"use client";

import { useCallback, useEffect, useState } from "react";
import {
	DEFAULT_TRADE_SORT,
	type SortField,
	type TradeSort,
} from "@/lib/constants";
import { api } from "@/trpc/react";

export function useTradeSort() {
	const [sort, setSort] = useState<TradeSort>(DEFAULT_TRADE_SORT);
	const [isLoaded, setIsLoaded] = useState(false);

	const { data: settings, isLoading } = api.settings.get.useQuery();
	const updateSettings = api.settings.update.useMutation();

	// Load sort from settings
	useEffect(() => {
		if (isLoaded) return;
		if (isLoading) return;

		if (settings?.tradeLogSort) {
			try {
				const savedSort = JSON.parse(settings.tradeLogSort) as TradeSort;
				setSort(savedSort);
			} catch {
				setSort(DEFAULT_TRADE_SORT);
			}
		}
		setIsLoaded(true);
	}, [settings, isLoading, isLoaded]);

	const toggleSort = useCallback(
		(columnId: string) => {
			const newSort: TradeSort =
				sort.field === columnId
					? {
							field: columnId as SortField,
							direction: sort.direction === "asc" ? "desc" : "asc",
						}
					: { field: columnId as SortField, direction: "desc" };

			setSort(newSort);
			updateSettings.mutate({ tradeLogSort: JSON.stringify(newSort) });
		},
		[sort, updateSettings],
	);

	const resetSort = useCallback(() => {
		setSort(DEFAULT_TRADE_SORT);
		updateSettings.mutate({ tradeLogSort: JSON.stringify(DEFAULT_TRADE_SORT) });
	}, [updateSettings]);

	return {
		sort,
		toggleSort,
		resetSort,
		isLoading: !isLoaded || isLoading,
	};
}
