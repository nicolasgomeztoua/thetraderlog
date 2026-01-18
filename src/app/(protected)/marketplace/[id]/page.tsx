"use client";

import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle,
	Download,
	ExternalLink,
	Flag,
	Loader2,
	ShieldCheck,
	TriangleAlert,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { VoteControls } from "@/components/marketplace";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { STRATEGY_REPORT_REASONS } from "@/lib/constants";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface RiskParameters {
	positionSizing?: {
		method: "fixed" | "risk_percent" | "kelly";
		fixedSize?: number;
		riskPercent?: number;
		kellyFraction?: number;
	};
	maxRiskPerTrade?: {
		type: "dollars" | "percent";
		value: number;
	};
	dailyLossLimit?: {
		type: "dollars" | "percent";
		value: number;
	};
	maxConcurrentPositions?: number;
	minRiskRewardRatio?: number;
}

interface StrategyRule {
	id: string;
	text: string;
	category: string;
	order: number;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function LoadingSkeleton() {
	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-6 sm:py-6"
			data-testid="marketplace-detail-loading"
		>
			{/* Hero banner skeleton */}
			<Skeleton className="aspect-[3/1] w-full rounded-lg" />
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 sm:gap-3">
					<Skeleton className="h-10 w-10 rounded" />
					<Skeleton className="h-8 w-48 sm:w-64" />
				</div>
				<Skeleton className="h-10 w-32" />
			</div>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
				<Skeleton className="h-20" />
				<Skeleton className="h-20" />
				<Skeleton className="h-20" />
				<Skeleton className="h-20" />
			</div>
			<Skeleton className="h-48" />
			<Skeleton className="h-64" />
		</div>
	);
}

// =============================================================================
// TRACK RECORD BADGE
// =============================================================================

function TrackRecordBadge({
	status,
	className,
}: {
	status: "limited" | "normal" | "verified";
	className?: string;
}) {
	if (status === "normal") return null;

	if (status === "verified") {
		return (
			<div
				className={cn(
					"flex items-center gap-1.5 rounded bg-profit/20 px-2.5 py-1",
					className,
				)}
				data-testid="track-record-badge-verified"
			>
				<ShieldCheck className="h-4 w-4 text-profit" />
				<span className="font-mono text-profit text-xs uppercase">
					Verified Track Record
				</span>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 rounded bg-yellow-500/20 px-2.5 py-1",
				className,
			)}
			data-testid="track-record-badge-limited"
		>
			<TriangleAlert className="h-4 w-4 text-yellow-500" />
			<span className="font-mono text-xs text-yellow-500 uppercase">
				Limited Data
			</span>
		</div>
	);
}

// =============================================================================
// RULES DISPLAY COMPONENT
// =============================================================================

function RulesDisplay({ rules }: { rules: StrategyRule[] }) {
	// Group rules by category
	const groupedRules = rules.reduce(
		(acc, rule) => {
			const category = rule.category;
			if (!acc[category]) {
				acc[category] = [];
			}
			acc[category].push(rule);
			return acc;
		},
		{} as Record<string, StrategyRule[]>,
	);

	const categoryLabels: Record<string, string> = {
		entry: "Entry Rules",
		exit: "Exit Rules",
		risk: "Risk Rules",
		management: "Management Rules",
	};

	const categoryOrder = ["entry", "exit", "risk", "management"];

	if (rules.length === 0) {
		return (
			<p className="font-mono text-muted-foreground text-sm italic">
				No rules defined
			</p>
		);
	}

	return (
		<div className="space-y-4">
			{categoryOrder.map((category) => {
				const categoryRules = groupedRules[category];
				if (!categoryRules || categoryRules.length === 0) return null;

				return (
					<div key={category}>
						<h4 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
							{categoryLabels[category] ?? category}
						</h4>
						<ul className="space-y-1.5">
							{categoryRules
								.sort((a, b) => a.order - b.order)
								.map((rule) => (
									<li
										className="flex items-start gap-2 font-mono text-sm"
										key={rule.id}
									>
										<span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
										<span>{rule.text}</span>
									</li>
								))}
						</ul>
					</div>
				);
			})}
		</div>
	);
}

