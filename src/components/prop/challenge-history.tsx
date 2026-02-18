"use client";

import { useMemo } from "react";
import { useAccount } from "@/contexts/account-context";
import {
	CHALLENGE_STATUS_LABELS,
	isPropAccountType,
} from "@/lib/constants/prop";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface PropAccount {
	id: string;
	name: string;
	accountType: string;
	challengeStartDate: Date | string | null;
	challengeEndDate: Date | string | null;
	challengeStatus: "active" | "passed" | "failed" | null;
	initialBalance: string | null;
	linkedAccountId: string | null;
}

interface ChallengeHistoryProps {
	/** Currently selected prop account ID (highlighted in the timeline) */
	selectedAccountId?: string | null;
	/** Callback when user clicks on a challenge entry */
	onSelectAccount?: (accountId: string) => void;
	className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function parseDate(value: Date | string | null): Date | null {
	if (!value) return null;
	if (value instanceof Date) return value;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(value: Date | string | null): string {
	const d = parseDate(value);
	if (!d) return "—";
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getStatusColor(status: string | null): {
	text: string;
	bg: string;
	dot: string;
	line: string;
} {
	switch (status) {
		case "passed":
			return {
				text: "text-profit",
				bg: "bg-profit/10",
				dot: "bg-profit",
				line: "bg-profit/20",
			};
		case "failed":
			return {
				text: "text-loss",
				bg: "bg-loss/10",
				dot: "bg-loss",
				line: "bg-loss/20",
			};
		default:
			return {
				text: "text-primary",
				bg: "bg-primary/10",
				dot: "bg-primary",
				line: "bg-primary/20",
			};
	}
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ChallengeHistory({
	selectedAccountId,
	onSelectAccount,
	className,
}: ChallengeHistoryProps) {
	const { accounts } = useAccount();

	// Filter and sort prop accounts by challengeStartDate (newest first)
	const propAccounts = useMemo(() => {
		const filtered = accounts.filter((a) =>
			isPropAccountType(a.accountType),
		) as PropAccount[];

		return filtered.sort((a, b) => {
			const dateA = parseDate(a.challengeStartDate);
			const dateB = parseDate(b.challengeStartDate);
			if (!dateA && !dateB) return 0;
			if (!dateA) return 1;
			if (!dateB) return -1;
			return dateB.getTime() - dateA.getTime();
		});
	}, [accounts]);

	// Build a map of account IDs to names for linked account display
	const accountNameMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const a of accounts) {
			map.set(a.id, a.name);
		}
		return map;
	}, [accounts]);

	if (propAccounts.length === 0) {
		return (
			<div
				className={cn(
					"rounded border border-white/5 bg-white/1 p-6",
					className,
				)}
				data-testid="challenge-history"
			>
				<div className="mb-4 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Challenge History
				</div>
				<div
					className="flex flex-col items-center py-8"
					data-testid="challenge-history-empty"
				>
					<p className="font-mono text-muted-foreground/60 text-xs">
						No challenge history yet
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn("rounded border border-white/5 bg-white/1 p-6", className)}
			data-testid="challenge-history"
		>
			<div className="mb-5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
				Challenge History
			</div>

			{/* Vertical timeline */}
			<div
				className="relative space-y-0"
				data-testid="challenge-history-timeline"
			>
				{propAccounts.map((account, index) => {
					const colors = getStatusColor(account.challengeStatus);
					const isSelected = account.id === selectedAccountId;
					const isLast = index === propAccounts.length - 1;
					const linkedName = account.linkedAccountId
						? accountNameMap.get(account.linkedAccountId)
						: null;

					return (
						<div
							className="relative flex gap-4"
							data-testid={`challenge-history-entry-${account.id}`}
							key={account.id}
						>
							{/* Timeline dot + line */}
							<div className="flex flex-col items-center">
								<div
									className={cn(
										"mt-1 h-3 w-3 shrink-0 rounded-full border-2",
										isSelected
											? `${colors.dot} border-transparent`
											: `border-current ${colors.text} bg-transparent`,
									)}
									data-testid={`challenge-history-dot-${account.id}`}
								/>
								{!isLast && (
									<div className={cn("min-h-6 w-px flex-1", colors.line)} />
								)}
							</div>

							{/* Entry content */}
							<button
								className={cn(
									"mb-4 flex-1 rounded border p-3 text-left transition-all",
									isSelected
										? "border-white/10 bg-white/2"
										: "border-white/5 bg-transparent hover:border-white/10 hover:bg-white/1",
								)}
								data-testid={`challenge-history-button-${account.id}`}
								onClick={() => onSelectAccount?.(account.id)}
								type="button"
							>
								<div className="flex items-center justify-between gap-2">
									{/* Account name + type */}
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate font-mono font-semibold text-sm">
												{account.name}
											</span>
											<span
												className={cn(
													"shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
													colors.text,
													colors.bg,
												)}
												data-testid={`challenge-history-status-${account.id}`}
											>
												{CHALLENGE_STATUS_LABELS[
													account.challengeStatus ?? ""
												] ?? "Active"}
											</span>
										</div>

										{/* Date range */}
										<div className="mt-1 font-mono text-[10px] text-muted-foreground">
											{formatDate(account.challengeStartDate)}
											{" — "}
											{formatDate(account.challengeEndDate)}
										</div>
									</div>

									{/* Account type label */}
									<span className="shrink-0 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										{account.accountType === "prop_funded"
											? "Funded"
											: "Challenge"}
									</span>
								</div>

								{/* Initial balance */}
								<div className="mt-2 font-mono text-[10px] text-muted-foreground">
									Starting balance: $
									{Number.parseFloat(
										account.initialBalance ?? "0",
									).toLocaleString("en-US", {
										minimumFractionDigits: 2,
										maximumFractionDigits: 2,
									})}
								</div>

								{/* Linked funded account indicator */}
								{linkedName && (
									<div
										className="mt-2 flex items-center gap-1.5"
										data-testid={`challenge-history-linked-${account.id}`}
									>
										<span className="font-mono text-muted-foreground text-xs">
											→
										</span>
										<span className="font-mono text-profit text-xs">
											Funded:
										</span>
										<span className="font-mono text-profit/80 text-xs">
											{linkedName}
										</span>
									</div>
								)}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
