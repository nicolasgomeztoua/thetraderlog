"use client";

import { useMemo } from "react";
import { toDateString } from "@/lib/shared";
import { api } from "@/trpc/react";

/**
 * Suggested actions based on the user's current trading context.
 * - start-journal: User traded today but hasn't started journaling
 * - review-trades: User has trades needing review
 * - log-trade: User hasn't traded today - prompt to log trades
 * - idle: No immediate action suggested
 */
export type SuggestedAction =
	| "start-journal"
	| "review-trades"
	| "log-trade"
	| "idle";

export interface TradingContext {
	/** Whether the user has any open positions */
	hasOpenPositions: boolean;
	/** Whether the user has made any trades today */
	tradedToday: boolean;
	/** Whether the user has started journaling today */
	journaledToday: boolean;
	/** The time of the user's last trade, or null if no trades */
	lastTradeTime: Date | null;
	/** Suggested action based on current context */
	suggestedAction: SuggestedAction;
	/** Whether the context is still loading */
	isLoading: boolean;
}

/**
 * Hook that determines the user's trading context based on their actual activity.
 * Used by the Command Center dashboard to adapt its layout and emphasis.
 *
 * @returns Trading context including suggested action based on activity
 */
export function useTradingContext(): TradingContext {
	const today = toDateString(new Date());

	// Get today's journal and trades
	// This query returns journal + all trades for the day, giving us everything we need
	const { data: journalData, isLoading } =
		api.dailyJournal.getWithTrades.useQuery(
			{ date: today },
			{ staleTime: 30000 },
		);

	const context = useMemo<TradingContext>(() => {
		// Default context while loading
		if (isLoading || !journalData) {
			return {
				hasOpenPositions: false,
				tradedToday: false,
				journaledToday: false,
				lastTradeTime: null,
				suggestedAction: "idle",
				isLoading: true,
			};
		}

		const { journal, trades } = journalData;

		// Check if user has open positions
		// Open trades are those without an exitTime or with status 'open'
		const openTrades = trades.filter(
			(trade) => !trade.exitTime || trade.status === "open",
		);
		const hasOpenPositions = openTrades.length > 0;

		// Check if user traded today (any trades, open or closed)
		const tradedToday = trades.length > 0;

		// Check if user has started journaling today
		// journaledToday is true if dayStartedAt is set OR if there's content
		const journaledToday =
			journal?.dayStartedAt !== null ||
			(journal?.content !== null && journal.content.trim() !== "");

		// Get the last trade time
		const lastTradeTime = tradedToday
			? trades.reduce<Date | null>((latest, trade) => {
					const tradeTime = new Date(trade.entryTime);
					return !latest || tradeTime > latest ? tradeTime : latest;
				}, null)
			: null;

		// Determine suggested action
		let suggestedAction: SuggestedAction = "idle";

		if (hasOpenPositions) {
			// If user has open positions, suggest reviewing them
			suggestedAction = "review-trades";
		} else if (tradedToday && !journaledToday) {
			// If traded today but hasn't started journal, suggest starting
			suggestedAction = "start-journal";
		} else if (!tradedToday) {
			// If no trades today, suggest logging a trade
			suggestedAction = "log-trade";
		}
		// Otherwise, idle - user has traded and journaled

		return {
			hasOpenPositions,
			tradedToday,
			journaledToday,
			lastTradeTime,
			suggestedAction,
			isLoading: false,
		};
	}, [isLoading, journalData]);

	return context;
}
