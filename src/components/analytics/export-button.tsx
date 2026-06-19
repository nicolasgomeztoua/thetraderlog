"use client";

import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import {
	UpgradeButtonCompact,
	useHasFeature,
} from "@/components/billing/upgrade-prompt";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/contexts/account-context";
import { FEATURE_CSV_IMPORT_EXPORT } from "@/lib/constants/billing";
import { type ExportableTrade, exportTradesToCSV } from "@/lib/ui";
import { useAnalyticsFilterStore } from "@/stores/analytics-filter-store";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface ExportButtonProps {
	/** Optional additional className */
	className?: string;
}

// =============================================================================
// HELPER: Convert store filters to API format
// =============================================================================

function useApiFilters() {
	const filters = useAnalyticsFilterStore((s) => s.filters);

	return {
		symbols: filters.symbols.length > 0 ? filters.symbols : undefined,
		dateRange:
			filters.dateRange.start || filters.dateRange.end
				? {
						start: filters.dateRange.start?.toISOString() ?? null,
						end: filters.dateRange.end?.toISOString() ?? null,
					}
				: undefined,
		daysOfWeek: filters.daysOfWeek.length > 0 ? filters.daysOfWeek : undefined,
		hours: filters.hours.length > 0 ? filters.hours : undefined,
		sessions: filters.sessions.length > 0 ? filters.sessions : undefined,
		strategies: filters.strategies.length > 0 ? filters.strategies : undefined,
		tags: filters.tags.length > 0 ? filters.tags : undefined,
		rMultipleRange:
			filters.rMultipleRange.min !== null || filters.rMultipleRange.max !== null
				? filters.rMultipleRange
				: undefined,
		positionSizeRange:
			filters.positionSizeRange.min !== null ||
			filters.positionSizeRange.max !== null
				? filters.positionSizeRange
				: undefined,
		outcome: filters.outcome !== "all" ? filters.outcome : undefined,
		reviewed: filters.reviewed !== "all" ? filters.reviewed : undefined,
	};
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ExportButton({ className }: ExportButtonProps) {
	const [isExporting, setIsExporting] = useState(false);
	const { hasAccess: hasExport } = useHasFeature(FEATURE_CSV_IMPORT_EXPORT);
	const { selectedAccountId } = useAccount();
	const hasActiveFilters = useAnalyticsFilterStore((s) => s.hasActiveFilters());
	const apiFilters = useApiFilters();

	const utils = api.useUtils();

	const handleExportTrades = async () => {
		setIsExporting(true);

		try {
			// Fetch the filtered trades data
			const data = await utils.analytics.exportFilteredTrades.fetch({
				accountId: selectedAccountId,
				filters: apiFilters,
			});

			if (!data || data.length === 0) {
				// No trades to export
				setIsExporting(false);
				return;
			}

			// Transform data to exportable format
			const exportableData: ExportableTrade[] = data.map((trade) => ({
				exitTime: trade.exitTime,
				entryTime: trade.entryTime,
				symbol: trade.symbol,
				direction: trade.direction,
				quantity: trade.quantity,
				entryPrice: trade.entryPrice,
				exitPrice: trade.exitPrice,
				realizedPnl: trade.realizedPnl,
				netPnl: trade.netPnl,
				fees: trade.fees,
				rMultiple: trade.rMultiple,
				durationMinutes: trade.durationMinutes,
				strategyName: trade.strategyName,
				tags: trade.tags,
				rating: trade.rating,
				isReviewed: trade.isReviewed,
				notes: trade.notes,
			}));

			// Export to CSV
			exportTradesToCSV(exportableData, hasActiveFilters);
		} catch (error) {
			console.error("Failed to export trades:", error);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					className={`relative font-mono ${className ?? ""}`}
					disabled={isExporting}
					size="sm"
					variant="outline"
				>
					{isExporting ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Download className="size-4" />
					)}
					<span>Export</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="font-mono">
				{hasExport ? (
					<DropdownMenuItem
						className="cursor-pointer"
						disabled={isExporting}
						onClick={handleExportTrades}
					>
						<FileSpreadsheet className="mr-2 size-4" />
						<span>Export Filtered Trades (CSV)</span>
					</DropdownMenuItem>
				) : (
					<div className="p-1">
						<UpgradeButtonCompact feature={FEATURE_CSV_IMPORT_EXPORT} />
					</div>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
