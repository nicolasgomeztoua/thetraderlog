"use client";

import {
	AlertCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	ExternalLink,
	Globe,
	Monitor,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	BUG_REPORT_CATEGORY_LABELS,
	BUG_REPORT_SEVERITY_COLORS,
	BUG_REPORT_SEVERITY_LABELS,
	BUG_REPORT_STATUS_COLORS,
	BUG_REPORT_STATUS_LABELS,
} from "@/lib/constants/admin";
import { ERR_ADMIN_LOAD_BUG_REPORTS_FAILED } from "@/lib/constants/errors";
import { api } from "@/trpc/react";

type BugReportStatus = "open" | "in_progress" | "resolved" | "closed";
type BugReportSeverity = "low" | "medium" | "high" | "critical";
type BugReportCategory = "ui" | "data" | "performance" | "crash" | "other";

const STATUS_TRANSITIONS: Record<string, BugReportStatus[]> = {
	open: ["in_progress", "closed"],
	in_progress: ["resolved", "open", "closed"],
	resolved: ["closed", "open"],
	closed: ["open"],
};

export default function AdminBugReportsPage() {
	const [page, setPage] = useState(1);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");
	const [severityFilter, setSeverityFilter] = useState<string>("all");
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const utils = api.useUtils();

	const { data, isLoading, error } = api.admin.bugReports.list.useQuery({
		page,
		pageSize: ADMIN_TABLE_PAGE_SIZE,
		status:
			statusFilter !== "all" ? (statusFilter as BugReportStatus) : undefined,
		category:
			categoryFilter !== "all"
				? (categoryFilter as BugReportCategory)
				: undefined,
		severity:
			severityFilter !== "all"
				? (severityFilter as BugReportSeverity)
				: undefined,
	});

	const updateStatus = api.admin.bugReports.updateStatus.useMutation({
		onSuccess: () => {
			utils.admin.bugReports.list.invalidate();
		},
	});

	const handleStatusChange = (id: string, status: BugReportStatus) => {
		updateStatus.mutate({ id, status });
	};

	const formatDate = (date: Date | string) => {
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div>
			<h1 className="font-mono text-lg uppercase tracking-wider">
				Bug <span className="text-primary">Reports</span>
			</h1>
			<p className="mt-2 font-mono text-muted-foreground text-xs">
				Triage and manage reported issues
			</p>

			{/* Filters */}
			<div className="mt-6 flex flex-wrap items-center gap-3">
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
						{Object.entries(BUG_REPORT_STATUS_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					onValueChange={(v) => {
						setCategoryFilter(v);
						setPage(1);
					}}
					value={categoryFilter}
				>
					<SelectTrigger className="font-mono text-xs" size="sm">
						<SelectValue placeholder="Category" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Categories</SelectItem>
						{Object.entries(BUG_REPORT_CATEGORY_LABELS).map(
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
						setSeverityFilter(v);
						setPage(1);
					}}
					value={severityFilter}
				>
					<SelectTrigger className="font-mono text-xs" size="sm">
						<SelectValue placeholder="Severity" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Severities</SelectItem>
						{Object.entries(BUG_REPORT_SEVERITY_LABELS).map(
							([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							),
						)}
					</SelectContent>
				</Select>

				{data && (
					<span className="ml-auto font-mono text-muted-foreground text-xs">
						{data.total} report{data.total !== 1 ? "s" : ""}
					</span>
				)}
			</div>

			{/* Error state */}
			{error && (
				<div className="mt-6 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
					<AlertCircle className="size-4 shrink-0" />
					<span>{ERR_ADMIN_LOAD_BUG_REPORTS_FAILED}</span>
				</div>
			)}

			{/* Table */}
			<div className="mt-4 rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Title
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Category
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Severity
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Status
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Reporter
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Date
							</TableHead>
							<TableHead className="w-10" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<TableRow key={`skeleton-${i.toString()}`}>
									{Array.from({ length: 7 }).map((_, j) => (
										<TableCell key={`skeleton-cell-${j.toString()}`}>
											<div className="h-4 w-20 animate-pulse rounded bg-muted" />
										</TableCell>
									))}
								</TableRow>
							))}

						{data?.items.length === 0 && (
							<TableRow>
								<TableCell
									className="py-8 text-center font-mono text-muted-foreground text-sm"
									colSpan={7}
								>
									No bug reports found
								</TableCell>
							</TableRow>
						)}

						{data?.items.map((report) => {
							const isExpanded = expandedId === report.id;
							const availableTransitions =
								STATUS_TRANSITIONS[report.status] ?? [];

							return (
								<>
									<TableRow
										className="cursor-pointer"
										key={report.id}
										onClick={() => setExpandedId(isExpanded ? null : report.id)}
									>
										<TableCell className="max-w-[300px] truncate font-mono text-sm">
											{report.title}
										</TableCell>
										<TableCell>
											<span className="font-mono text-muted-foreground text-xs">
												{BUG_REPORT_CATEGORY_LABELS[report.category] ??
													report.category}
											</span>
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${BUG_REPORT_SEVERITY_COLORS[report.severity] ?? ""}`}
											>
												{BUG_REPORT_SEVERITY_LABELS[report.severity] ??
													report.severity}
											</span>
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger
													asChild
													onClick={(e) => e.stopPropagation()}
												>
													<button
														className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs transition-colors hover:opacity-80 ${BUG_REPORT_STATUS_COLORS[report.status] ?? ""}`}
														type="button"
													>
														{BUG_REPORT_STATUS_LABELS[report.status] ??
															report.status}
														<ChevronDown className="size-3" />
													</button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="start">
													{availableTransitions.map((status) => (
														<DropdownMenuItem
															className="font-mono text-xs"
															key={status}
															onClick={(e) => {
																e.stopPropagation();
																handleStatusChange(report.id, status);
															}}
														>
															<span
																className={`mr-2 inline-block size-2 rounded-full ${BUG_REPORT_STATUS_COLORS[status]?.split(" ")[0] ?? ""}`}
															/>
															{BUG_REPORT_STATUS_LABELS[status] ?? status}
														</DropdownMenuItem>
													))}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
										<TableCell className="font-mono text-muted-foreground text-xs">
											{report.user.name ?? report.user.email}
										</TableCell>
										<TableCell className="font-mono text-muted-foreground text-xs">
											{formatDate(report.createdAt)}
										</TableCell>
										<TableCell>
											{isExpanded ? (
												<ChevronUp className="size-4 text-muted-foreground" />
											) : (
												<ChevronDown className="size-4 text-muted-foreground" />
											)}
										</TableCell>
									</TableRow>

									{/* Expanded detail row */}
									{isExpanded && (
										<TableRow
											className="hover:bg-transparent"
											key={`${report.id}-detail`}
										>
											<TableCell
												className="border-t-0 bg-muted/20 p-0"
												colSpan={7}
											>
												<div className="px-6 py-4">
													{/* Description */}
													{report.description && (
														<div className="mb-4">
															<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
																Description
															</span>
															<p className="mt-1 font-mono text-sm leading-relaxed">
																{report.description}
															</p>
														</div>
													)}

													{/* Metadata grid */}
													<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
														{report.pageUrl && (
															<div>
																<span className="flex items-center gap-1 font-mono text-muted-foreground text-xs uppercase tracking-wider">
																	<Globe className="size-3" />
																	Page URL
																</span>
																<a
																	className="mt-1 flex items-center gap-1 font-mono text-primary text-xs hover:underline"
																	href={report.pageUrl}
																	rel="noopener noreferrer"
																	target="_blank"
																>
																	{report.pageUrl}
																	<ExternalLink className="size-3" />
																</a>
															</div>
														)}

														{report.userAgent && (
															<div>
																<span className="flex items-center gap-1 font-mono text-muted-foreground text-xs uppercase tracking-wider">
																	<Monitor className="size-3" />
																	User Agent
																</span>
																<p className="mt-1 max-w-xs truncate font-mono text-xs">
																	{report.userAgent}
																</p>
															</div>
														)}

														{report.screenshotKey && (
															<div>
																<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
																	Screenshot
																</span>
																<p className="mt-1 font-mono text-primary text-xs">
																	Attached
																</p>
															</div>
														)}
													</div>

													{/* Raw metadata */}
													{report.metadata &&
														Object.keys(
															report.metadata as Record<string, unknown>,
														).length > 0 && (
															<div className="mt-4">
																<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
																	Metadata
																</span>
																<pre className="mt-1 max-h-32 overflow-auto rounded border border-border bg-background p-3 font-mono text-xs">
																	{JSON.stringify(report.metadata, null, 2)}
																</pre>
															</div>
														)}
												</div>
											</TableCell>
										</TableRow>
									)}
								</>
							);
						})}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			{data && data.totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between">
					<span className="font-mono text-muted-foreground text-xs">
						Page {data.page} of {data.totalPages}
					</span>
					<div className="flex items-center gap-2">
						<Button
							disabled={data.page <= 1}
							onClick={() => setPage((p) => p - 1)}
							size="icon-sm"
							variant="outline"
						>
							<ChevronLeft className="size-4" />
						</Button>
						<Button
							disabled={data.page >= data.totalPages}
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
	);
}
