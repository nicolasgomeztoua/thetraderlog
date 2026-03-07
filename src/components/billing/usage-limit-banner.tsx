"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { api } from "@/trpc/react";

function getHoursUntilMidnightUTC(): number {
	const now = new Date();
	const midnight = new Date(now);
	midnight.setUTCDate(midnight.getUTCDate() + 1);
	midnight.setUTCHours(0, 0, 0, 0);
	return Math.ceil((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
}

function getNextMonthResetDate(): string {
	const now = new Date();
	const nextMonth = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
	);
	return nextMonth.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	});
}

interface UsageLimitBannerProps {
	type: "chat" | "reports";
}

export function UsageLimitBanner({ type }: UsageLimitBannerProps) {
	const { data: usage } = api.billing.getUsage.useQuery();

	if (!usage) return null;

	const bucket = type === "chat" ? usage.chat : usage.reports;

	// No limit (beta/unlimited) or not yet reached
	if (bucket.limit === null || bucket.used < bucket.limit) return null;

	const resetMessage =
		type === "chat"
			? `Resets in ${getHoursUntilMidnightUTC().toString()}h (midnight UTC)`
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
	const { data: usage } = api.billing.getUsage.useQuery();
	if (!usage) return false;
	return usage.chat.limit !== null && usage.chat.used >= usage.chat.limit;
}

export function useReportLimitReached(): boolean {
	const { data: usage } = api.billing.getUsage.useQuery();
	if (!usage) return false;
	return (
		usage.reports.limit !== null && usage.reports.used >= usage.reports.limit
	);
}
