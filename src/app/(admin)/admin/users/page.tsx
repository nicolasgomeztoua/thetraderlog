"use client";

import { AlertCircle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
	ROLE_COLORS,
	ROLE_LABELS,
} from "@/lib/constants/admin";
import { api } from "@/trpc/react";

export default function AdminUsersPage() {
	const router = useRouter();
	const [page, setPage] = useState(1);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");

	const { data, isLoading, error } = api.admin.users.list.useQuery({
		page,
		pageSize: ADMIN_TABLE_PAGE_SIZE,
		search: search || undefined,
	});

	const handleSearch = () => {
		setSearch(searchInput);
		setPage(1);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const formatDate = (date: Date | string | null) => {
		if (!date) return "—";
		return new Date(date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	return (
		<div>
			<h1 className="font-mono text-lg uppercase tracking-wider">
				User <span className="text-primary">Management</span>
			</h1>
			<p className="mt-2 font-mono text-muted-foreground text-xs">
				View and manage all platform users
			</p>

			{/* Search */}
			<div className="mt-6 flex items-center gap-3">
				<div className="relative max-w-sm flex-1">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
					<Input
						className="pl-9 font-mono text-xs"
						onChange={(e) => setSearchInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search by name or email..."
						value={searchInput}
					/>
				</div>
				<Button
					className="font-mono text-xs"
					onClick={handleSearch}
					size="sm"
					variant="outline"
				>
					Search
				</Button>
				{search && (
					<Button
						className="font-mono text-xs"
						onClick={() => {
							setSearchInput("");
							setSearch("");
							setPage(1);
						}}
						size="sm"
						variant="ghost"
					>
						Clear
					</Button>
				)}

				{data && (
					<span className="ml-auto font-mono text-muted-foreground text-xs">
						{data.total} user{data.total !== 1 ? "s" : ""}
					</span>
				)}
			</div>

			{/* Error state */}
			{error && (
				<div className="mt-6 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
					<AlertCircle className="size-4 shrink-0" />
					<span>Failed to load users</span>
				</div>
			)}

			{/* Table */}
			<div className="mt-4 rounded-lg border border-border">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Name
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Email
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Role
							</TableHead>
							<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
								Accounts
							</TableHead>
							<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
								Trades
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Joined
							</TableHead>
							<TableHead className="font-mono text-xs uppercase tracking-wider">
								Last Active
							</TableHead>
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
									No users found
								</TableCell>
							</TableRow>
						)}

						{data?.items.map((user) => (
							<TableRow
								className="cursor-pointer"
								key={user.id}
								onClick={() => router.push(`/admin/users/${user.id}`)}
							>
								<TableCell className="font-mono text-sm">
									{user.name ?? "—"}
								</TableCell>
								<TableCell className="font-mono text-muted-foreground text-xs">
									{user.email}
								</TableCell>
								<TableCell>
									<span
										className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${ROLE_COLORS[user.role] ?? ""}`}
									>
										{ROLE_LABELS[user.role] ?? user.role}
									</span>
								</TableCell>
								<TableCell className="text-right font-mono text-muted-foreground text-xs">
									{user.accountCount}
								</TableCell>
								<TableCell className="text-right font-mono text-muted-foreground text-xs">
									{user.tradeCount}
								</TableCell>
								<TableCell className="font-mono text-muted-foreground text-xs">
									{formatDate(user.createdAt)}
								</TableCell>
								<TableCell className="font-mono text-muted-foreground text-xs">
									{formatDate(user.lastActive)}
								</TableCell>
							</TableRow>
						))}
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
