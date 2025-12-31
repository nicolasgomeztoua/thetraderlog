"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";

interface UseImportProgressOptions {
	/** Trade IDs to track */
	tradeIds: number[] | null;
	/** Called when processing completes */
	onComplete?: () => void;
}

/**
 * Hook to track import processing progress and display a persistent toast
 *
 * Usage:
 * ```tsx
 * const { isProcessing, progress } = useImportProgress({
 *   tradeIds: importedTradeIds,
 *   onComplete: () => console.log("Done!"),
 * });
 * ```
 */
export function useImportProgress({
	tradeIds,
	onComplete,
}: UseImportProgressOptions) {
	const toastIdRef = useRef<string | number | null>(null);
	const hasCompletedRef = useRef(false);

	// Only poll if we have trade IDs to track
	const shouldPoll = Boolean(
		tradeIds && tradeIds.length > 0 && !hasCompletedRef.current,
	);

	const { data, isLoading } = api.trades.getImportProgress.useQuery(
		{ tradeIds: tradeIds ?? [] },
		{
			enabled: shouldPoll,
			refetchInterval: (query) => {
				// Stop polling when complete
				if (query.state.data?.isComplete) {
					return false;
				}
				return 2000; // Poll every 2 seconds
			},
		},
	);

	// Handle toast updates
	useEffect(() => {
		if (!shouldPoll) return;

		// Show initial toast
		if (!toastIdRef.current && tradeIds && tradeIds.length > 0) {
			toastIdRef.current = toast.loading("Processing market data...", {
				description: `0/${tradeIds.length} trades`,
				duration: Infinity, // Keep visible until dismissed
			});
		}

		// Update toast with progress
		if (data && toastIdRef.current) {
			if (data.isComplete) {
				// Complete - show success and dismiss
				toast.success("Market data processed!", {
					id: toastIdRef.current,
					description: `${data.processed}/${data.total} trades analyzed`,
					duration: 4000,
				});
				toastIdRef.current = null;
				hasCompletedRef.current = true;
				onComplete?.();
			} else {
				// Still processing - update progress
				toast.loading("Processing market data...", {
					id: toastIdRef.current,
					description: `${data.processed}/${data.total} trades (${data.progress}%)`,
				});
			}
		}
	}, [data, shouldPoll, tradeIds, onComplete]);

	// Cleanup toast on unmount if still processing
	useEffect(() => {
		return () => {
			// Don't dismiss on unmount - we want it to persist across navigation
			// The toast will auto-dismiss when processing completes
		};
	}, []);

	return {
		isProcessing: shouldPoll && !data?.isComplete,
		isComplete: data?.isComplete ?? false,
		progress: data?.progress ?? 0,
		processed: data?.processed ?? 0,
		total: data?.total ?? tradeIds?.length ?? 0,
		isLoading,
	};
}
