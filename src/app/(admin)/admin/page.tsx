"use client";

import {
	Activity,
	AlertCircle,
	BarChart3,
	Bot,
	Bug,
	Users,
} from "lucide-react";
import Link from "next/link";
import { ERR_ADMIN_LOAD_STATS_FAILED } from "@/lib/constants/errors";
import { api } from "@/trpc/react";

const OVERVIEW_CARDS = [
	{
		label: "Total Users",
		key: "totalUsers" as const,
		href: "/admin/users",
		icon: Users,
		format: "number" as const,
	},
	{
		label: "Active Users (7d)",
		key: "activeUsersLast7d" as const,
		href: "/admin/users",
		icon: Activity,
		format: "number" as const,
	},
	{
		label: "Total Trades",
		key: "totalTrades" as const,
		href: "/admin/analytics",
		icon: BarChart3,
		format: "number" as const,
	},
	{
		label: "Open Bug Reports",
		key: "openBugReports" as const,
		href: "/admin/bug-reports",
		icon: Bug,
		format: "number" as const,
	},
	{
		label: "AI Conversations (7d)",
		key: "aiConversationsLast7d" as const,
		href: "/admin/ai",
		icon: Bot,
		format: "number" as const,
	},
	{
		label: "Total AI Tokens",
		key: "totalTokensUsed" as const,
		href: "/admin/ai",
		icon: Bot,
		format: "compact" as const,
	},
] as const;

function formatValue(value: number, format: "number" | "compact"): string {
	if (format === "compact") {
		if (value >= 1_000_000) {
			return `${(value / 1_000_000).toFixed(1)}M`;
		}
		if (value >= 1_000) {
			return `${(value / 1_000).toFixed(1)}K`;
		}
		return value.toLocaleString();
	}
	return value.toLocaleString();
}

export default function AdminOverviewPage() {
	const { data, isLoading, error } =
		api.admin.analytics.platformStats.useQuery();

	return (
		<div>
			<h1 className="font-mono text-lg uppercase tracking-wider">
				Admin <span className="text-primary">Overview</span>
			</h1>
			<p className="mt-2 font-mono text-muted-foreground text-xs">
				Platform metrics at a glance
			</p>

			{error && (
				<div className="mt-6 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
					<AlertCircle className="size-4 shrink-0" />
					<span>{ERR_ADMIN_LOAD_STATS_FAILED}</span>
				</div>
			)}

			<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{OVERVIEW_CARDS.map((card) => {
					const Icon = card.icon;
					const value = data?.[card.key] ?? 0;

					return (
						<Link
							className="group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-primary/5"
							href={card.href}
							key={card.key}
						>
							<div className="flex items-center justify-between">
								<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
									{card.label}
								</span>
								<Icon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
							</div>
							<div className="mt-3">
								{isLoading ? (
									<div className="h-8 w-24 animate-pulse rounded bg-muted" />
								) : (
									<span className="font-bold font-mono text-2xl text-primary">
										{formatValue(value, card.format)}
									</span>
								)}
							</div>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
