"use client";

import { Lock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ERR_MARKET_DATA_REFRESH_FAILED } from "@/lib/constants/errors";
import { cn } from "@/lib/shared";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

// Trades per request. Each trade hits Databento (~5-10s) and the server fans
// out at MAEMFE_BATCH_CONCURRENCY (=2), so a chunk of 8 keeps every request well
// within the serverless budget while moving the progress toast along.
const CHUNK_SIZE = 8;

interface RefetchMarketDataButtonProps {
	/** Scope the pending set to the currently viewed account (undefined = all). */
	accountId: string | undefined;
	/** Whether the user can manage trades (gates the bulk refetch endpoint). */
	hasFeature: boolean;
}

/**
 * Header action for the trades page: refetch market data and recompute MAE/MFE
 * for every trade still pending (NULL or "pending" market-data quality). The
 * bulk counterpart of the single-trade "Re-fetch data" button — it chunks the
 * pending set through `trades.bulkRefreshMarketData` and shows one persistent
 * progress toast.
 */
export function RefetchMarketDataButton({
	accountId,
	hasFeature,
}: RefetchMarketDataButtonProps) {
	const utils = api.useUtils();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [isRefetching, setIsRefetching] = useState(false);

	const { data: pending } = api.trades.getPendingMarketDataTrades.useQuery(
		{ accountId },
		{ enabled: hasFeature },
	);
	const pendingIds = pending?.tradeIds ?? [];
	const pendingCount = pendingIds.length;
	// More pending trades exist than this run covers (server caps the set).
	const truncated = pending?.truncated ?? false;

	const bulkRefresh = api.trades.bulkRefreshMarketData.useMutation();

	if (!hasFeature) {
		return (
			<Button
				className="font-mono text-xs uppercase tracking-wider"
				disabled
				size="sm"
				title="Trade management is required to refetch market data"
				variant="outline"
			>
				<Lock className="mr-2 h-3.5 w-3.5" />
				Refetch Data
			</Button>
		);
	}

	const runRefetch = async () => {
		if (pendingCount === 0 || isRefetching) return;

		setIsRefetching(true);
		const total = pendingCount;
		const toastId = toast.loading("Refetching market data…", {
			description: `0/${total} trades`,
			duration: Number.POSITIVE_INFINITY,
		});

		const totals = { refreshed: 0, pending: 0, unavailable: 0 };
		let processed = 0;

		try {
			for (let i = 0; i < pendingIds.length; i += CHUNK_SIZE) {
				const chunk = pendingIds.slice(i, i + CHUNK_SIZE);
				const result = await bulkRefresh.mutateAsync({ tradeIds: chunk });
				totals.refreshed += result.refreshed;
				totals.pending += result.pending;
				totals.unavailable += result.unavailable;
				processed += chunk.length;

				toast.loading("Refetching market data…", {
					id: toastId,
					description: `${processed}/${total} trades (${Math.round(
						(processed / total) * 100,
					)}%)`,
				});
			}

			const parts = [`${totals.refreshed} refreshed`];
			if (totals.pending > 0) parts.push(`${totals.pending} awaiting data`);
			if (totals.unavailable > 0)
				parts.push(`${totals.unavailable} unavailable`);

			toast.success(
				truncated
					? "Refetched first 500 — run again for the rest"
					: "Market data refetched",
				{
					id: toastId,
					description: parts.join(" · "),
					duration: 5000,
				},
			);

			await Promise.all([
				utils.trades.getAll.invalidate(),
				utils.trades.getPendingMarketDataTrades.invalidate(),
				utils.marketData.getFullDayChartData.invalidate(),
				utils.marketData.getExtendedChartData.invalidate(),
			]);
		} catch (error) {
			// Trades processed before the failure are already persisted — tell the
			// user so they know a re-run only needs to finish the remainder.
			toast.error(getErrorMessage(error, ERR_MARKET_DATA_REFRESH_FAILED), {
				id: toastId,
				description:
					processed > 0
						? `Stopped after ${processed}/${total} — ${totals.refreshed} refreshed. Run again to finish the rest.`
						: undefined,
				duration: 5000,
			});
			await utils.trades.getAll.invalidate();
			await utils.trades.getPendingMarketDataTrades.invalidate();
		} finally {
			setIsRefetching(false);
		}
	};

	return (
		<>
			<Button
				className="font-mono text-xs uppercase tracking-wider"
				disabled={pendingCount === 0 || isRefetching}
				onClick={() => setDialogOpen(true)}
				size="sm"
				title={
					pendingCount === 0
						? "All trades have market data"
						: `Refetch market data for ${pendingCount} pending trade(s)`
				}
				variant="outline"
			>
				<RefreshCw
					className={cn("mr-2 h-3.5 w-3.5", isRefetching && "animate-spin")}
				/>
				{isRefetching ? "Refetching…" : "Refetch Data"}
				{pendingCount > 0 && !isRefetching ? (
					<span className="ml-1.5 text-muted-foreground">
						({pendingCount}
						{truncated ? "+" : ""})
					</span>
				) : null}
			</Button>

			<AlertDialog onOpenChange={setDialogOpen} open={dialogOpen}>
				<AlertDialogContent className="border-border bg-background">
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono uppercase tracking-wider">
							Refetch Market Data
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							Re-pull provider data and recompute MAE/MFE for{" "}
							{truncated
								? "the first 500 pending trades (more remain — run again after)"
								: `${pendingCount} pending trade(s)`}
							. This can take a little while for large batches.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="font-mono text-xs uppercase tracking-wider">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="font-mono text-xs uppercase tracking-wider"
							onClick={runRefetch}
						>
							Refetch
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
