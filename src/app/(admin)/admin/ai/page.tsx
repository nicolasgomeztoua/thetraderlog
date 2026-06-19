"use client";

import type { AgCartesianChartOptions } from "ag-charts-community";
import { AgCharts } from "ag-charts-react";
import {
	AlertCircle,
	Bot,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	MessageSquare,
	Zap,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	ADMIN_TABLE_PAGE_SIZE,
	AI_CONVERSATION_MODE_COLORS,
	AI_CONVERSATION_MODE_LABELS,
	AI_CONVERSATION_STATUS_COLORS,
	AI_CONVERSATION_STATUS_LABELS,
} from "@/lib/constants/admin";
import { ERR_ADMIN_LOAD_CONVERSATIONS_FAILED } from "@/lib/constants/errors";
import { api } from "@/trpc/react";

type ConversationMode = "chat" | "report";
type ConversationStatus = "active" | "generating" | "complete" | "failed";

interface DailyUsageData {
	date: string;
	tokens: number;
	messageCount: number;
}

function formatCompact(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
	return value.toLocaleString();
}

function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function TokenUsageChart({ data }: { data: DailyUsageData[] }) {
	const chartOptions: AgCartesianChartOptions<DailyUsageData> = useMemo(() => {
		if (!data || data.length === 0) return { data: [] };

		return {
			background: { fill: "transparent" },
			data: data.map((d) => ({
				...d,
				date: new Date(d.date).toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
				}),
			})),
			series: [
				{
					type: "bar" as const,
					xKey: "date",
					yKey: "tokens",
					yName: "Tokens",
					fill: "#00d4ff",
					cornerRadius: 2,
				},
			],
			axes: [
				{
					type: "category" as const,
					position: "bottom" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						rotation: -45,
					},
					line: { stroke: "#1e293b" },
				},
				{
					type: "number" as const,
					position: "left" as const,
					label: {
						color: "#64748b",
						fontFamily: "JetBrains Mono, monospace",
						fontSize: 9,
						formatter: (params: { value: number }) =>
							formatCompact(params.value),
					},
					line: { stroke: "#1e293b" },
					gridLine: { style: [{ stroke: "#ffffff08" }] },
				},
			],
		};
	}, [data]);

	if (!data || data.length === 0) {
		return (
			<div className="flex h-[250px] items-center justify-center font-mono text-muted-foreground text-xs">
				No usage data available
			</div>
		);
	}

	return <AgCharts options={chartOptions} style={{ height: 250 }} />;
}

