"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { CreditCard, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	getNextMonthResetDate,
	getTimeUntilMidnightUTC,
	isBetaFromMetadata,
} from "@/lib/billing/utils";
import {
	FEATURE_AI_CHAT,
	PLAN_METADATA,
	PLAN_NONE,
	PLAN_PRO,
	PLAN_STARTER,
} from "@/lib/constants/billing";
import { ERR_BILLING_LOAD_FAILED } from "@/lib/constants/errors";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

function UsageMeter({
	label,
	used,
	limit,
	resetLabel,
	testId,
}: {
	label: string;
	used: number;
	limit: number | null;
	resetLabel: string;
	testId: string;
}) {
	if (limit === null) {
		return (
			<div className="space-y-1.5" data-testid={testId}>
				<div className="flex items-center justify-between font-mono text-xs">
					<span className="text-muted-foreground uppercase tracking-wider">
						{label}
					</span>
					<span className="text-muted-foreground">
						{used} used &middot; Unlimited
					</span>
				</div>
				<div className="h-2 w-full rounded-full bg-secondary">
					<div
						className="h-full rounded-full bg-[#d4ff00]/30"
						style={{ width: "5%" }}
					/>
				</div>
			</div>
		);
	}

	const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
	const colorClass =
		percentage > 80
			? "bg-[#ff3b3b]"
			: percentage > 50
				? "bg-amber-500"
				: "bg-[#00ff88]";

	return (
		<div className="space-y-1.5" data-testid={testId}>
			<div className="flex items-center justify-between font-mono text-xs">
				<span className="text-muted-foreground uppercase tracking-wider">
					{label}
				</span>
				<span className="text-muted-foreground">
					{used}/{limit} &middot; {resetLabel}
				</span>
			</div>
			<div className="h-2 w-full rounded-full bg-secondary">
				<div
					className={cn("h-full rounded-full transition-all", colorClass)}
					style={{ width: `${Math.max(percentage, 2)}%` }}
				/>
			</div>
		</div>
	);
}

function useResetTimeLabel(enabled: boolean): string {
	const [label, setLabel] = useState(
		() => `Resets in ${getTimeUntilMidnightUTC()}`,
	);
	useEffect(() => {
		if (!enabled) return;
		setLabel(`Resets in ${getTimeUntilMidnightUTC()}`);
		const id = setInterval(() => {
			setLabel(`Resets in ${getTimeUntilMidnightUTC()}`);
		}, 60_000);
		return () => clearInterval(id);
	}, [enabled]);
	return label;
}

function getResetDateLabel(): string {
	return `Resets ${getNextMonthResetDate()}`;
}