// =============================================================================
// RISK PARAMETERS DISPLAY
// =============================================================================

function RiskParametersDisplay({
	riskParameters,
}: {
	riskParameters: RiskParameters | null;
}) {
	if (!riskParameters) {
		return (
			<p className="font-mono text-muted-foreground text-sm italic">
				No risk parameters defined
			</p>
		);
	}

	const items: Array<{ label: string; value: string }> = [];

	// Position sizing
	if (riskParameters.positionSizing) {
		const ps = riskParameters.positionSizing;
		if (ps.method === "fixed" && ps.fixedSize !== undefined) {
			items.push({
				label: "Position Size",
				value: `${ps.fixedSize} contracts`,
			});
		} else if (ps.method === "risk_percent" && ps.riskPercent !== undefined) {
			items.push({
				label: "Position Sizing",
				value: `${ps.riskPercent}% of account risk`,
			});
		} else if (ps.method === "kelly" && ps.kellyFraction !== undefined) {
			items.push({
				label: "Position Sizing",
				value: `Kelly criterion (${ps.kellyFraction}x)`,
			});
		}
	}

	// Max risk per trade
	if (riskParameters.maxRiskPerTrade) {
		const mr = riskParameters.maxRiskPerTrade;
		items.push({
			label: "Max Risk/Trade",
			value: mr.type === "dollars" ? `$${mr.value}` : `${mr.value}%`,
		});
	}

	// Daily loss limit
	if (riskParameters.dailyLossLimit) {
		const dl = riskParameters.dailyLossLimit;
		items.push({
			label: "Daily Loss Limit",
			value: dl.type === "dollars" ? `$${dl.value}` : `${dl.value}%`,
		});
	}

	// Max concurrent positions
	if (riskParameters.maxConcurrentPositions !== undefined) {
		items.push({
			label: "Max Positions",
			value: `${riskParameters.maxConcurrentPositions}`,
		});
	}

	// Min R:R ratio
	if (riskParameters.minRiskRewardRatio !== undefined) {
		items.push({
			label: "Min R:R Ratio",
			value: `${riskParameters.minRiskRewardRatio}:1`,
		});
	}

	if (items.length === 0) {
		return (
			<p className="font-mono text-muted-foreground text-sm italic">
				No risk parameters defined
			</p>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
			{items.map((item) => (
				<div key={item.label}>
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						{item.label}
					</div>
					<div className="mt-0.5 font-mono text-sm">{item.value}</div>
				</div>
			))}
		</div>
	);
}

// =============================================================================
// DOWNLOAD CONFIRMATION DIALOG
// =============================================================================

function DownloadConfirmDialog({
	strategyName,
	strategyColor,
	isPending,
	onConfirm,
}: {
	strategyName: string;
	strategyColor: string;
	isPending: boolean;
	onConfirm: () => void;
}) {
	const [open, setOpen] = useState(false);

	const handleConfirm = () => {
		onConfirm();
		// Dialog stays open during download, closes on success via parent navigation
	};

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button
					className="font-mono"
					data-testid="download-button"
					style={{
						backgroundColor: strategyColor,
						color: "#050505",
					}}
				>
					<Download className="mr-2 h-4 w-4" />
					Download
				</Button>
			</DialogTrigger>
			<DialogContent className="border-border bg-background sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-mono text-sm uppercase tracking-wider">
						Download Strategy
					</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						This will copy &quot;{strategyName}&quot; to your account.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3 py-4">
					<p className="font-mono text-muted-foreground text-sm">
						A copy of this strategy will be added to your strategies. You can
						customize it freely without affecting the original.
					</p>
					<ul className="space-y-2 font-mono text-muted-foreground text-xs">
						<li className="flex items-start gap-2">
							<CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
							<span>Strategy rules and parameters will be copied</span>
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
							<span>Your edits won&apos;t affect the original</span>
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-profit" />
							<span>Attribution to the original author is preserved</span>
						</li>
					</ul>
				</div>
				<DialogFooter className="flex-col gap-2 sm:flex-row">
					<Button
						className="font-mono"
						disabled={isPending}
						onClick={() => setOpen(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className="font-mono"
						data-testid="download-confirm-button"
						disabled={isPending}
						onClick={handleConfirm}
						style={{
							backgroundColor: strategyColor,
							color: "#050505",
						}}
					>
						{isPending ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Download className="mr-2 h-4 w-4" />
						)}
						{isPending ? "Downloading..." : "Confirm Download"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// REPORT DIALOG
// =============================================================================

function ReportDialog({
	strategyId,
	strategyName,
}: {
	strategyId: string;
	strategyName: string;
}) {
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState<string>("");
	const [details, setDetails] = useState("");

	const reportMutation = api.marketplace.report.useMutation({
		onSuccess: () => {
			toast.success(
				"Report submitted. Thank you for helping keep the community safe.",
			);
			setOpen(false);
			setReason("");
			setDetails("");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to submit report");
		},
	});

	const handleSubmit = () => {
		if (!reason) {
			toast.error("Please select a reason for your report");
			return;
		}

		reportMutation.mutate({
			strategyId,
			reason: reason as (typeof STRATEGY_REPORT_REASONS)[number],
			details: details.trim() || undefined,
		});
	};

	const reasonLabels: Record<string, string> = {
		misleading_stats: "Misleading Statistics",
		inappropriate_content: "Inappropriate Content",
		spam: "Spam",
		other: "Other",
	};

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button
					className="font-mono text-xs"
					data-testid="report-button"
					size="sm"
					variant="ghost"
				>
					<Flag className="mr-2 h-3.5 w-3.5" />
					Report
				</Button>
			</DialogTrigger>
			<DialogContent className="border-border bg-background sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="font-mono text-sm uppercase tracking-wider">
						Report Strategy
					</DialogTitle>
					<DialogDescription className="font-mono text-xs">
						Report &quot;{strategyName}&quot; for violating community
						guidelines.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="report-reason"
						>
							Reason *
						</label>
						<Select onValueChange={setReason} value={reason}>
							<SelectTrigger
								className="font-mono"
								data-testid="report-reason-select"
								id="report-reason"
							>
								<SelectValue placeholder="Select a reason" />
							</SelectTrigger>
							<SelectContent>
								{STRATEGY_REPORT_REASONS.map((r) => (
									<SelectItem className="font-mono" key={r} value={r}>
										{reasonLabels[r] ?? r}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-2">
						<label
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider"
							htmlFor="report-details"
						>
							Additional Details (optional)
						</label>
						<Textarea
							className="min-h-24 resize-none font-mono text-sm"
							data-testid="report-details-textarea"
							id="report-details"
							maxLength={1000}
							onChange={(e) => setDetails(e.target.value)}
							placeholder="Provide more context about this report..."
							value={details}
						/>
						<p className="text-right font-mono text-[10px] text-muted-foreground">
							{details.length}/1000
						</p>
					</div>
				</div>
				<DialogFooter className="flex-col gap-2 sm:flex-row">
					<Button
						className="font-mono"
						onClick={() => setOpen(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className="font-mono"
						data-testid="report-submit-button"
						disabled={!reason || reportMutation.isPending}
						onClick={handleSubmit}
					>
						{reportMutation.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Submit Report
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function MarketplaceDetailPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;

	// Local state for vote optimistic updates
	const [voteScore, setVoteScore] = useState<number | null>(null);
	const [hasVoted, setHasVoted] = useState<number | null>(null);
	const [voteInitialized, setVoteInitialized] = useState(false);

	const utils = api.useUtils();

	// Fetch strategy details
	const { data: strategy, isLoading } = api.marketplace.getById.useQuery(
		{ id: strategyId },
		{
			enabled: !!strategyId,
		},
	);

	// Initialize vote state when strategy data arrives
	if (strategy && !voteInitialized) {
		setVoteScore(strategy.engagement.voteScore);
		setHasVoted(strategy.hasVoted);
		setVoteInitialized(true);
	}

	// Check if user has already downloaded this strategy
	const { data: downloadCheck } = api.strategies.getAll.useQuery(undefined, {
		select: (strategies) =>
			strategies.find((s) => s.sourceStrategyId === strategyId),
	});

	// Download mutation
	const downloadMutation = api.marketplace.download.useMutation({
		onSuccess: (copiedStrategy) => {
			toast.success("Strategy downloaded! You can now customize it.");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${copiedStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to download strategy");
		},
	});

	const handleVoteUpdate = (newScore: number, newVote: number | null) => {
		setVoteScore(newScore);
		setHasVoted(newVote);
	};

	const handleDownload = () => {
		downloadMutation.mutate({ strategyId });
	};

	// Loading state
	if (isLoading) {
		return <LoadingSkeleton />;
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
				data-testid="marketplace-detail-not-found"
			>
				<AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground sm:h-12 sm:w-12" />
				<h2 className="font-mono font-semibold text-lg uppercase tracking-wider sm:text-xl">
					Strategy not found
				</h2>
				<p className="mb-4 text-center font-mono text-muted-foreground text-sm sm:text-base">
					This strategy doesn&apos;t exist or is no longer public.
				</p>
				<Button asChild className="min-h-[44px] font-mono">
					<Link href="/marketplace">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Marketplace
					</Link>
				</Button>
			</div>
		);
	}

	const strategyColor = strategy.color ?? "#d4ff00";
	const isOwner = !!(
		strategy.currentUserId && strategy.creator?.id === strategy.currentUserId
	);
	const hasDownloaded = !!downloadCheck;

	// Use local state for vote controls, fallback to server data
	const displayVoteScore = voteScore ?? strategy.engagement.voteScore;
	const displayHasVoted = hasVoted ?? strategy.hasVoted;

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-4 py-4 sm:space-y-6 sm:py-6"
			data-testid="marketplace-detail-page"
		>
			{/* Hero Banner with Cover Image */}
			<div
				className="relative aspect-[3/1] w-full overflow-hidden rounded-lg"
				data-testid="marketplace-detail-hero"
			>
				{strategy.coverImageUrl ? (
					<Image
						alt={`${strategy.name} cover`}
						className="object-cover"
						data-testid="marketplace-detail-cover-image"
						fill
						sizes="(max-width: 768px) 95vw, 896px"
						src={strategy.coverImageUrl}
					/>
				) : (
					<div
						className="absolute inset-0"
						data-testid="marketplace-detail-cover-placeholder"
						style={{
							background: `linear-gradient(135deg, ${strategyColor}20 0%, ${strategyColor}05 50%, transparent 100%)`,
						}}
					/>
				)}
				{/* Gradient overlay for text readability */}
				<div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />

				{/* Track record badge on image */}
				<div className="absolute top-3 right-3">
					<TrackRecordBadge status={strategy.trackRecordStatus} />
				</div>

				{/* Strategy name and creator overlay */}
				<div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
					<div className="flex items-end justify-between gap-4">
						<div>
							<div className="mb-2 flex items-center gap-2">
								<div
									className="h-4 w-4 shrink-0 rounded shadow-lg sm:h-5 sm:w-5"
									style={{
										backgroundColor: strategyColor,
										boxShadow: `0 0 12px ${strategyColor}40`,
									}}
								/>
								<h1
									className="font-bold font-mono text-xl tracking-tight drop-shadow-lg sm:text-3xl"
									data-testid="marketplace-detail-heading"
									style={{
										textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)",
									}}
								>
									{strategy.name}
								</h1>
							</div>
							{/* Creator info */}
							<div
								className="flex items-center gap-2"
								data-testid="marketplace-detail-creator"
							>
								{strategy.creator ? (
									<>
										{strategy.creator.imageUrl ? (
											<Image
												alt={strategy.creator.name ?? "Creator"}
												className="rounded-full"
												height={24}
												src={strategy.creator.imageUrl}
												width={24}
											/>
										) : (
											<div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
												<span className="font-mono text-primary text-xs">
													{strategy.creator.name?.charAt(0).toUpperCase() ??
														"?"}
												</span>
											</div>
										)}
										<span
											className="font-mono text-sm drop-shadow-lg"
											style={{ textShadow: "0 1px 4px rgba(0, 0, 0, 0.8)" }}
										>
											by {strategy.creator.name ?? "Anonymous"}
										</span>
									</>
								) : (
									<>
										<User className="h-5 w-5 text-muted-foreground" />
										<span
											className="font-mono text-sm italic drop-shadow-lg"
											style={{ textShadow: "0 1px 4px rgba(0, 0, 0, 0.8)" }}
										>
											Anonymous
										</span>
									</>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Action Bar */}
			<div
				className="flex flex-wrap items-center justify-between gap-3"
				data-testid="marketplace-detail-actions"
			>
				<Button
					asChild
					className="min-h-[44px] shrink-0 font-mono"
					variant="ghost"
				>
					<Link href="/marketplace">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Marketplace
					</Link>
				</Button>

				<div className="flex items-center gap-2 sm:gap-3">
					{/* Vote controls */}
					<VoteControls
						hasVoted={displayHasVoted}
						isOwner={isOwner}
						onVoteUpdate={handleVoteUpdate}
						size="md"
						strategyId={strategyId}
						voteScore={displayVoteScore}
					/>

					{/* Download count */}
					<span
						className="flex items-center gap-1.5 font-mono text-muted-foreground text-sm"
						data-testid="marketplace-detail-downloads"
					>
						<Download className="h-4 w-4" />
						{strategy.engagement.downloadCount}
					</span>

					{/* Download button or Already Downloaded */}
					{isOwner ? (
						<Button
							asChild
							className="font-mono"
							style={{
								borderColor: `${strategyColor}40`,
								color: strategyColor,
							}}
							variant="outline"
						>
							<Link href={`/strategies/${strategyId}`}>
								<ExternalLink className="mr-2 h-4 w-4" />
								View My Strategy
							</Link>
						</Button>
					) : hasDownloaded ? (
						<Button
							asChild
							className="font-mono"
							data-testid="already-downloaded-button"
							variant="outline"
						>
							<Link href={`/strategies/${downloadCheck.id}`}>
								<CheckCircle className="mr-2 h-4 w-4 text-profit" />
								View Downloaded
							</Link>
						</Button>
					) : (
						<DownloadConfirmDialog
							isPending={downloadMutation.isPending}
							onConfirm={handleDownload}
							strategyColor={strategyColor}
							strategyName={strategy.name}
						/>
					)}

					{/* Report button (not for own strategy) */}
					{!isOwner && (
						<ReportDialog
							strategyId={strategyId}
							strategyName={strategy.name}
						/>
					)}
				</div>
			</div>

			{/* Instrument and Category badges */}
			{((strategy.instruments && strategy.instruments.length > 0) ||
				(strategy.categoryTags && strategy.categoryTags.length > 0)) && (
				<div
					className="flex flex-wrap gap-2"
					data-testid="marketplace-detail-badges"
				>
					{strategy.instruments?.map((instrument) => (
						<span
							className="rounded bg-primary/10 px-2 py-1 font-mono text-primary text-xs"
							key={instrument}
						>
							{instrument}
						</span>
					))}
					{strategy.categoryTags?.map((category) => (
						<span
							className="rounded bg-accent/10 px-2 py-1 font-mono text-accent text-xs"
							key={category}
						>
							{category}
						</span>
					))}
				</div>
			)}

			{/* Performance Stats */}
			{strategy.stats && (
				<div className="space-y-3" data-testid="marketplace-detail-stats">
					{/* Limited data warning */}
					{strategy.trackRecordStatus === "limited" && (
						<div className="flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-3">
							<TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
							<p className="font-mono text-xs text-yellow-500">
								This strategy has limited trade history (
								{strategy.stats.totalTrades} trades). Performance metrics may
								not be statistically significant.
							</p>
						</div>
					)}

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<div
							className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
							style={{
								borderTopColor: `${strategyColor}30`,
								borderTopWidth: 2,
							}}
						>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								Trades
							</div>
							<div className="mt-1 font-bold font-mono text-lg sm:text-2xl">
								{strategy.stats.totalTrades}
							</div>
						</div>
						<div
							className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
							style={{
								borderTopColor: `${strategyColor}30`,
								borderTopWidth: 2,
							}}
						>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								Win Rate
							</div>
							<div
								className={cn(
									"mt-1 font-bold font-mono text-lg sm:text-2xl",
									strategy.stats.winRate >= 50 ? "text-profit" : "text-loss",
								)}
							>
								{strategy.stats.winRate.toFixed(1)}%
							</div>
						</div>
						<div
							className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
							style={{
								borderTopColor: `${strategyColor}30`,
								borderTopWidth: 2,
							}}
						>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								Profit Factor
							</div>
							<div
								className={cn(
									"mt-1 font-bold font-mono text-lg sm:text-2xl",
									(strategy.stats.profitFactor ?? 0) >= 1
										? "text-profit"
										: "text-loss",
								)}
							>
								{strategy.stats.profitFactor === null
									? "N/A"
									: strategy.stats.profitFactor.toFixed(2)}
							</div>
						</div>
						<div
							className="rounded border border-white/5 bg-white/2 p-3 sm:p-4"
							style={{
								borderTopColor: `${strategyColor}30`,
								borderTopWidth: 2,
							}}
						>
							<div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
								Avg R
							</div>
							<div
								className={cn(
									"mt-1 font-bold font-mono text-lg sm:text-2xl",
									strategy.stats.avgR >= 0 ? "text-profit" : "text-loss",
								)}
							>
								{strategy.stats.avgR >= 0 ? "+" : ""}
								{strategy.stats.avgR.toFixed(2)}R
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Description */}
			{strategy.description && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="marketplace-detail-description"
				>
					<h2 className="mb-3 font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Description
					</h2>
					<p className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
						{strategy.description}
					</p>
				</div>
			)}

			{/* Strategy Rules */}
			{strategy.rules && strategy.rules.length > 0 && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="marketplace-detail-rules"
				>
					<h2 className="mb-4 font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Strategy Rules
					</h2>
					<RulesDisplay rules={strategy.rules as StrategyRule[]} />
				</div>
			)}

			{/* Risk Parameters */}
			{strategy.riskParameters && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="marketplace-detail-risk-parameters"
				>
					<h2 className="mb-4 font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Risk Management
					</h2>
					<RiskParametersDisplay
						riskParameters={strategy.riskParameters as RiskParameters}
					/>
				</div>
			)}

			{/* Legacy Entry/Exit Criteria (if present) */}
			{(strategy.entryCriteria || strategy.exitRules) && (
				<div
					className="rounded border border-white/5 bg-white/2 p-4 sm:p-6"
					data-testid="marketplace-detail-legacy-rules"
				>
					{strategy.entryCriteria && (
						<div className="mb-4">
							<h3 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
								Entry Criteria
							</h3>
							<p className="whitespace-pre-wrap font-mono text-sm">
								{strategy.entryCriteria}
							</p>
						</div>
					)}
					{strategy.exitRules && (
						<div>
							<h3 className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-wider">
								Exit Rules
							</h3>
							<p className="whitespace-pre-wrap font-mono text-sm">
								{strategy.exitRules}
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
