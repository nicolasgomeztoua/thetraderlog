/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/server/db";
import type { Database } from "@/server/db/create-db";
import type { User } from "@/server/db/schema";
import { users } from "@/server/db/schema";

/**
 * Context overrides for testing.
 * Allows injecting a test database and bypassing Clerk authentication.
 */
export interface TRPCContextOverrides {
	/** Test database connection (from Testcontainers) */
	db?: Database;
	/** Mock user ID (bypasses Clerk auth) */
	userId?: string | null;
	/** Pre-created user object (skips database lookup in authMiddleware) */
	user?: User;
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
// E2E test mode - bypasses Clerk auth with a fixed test user ID
const isE2ETestMode =
	process.env.E2E_TEST_MODE === "true" && process.env.NODE_ENV !== "production";
const E2E_TEST_USER_ID = "e2e-test-user";

export const createTRPCContext = async (
	opts: { headers: Headers },
	overrides?: TRPCContextOverrides,
) => {
	// Use overrides for testing, or fetch from Clerk for production
	const resolvedDb = overrides?.db ?? db;

	// Determine userId: overrides > E2E test mode > Clerk auth
	let resolvedUserId: string | null;
	if (overrides?.userId !== undefined) {
		resolvedUserId = overrides.userId;
	} else if (isE2ETestMode) {
		resolvedUserId = E2E_TEST_USER_ID;
	} else {
		resolvedUserId = (await auth()).userId;
	}

	return {
		db: resolvedDb,
		userId: resolvedUserId,
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
		// In test/E2E environment, create a simple test user without Clerk
		if (process.env.NODE_ENV === "test" || isE2ETestMode) {
			// Use upsert to handle race conditions when multiple tests run in parallel
			const [newUser] = await ctx.db
				.insert(users)
				.values({
					clerkId: ctx.userId,
					email: `test-${ctx.userId}@test.local`,
					name: "E2E Test User",
					role: "user",
				})
				.onConflictDoNothing({ target: users.clerkId })
				.returning();

			// If onConflictDoNothing returned nothing, fetch the existing user
			if (!newUser) {
				user = await ctx.db.query.users.findFirst({
					where: eq(users.clerkId, ctx.userId),
				});
			} else {
				user = newUser;
			}
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
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * This procedure requires the user to be authenticated and will fetch the user from the database.
 * Use this for any operation that requires a logged-in user.
 */
export const protectedProcedure = t.procedure
	.use(timingMiddleware)
	.use(authMiddleware);