export function BillingTab() {
	const { isLoaded: clerkLoaded, has } = useAuth();
	const { user } = useUser();
	const { openUserProfile } = useClerk();
	const planQuery = api.billing.getCurrentPlan.useQuery();

	const isBetaUser = isBetaFromMetadata(
		user?.publicMetadata as Record<string, unknown> | undefined,
	);

	// Gate usageQuery on Clerk's client-side feature check so it fires in
	// parallel with planQuery instead of waiting for planQuery to resolve.
	const hasAiFeature =
		clerkLoaded &&
		(isBetaUser || (has?.({ feature: FEATURE_AI_CHAT }) ?? false));

	const plan = planQuery.data;
	const isLoading = !clerkLoaded || planQuery.isLoading;
	const isBeta = plan?.beta ?? false;
	const effectivePlan = plan?.plan ?? PLAN_NONE;
	const metadata = PLAN_METADATA[effectivePlan] ?? PLAN_METADATA[PLAN_NONE];

	const isProUser = effectivePlan === PLAN_PRO;
	const isStarterUser = effectivePlan === PLAN_STARTER;
	const hasPaidPlan = isProUser || isStarterUser;

	const resetTimeLabel = useResetTimeLabel(isProUser);
	const usageQuery = api.billing.getUsage.useQuery(undefined, {
		enabled: hasAiFeature,
	});
	const usage = usageQuery.data;

	if (isLoading) {
		return (
			<div className="space-y-4 sm:space-y-6" data-testid="billing-tab-loading">
				<Card>
					<CardHeader className="p-4 sm:p-6">
						<Skeleton className="h-5 w-32" />
						<Skeleton className="hidden h-4 w-64 sm:block" />
					</CardHeader>
					<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
						<div className="rounded border border-border bg-secondary/50 p-4">
							<Skeleton className="mb-2 h-4 w-20" />
							<Skeleton className="h-3 w-16" />
						</div>
						<div>
							<Skeleton className="mb-2 h-3 w-28" />
							<div className="space-y-1.5">
								<Skeleton className="h-3 w-48" />
								<Skeleton className="h-3 w-40" />
								<Skeleton className="h-3 w-36" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (planQuery.isError) {
		return (
			<Card data-testid="billing-tab-error">
				<CardContent className="p-6 text-center font-mono text-muted-foreground text-sm">
					{ERR_BILLING_LOAD_FAILED}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4 sm:space-y-6" data-testid="billing-tab">
			{/* Current Plan Card */}
			<Card data-testid="billing-plan-card">
				<CardHeader className="p-4 sm:p-6">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<CreditCard className="h-4 w-4" />
								Current Plan
							</CardTitle>
							<CardDescription className="hidden sm:block">
								Manage your subscription and billing
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							{isBeta && (
								<Badge
									className="border-[#00d4ff]/30 bg-[#00d4ff]/10 font-mono text-[#00d4ff] text-[10px] uppercase tracking-wider"
									data-testid="billing-badge-beta"
								>
									Beta Access
								</Badge>
							)}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
					<div className="flex items-center justify-between rounded border border-border bg-secondary/50 p-4">
						<div>
							<p
								className="font-medium font-mono text-sm uppercase tracking-wider"
								data-testid="billing-plan-name"
							>
								{hasPaidPlan ? (metadata?.name ?? "No Plan") : "No active plan"}
							</p>
							<p className="font-mono text-muted-foreground text-xs">
								{hasPaidPlan
									? metadata?.price
									: isBeta
										? "Pro features free during beta"
										: "Subscribe to get started"}
							</p>
						</div>
						<div>
							{hasPaidPlan ? (
								<Button
									className="font-mono text-[10px] uppercase tracking-wider"
									data-testid="billing-button-manage"
									onClick={() => openUserProfile()}
									size="sm"
									variant="outline"
								>
									Manage Subscription
									<Settings className="ml-1.5 h-3 w-3" />
								</Button>
							) : (
								<Button
									asChild
									className="bg-[#d4ff00] font-mono text-[10px] text-black uppercase tracking-wider hover:bg-[#d4ff00]/90"
									data-testid="billing-button-upgrade"
									size="sm"
								>
									<Link href="/pricing">
										<Zap className="mr-1.5 h-3 w-3" />
										Upgrade
									</Link>
								</Button>
							)}
						</div>
					</div>

					{/* Plan Features */}
					<div>
						<p className="mb-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Included Features
						</p>
						<ul className="space-y-1.5">
							{metadata?.features.map((feature) => (
								<li
									className="flex items-center gap-2 font-mono text-muted-foreground text-xs"
									key={feature}
								>
									<span className="text-[#00ff88]">✓</span>
									{feature}
								</li>
							))}
						</ul>
					</div>
				</CardContent>
			</Card>

			{/* Usage Meters Card - shown for Pro users and beta */}
			{(isProUser || isBeta) && usageQuery.isLoading && (
				<Card data-testid="billing-usage-card-loading">
					<CardHeader className="p-4 sm:p-6">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="hidden h-4 w-56 sm:block" />
					</CardHeader>
					<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
						<div className="space-y-1.5">
							<Skeleton className="h-3 w-48" />
							<Skeleton className="h-2 w-full" />
						</div>
						<div className="space-y-1.5">
							<Skeleton className="h-3 w-48" />
							<Skeleton className="h-2 w-full" />
						</div>
					</CardContent>
				</Card>
			)}
			{(isProUser || isBeta) && usageQuery.isError && (
				<Card data-testid="billing-usage-card-error">
					<CardContent className="p-6 text-center font-mono text-muted-foreground text-sm">
						Failed to load usage data.{" "}
						<button
							className="text-primary underline underline-offset-2 hover:text-primary/80"
							onClick={() => usageQuery.refetch()}
							type="button"
						>
							Retry
						</button>
					</CardContent>
				</Card>
			)}
			{(isProUser || isBeta) && usage && (
				<Card data-testid="billing-usage-card">
					<CardHeader className="p-4 sm:p-6">
						<CardTitle className="flex items-center gap-2">
							<Zap className="h-4 w-4" />
							AI Usage
						</CardTitle>
						<CardDescription className="hidden sm:block">
							Track your daily and monthly AI usage
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
						<UsageMeter
							label="AI Chat Messages"
							limit={usage.chat.limit}
							resetLabel={resetTimeLabel}
							testId="billing-usage-chat"
							used={usage.chat.used}
						/>
						<UsageMeter
							label="AI Reports"
							limit={usage.reports.limit}
							resetLabel={getResetDateLabel()}
							testId="billing-usage-reports"
							used={usage.reports.used}
						/>
					</CardContent>
				</Card>
			)}

			{/* Plan Comparison Card */}
			<Card data-testid="billing-plans-comparison">
				<CardHeader className="p-4 sm:p-6">
					<CardTitle>All Plans</CardTitle>
					<CardDescription className="hidden sm:block">
						Compare features across plans
					</CardDescription>
				</CardHeader>
				<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
					<div className="grid gap-3 sm:grid-cols-2">
						{[PLAN_STARTER, PLAN_PRO].map((planSlug) => {
							const planMeta = PLAN_METADATA[planSlug];
							if (!planMeta) return null;
							const isCurrent = effectivePlan === planSlug;

							return (
								<div
									className={cn(
										"rounded border p-3 transition-colors",
										isCurrent
											? "border-[#d4ff00]/50 bg-[#d4ff00]/5"
											: "border-border bg-secondary/30",
									)}
									key={planSlug}
								>
									<div className="mb-2 flex items-center justify-between">
										<p className="font-medium font-mono text-xs uppercase tracking-wider">
											{planMeta.name}
										</p>
										{isCurrent && (
											<Badge
												className="bg-[#d4ff00]/20 font-mono text-[#d4ff00] text-[10px] uppercase tracking-wider"
												data-testid={`billing-badge-current-${planSlug}`}
											>
												Current
											</Badge>
										)}
									</div>
									<p className="mb-3 font-bold font-mono text-lg">
										{planMeta.price}
									</p>
									<ul className="space-y-1">
										{planMeta.features.map((f) => (
											<li
												className="font-mono text-[10px] text-muted-foreground"
												key={f}
											>
												<span className="mr-1 text-[#00ff88]">✓</span>
												{f}
											</li>
										))}
									</ul>
									{!isCurrent &&
										(() => {
											const isUpgrade =
												effectivePlan === PLAN_NONE ||
												(effectivePlan === PLAN_STARTER &&
													planSlug === PLAN_PRO);
											return isUpgrade ? (
												<Button
													asChild
													className="mt-3 w-full font-mono text-[10px] uppercase tracking-wider"
													size="sm"
													variant="outline"
												>
													<Link href="/pricing">Upgrade</Link>
												</Button>
											) : (
												<Button
													className="mt-3 w-full font-mono text-[10px] uppercase tracking-wider"
													onClick={() => openUserProfile()}
													size="sm"
													variant="outline"
												>
													Manage Plan
												</Button>
											);
										})()}
								</div>
							);
						})}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
