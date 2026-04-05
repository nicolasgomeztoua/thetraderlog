"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	Lock,
	MessageSquare,
	Play,
	Sparkles,
	Zap,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { isBetaFromMetadata } from "@/lib/billing/utils";
import {
	FEATURE_AI_CHAT,
	FEATURE_AI_REPORTS,
	FEATURE_ANALYTICS,
	FEATURE_CSV_IMPORT_EXPORT,
	FEATURE_CUSTOM_STRATEGIES,
	FEATURE_CUSTOM_TAGS,
	FEATURE_DAILY_JOURNAL,
	FEATURE_PDF_EXPORT,
	FEATURE_TRADE_MANAGEMENT,
	FEATURE_TRADE_REPLAY,
	PLAN_PRO,
	PLAN_STARTER,
} from "@/lib/constants/billing";

const FEATURE_CONFIG: Record<
	string,
	{
		title: string;
		description: string;
		icon: typeof Lock;
		planRequired: string;
		isAiFeature: boolean;
	}
> = {
	[FEATURE_AI_CHAT]: {
		title: "Unlock AI Chat",
		description:
			"Get AI-powered trading insights with up to 50 messages per day.",
		icon: MessageSquare,
		planRequired: PLAN_PRO,
		isAiFeature: true,
	},
	[FEATURE_AI_REPORTS]: {
		title: "Unlock AI Reports",
		description:
			"Generate detailed AI analysis reports for your trading performance.",
		icon: Sparkles,
		planRequired: PLAN_PRO,
		isAiFeature: true,
	},
	[FEATURE_PDF_EXPORT]: {
		title: "Unlock PDF Export",
		description: "Download your AI reports as professionally formatted PDFs.",
		icon: Sparkles,
		planRequired: PLAN_PRO,
		isAiFeature: true,
	},
	[FEATURE_TRADE_MANAGEMENT]: {
		title: "Unlock Trade Management",
		description:
			"Log, edit, and manage your trades with full journaling capabilities.",
		icon: Zap,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
	[FEATURE_CSV_IMPORT_EXPORT]: {
		title: "Unlock CSV Import",
		description:
			"Import trades from your broker platform via CSV for fast onboarding.",
		icon: Zap,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
	[FEATURE_CUSTOM_TAGS]: {
		title: "Unlock Custom Tags",
		description: "Create and manage custom tags to categorize your trades.",
		icon: Zap,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
	[FEATURE_CUSTOM_STRATEGIES]: {
		title: "Unlock Custom Strategies",
		description:
			"Define and track your own trading strategies for deeper analysis.",
		icon: Zap,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
	[FEATURE_ANALYTICS]: {
		title: "Unlock Advanced Analytics",
		description:
			"Deep-dive into time, risk, and behavioral patterns across your trades.",
		icon: BarChart3,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
	[FEATURE_DAILY_JOURNAL]: {
		title: "Unlock Daily Journal",
		description:
			"Reflect on your trading day with a rich journal, checklists, and calendar.",
		icon: BookOpen,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
	[FEATURE_TRADE_REPLAY]: {
		title: "Unlock Trade Replay",
		description:
			"Replay your trades tick-by-tick to study entries, exits, and execution.",
		icon: Play,
		planRequired: PLAN_STARTER,
		isAiFeature: false,
	},
};

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Reusable hook that checks if the current user has access to a feature.
 * Includes beta bypass. Use for conditional rendering (lock icons, button swaps)
 * without wrapping entire sections in <UpgradePrompt>.
 */
export function useHasFeature(feature: string): {
	hasAccess: boolean;
	isLoaded: boolean;
} {
	const { has, isLoaded } = useAuth();
	const { user } = useUser();

	if (!isLoaded) return { hasAccess: false, isLoaded: false };

	const isBeta = isBetaFromMetadata(
		user?.publicMetadata as Record<string, unknown> | undefined,
	);
	const hasAccess = isBeta || !!has?.({ feature });

	return { hasAccess, isLoaded };
}

// =============================================================================
// COMPONENTS
// =============================================================================

interface UpgradePromptProps {
	feature: string;
	children: ReactNode;
}

export function UpgradePrompt({ feature, children }: UpgradePromptProps) {
	const { hasAccess, isLoaded } = useHasFeature(feature);

	if (!isLoaded) {
		return (
			<div className="flex h-full min-h-[300px] items-center justify-center p-6">
				<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
			</div>
		);
	}

	if (hasAccess) {
		return <>{children}</>;
	}

	const config = FEATURE_CONFIG[feature];
	if (!config) {
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				`UpgradePrompt: no config found for feature "${feature}". Add it to FEATURE_CONFIG.`,
			);
		}
		return <>{children}</>;
	}

	return <UpgradeCard config={config} />;
}

/**
 * Blurred teaser gate — renders children blurred with upgrade card overlaid.
 * Free users see the content exists (charts, tables) but can't interact.
 */
export function UpgradeOverlay({ feature, children }: UpgradePromptProps) {
	const { hasAccess, isLoaded } = useHasFeature(feature);

	if (!isLoaded) {
		return (
			<div className="flex h-full min-h-[300px] items-center justify-center p-6">
				<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
			</div>
		);
	}

	if (hasAccess) {
		return <>{children}</>;
	}

	const config = FEATURE_CONFIG[feature];
	if (!config) {
		if (process.env.NODE_ENV !== "production") {
			console.warn(
				`UpgradeOverlay: no config found for feature "${feature}". Add it to FEATURE_CONFIG.`,
			);
		}
		return <>{children}</>;
	}

	return (
		<div className="relative">
			<div aria-hidden className="pointer-events-none select-none blur-[6px]">
				{children}
			</div>
			<div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[1px]">
				{/* Subtle gradient atmosphere */}
				<div
					className={`-left-20 pointer-events-none absolute top-1/4 size-75 rounded-full blur-[100px] ${
						config.isAiFeature ? "bg-accent/5" : "bg-primary/5"
					}`}
				/>
				<UpgradeCard config={config} />
			</div>
		</div>
	);
}

interface UpgradeCardInlineProps {
	feature: string;
}

export function UpgradeCardInline({ feature }: UpgradeCardInlineProps) {
	const config = FEATURE_CONFIG[feature];
	if (!config) return null;
	return <UpgradeCard config={config} inline />;
}

interface UpgradeButtonCompactProps {
	feature: string;
	testId?: string;
}

export function UpgradeButtonCompact({
	feature,
	testId,
}: UpgradeButtonCompactProps) {
	const config = FEATURE_CONFIG[feature];
	if (!config) return null;
	const isAi = config.isAiFeature;

	return (
		<Link
			className={`group inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all ${
				isAi
					? "border-accent/20 bg-accent/[0.05] text-accent/70 hover:border-accent/40 hover:text-accent"
					: "border-primary/20 bg-primary/[0.05] text-primary/70 hover:border-primary/40 hover:text-primary"
			}`}
			data-testid={testId}
			href="/pricing"
		>
			<Lock className="size-2.5" />
			{config.title}
			<ArrowRight className="size-2.5 transition-transform group-hover:translate-x-0.5" />
		</Link>
	);
}

function UpgradeCard({
	config,
	inline,
}: {
	config: (typeof FEATURE_CONFIG)[string];
	inline?: boolean;
}) {
	const Icon = config.icon;
	const isAi = config.isAiFeature;
	const planLabel = config.planRequired === PLAN_PRO ? "Pro" : "Starter";

	return (
		<div
			className={
				inline
					? "w-full"
					: "flex h-full min-h-[300px] items-center justify-center p-6"
			}
			data-testid="upgrade-prompt"
		>
			<div
				className={`relative mx-auto w-full max-w-md overflow-hidden rounded border ${
					isAi
						? "border-accent/20 bg-accent/[0.02]"
						: "border-primary/20 bg-primary/[0.02]"
				}`}
			>
				{/* Grid background */}
				<div
					className="pointer-events-none absolute inset-0 opacity-30"
					style={{
						backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
						linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
						backgroundSize: "40px 40px",
					}}
				/>

				{/* Terminal chrome header */}
				<div className="relative flex items-center gap-2 border-white/5 border-b bg-white/[0.02] px-4 py-2">
					<div className="flex items-center gap-1.5">
						<div className="size-2 rounded-full bg-loss/60" />
						<div className="size-2 rounded-full bg-breakeven/60" />
						<div className="size-2 rounded-full bg-profit/60" />
					</div>
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						upgrade required
					</span>
				</div>

				{/* Content */}
				<div className="relative flex flex-col items-center gap-5 p-6 text-center">
					{/* Icon */}
					<div
						className={`flex size-10 items-center justify-center rounded border ${
							isAi
								? "border-accent/20 bg-accent/10"
								: "border-primary/20 bg-primary/10"
						}`}
					>
						<Icon
							className={`size-5 ${isAi ? "text-accent" : "text-primary"}`}
						/>
					</div>

					{/* Copy */}
					<div className="space-y-2">
						<h3
							className={`font-mono font-semibold text-base ${
								isAi ? "text-accent" : "text-primary"
							}`}
						>
							{config.title}
						</h3>
						<p className="max-w-xs font-mono text-muted-foreground text-xs leading-relaxed">
							{config.description}
						</p>
					</div>

					{/* Plan badge */}
					<div
						className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
							isAi
								? "border-accent/20 text-accent/70"
								: "border-primary/20 text-primary/70"
						}`}
					>
						<Lock className="size-2.5" />
						<span>Requires {planLabel} plan</span>
					</div>

					{/* CTA */}
					<div className="w-full space-y-2">
						<Button
							asChild
							className="w-full font-mono text-xs uppercase tracking-wider"
							size="sm"
						>
							<Link href="/pricing">
								<span className="mr-2 opacity-50">$</span>
								Start 30-Day Free Trial
								<ArrowRight className="ml-2 size-3.5 transition-transform group-hover:translate-x-1" />
							</Link>
						</Button>
						<p className="font-mono text-[10px] text-muted-foreground">
							30-day free trial &middot; {planLabel} plan
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
