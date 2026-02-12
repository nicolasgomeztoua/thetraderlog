"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { api } from "@/trpc/react";

interface ImportProgressContextType {
	startTracking: (tradeIds: string[]) => void;
	isProcessing: boolean;
}

const ImportProgressContext = createContext<
	ImportProgressContextType | undefined
>(undefined);

export function ImportProgressProvider({ children }: { children: ReactNode }) {
	const [tradeIds, setTradeIds] = useState<string[] | null>(null);
	const toastIdRef = useRef<string | number | null>(null);
	const hasCompletedRef = useRef(false);

	const shouldPoll = Boolean(
		tradeIds && tradeIds.length > 0 && !hasCompletedRef.current,
	);

	const { data } = api.trades.getImportProgress.useQuery(
		{ tradeIds: tradeIds ?? [] },
		{
			enabled: shouldPoll,
			refetchInterval: (query) => {
				if (query.state.data?.isComplete) {
					return false;
				}
				return 2000;
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
				duration: Number.POSITIVE_INFINITY,
			});
		}

		// Update toast with progress
		if (data && toastIdRef.current) {
			if (data.isComplete) {
				toast.success("Market data processed!", {
					id: toastIdRef.current,
					description: `${data.processed}/${data.total} trades analyzed`,
					duration: 4000,
				});
				toastIdRef.current = null;
				hasCompletedRef.current = true;
				setTradeIds(null);
			} else {
				toast.loading("Processing market data...", {
					id: toastIdRef.current,
					description: `${data.processed}/${data.total} trades (${data.progress}%)`,
				});
			}
		}
	}, [data, shouldPoll, tradeIds]);

	const startTracking = useCallback((ids: string[]) => {
		hasCompletedRef.current = false;
		toastIdRef.current = null;
		setTradeIds(ids);
	}, []);

	return (
		<ImportProgressContext.Provider
			value={{
				startTracking,
				isProcessing: shouldPoll && !data?.isComplete,
			}}
		>
			{children}
		</ImportProgressContext.Provider>
	);
}

export function useImportProgressContext() {
	const context = useContext(ImportProgressContext);
	if (context === undefined) {
		throw new Error(
			"useImportProgressContext must be used within an ImportProgressProvider",
		);
	}
	return context;
}
