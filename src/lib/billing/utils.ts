import { PLAN_PRO } from "@/lib/constants/billing";

/**
 * Minimal interface for checking beta status from Clerk user metadata.
 * Works with Clerk's currentUser() or session claims.
 */
interface UserWithMetadata {
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

	if (auth.has({ plan: "starter" })) {
		return "starter";
	}

	return "free";
}
