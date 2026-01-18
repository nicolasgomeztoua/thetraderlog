/**
 * Shared marketplace utilities
 * Used across backend routers and frontend components
 */

import {
	LIMITED_DATA_THRESHOLD,
	VERIFIED_TRACK_RECORD_THRESHOLD,
} from "@/lib/constants";

/** Track record status based on trade count */
export type TrackRecordStatus = "limited" | "normal" | "verified";

/**
 * Cached stats structure stored in strategy.cachedStats column
 * Also used in marketplace list and detail responses
 */
export interface CachedStats {
	totalTrades: number;
	wins: number;
	losses: number;
	winRate: number;
	profitFactor: number | null;
	avgR: number | null;
	avgWin: number;
	avgLoss: number;
	computedAt: string;
}

/**
 * Determine track record status based on total trades
 * @param totalTrades - Number of closed trades for the strategy
 * @returns Track record status: "verified" (100+), "normal" (30-99), or "limited" (<30)
 */
export function getTrackRecordStatus(totalTrades: number): TrackRecordStatus {
	if (totalTrades >= VERIFIED_TRACK_RECORD_THRESHOLD) {
		return "verified";
	}
	if (totalTrades < LIMITED_DATA_THRESHOLD) {
		return "limited";
	}
	return "normal";
}

/**
 * Parse cached stats JSON safely
 * @param cachedStatsJson - JSON string from database or null
 * @returns Parsed CachedStats object or null if invalid/missing
 */
export function parseCachedStats(
	cachedStatsJson: string | null,
): CachedStats | null {
	if (!cachedStatsJson) return null;
	try {
		return JSON.parse(cachedStatsJson) as CachedStats;
	} catch {
		return null;
	}
}