export default function AdminAIPage() {
	const [page, setPage] = useState(1);
	const [modeFilter, setModeFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const { data: stats, isLoading: statsLoading } =
		api.admin.ai.usageStats.useQuery();

	const {
		data: conversations,
		isLoading: conversationsLoading,
		error: conversationsError,
	} = api.admin.ai.listConversations.useQuery({
		page,
		pageSize: ADMIN_TABLE_PAGE_SIZE,
		mode: modeFilter !== "all" ? (modeFilter as ConversationMode) : undefined,
		status:
			statusFilter !== "all" ? (statusFilter as ConversationStatus) : undefined,
	});

	const expandedConversation = api.admin.ai.getConversation.useQuery(
		{ id: expandedId ?? "" },
		{ enabled: !!expandedId },
	);

	const totalConversations =
		stats?.conversationsByMode.reduce((sum, m) => sum + m.count, 0) ?? 0;
	const reportCount =
		stats?.conversationsByMode.find((m) => m.mode === "report")?.count ?? 0;
	const avgTokens =
		totalConversations > 0
			? Math.round((stats?.totalTokensUsed ?? 0) / totalConversations)
			: 0;

	return (
		<div>
			<h1 className="font-mono text-lg uppercase tracking-wider">
				AI <span className="text-[#00d4ff]">Usage</span>
			</h1>
			<p className="mt-2 font-mono text-muted-foreground text-xs">
				Monitor AI conversations, reports, and token consumption
			</p>

			{/* Top Stats */}
			<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{[
					{
						label: "Total Conversations",
						value: totalConversations,
						icon: MessageSquare,
						format: "number" as const,
					},
					{
						label: "Total Reports",
						value: reportCount,
						icon: Bot,
						format: "number" as const,
					},
					{
						label: "Total Tokens",
						value: stats?.totalTokensUsed ?? 0,
						icon: Zap,
						format: "compact" as const,
					},
					{
						label: "Avg Tokens / Conversation",
						value: avgTokens,
						icon: Zap,
						format: "compact" as const,
					},
				].map((card) => {
					const Icon = card.icon;
					return (
						<div
							className="rounded-lg border border-border bg-card p-5"
							key={card.label}
						>
							<div className="flex items-center justify-between">
								<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
									{card.label}
								</span>
								<Icon className="size-4 text-[#00d4ff]" />
							</div>
							<div className="mt-3">
								{statsLoading ? (
									<div className="h-8 w-24 animate-pulse rounded bg-muted" />
								) : (
									<span className="font-bold font-mono text-2xl text-[#00d4ff]">
										{card.format === "compact"
											? formatCompact(card.value)
											: card.value.toLocaleString()}
									</span>
								)}
							</div>
						</div>
					);
				})}
			</div>

			{/* Token Usage Chart */}
			<div className="mt-6 rounded-lg border border-border bg-card p-5">
				<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Token Usage — Last 30 Days
				</h2>
				<div className="mt-4">
					{statsLoading ? (
						<Skeleton className="h-[250px] w-full" />
					) : (
						<TokenUsageChart data={stats?.dailyUsage ?? []} />
					)}
				</div>
			</div>

			{/* Conversations Table */}
			<div className="mt-6">
				<h2 className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Conversations
				</h2>

				{/* Filters */}
				<div className="mt-4 flex flex-wrap items-center gap-3">
					<Select
						onValueChange={(v) => {
							setModeFilter(v);
							setPage(1);
						}}
						value={modeFilter}
					>
						<SelectTrigger className="font-mono text-xs" size="sm">
							<SelectValue placeholder="Mode" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Modes</SelectItem>
							{Object.entries(AI_CONVERSATION_MODE_LABELS).map(
								([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) => {
							setStatusFilter(v);
							setPage(1);
						}}
						value={statusFilter}
					>
						<SelectTrigger className="font-mono text-xs" size="sm">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Statuses</SelectItem>
							{Object.entries(AI_CONVERSATION_STATUS_LABELS).map(
								([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>

					{conversations && (
						<span className="ml-auto font-mono text-muted-foreground text-xs">
							{conversations.total} conversation
							{conversations.total !== 1 ? "s" : ""}
						</span>
					)}
				</div>

				{/* Error state */}
				{conversationsError && (
					<div className="mt-4 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
						<AlertCircle className="size-4 shrink-0" />
						<span>{ERR_ADMIN_LOAD_CONVERSATIONS_FAILED}</span>
					</div>
				)}

				{/* Table */}
				<div className="mt-4 rounded-lg border border-border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="font-mono text-xs uppercase tracking-wider">
									User
								</TableHead>
								<TableHead className="font-mono text-xs uppercase tracking-wider">
									Title
								</TableHead>
								<TableHead className="font-mono text-xs uppercase tracking-wider">
									Mode
								</TableHead>
								<TableHead className="font-mono text-xs uppercase tracking-wider">
									Status
								</TableHead>
								<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
									Messages
								</TableHead>
								<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
									Tokens
								</TableHead>
								<TableHead className="font-mono text-xs uppercase tracking-wider">
									Date
								</TableHead>
								<TableHead className="w-10" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{conversationsLoading &&
								Array.from({ length: 5 }).map((_, i) => (
									<TableRow key={`skeleton-${i.toString()}`}>
										{Array.from({ length: 8 }).map((_, j) => (
											<TableCell key={`skeleton-cell-${j.toString()}`}>
												<div className="h-4 w-20 animate-pulse rounded bg-muted" />
											</TableCell>
										))}
									</TableRow>
								))}

							{conversations?.items.length === 0 && (
								<TableRow>
									<TableCell
										className="py-8 text-center font-mono text-muted-foreground text-sm"
										colSpan={8}
									>
										No conversations found
									</TableCell>
								</TableRow>
							)}

							{conversations?.items.map((convo) => {
								const isExpanded = expandedId === convo.id;

								return (
									<Fragment key={convo.id}>
										<TableRow
											className="cursor-pointer"
											onClick={() =>
												setExpandedId(isExpanded ? null : convo.id)
											}
										>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{convo.user.name ?? convo.user.email}
											</TableCell>
											<TableCell className="max-w-[250px] truncate font-mono text-sm">
												{convo.title ?? "Untitled"}
											</TableCell>
											<TableCell>
												<span
													className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${AI_CONVERSATION_MODE_COLORS[convo.mode ?? ""] ?? ""}`}
												>
													{AI_CONVERSATION_MODE_LABELS[convo.mode ?? ""] ??
														convo.mode ??
														"—"}
												</span>
											</TableCell>
											<TableCell>
												<span
													className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${AI_CONVERSATION_STATUS_COLORS[convo.status] ?? ""}`}
												>
													{AI_CONVERSATION_STATUS_LABELS[convo.status] ??
														convo.status}
												</span>
											</TableCell>
											<TableCell className="text-right font-mono text-muted-foreground text-xs">
												{convo.messageCount}
											</TableCell>
											<TableCell className="text-right font-mono text-muted-foreground text-xs">
												{formatCompact(convo.tokenCount)}
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{formatDate(convo.createdAt)}
											</TableCell>
											<TableCell>
												{isExpanded ? (
													<ChevronUp className="size-4 text-muted-foreground" />
												) : (
													<ChevronDown className="size-4 text-muted-foreground" />
												)}
											</TableCell>
										</TableRow>

										{/* Expanded messages */}
										{isExpanded && (
											<TableRow className="hover:bg-transparent">
												<TableCell
													className="border-t-0 bg-muted/20 p-0"
													colSpan={8}
												>
													<div className="max-h-96 overflow-y-auto px-6 py-4">
														{expandedConversation.isLoading ? (
															<div className="space-y-3">
																{Array.from({ length: 3 }).map((_, i) => (
																	<div
																		className="h-16 animate-pulse rounded bg-muted"
																		key={`msg-skeleton-${i.toString()}`}
																	/>
																))}
															</div>
														) : expandedConversation.data?.messages.length ===
															0 ? (
															<p className="font-mono text-muted-foreground text-xs">
																No messages in this conversation
															</p>
														) : (
															<div className="space-y-3">
																{expandedConversation.data?.messages.map(
																	(msg) => (
																		<div
																			className={`rounded border p-3 ${
																				msg.role === "assistant"
																					? "border-[#00d4ff]/20 bg-[#00d4ff]/5"
																					: msg.role === "user"
																						? "border-border bg-background"
																						: "border-primary/20 bg-primary/5"
																			}`}
																			key={msg.id}
																		>
																			<div className="flex items-center justify-between">
																				<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
																					{msg.role}
																				</span>
																				<div className="flex items-center gap-3">
																					{msg.tokensUsed && (
																						<span className="font-mono text-muted-foreground text-xs">
																							{formatCompact(msg.tokensUsed)}{" "}
																							tokens
																						</span>
																					)}
																					{msg.model && (
																						<span className="font-mono text-muted-foreground text-xs">
																							{msg.model}
																						</span>
																					)}
																				</div>
																			</div>
																			<p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">
																				{msg.content}
																			</p>
																		</div>
																	),
																)}
															</div>
														)}
													</div>
												</TableCell>
											</TableRow>
										)}
									</Fragment>
								);
							})}
						</TableBody>
					</Table>
				</div>

				{/* Pagination */}
				{conversations && conversations.totalPages > 1 && (
					<div className="mt-4 flex items-center justify-between">
						<span className="font-mono text-muted-foreground text-xs">
							Page {conversations.page} of {conversations.totalPages}
						</span>
						<div className="flex items-center gap-2">
							<Button
								disabled={conversations.page <= 1}
								onClick={() => setPage((p) => p - 1)}
								size="icon-sm"
								variant="outline"
							>
								<ChevronLeft className="size-4" />
							</Button>
							<Button
								disabled={conversations.page >= conversations.totalPages}
								onClick={() => setPage((p) => p + 1)}
								size="icon-sm"
								variant="outline"
							>
								<ChevronRight className="size-4" />
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
