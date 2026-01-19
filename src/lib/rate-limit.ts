import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/env";
import { MAX_VOTES_PER_HOUR } from "@/lib/constants/marketplace";

/**
 * Check if Upstash Redis rate limiting is configured
 */
export function isRateLimitConfigured(): boolean {
	return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/**
 * Create an Upstash Redis client for rate limiting
 * Returns null if not configured
 */
function createRedisClient(): Redis | null {
	if (!isRateLimitConfigured()) {
		return null;
	}

	// Safe to use nullish coalescing since isRateLimitConfigured checks for presence
	return new Redis({
		url: env.UPSTASH_REDIS_REST_URL ?? "",
		token: env.UPSTASH_REDIS_REST_TOKEN ?? "",
	});
}

/**
 * Vote rate limiter: Max votes per user per hour
 * Uses sliding window algorithm for smooth rate limiting
 */
export function createVoteRateLimiter(): Ratelimit | null {
	const redis = createRedisClient();
	if (!redis) {
		return null;
	}

	return new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(MAX_VOTES_PER_HOUR, "1 h"),
		prefix: "ratelimit:vote",
		analytics: true,
	});
}

/**
 * Check if a user can vote based on rate limits
 * Returns { success: true, remaining: number } if allowed
 * Returns { success: false, remaining: 0, reset: number } if rate limited
 * Returns { success: true } with no rate limiting if Upstash is not configured
 */
export async function checkVoteRateLimit(
	userId: string,
): Promise<{ success: boolean; remaining?: number; reset?: number }> {
	const rateLimiter = createVoteRateLimiter();

	// If rate limiting is not configured, allow all votes
	if (!rateLimiter) {
		return { success: true };
	}

	const result = await rateLimiter.limit(userId);

	return {
		success: result.success,
		remaining: result.remaining,
		reset: result.success ? undefined : result.reset,
	};
}
