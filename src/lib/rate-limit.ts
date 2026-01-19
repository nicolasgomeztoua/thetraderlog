/**
 * Simple in-memory rate limiter.
 *
 * Uses a sliding window approach with configurable limits.
 * Note: This is process-scoped (won't work across multiple server instances).
 * For production at scale, use Redis-based rate limiting.
 */

// Rate limit window entry: timestamp when the action occurred
type WindowEntry = number;

// Store: Map of key -> array of timestamps
const rateLimitStore = new Map<string, WindowEntry[]>();

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
let lastCleanup = Date.now();

function cleanupOldEntries(windowMs: number) {
	const now = Date.now();
	if (now - lastCleanup < CLEANUP_INTERVAL) return;

	lastCleanup = now;
	const cutoff = now - windowMs;

	for (const [key, timestamps] of rateLimitStore.entries()) {
		// Remove timestamps outside the window
		const filtered = timestamps.filter((t) => t > cutoff);
		if (filtered.length === 0) {
			rateLimitStore.delete(key);
		} else {
			rateLimitStore.set(key, filtered);
		}
	}
}

export interface RateLimitResult {
	success: boolean;
	remaining: number;
	resetAt: Date;
}

export interface RateLimitOptions {
	/** Maximum number of requests allowed in the window */
	limit: number;
	/** Window duration in milliseconds */
	windowMs: number;
}

/**
 * Check if a request is rate limited.
 *
 * @param key - Unique identifier (e.g., `vote:${userId}`)
 * @param options - Rate limit configuration
 * @returns Whether the request is allowed and remaining quota
 *
 * @example
 * ```ts
 * const result = checkRateLimit(`vote:${userId}`, { limit: 30, windowMs: 60000 });
 * if (!result.success) {
 *   throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Slow down!' });
 * }
 * ```
 */
export function checkRateLimit(
	key: string,
	options: RateLimitOptions,
): RateLimitResult {
	const { limit, windowMs } = options;
	const now = Date.now();
	const windowStart = now - windowMs;

	// Cleanup old entries occasionally
	cleanupOldEntries(windowMs);

	// Get existing timestamps for this key
	const timestamps = rateLimitStore.get(key) ?? [];

	// Filter to only include timestamps within the window
	const recentTimestamps = timestamps.filter((t) => t > windowStart);

	// Check if limit exceeded
	if (recentTimestamps.length >= limit) {
		// Find when the oldest entry will expire
		const oldestInWindow = Math.min(...recentTimestamps);
		const resetAt = new Date(oldestInWindow + windowMs);

		return {
			success: false,
			remaining: 0,
			resetAt,
		};
	}

	// Add the current timestamp
	recentTimestamps.push(now);
	rateLimitStore.set(key, recentTimestamps);

	return {
		success: true,
		remaining: limit - recentTimestamps.length,
		resetAt: new Date(now + windowMs),
	};
}

/**
 * Rate limit constants for different actions.
 */
export const RATE_LIMITS = {
	/** Votes: 30 per minute per user */
	VOTES: {
		limit: 30,
		windowMs: 60 * 1000, // 1 minute
	},
} as const;
