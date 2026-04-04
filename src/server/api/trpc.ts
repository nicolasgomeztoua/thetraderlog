/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";
import { hasFeatureAccess, hasPlanAccess } from "@/lib/billing/utils";
import {
	ERR_ADMIN_FORBIDDEN,
	ERR_FEATURE_NOT_AVAILABLE,
	ERR_PLAN_REQUIRED,
} from "@/lib/constants/errors";
import { logger } from "@/lib/logger";
import { db } from "@/server/db";
import type { Database } from "@/server/db/create-db";
import type { User } from "@/server/db/schema";
import { users } from "@/server/db/schema";

/**
 * Context overrides for testing.
 * Allows injecting a test database and bypassing Clerk authentication.
 */
export interface ClerkAuthLike {
	has: (params: {
		feature?: string;
		plan?: string;
		permission?: string;
		role?: string;
	}) => boolean;
	sessionClaims?: {
		metadata?: Record<string, unknown>;
	};
}

export interface TRPCContextOverrides {
	/** Test database connection (from Testcontainers) */
	db?: Database;
	/** Mock user ID (bypasses Clerk auth) */
	userId?: string | null;
	/** Pre-created user object (skips database lookup in authMiddleware) */
	user?: User;
	/** Mock Clerk auth object for entitlement checks in tests */
	clerkAuth?: ClerkAuthLike;
}

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (
	opts: { headers: Headers },
	overrides?: TRPCContextOverrides,
) => {
	// Use overrides for testing, or fetch from Clerk for production
	const resolvedDb = overrides?.db ?? db;

	// In test environment with userId override, skip Clerk auth() call entirely
	const clerkAuthSession =
		overrides?.clerkAuth ??
		(overrides?.userId !== undefined ? null : await auth());
	const resolvedUserId =
		overrides?.userId !== undefined
			? overrides.userId
			: ((clerkAuthSession as Awaited<ReturnType<typeof auth>> | null)
					?.userId ?? null);

	return {
		db: resolvedDb,
		userId: resolvedUserId,
		clerkAuth: clerkAuthSession ? (clerkAuthSession as ClerkAuthLike) : null,
		// Pass along the pre-created user for tests (if provided)
		_testUser: overrides?.user,
		...opts,
	};
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next }) => {
	// Skip artificial delay in test environment
	if (t._config.isDev && process.env.NODE_ENV !== "test") {
		// artificial delay in dev
		const waitMs = Math.floor(Math.random() * 400) + 100;
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}

	return next();
});

/**
 * Sentry middleware — sets user context and captures unhandled procedure errors.
 * Wraps every procedure so Sentry Issues include userId, email, and procedure path.
 * Intentional TRPCErrors (NOT_FOUND, UNAUTHORIZED) are NOT reported — only unexpected crashes.
 */
const sentryMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
	return Sentry.withScope(async (scope) => {
		scope.setTag("trpc.path", path);
		scope.setTag("trpc.type", type);

		try {
			const result = await next();
			return result;
		} catch (error) {
			// Only report unexpected errors — not intentional TRPCErrors from business logic
			const isIntentional =
				error instanceof TRPCError &&
				[
					"BAD_REQUEST",
					"UNAUTHORIZED",
					"FORBIDDEN",
					"NOT_FOUND",
					"CONFLICT",
					"PRECONDITION_FAILED",
					"PARSE_ERROR",
				].includes(error.code);

			if (!isIntentional) {
				logger.error("tRPC procedure failed", error, {
					path,
					type,
					userId: ctx.userId,
				});
			}

			throw error;
		}
	});
});

/**
 * Auth middleware - ensures user is authenticated and syncs user to DB if needed
 */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
	if (!ctx.userId) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	// If a test user was pre-created and passed in, use it directly
	if (ctx._testUser) {
		return next({
			ctx: {
				...ctx,
				user: ctx._testUser,
			},
		});
	}

	// Try to find user in database
	let user = await ctx.db.query.users.findFirst({
		where: eq(users.clerkId, ctx.userId),
	});

	// If user doesn't exist, create them (auto-sync on first login)
	if (!user) {
		// In test environment, create a simple test user without Clerk
		if (process.env.NODE_ENV === "test") {
			const [newUser] = await ctx.db
				.insert(users)
				.values({
					clerkId: ctx.userId,
					email: `test-${ctx.userId}@test.local`,
					name: "Test User",
					role: "user",
				})
				.returning();

			user = newUser;
		} else {
			// Production: fetch user data from Clerk
			const clerkUser = await currentUser();

			if (!clerkUser) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "Could not fetch user data from Clerk",
				});
			}

			const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
			const name =
				[clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
				null;

			const [newUser] = await ctx.db
				.insert(users)
				.values({
					clerkId: ctx.userId,
					email,
					name,
					imageUrl: clerkUser.imageUrl,
					role: "user",
				})
				.returning();

			user = newUser;
		}
	}

	if (!user) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Failed to create or find user",
		});
	}

	// Set Sentry user context so all errors/logs are attributed to this user
	Sentry.setUser({ id: user.clerkId, email: user.email });

	return next({
		ctx: {
			...ctx,
			user,
		},
	});
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure
	.use(timingMiddleware)
	.use(sentryMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * This procedure requires the user to be authenticated and will fetch the user from the database.
 * Use this for any operation that requires a logged-in user.
 */
export const protectedProcedure = t.procedure
	.use(timingMiddleware)
	.use(sentryMiddleware)
	.use(authMiddleware);

/**
 * Admin procedure
 *
 * This procedure requires the user to be authenticated AND have the admin role.
 * Use this for all admin panel endpoints.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
	if (ctx.user.role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: ERR_ADMIN_FORBIDDEN,
		});
	}
	return next({ ctx });
});

/**
 * Middleware factory: requires a specific feature entitlement.
 * Uses Clerk's has() with beta user bypass.
 * If no clerkAuth is available (e.g., tests without mock), access is denied.
 */
export const requireFeature = (feature: string) =>
	protectedProcedure.use(async ({ ctx, next }) => {
		if (!ctx.clerkAuth) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: ERR_FEATURE_NOT_AVAILABLE,
			});
		}
		if (!hasFeatureAccess(ctx.clerkAuth, feature)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: ERR_FEATURE_NOT_AVAILABLE,
			});
		}
		return next({ ctx });
	});

/**
 * Middleware factory: requires a specific plan entitlement.
 * Uses Clerk's has() with beta user bypass.
 * If no clerkAuth is available (e.g., tests without mock), access is denied.
 */
export const requirePlan = (plan: string) =>
	protectedProcedure.use(async ({ ctx, next }) => {
		if (!ctx.clerkAuth) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: ERR_PLAN_REQUIRED,
			});
		}
		if (!hasPlanAccess(ctx.clerkAuth, plan)) {
			throw new TRPCError({
				code: "FORBIDDEN",
				message: ERR_PLAN_REQUIRED,
			});
		}
		return next({ ctx });
	});
