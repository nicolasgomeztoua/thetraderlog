"use client";

import {
	AlertCircle,
	ArrowLeft,
	Bot,
	Bug,
	ChevronDown,
	CreditCard,
	Mail,
	Shield,
	ShieldOff,
	TrendingDown,
	TrendingUp,
	User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	ACCOUNT_TYPE_COLORS,
	ACCOUNT_TYPE_LABELS,
	ROLE_COLORS,
	ROLE_LABELS,
} from "@/lib/constants/admin";
import { api } from "@/trpc/react";

function formatDate(date: Date | string | null) {
	if (!date) return "—";
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatPnl(value: string | null) {
	if (!value) return "—";
	const num = Number.parseFloat(value);
	const formatted = `$${Math.abs(num).toFixed(2)}`;
	if (num > 0) return `+${formatted}`;
	if (num < 0) return `-${formatted}`;
	return formatted;
}

export default function AdminUserDetailPage() {
	const params = useParams();
	const userId = params.userId as string;
	const [showRoleDialog, setShowRoleDialog] = useState(false);
	const utils = api.useUtils();

	const {
		data: user,
		isLoading,
		error,
	} = api.admin.users.getById.useQuery({ id: userId });

	const updateRole = api.admin.users.updateRole.useMutation({
		onSuccess: () => {
			utils.admin.users.getById.invalidate({ id: userId });
			utils.admin.users.list.invalidate();
		},
	});

	const newRole = user?.role === "admin" ? "user" : "admin";

	const handleRoleUpdate = () => {
		updateRole.mutate({ id: userId, role: newRole });
		setShowRoleDialog(false);
	};

	if (isLoading) {
		return (
			<div>
				<Link
					className="mb-6 inline-flex items-center gap-1 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
					href="/admin/users"
				>
					<ArrowLeft className="size-3" />
					Back to Users
				</Link>
				<div className="space-y-4">
					<div className="h-6 w-48 animate-pulse rounded bg-muted" />
					<div className="h-4 w-64 animate-pulse rounded bg-muted" />
					<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<div
								className="h-24 animate-pulse rounded-lg border border-border bg-card"
								key={`skeleton-${i.toString()}`}
							/>
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error || !user) {
		return (
			<div>
				<Link
					className="mb-6 inline-flex items-center gap-1 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
					href="/admin/users"
				>
					<ArrowLeft className="size-3" />
					Back to Users
				</Link>
				<div className="mt-6 flex items-center gap-2 rounded border border-red-400/20 bg-red-400/5 px-4 py-3 font-mono text-red-400 text-sm">
					<AlertCircle className="size-4 shrink-0" />
					<span>{error?.message ?? "User not found"}</span>
				</div>
			</div>
		);
	}

	return (
		<div>
			{/* Back link */}
			<Link
				className="mb-6 inline-flex items-center gap-1 font-mono text-muted-foreground text-xs transition-colors hover:text-foreground"
				href="/admin/users"
			>
				<ArrowLeft className="size-3" />
				Back to Users
			</Link>

			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-center gap-4">
					{user.imageUrl ? (
						<Image
							alt={user.name ?? "User avatar"}
							className="size-14 rounded-full border border-border"
							height={56}
							src={user.imageUrl}
							width={56}
						/>
					) : (
						<div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted">
							<User className="size-6 text-muted-foreground" />
						</div>
					)}
					<div>
						<h1 className="font-mono text-lg">{user.name ?? "Unnamed User"}</h1>
						<div className="mt-1 flex items-center gap-2 font-mono text-muted-foreground text-xs">
							<Mail className="size-3" />
							{user.email}
						</div>
						<div className="mt-1 flex items-center gap-3">
							<span
								className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${ROLE_COLORS[user.role] ?? ""}`}
							>
								{ROLE_LABELS[user.role] ?? user.role}
							</span>
							<span className="font-mono text-muted-foreground text-xs">
								Joined {formatDate(user.createdAt)}
							</span>
						</div>
					</div>
				</div>

				{/* Role toggle button */}
				<Button
					className="font-mono text-xs"
					disabled={updateRole.isPending}
					onClick={() => setShowRoleDialog(true)}
					size="sm"
					variant="outline"
				>
					{newRole === "admin" ? (
						<Shield className="mr-1.5 size-3" />
					) : (
						<ShieldOff className="mr-1.5 size-3" />
					)}
					{newRole === "admin" ? "Promote to Admin" : "Demote to User"}
					<ChevronDown className="ml-1.5 size-3" />
				</Button>
			</div>

			{/* Summary stats */}
			<div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<CreditCard className="size-3.5 text-muted-foreground" />
						<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Accounts
						</span>
					</div>
					<span className="mt-2 block font-bold font-mono text-primary text-xl">
						{user.accounts.length}
					</span>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<TrendingUp className="size-3.5 text-muted-foreground" />
						<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Recent Trades
						</span>
					</div>
					<span className="mt-2 block font-bold font-mono text-primary text-xl">
						{user.recentTrades.length}
					</span>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<Bot className="size-3.5 text-muted-foreground" />
						<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							AI Convos
						</span>
					</div>
					<span className="mt-2 block font-bold font-mono text-primary text-xl">
						{user.aiConversationCount}
					</span>
				</div>
				<div className="rounded-lg border border-border bg-card p-4">
					<div className="flex items-center gap-2">
						<Bug className="size-3.5 text-muted-foreground" />
						<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
							Bug Reports
						</span>
					</div>
					<span className="mt-2 block font-bold font-mono text-primary text-xl">
						{user.bugReportCount}
					</span>
				</div>
			</div>

			{/* Accounts section */}
			<div className="mt-8">
				<h2 className="font-mono text-sm uppercase tracking-wider">
					Accounts{" "}
					<span className="text-muted-foreground">
						({user.accounts.length})
					</span>
				</h2>
				{user.accounts.length === 0 ? (
					<p className="mt-3 font-mono text-muted-foreground text-xs">
						No accounts
					</p>
				) : (
					<div className="mt-3 rounded-lg border border-border">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Name
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Type
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Broker
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Status
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Created
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{user.accounts.map((account) => (
									<TableRow key={account.id}>
										<TableCell className="font-mono text-sm">
											{account.name}
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${ACCOUNT_TYPE_COLORS[account.accountType] ?? ""}`}
											>
												{ACCOUNT_TYPE_LABELS[account.accountType] ??
													account.accountType}
											</span>
										</TableCell>
										<TableCell className="font-mono text-muted-foreground text-xs">
											{account.broker ?? "—"}
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs ${account.isActive ? "bg-green-400/10 text-green-400" : "bg-neutral-400/10 text-neutral-400"}`}
											>
												{account.isActive ? "Active" : "Inactive"}
											</span>
										</TableCell>
										<TableCell className="font-mono text-muted-foreground text-xs">
											{formatDate(account.createdAt)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			{/* Recent Trades section */}
			<div className="mt-8">
				<h2 className="font-mono text-sm uppercase tracking-wider">
					Recent Trades{" "}
					<span className="text-muted-foreground">
						(last {user.recentTrades.length})
					</span>
				</h2>
				{user.recentTrades.length === 0 ? (
					<p className="mt-3 font-mono text-muted-foreground text-xs">
						No trades
					</p>
				) : (
					<div className="mt-3 rounded-lg border border-border">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Symbol
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Direction
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Status
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Entry
									</TableHead>
									<TableHead className="font-mono text-xs uppercase tracking-wider">
										Exit
									</TableHead>
									<TableHead className="text-right font-mono text-xs uppercase tracking-wider">
										Net P&L
									</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{user.recentTrades.map((trade) => {
									const pnl = trade.netPnl
										? Number.parseFloat(trade.netPnl)
										: 0;
									return (
										<TableRow key={trade.id}>
											<TableCell className="font-mono text-sm">
												{trade.symbol}
											</TableCell>
											<TableCell>
												<span
													className={`inline-flex items-center gap-1 font-mono text-xs ${trade.direction === "long" ? "text-green-400" : "text-red-400"}`}
												>
													{trade.direction === "long" ? (
														<TrendingUp className="size-3" />
													) : (
														<TrendingDown className="size-3" />
													)}
													{trade.direction.toUpperCase()}
												</span>
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{trade.status}
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{formatDate(trade.entryTime)}
											</TableCell>
											<TableCell className="font-mono text-muted-foreground text-xs">
												{formatDate(trade.exitTime)}
											</TableCell>
											<TableCell
												className={`text-right font-mono text-sm ${pnl > 0 ? "text-green-400" : pnl < 0 ? "text-red-400" : "text-muted-foreground"}`}
											>
												{formatPnl(trade.netPnl)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>

			{/* AI Conversations summary */}
			<div className="mt-8">
				<h2 className="font-mono text-sm uppercase tracking-wider">
					AI Conversations{" "}
					<span className="text-muted-foreground">
						({user.aiConversationCount})
					</span>
				</h2>
				<p className="mt-3 font-mono text-muted-foreground text-xs">
					{user.aiConversationCount > 0
						? `${user.aiConversationCount} conversation${user.aiConversationCount !== 1 ? "s" : ""} total`
						: "No AI conversations"}
				</p>
			</div>

			{/* Bug Reports summary */}
			<div className="mt-8">
				<h2 className="font-mono text-sm uppercase tracking-wider">
					Bug Reports{" "}
					<span className="text-muted-foreground">({user.bugReportCount})</span>
				</h2>
				<p className="mt-3 font-mono text-muted-foreground text-xs">
					{user.bugReportCount > 0
						? `${user.bugReportCount} report${user.bugReportCount !== 1 ? "s" : ""} submitted`
						: "No bug reports submitted"}
				</p>
			</div>

			{/* Role change confirmation dialog */}
			<AlertDialog onOpenChange={setShowRoleDialog} open={showRoleDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono">
							{newRole === "admin" ? "Promote to Admin" : "Demote to User"}
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							{newRole === "admin"
								? `This will grant admin privileges to ${user.name ?? user.email}. They will have full access to the admin panel.`
								: `This will remove admin privileges from ${user.name ?? user.email}. They will lose access to the admin panel.`}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel className="font-mono text-xs">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="font-mono text-xs"
							onClick={handleRoleUpdate}
						>
							{newRole === "admin" ? "Promote" : "Demote"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
