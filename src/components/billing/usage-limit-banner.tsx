"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { AlertTriangle, Clock } from "lucide-react";
import {
	getNextMonthResetDate,
	getTimeUntilMidnightUTC,
} from "@/lib/billing/utils";
import { PLAN_PRO } from "@/lib/constants/billing";
import { api } from "@/trpc/react";

function useHasAiPlan(): boolean {
	const { has } = useAuth();
	const { user } = useUser();
	const isBeta = user?.publicMetadata?.beta === true;
	return isBeta || !!has?.({ plan: PLAN_PRO });
}

interface UsageLimitBannerProps {
	type: "chat" | "reports";
}

export function UsageLimitBanner({ type }: UsageLimitBannerProps) {
	const hasAiPlan = useHasAiPlan();
	const { data: usage } = api.billing.getUsage.useQuery(undefined, {
		enabled: hasAiPlan,
	});

	if (!usage) return null;

	const bucket = type === "chat" ? usage.chat : usage.reports;

	// No limit (beta/unlimited) or not yet reached
	if (bucket.limit === null || bucket.used < bucket.limit) return null;

	const resetMessage =
		type === "chat"
			? `Resets in ${getTimeUntilMidnightUTC()} (midnight UTC)`
			: `Resets ${getNextMonthResetDate()}`;

	return (
		<div
			className="flex items-center gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2"
			data-testid={`usage-limit-banner-${type}`}
		>
			<AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
			<span className="font-mono text-amber-500 text-xs">
				{type === "chat" ? "Daily" : "Monthly"} limit reached
			</span>
			<span className="font-mono text-[10px] text-amber-500/60">|</span>
			<Clock className="size-3 shrink-0 text-amber-500/60" />
			<span className="font-mono text-[10px] text-amber-500/60">
				{resetMessage}
			</span>
		</div>
	);
}

export function useChatLimitReached(): boolean {
	const hasPaidPlan = useHasAiPlan();
	const { data: usage } = api.billing.getUsage.useQuery(undefined, {
		enabled: hasPaidPlan,
	});
	if (!usage) return false;
	return usage.chat.limit !== null && usage.chat.used >= usage.chat.limit;
}

export function useReportLimitReached(): boolean {
	const hasPaidPlan = useHasAiPlan();
	const { data: usage } = api.billing.getUsage.useQuery(undefined, {
		enabled: hasPaidPlan,
	});
	if (!usage) return false;
	return (
		usage.reports.limit !== null && usage.reports.used >= usage.reports.limit
	);
}
