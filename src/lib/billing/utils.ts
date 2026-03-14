import { PLAN_FREE, PLAN_PRO, PLAN_STARTER } from "@/lib/constants/billing";

/**
 * Returns the time until midnight UTC as a human-readable label.
 * Shows hours + minutes when >= 1h, otherwise shows minutes only.
 */
export function getTimeUntilMidnightUTC(): string {
	const now = new Date();
	const midnight = new Date(now);
	midnight.setUTCDate(midnight.getUTCDate() + 1);
	midnight.setUTCHours(0, 0, 0, 0);
	const diffMs = midnight.getTime() - now.getTime();
	const totalMinutes = Math.max(1, Math.ceil(diffMs / (1000 * 60)));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours >= 1) {
		return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	}
	return `${totalMinutes}m`;
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
 * Minimal interface for Clerk's auth object (server-side or client-side).
 * Accepts any object with a has() method matching Clerk's signature.
 * sessionClaims.metadata carries publicMetadata for beta detection.
 */
export interface AuthWithHas {
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

/**
 * Checks if the given publicMetadata object has beta access enabled.
 * Works with both server-side sessionClaims.metadata and client-side user.publicMetadata.
 */
export function isBetaFromMetadata(
	metadata: Record<string, unknown> | undefined | null,
): boolean {
	if (!metadata || typeof metadata !== "object") return false;
	const features = metadata.features;
	if (!features || typeof features !== "object") return false;
	return (features as Record<string, unknown>).beta_access === true;
}

/**
 * Checks if the auth session has beta access via publicMetadata (sessionClaims.metadata).
 * Beta users get full Pro access without a subscription.
 */
export function isBetaAuth(auth: AuthWithHas): boolean {
	return isBetaFromMetadata(auth.sessionClaims?.metadata);
}

/**
 * Checks if the auth session has access to a specific feature.
 * Beta users bypass the check and always have access.
 */
export function hasFeatureAccess(auth: AuthWithHas, feature: string): boolean {
	if (isBetaAuth(auth)) {
		return true;
	}
	return auth.has({ feature });
}

/**
 * Checks if the auth session has access to a specific plan.
 * Beta users bypass the check and always have access.
 */
export function hasPlanAccess(auth: AuthWithHas, plan: string): boolean {
	if (isBetaAuth(auth)) {
		return true;
	}
	return auth.has({ plan });
}

/**
 * Returns the effective plan slug for a user.
 * Beta users are treated as Pro regardless of their actual subscription.
 */
export function getEffectivePlan(auth: AuthWithHas): string {
	if (isBetaAuth(auth)) {
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
