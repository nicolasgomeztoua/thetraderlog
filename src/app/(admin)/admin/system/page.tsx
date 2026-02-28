"use client";

import {
	Activity,
	AlertCircle,
	CheckCircle,
	Clock,
	Database,
	FileText,
	MessageSquare,
	Server,
	Users,
	XCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ERR_ADMIN_LOAD_SYSTEM_HEALTH_FAILED } from "@/lib/constants/errors";
import { api } from "@/trpc/react";

const TABLE_COUNT_CARDS = [
	{ key: "users" as const, label: "Users", icon: Users },
	{ key: "trades" as const, label: "Trades", icon: Activity },
	{ key: "accounts" as const, label: "Accounts", icon: FileText },
	{
		key: "aiConversations" as const,
		label: "AI Conversations",
		icon: MessageSquare,
	},
	{ key: "aiMessages" as const, label: "AI Messages", icon: MessageSquare },
	{ key: "bugReports" as const, label: "Bug Reports", icon: AlertCircle },
] as const;

function formatTimestamp(date: string | Date | null): string {
	if (!date) return "—";
	return new Date(date).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function AdminSystemPage() {
	const { data, isLoading, error } = api.admin.system.health.useQuery();

	const isConnected = data?.databaseStatus === "connected";

	return (
		<div>
			<h1 className="font-mono text-lg uppercase tracking-wider">
				System <span className="text-primary">Health</span>
			</h1>
			<p className="mt-2 font-mono text-muted-foreground text-xs">
				Database status, table counts, and system information
			</p>

			{error && (
				<div className="mt-4 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
					<AlertCircle className="size-4 shrink-0" />
					<span>{ERR_ADMIN_LOAD_SYSTEM_HEALTH_FAILED}</span>
				</div>
			)}

			{/* System Status */}
			<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
				{/* Database Connection */}
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex items-center gap-2">
						<Database className="size-4 text-muted-foreground" />
						<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Database Connection
						</span>
					</div>
					<div className="mt-3 flex items-center gap-2">
						{isLoading ? (
							<Skeleton className="h-6 w-32" />
						) : isConnected ? (
							<>
								<CheckCircle className="size-5 text-[#00ff88]" />
								<span className="font-mono text-[#00ff88] text-sm">
									Connected
								</span>
							</>
						) : (
							<>
								<XCircle className="size-5 text-[#ff3b3b]" />
								<span className="font-mono text-[#ff3b3b] text-sm">Error</span>
							</>
						)}
					</div>
				</div>

				{/* App Version */}
				<div className="rounded-lg border border-border bg-card p-5">
					<div className="flex items-center gap-2">
						<Server className="size-4 text-muted-foreground" />
						<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							App Version
						</span>
					</div>
					<div className="mt-3">
						{isLoading ? (
							<Skeleton className="h-6 w-24" />
						) : (
							<span className="font-bold font-mono text-primary text-xl">
								v{data?.appVersion ?? "unknown"}
							</span>
						)}
					</div>
				</div>
			</div>

			{/* Table Counts */}
			<div className="mt-6">
				<div className="flex items-center gap-2">
					<Database className="size-4 text-primary" />
					<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Database Row Counts
					</h2>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
					{TABLE_COUNT_CARDS.map((card) => {
						const Icon = card.icon;
						const value = data?.tableCounts[card.key] ?? 0;

						return (
							<div
								className="rounded-lg border border-border bg-card p-4"
								key={card.key}
							>
								<div className="flex items-center gap-1.5">
									<Icon className="size-3.5 text-muted-foreground" />
									<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
										{card.label}
									</span>
								</div>
								<div className="mt-2">
									{isLoading ? (
										<Skeleton className="h-7 w-16" />
									) : (
										<span className="font-bold font-mono text-lg text-primary">
											{value.toLocaleString()}
										</span>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Last Activity */}
			<div className="mt-6">
				<div className="flex items-center gap-2">
					<Clock className="size-4 text-primary" />
					<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Last Activity
					</h2>
				</div>
				<div className="mt-4 rounded-lg border border-border bg-card">
					{isLoading ? (
						<div className="space-y-4 p-5">
							<Skeleton className="h-5 w-64" />
							<Skeleton className="h-5 w-64" />
							<Skeleton className="h-5 w-64" />
						</div>
					) : (
						<div className="divide-y divide-border">
							<div className="flex items-center justify-between px-5 py-3">
								<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Last User Signup
								</span>
								<span className="font-mono text-sm">
									{formatTimestamp(data?.lastActivity.lastSignup ?? null)}
								</span>
							</div>
							<div className="flex items-center justify-between px-5 py-3">
								<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Last Trade
								</span>
								<span className="font-mono text-sm">
									{formatTimestamp(data?.lastActivity.lastTrade ?? null)}
								</span>
							</div>
							<div className="flex items-center justify-between px-5 py-3">
								<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Last AI Conversation
								</span>
								<span className="font-mono text-sm">
									{formatTimestamp(
										data?.lastActivity.lastAiConversation ?? null,
									)}
								</span>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
