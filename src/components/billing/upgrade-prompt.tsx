"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { Lock, MessageSquare, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	FEATURE_AI_CHAT,
	FEATURE_AI_REPORTS,
	FEATURE_CSV_IMPORT_EXPORT,
	FEATURE_CUSTOM_STRATEGIES,
	FEATURE_CUSTOM_TAGS,
	FEATURE_PDF_EXPORT,
	FEATURE_TRADE_MANAGEMENT,
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
};

interface UpgradePromptProps {
	feature: string;
	children: ReactNode;
}

export function UpgradePrompt({ feature, children }: UpgradePromptProps) {
	const { has, isLoaded } = useAuth();
	const { user } = useUser();

	if (!isLoaded) {
		return (
			<div className="flex h-full min-h-[300px] items-center justify-center p-6">
				<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
			</div>
		);
	}

	const isBeta = user?.publicMetadata?.beta === true;
	const hasAccess = isBeta || has?.({ feature });

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

interface UpgradeCardInlineProps {
	feature: string;
}

export function UpgradeCardInline({ feature }: UpgradeCardInlineProps) {
	const config = FEATURE_CONFIG[feature];
	if (!config) return null;
	return <UpgradeCard config={config} inline />;
}

function UpgradeCard({
	config,
	inline,
}: {
	config: (typeof FEATURE_CONFIG)[string];
	inline?: boolean;
}) {
	const Icon = config.icon;
	const accentColor = config.isAiFeature ? "#00d4ff" : "#d4ff00";
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
				className="mx-auto w-full max-w-md rounded-lg border bg-card p-6"
				style={{ borderColor: `${accentColor}33` }}
			>
				<div className="flex flex-col items-center gap-4 text-center">
					<div
						className="flex size-12 items-center justify-center rounded-full"
						style={{ backgroundColor: `${accentColor}1a` }}
					>
						<Icon className="size-6" style={{ color: accentColor }} />
					</div>

					<div className="space-y-2">
						<h3
							className="font-mono font-semibold text-lg"
							style={{ color: accentColor }}
						>
							{config.title}
						</h3>
						<p className="font-mono text-muted-foreground text-sm">
							{config.description}
						</p>
					</div>

					<div className="flex items-center gap-2 font-mono text-muted-foreground text-xs">
						<Lock className="size-3" />
						<span>Requires {planLabel} plan</span>
					</div>

					<Button asChild className="w-full font-mono" size="sm">
						<Link href="/pricing">
							<Zap className="mr-2 size-4" />
							Upgrade to {planLabel}
						</Link>
					</Button>
				</div>
			</div>
		</div>
	);
}
