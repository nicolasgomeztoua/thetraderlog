"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/trpc/react";

export interface TradeColumn {
	id: string;
	label: string;
	visible: boolean;
	order: number;
	width?: number;
}

const DEFAULT_COLUMNS: TradeColumn[] = [
	{ id: "checkbox", label: "", visible: true, order: 0 },
	{ id: "symbol", label: "Symbol", visible: true, order: 1 },
	{ id: "side", label: "Side", visible: true, order: 2 },
	{ id: "entry", label: "Entry", visible: true, order: 3 },
	{ id: "exit", label: "Exit", visible: true, order: 4 },
	{ id: "size", label: "Size", visible: true, order: 5 },
	{ id: "pnl", label: "P&L", visible: true, order: 6 },
	{ id: "result", label: "Result", visible: true, order: 7 },
	{ id: "rating", label: "Rating", visible: true, order: 8 },
	{ id: "reviewed", label: "Reviewed", visible: true, order: 9 },
	{ id: "setup", label: "Setup", visible: false, order: 10 },
	{ id: "fees", label: "Fees", visible: false, order: 11 },
	{ id: "duration", label: "Duration", visible: false, order: 12 },
	{ id: "rMultiple", label: "R-Multiple", visible: false, order: 13 },
	{ id: "tags", label: "Tags", visible: false, order: 14 },
	{ id: "account", label: "Account", visible: false, order: 15 },
	{ id: "strategy", label: "Strategy", visible: false, order: 16 },
	{ id: "actions", label: "", visible: true, order: 99 },
];

export function useTradeColumns() {
	const [columns, setColumns] = useState<TradeColumn[]>(DEFAULT_COLUMNS);
	const [isLoaded, setIsLoaded] = useState(false);

	const { data: settings, isLoading } = api.settings.get.useQuery();
	const updateSettings = api.settings.update.useMutation();

	// Load columns from settings
	useEffect(() => {
		// Already loaded, skip
		if (isLoaded) return;

		// Still loading settings, wait
		if (isLoading) return;

		// Settings loaded - either use saved columns or defaults
		if (settings?.tradeLogColumns) {
			try {
				const savedColumns = JSON.parse(
					settings.tradeLogColumns,
				) as TradeColumn[];
				// Merge with defaults to handle new columns
				const mergedColumns = DEFAULT_COLUMNS.map((defaultCol) => {
					const saved = savedColumns.find((s) => s.id === defaultCol.id);
					return saved ? { ...defaultCol, ...saved } : defaultCol;
				});
				setColumns(mergedColumns.sort((a, b) => a.order - b.order));
			} catch {
				setColumns(DEFAULT_COLUMNS);
			}
		}
		// Mark as loaded regardless of whether we found saved columns
		setIsLoaded(true);
	}, [settings, isLoading, isLoaded]);

	const toggleColumn = useCallback(
		(columnId: string) => {
			const newColumns = columns.map((col) =>
				col.id === columnId ? { ...col, visible: !col.visible } : col,
			);
			setColumns(newColumns);
			updateSettings.mutate({
				tradeLogColumns: JSON.stringify(newColumns),
			});
		},
		[columns, updateSettings],
	);

	const reorderColumns = useCallback(
		(fromIndex: number, toIndex: number) => {
			const reordered = [...columns];
			const [removed] = reordered.splice(fromIndex, 1);
			if (removed) {
				reordered.splice(toIndex, 0, removed);
				// Update order values
				const withNewOrder = reordered.map((col, idx) => ({
					...col,
					order: idx,
				}));
				setColumns(withNewOrder);
				updateSettings.mutate({
					tradeLogColumns: JSON.stringify(withNewOrder),
				});
			}
		},
		[columns, updateSettings],
	);

	const resetColumns = useCallback(() => {
		setColumns(DEFAULT_COLUMNS);
		updateSettings.mutate({
			tradeLogColumns: JSON.stringify(DEFAULT_COLUMNS),
		});
	}, [updateSettings]);

	const visibleColumns = columns
		.filter((col) => col.visible)
		.sort((a, b) => a.order - b.order);

	return {
		columns,
		visibleColumns,
		toggleColumn,
		reorderColumns,
		resetColumns,
		isLoading: !isLoaded || isLoading,
	};
}
