"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Copy,
	Loader2,
	Pencil,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { RiskParameters, StrategyFormData } from "@/components/strategy";
import {
	StrategyCriteriaDisplay,
	StrategyForm,
	StrategyRiskDisplay,
	StrategyRulesDisplay,
} from "@/components/strategy";
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

export default function StrategyDetailPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;
	const isMobile = useIsMobile();
	const formRef = useRef<HTMLDivElement>(null);

	const [deleteOpen, setDeleteOpen] = useState(false);
	const [duplicateOpen, setDuplicateOpen] = useState(false);

	const utils = api.useUtils();

	const { data: strategy, isLoading } = api.strategies.getById.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId },
	);

	const { data: stats } = api.strategies.getStats.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId && !!strategy },
	);

	const updateMutation = api.strategies.update.useMutation({
		onSuccess: () => {
			toast.success("Strategy updated");
			utils.strategies.getById.invalidate({ id: strategyId });
			utils.strategies.getAll.invalidate();
			utils.strategies.getTradeRuleChecks.invalidate();
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
			setDuplicateOpen(false);
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

	const scrollToForm = () => {
		formRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-6 sm:py-6"
				data-testid="strategy-detail-loading"
			>
				{/* Action bar skeleton */}
				<div className="flex items-center justify-between gap-2">
					<Skeleton className="h-10 w-40" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-9 sm:w-20" />
						<Skeleton className="h-9 w-9 sm:w-24" />
						<Skeleton className="h-9 w-9 sm:w-20" />
					</div>
				</div>

				{/* Loading skeleton for hero with terminal chrome */}
				<div className="overflow-hidden rounded border border-border">
					<div className="flex items-center justify-between border-border/50 border-b bg-muted px-4 py-2">
						<div className="flex items-center gap-1.5">
							<div className="h-2 w-2 rounded-full bg-loss/60" />
							<div className="h-2 w-2 rounded-full bg-breakeven/60" />
							<div className="h-2 w-2 rounded-full bg-profit/60" />
						</div>
						<Skeleton className="h-3 w-32" />
						<div className="w-14" />
					</div>
					<div className="p-6 sm:p-8">
						<div className="mb-4 flex items-center gap-3">
							<Skeleton className="h-4 w-4 rounded" />
							<Skeleton className="h-3 w-20" />
						</div>
						<Skeleton className="mb-3 h-10 w-64 sm:h-12" />
						<div className="mb-6 flex items-center gap-2">
							<Skeleton className="h-2 w-2 rounded-full" />
							<Skeleton className="h-3 w-16" />
						</div>
						<Skeleton className="h-11 w-36" />
					</div>
				</div>

				{/* Stats grid skeleton */}
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
					{[1, 2, 3, 4].map((i) => (
						<div
							className="rounded border border-border/50 bg-muted p-3 sm:p-4"
							key={i}
						>
							<Skeleton className="mb-2 h-3 w-12" />
							<Skeleton className="h-7 w-16" />
						</div>
					))}
				</div>

				{/* Rules section skeleton */}
				<div>
					<Skeleton className="mb-4 h-3 w-32" />
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
						{[1, 2, 3, 4].map((i) => (
							<div
								className="overflow-hidden rounded border border-border"
								key={i}
							>
								<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-2">
									<div className="flex items-center gap-1.5">
										<Skeleton className="h-2 w-2 rounded-full" />
										<Skeleton className="h-2 w-2 rounded-full" />
										<Skeleton className="h-2 w-2 rounded-full" />
									</div>
									<Skeleton className="h-2.5 w-20" />
								</div>
								<div className="p-4">
									<div className="mb-3 flex items-center gap-2">
										<Skeleton className="h-4 w-4" />
										<Skeleton className="h-4 w-24" />
									</div>
									<div className="space-y-2">
										<Skeleton className="h-3 w-full" />
										<Skeleton className="h-3 w-3/4" />
									</div>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Form section skeleton */}
				<Skeleton className="h-96" />
			</div>
		);
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
				data-testid="strategy-detail-not-found"
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

	// All rules for display (includes generated rules from config toggles)
	const allRules = strategy.rules.map((rule) => ({
		id: rule.id,
		text: rule.text,
		category: rule.category,
		order: rule.order,
		ruleType: rule.ruleType,
	}));

	// Manual rules only for the form (generated rules can't be edited manually)
	const manualRules = strategy.rules
		.filter((rule) => !rule.isGenerated)
		.map((rule) => ({
			id: rule.id,
			text: rule.text,
			category: rule.category,
			order: rule.order,
		}));

	const color = strategy.color ?? "#d4ff00";
	const isActive = strategy.isActive !== false;
	const hasTrades = stats && stats.totalTrades > 0;

	return (
		<div
			className="stagger-sections mx-auto w-[95%] max-w-4xl space-y-6 py-4 sm:space-y-8 sm:py-6"
			data-testid="strategy-detail-page"
		>
			{/* Action Bar */}
			<div
				className="flex items-center justify-between gap-2"
				data-testid="strategy-detail-action-bar"
			>
				<Button
					asChild
					className="min-h-[44px] gap-2 font-mono text-xs uppercase tracking-wider sm:min-h-0"
					data-testid="strategy-detail-action-back"
					variant="ghost"
				>
					<Link href="/strategies">
						<ArrowLeft className="h-4 w-4" />
						<span className="hidden sm:inline">Back to Strategies</span>
					</Link>
				</Button>

				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					<Button
						className="min-h-[36px] min-w-[36px] font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:min-w-0"
						data-testid="strategy-detail-action-edit"
						onClick={scrollToForm}
						size={isMobile ? "icon" : "sm"}
						variant="outline"
					>
						<Pencil className="h-3.5 w-3.5 sm:mr-2 sm:h-3 sm:w-3" />
						<span className="hidden sm:inline">Edit</span>
					</Button>
					<AlertDialog onOpenChange={setDuplicateOpen} open={duplicateOpen}>
						<AlertDialogTrigger asChild>
							<Button
								className="min-h-[36px] min-w-[36px] font-mono text-xs uppercase tracking-wider sm:min-h-0 sm:min-w-0"
								data-testid="strategy-detail-action-duplicate"
								size={isMobile ? "icon" : "sm"}
								variant="outline"
							>
								<Copy className="h-3.5 w-3.5 sm:mr-2 sm:h-3 sm:w-3" />
								<span className="hidden sm:inline">Duplicate</span>
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="mx-4 border-border bg-background sm:mx-0">
							<AlertDialogHeader>
								<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
									Duplicate Strategy
								</AlertDialogTitle>
								<AlertDialogDescription className="font-mono text-xs">
									Create a copy of &quot;{strategy.name}&quot;? The new strategy
									will be named &quot;{strategy.name} (Copy)&quot;.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
								<AlertDialogCancel className="min-h-[44px] font-mono text-xs sm:min-h-0">
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									className="min-h-[44px] font-mono text-xs sm:min-h-0"
									disabled={duplicateMutation.isPending}
									onClick={(e) => {
										e.preventDefault();
										duplicateMutation.mutate({ id: strategyId });
									}}
								>
									{duplicateMutation.isPending && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									Duplicate
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
					<AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
						<AlertDialogTrigger asChild>
							<Button
								className="min-h-[36px] min-w-[36px] sm:min-h-0 sm:min-w-0"
								data-testid="strategy-detail-action-delete"
								size={isMobile ? "icon" : "sm"}
								variant="ghost"
							>
								<Trash2 className="h-4 w-4 text-muted-foreground transition-colors hover:text-loss sm:mr-2" />
								<span className="hidden font-mono text-xs uppercase tracking-wider sm:inline">
									Delete
								</span>
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="mx-4 border-border bg-background sm:mx-0">
							<AlertDialogHeader>
								<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
									Delete Strategy
								</AlertDialogTitle>
								<AlertDialogDescription className="font-mono text-xs">
									Are you sure you want to delete &quot;{strategy.name}&quot;?
									This action cannot be undone. The strategy will be removed
									from all associated trades.
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

			{/* Hero Section with Terminal Chrome */}
			<div
				className="overflow-hidden rounded border border-border"
				data-testid="strategy-detail-hero"
			>
				{/* Terminal window chrome header */}
				<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
					<div className="flex items-center gap-1 sm:gap-1.5">
						<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
						<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
						<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
					</div>
					<span className="max-w-[180px] truncate font-mono text-[9px] text-muted-foreground sm:max-w-none sm:text-[10px]">
						strategy — {strategy.name.toLowerCase().replace(/\s+/g, "-")}
					</span>
					<div className="w-10 sm:w-14" />
				</div>

				{/* Hero content with strategy color gradient */}
				<div
					className="relative p-4 sm:p-8"
					style={{
						background: `linear-gradient(135deg, ${color}15 0%, ${color}05 30%, transparent 70%)`,
					}}
				>
					{/* Strategy color indicator */}
					<div className="mb-3 flex items-center gap-2 sm:mb-4 sm:gap-3">
						<div
							className="h-3 w-3 rounded sm:h-4 sm:w-4"
							style={{ backgroundColor: color }}
						/>
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							$ STRATEGY
						</span>
					</div>

					{/* Strategy name */}
					<h1
						className="mb-2 font-bold text-2xl tracking-tight sm:mb-3 sm:text-4xl"
						data-testid="strategy-detail-name"
					>
						{strategy.name}
					</h1>

					{/* Status badge */}
					<div
						className="mb-4 flex items-center gap-1.5 sm:mb-6 sm:gap-2"
						data-testid="strategy-detail-status"
					>
						{isActive ? (
							<>
								<span className="relative flex h-2 w-2">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-profit opacity-75" />
									<span className="relative inline-flex h-2 w-2 rounded-full bg-profit" />
								</span>
								<span className="font-mono text-[10px] text-profit uppercase tracking-wider sm:text-xs">
									Active
								</span>
							</>
						) : (
							<>
								<span className="h-2 w-2 rounded-full bg-muted-foreground" />
								<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-xs">
									Inactive
								</span>
							</>
						)}
					</div>

					{/* Description if available */}
					{strategy.description && (
						<p className="mb-4 max-w-2xl font-mono text-muted-foreground text-xs sm:mb-6 sm:text-sm">
							{strategy.description}
						</p>
					)}

					{/* Edit Strategy button */}
					<Button
						className="min-h-[44px] gap-2 bg-primary font-mono text-primary-foreground text-xs uppercase tracking-wider hover:bg-primary/90"
						onClick={scrollToForm}
					>
						<Pencil className="h-4 w-4" />
						Edit Strategy
					</Button>
				</div>
			</div>

			{/* Quick Stats Row */}
			<div
				className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4"
				data-testid="strategy-detail-stats"
			>
				<div className="rounded border border-border/50 bg-muted p-3 transition-all duration-200 hover:border-border hover:bg-muted/80 sm:p-4">
					<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
						Trades
					</div>
					<div className="mt-1 font-bold font-mono text-lg sm:text-2xl">
						{hasTrades ? stats.totalTrades : "—"}
					</div>
				</div>
				<div className="rounded border border-border/50 bg-muted p-3 transition-all duration-200 hover:border-border hover:bg-muted/80 sm:p-4">
					<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
						Win Rate
					</div>
					<div
						className={cn(
							"mt-1 font-bold font-mono text-lg sm:text-2xl",
							hasTrades
								? stats.winRate >= 50
									? "text-profit"
									: "text-loss"
								: "text-muted-foreground",
						)}
					>
						{hasTrades ? `${stats.winRate.toFixed(0)}%` : "—"}
					</div>
				</div>
				<div className="rounded border border-border/50 bg-muted p-3 transition-all duration-200 hover:border-border hover:bg-muted/80 sm:p-4">
					<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
						Total P&L
					</div>
					<div
						className={cn(
							"mt-1 font-bold font-mono text-lg sm:text-2xl",
							hasTrades
								? stats.totalPnl >= 0
									? "text-profit"
									: "text-loss"
								: "text-muted-foreground",
						)}
					>
						{hasTrades
							? `${stats.totalPnl >= 0 ? "+" : ""}$${Math.abs(
									stats.totalPnl,
								).toLocaleString("en-US", {
									minimumFractionDigits: 2,
									maximumFractionDigits: 2,
								})}`
							: "—"}
					</div>
				</div>
				<div className="rounded border border-border/50 bg-muted p-3 transition-all duration-200 hover:border-border hover:bg-muted/80 sm:p-4">
					<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
						Profit Factor
					</div>
					<div
						className={cn(
							"mt-1 font-bold font-mono text-lg sm:text-2xl",
							hasTrades
								? stats.profitFactor >= 1
									? "text-profit"
									: "text-loss"
								: "text-muted-foreground",
						)}
					>
						{hasTrades ? stats.profitFactor.toFixed(2) : "—"}
					</div>
				</div>
			</div>

			{/* Rules Display Section */}
			<section data-testid="strategy-detail-rules">
				<h2 className="mb-4 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					→ Strategy Rules
				</h2>
				<StrategyRulesDisplay rules={allRules} />
			</section>

			{/* Entry/Exit Criteria Section */}
			<section data-testid="strategy-detail-criteria">
				<h2 className="mb-4 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					→ Trading Criteria
				</h2>
				<StrategyCriteriaDisplay
					entryCriteria={strategy.entryCriteria}
					exitRules={strategy.exitRules}
				/>
			</section>

			{/* Risk Parameters Section */}
			<section data-testid="strategy-detail-risk">
				<h2 className="mb-4 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					→ Risk Parameters
				</h2>
				<StrategyRiskDisplay
					riskParameters={strategy.riskParameters as RiskParameters | null}
				/>
			</section>

			{/* Form Section */}
			<section data-testid="strategy-detail-form" ref={formRef}>
				<h2 className="mb-4 font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
					→ Edit Strategy
				</h2>
				<div className="overflow-hidden rounded border border-border">
					{/* Terminal window chrome header */}
					<div className="flex items-center justify-between border-border/50 border-b bg-muted px-3 py-1.5 sm:px-4 sm:py-2">
						<div className="flex items-center gap-1 sm:gap-1.5">
							<div className="h-1.5 w-1.5 rounded-full bg-loss/60 sm:h-2 sm:w-2" />
							<div className="h-1.5 w-1.5 rounded-full bg-breakeven/60 sm:h-2 sm:w-2" />
							<div className="h-1.5 w-1.5 rounded-full bg-profit/60 sm:h-2 sm:w-2" />
						</div>
						<span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
							strategy-form.edit
						</span>
						<div className="w-10 sm:w-14" />
					</div>
					<div className="p-4 sm:p-6">
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
								rules: manualRules,
							}}
							isSubmitting={updateMutation.isPending}
							onSubmit={handleSubmit}
							submitLabel="Save Changes"
						/>
					</div>
				</div>
			</section>
		</div>
	);
}
