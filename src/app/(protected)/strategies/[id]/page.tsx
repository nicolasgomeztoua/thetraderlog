"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Copy,
	Loader2,
	Pencil,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { StrategyFormData } from "@/components/strategy";
import { RulesCompliancePanel, StrategyForm } from "@/components/strategy";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// QUICK STATS COMPONENT
// =============================================================================

interface QuickStatsProps {
	trades: number;
	winRate: number;
	totalPnl: number;
	compliance: number;
	hasData: boolean;
}

function QuickStats({
	trades,
	winRate,
	totalPnl,
	compliance,
	hasData,
}: QuickStatsProps) {
	return (
		<div
			className="grid grid-cols-2 gap-3 sm:grid-cols-4"
			data-testid="strategy-quick-stats"
		>
			<div className="rounded border border-white/5 bg-white/2 p-3">
				<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
					Trades
				</div>
				<div className="mt-1 font-bold font-mono text-lg">{trades}</div>
			</div>
			<div className="rounded border border-white/5 bg-white/2 p-3">
				<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
					Win Rate
				</div>
				{hasData ? (
					<div
						className={cn(
							"mt-1 font-bold font-mono text-lg",
							winRate >= 50 ? "text-profit" : "text-loss",
						)}
					>
						{winRate.toFixed(0)}%
					</div>
				) : (
					<div className="mt-1 font-mono text-lg text-muted-foreground/50">
						—
					</div>
				)}
			</div>
			<div className="rounded border border-white/5 bg-white/2 p-3">
				<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
					Total P&L
				</div>
				{hasData ? (
					<div
						className={cn(
							"mt-1 font-bold font-mono text-lg",
							totalPnl >= 0 ? "text-profit" : "text-loss",
						)}
					>
						{totalPnl >= 0 ? "+" : ""}$
						{Math.abs(totalPnl).toLocaleString("en-US", {
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						})}
					</div>
				) : (
					<div className="mt-1 font-mono text-lg text-muted-foreground/50">
						—
					</div>
				)}
			</div>
			<div className="rounded border border-white/5 bg-white/2 p-3">
				<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
					Compliance
				</div>
				{hasData ? (
					<div
						className={cn(
							"mt-1 font-bold font-mono text-lg",
							compliance >= 80
								? "text-profit"
								: compliance >= 50
									? "text-yellow-500"
									: "text-loss",
						)}
					>
						{compliance.toFixed(0)}%
					</div>
				) : (
					<div className="mt-1 font-mono text-lg text-muted-foreground/50">
						—
					</div>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function PageSkeleton() {
	return (
		<div className="mx-auto w-[95%] max-w-7xl space-y-6 py-6">
			{/* Header */}
			<div className="flex items-center gap-3">
				<Skeleton className="h-8 w-8" />
				<Skeleton className="h-4 w-4 rounded-full" />
				<Skeleton className="h-8 w-48" />
			</div>
			{/* Stats */}
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{[1, 2, 3, 4].map((i) => (
					<Skeleton className="h-20" key={i} />
				))}
			</div>
			{/* Two column layout */}
			<div className="grid gap-6 lg:grid-cols-[1fr_400px]">
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	);
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function StrategyDetailPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;
	const isMobile = useIsMobile();

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [isEditMode, setIsEditMode] = useState(false);

	const utils = api.useUtils();

	// Fetch strategy data
	const { data: strategy, isLoading: strategyLoading } =
		api.strategies.getById.useQuery(
			{ id: strategyId },
			{ enabled: !!strategyId },
		);

	// Fetch stats
	const { data: stats } = api.strategies.getStats.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId && !!strategy },
	);

	// Fetch compliance data
	const { data: compliance } = api.strategies.getRuleCompliance.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId && !!strategy },
	);

	const isLoading = strategyLoading;

	const updateMutation = api.strategies.update.useMutation({
		onSuccess: () => {
			toast.success("Strategy updated");
			utils.strategies.getById.invalidate({ id: strategyId });
			utils.strategies.getAll.invalidate();
			utils.strategies.getRuleCompliance.invalidate({ id: strategyId });
			setIsEditMode(false);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update strategy");
		},
	});

	const deleteMutation = api.strategies.delete.useMutation({
		onSuccess: () => {
			toast.success("Strategy deleted");
			utils.strategies.getAll.invalidate();
			router.push("/strategies");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete strategy");
		},
	});

	const duplicateMutation = api.strategies.duplicate.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to duplicate strategy");
		},
	});

	const handleSubmit = (data: StrategyFormData) => {
		updateMutation.mutate({
			id: strategyId,
			name: data.name,
			description: data.description || null,
			color: data.color,
			entryCriteria: data.entryCriteria || null,
			exitRules: data.exitRules || null,
			riskParameters: data.riskParameters,
			scalingRules: data.scalingRules,
			trailingRules: data.trailingRules,
			isActive: data.isActive,
			rules: data.rules,
		});
	};

	// Loading state
	if (isLoading) {
		return <PageSkeleton />;
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
				data-testid="strategy-not-found"
			>
				<AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground sm:h-12 sm:w-12" />
				<h2 className="font-semibold text-lg sm:text-xl">Strategy not found</h2>
				<p className="mb-4 text-center text-muted-foreground text-sm sm:text-base">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="min-h-[44px]">
					<Link href="/strategies">Back to Strategies</Link>
				</Button>
			</div>
		);
	}

	// Transform rules for the form
	const formRules = strategy.rules.map((rule) => ({
		id: rule.id,
		text: rule.text,
		category: rule.category,
		order: rule.order,
	}));

	const hasTradeData = (stats?.totalTrades ?? 0) > 0;
	const color = strategy.color ?? "#d4ff00";

	return (
		<div
			className="mx-auto w-[95%] max-w-7xl space-y-6 py-6"
			data-testid="strategy-detail-page"
		>
			{/* Terminal Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 items-center gap-3">
					<Button
						asChild
						className="h-9 w-9 shrink-0"
						size="icon"
						variant="ghost"
					>
						<Link href="/strategies">
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div
						className="h-4 w-4 shrink-0 rounded"
						data-testid="strategy-color-indicator"
						style={{ backgroundColor: color }}
					/>
					<h1
						className="truncate font-bold font-mono text-xl tracking-tight sm:text-2xl"
						data-testid="strategy-name"
					>
						{strategy.name}
					</h1>
					{!strategy.isActive && (
						<span className="shrink-0 rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
							Inactive
						</span>
					)}
				</div>

				{/* Action buttons */}
				<div className="flex items-center gap-2">
					{/* Edit mode toggle */}
					<Button
						className={cn(
							"min-h-[36px] font-mono text-xs uppercase tracking-wider",
							isEditMode && "bg-primary text-primary-foreground",
						)}
						data-testid="edit-mode-toggle"
						onClick={() => setIsEditMode(!isEditMode)}
						size="sm"
						variant={isEditMode ? "default" : "outline"}
					>
						{isEditMode ? (
							<>
								<X className="mr-1.5 h-3 w-3" />
								Cancel
							</>
						) : (
							<>
								<Pencil className="mr-1.5 h-3 w-3" />
								Edit
							</>
						)}
					</Button>

					{/* Duplicate */}
					<Button
						className="min-h-[36px] font-mono text-xs"
						data-testid="duplicate-btn"
						disabled={duplicateMutation.isPending}
						onClick={() => duplicateMutation.mutate({ id: strategyId })}
						size={isMobile ? "icon" : "sm"}
						variant="outline"
					>
						{duplicateMutation.isPending ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Copy className="h-3.5 w-3.5 sm:mr-1.5" />
						)}
						<span className="hidden sm:inline">Duplicate</span>
					</Button>

					{/* Delete */}
					<AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
						<AlertDialogTrigger asChild>
							<Button
								className="min-h-[36px] min-w-[36px]"
								data-testid="delete-btn"
								size="icon"
								variant="ghost"
							>
								<Trash2 className="h-4 w-4 text-muted-foreground transition-colors hover:text-loss" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="mx-4 border-border bg-background sm:mx-0">
							<AlertDialogHeader>
								<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider">
									Delete Strategy
								</AlertDialogTitle>
								<AlertDialogDescription className="font-mono text-xs">
									Are you sure you want to delete &quot;{strategy.name}&quot;?
									This action cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
								<AlertDialogCancel className="min-h-[44px] font-mono text-xs sm:min-h-0">
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									className="min-h-[44px] bg-loss font-mono text-xs hover:bg-loss/90 sm:min-h-0"
									disabled={deleteMutation.isPending}
									onClick={(e) => {
										e.preventDefault();
										deleteMutation.mutate({ id: strategyId });
									}}
								>
									{deleteMutation.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			{/* Quick Stats Bar */}
			<QuickStats
				compliance={compliance?.avgCompliance ?? 0}
				hasData={hasTradeData}
				totalPnl={stats?.totalPnl ?? 0}
				trades={stats?.totalTrades ?? 0}
				winRate={stats?.winRate ?? 0}
			/>

			{/* Two-column layout */}
			<div className="grid gap-6 lg:grid-cols-[1fr_400px]">
				{/* Main: Compliance Dashboard */}
				<div className="order-2 lg:order-1">
					<div className="rounded-lg border border-white/5 bg-card p-4 sm:p-6">
						{/* Terminal header */}
						<div className="mb-6 flex items-center gap-2 border-white/5 border-b pb-3">
							<div className="flex items-center gap-1.5">
								<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
								<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
								<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
							</div>
							<span className="font-mono text-[10px] text-muted-foreground">
								rules-compliance
							</span>
						</div>

						{compliance ? (
							<RulesCompliancePanel
								avgCompliance={compliance.avgCompliance}
								ruleCompliance={compliance.ruleCompliance}
								totalTrades={compliance.totalTrades}
							/>
						) : (
							<div className="py-8 text-center font-mono text-muted-foreground text-sm">
								Loading compliance data...
							</div>
						)}
					</div>
				</div>

				{/* Sidebar: Strategy Form */}
				<div className="order-1 lg:order-2">
					<div
						className={cn(
							"rounded-lg border bg-card p-4 transition-colors sm:p-6",
							isEditMode ? "border-primary/30" : "border-white/5",
						)}
						data-testid="strategy-form-container"
					>
						{/* Terminal header */}
						<div className="mb-6 flex items-center justify-between border-white/5 border-b pb-3">
							<div className="flex items-center gap-2">
								<div className="flex items-center gap-1.5">
									<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
									<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
									<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
								</div>
								<span className="font-mono text-[10px] text-muted-foreground">
									strategy-config
								</span>
							</div>
							{isEditMode && (
								<span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary uppercase">
									Editing
								</span>
							)}
						</div>

						{isEditMode ? (
							<StrategyForm
								initialData={{
									name: strategy.name,
									description: strategy.description ?? "",
									color: strategy.color ?? "#d4ff00",
									entryCriteria: strategy.entryCriteria ?? "",
									exitRules: strategy.exitRules ?? "",
									riskParameters: strategy.riskParameters,
									scalingRules: strategy.scalingRules,
									trailingRules: strategy.trailingRules,
									isActive: strategy.isActive ?? true,
									rules: formRules,
								}}
								isSubmitting={updateMutation.isPending}
								onSubmit={handleSubmit}
								submitLabel="Save Changes"
							/>
						) : (
							<div className="space-y-4">
								{/* Strategy Info - Read only view */}
								<div>
									<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Description
									</div>
									<p className="mt-1 font-mono text-sm">
										{strategy.description || (
											<span className="text-muted-foreground/50">
												No description
											</span>
										)}
									</p>
								</div>

								{strategy.entryCriteria && (
									<div>
										<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Entry Criteria
										</div>
										<p className="mt-1 whitespace-pre-wrap font-mono text-sm">
											{strategy.entryCriteria}
										</p>
									</div>
								)}

								{strategy.exitRules && (
									<div>
										<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
											Exit Rules
										</div>
										<p className="mt-1 whitespace-pre-wrap font-mono text-sm">
											{strategy.exitRules}
										</p>
									</div>
								)}

								{/* Rules summary */}
								<div>
									<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Checklist Rules
									</div>
									<div className="mt-2 space-y-1">
										{strategy.rules.length > 0 ? (
											strategy.rules.slice(0, 5).map((rule) => (
												<div
													className="flex items-center gap-2 text-sm"
													key={rule.id}
												>
													<span
														className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase"
														style={{
															backgroundColor:
																rule.category === "entry"
																	? "rgba(0, 255, 136, 0.1)"
																	: rule.category === "exit"
																		? "rgba(212, 255, 0, 0.1)"
																		: rule.category === "risk"
																			? "rgba(255, 59, 59, 0.1)"
																			: "rgba(0, 212, 255, 0.1)",
															color:
																rule.category === "entry"
																	? "#00ff88"
																	: rule.category === "exit"
																		? "#d4ff00"
																		: rule.category === "risk"
																			? "#ff3b3b"
																			: "#00d4ff",
														}}
													>
														{rule.category}
													</span>
													<span className="truncate font-mono">
														{rule.text}
													</span>
												</div>
											))
										) : (
											<p className="font-mono text-muted-foreground/50 text-sm">
												No rules defined
											</p>
										)}
										{strategy.rules.length > 5 && (
											<p className="font-mono text-muted-foreground text-xs">
												+{strategy.rules.length - 5} more rules
											</p>
										)}
									</div>
								</div>

								{/* Edit prompt */}
								<div className="border-white/5 border-t pt-4">
									<Button
										className="w-full font-mono text-xs uppercase tracking-wider"
										onClick={() => setIsEditMode(true)}
										variant="outline"
									>
										<Pencil className="mr-2 h-3.5 w-3.5" />
										Edit Strategy
									</Button>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
