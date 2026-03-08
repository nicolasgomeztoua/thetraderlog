import { PLAN_FREE, PLAN_PRO, PLAN_STARTER } from "@/lib/constants/billing";

/**
 * Returns the time until midnight UTC as a human-readable label.
 * Shows hours when >= 1h, otherwise shows minutes.
 */
export function getTimeUntilMidnightUTC(): string {
	const now = new Date();
	const midnight = new Date(now);
	midnight.setUTCDate(midnight.getUTCDate() + 1);
	midnight.setUTCHours(0, 0, 0, 0);
	const diffMs = midnight.getTime() - now.getTime();
	const diffMinutes = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
	if (diffMinutes >= 60) {
		return `${Math.ceil(diffMinutes / 60)}h`;
	}
	return `${diffMinutes}m`;
}

/**
 * Returns a formatted string for the next month's first day (e.g., "Jan 1").
 */
export function getNextMonthResetDate(): string {
	const now = new Date();
	const nextMonth = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
	);
	return nextMonth.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

/**
 * Minimal interface for checking beta status from Clerk user metadata.
 * Works with Clerk's currentUser() or session claims.
 */
export interface UserWithMetadata {
	publicMetadata?: Record<string, unknown>;
}

/**
 * Minimal interface for Clerk's auth object (server-side).
 * Accepts any object with a has() method matching Clerk's signature.
 */
interface AuthWithHas {
	has: (params: {
		feature?: string;
		plan?: string;
		permission?: string;
		role?: string;
	}) => boolean;
}

/**
 * Checks if a user has beta access via Clerk publicMetadata.
 * Beta users get full Pro access without a subscription.
 */
export function isBetaUser(user: UserWithMetadata): boolean {
	return user.publicMetadata?.beta === true;
}

/**
 * Checks if the auth session has access to a specific feature.
 * Beta users bypass the check and always have access.
 */
export function hasFeatureAccess(
	auth: AuthWithHas,
	feature: string,
	user?: UserWithMetadata,
): boolean {
	if (user && isBetaUser(user)) {
		return true;
	}
	return auth.has({ feature });
}

/**
 * Checks if the auth session has access to a specific plan.
 * Beta users bypass the check and always have access.
 */
export function hasPlanAccess(
	auth: AuthWithHas,
	plan: string,
	user?: UserWithMetadata,
): boolean {
	if (user && isBetaUser(user)) {
		return true;
	}
	return auth.has({ plan });
}

/**
 * Returns the effective plan slug for a user.
 * Beta users are treated as Pro regardless of their actual subscription.
 */
export function getEffectivePlan(
	auth: AuthWithHas,
	user?: UserWithMetadata,
): string {
	if (user && isBetaUser(user)) {
		return PLAN_PRO;
	}

	if (auth.has({ plan: PLAN_PRO })) {
		return PLAN_PRO;
	}

	if (auth.has({ plan: PLAN_STARTER })) {
		return PLAN_STARTER;
	}

	return PLAN_FREE;
}
