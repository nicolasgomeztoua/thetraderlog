"use client";

import {
	ArrowRight,
	BarChart3,
	Code2,
	Cpu,
	Database,
	Sparkles,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { MessageRenderer } from "@/app/(protected)/ai/_components/message-renderer";
import type {
	SharedConversationMessage,
	SharedConversationPayload,
	SharedConversationProposal,
} from "@/server/api/helpers/conversation-share";

// =============================================================================
// TYPES
// =============================================================================

interface SharedConversationViewProps {
	payload: SharedConversationPayload;
}

// Mirror of the in-app tool badge labels (chat-message.tsx). Unknown tools fall
// back to their raw name with a generic icon.
const TOOL_LABELS: Record<string, { label: string; icon: typeof Database }> = {
	run_query: { label: "Running SQL", icon: Database },
	call_analytics: { label: "Analyzing data", icon: BarChart3 },
	get_market_data: { label: "Fetching market data", icon: Zap },
	run_python: { label: "Generating chart", icon: Code2 },
};

const AI_ACCENT = "#00d4ff";

// =============================================================================
// SHARED CONVERSATION VIEW — public, read-only
// =============================================================================

export function SharedConversationView({
	payload,
}: SharedConversationViewProps) {
	const { title, model, trader, messages } = payload;
	const traderName = trader.name ?? "A TheTraderLog trader";
	const traderFirstName = trader.name?.split(" ")[0] ?? "this trader";
	const displayTitle = title ?? "AI Trading Analysis";

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
				{/* ============================================================
				    BRANDED TOP BAR
				    ============================================================ */}
				<div className="flex items-center justify-between gap-3 border-white/10 border-b pb-4">
					<div className="flex min-w-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
						<span className="shrink-0 font-bold text-primary">TRADERLOG</span>
						<span className="hidden text-muted-foreground sm:inline">
							{"// "}
						</span>
						<span className="hidden truncate text-muted-foreground sm:inline">
							SHARED CHAT
						</span>
					</div>
					<Link
						className="shrink-0 whitespace-nowrap rounded border border-primary/30 bg-primary/5 px-3 py-1.5 font-mono text-[10px] text-primary uppercase tracking-wider transition-colors hover:bg-primary/10"
						href="/sign-up"
					>
						Start your journal
					</Link>
				</div>

				{/* ============================================================
				    TRADER IDENTITY (social proof)
				    ============================================================ */}
				<div className="mt-6 flex items-center gap-3">
					{trader.imageUrl ? (
						// biome-ignore lint/performance/noImgElement: avatar host is dynamic (Clerk CDN), not worth next/image config
						<img
							alt={traderName}
							className="size-10 rounded-full border border-white/10"
							src={trader.imageUrl}
						/>
					) : (
						<div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 font-bold font-mono text-primary text-sm">
							{traderName.charAt(0).toUpperCase()}
						</div>
					)}
					<div>
						<p className="font-bold font-mono text-foreground text-sm">
							{traderName}
						</p>
						<p className="font-mono text-[10px] text-muted-foreground">
							shared an AI analysis from their journal
						</p>
					</div>
				</div>

				{/* ============================================================
				    CONVERSATION TITLE
				    ============================================================ */}
				<div className="mt-6 border-white/10 border-b pb-4">
					<h1 className="font-mono text-base text-foreground leading-relaxed">
						{displayTitle}
					</h1>
					{model && (
						<div className="mt-2 flex items-center gap-3">
							<span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
								<Cpu className="size-2.5" />
								{model}
							</span>
						</div>
					)}
				</div>

				{/* ============================================================
				    MESSAGES
				    ============================================================ */}
				<div className="mt-6 space-y-4 sm:space-y-5">
					{messages.map((message) => (
						<SharedMessage key={message.id} message={message} />
					))}
				</div>

				{/* ============================================================
				    CTA — social proof footer
				    ============================================================ */}
				<div className="relative mt-10 overflow-hidden rounded-sm border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-8 text-center">
					<div className="pointer-events-none absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl from-primary/10 to-transparent blur-2xl" />
					<p className="relative font-mono text-[10px] text-primary uppercase tracking-widest">
						Ask · Analyze · Improve
					</p>
					<h3 className="relative mt-3 font-bold text-foreground text-xl tracking-tight sm:text-2xl">
						Analyze your trades like {traderFirstName}
					</h3>
					<p className="relative mx-auto mt-2 max-w-md font-mono text-muted-foreground text-xs leading-relaxed">
						TheTraderLog is the professional journal for futures traders — chat
						with an AI analyst about your performance, patterns, and risk.
					</p>
					<Link
						className="group relative mt-6 inline-flex items-center gap-2 rounded bg-primary px-6 py-2.5 font-mono text-primary-foreground text-xs uppercase tracking-wider transition-colors hover:bg-primary/90"
						href="/sign-up"
					>
						Start Free
						<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
					</Link>
				</div>

				{/* Footer */}
				<div className="mt-8 border-white/10 border-t pt-6 text-center">
					<p className="font-mono text-[10px] text-muted-foreground">
						Shared via{" "}
						<Link
							className="text-primary transition-colors hover:text-accent"
							href="/"
						>
							TheTraderLog
						</Link>{" "}
						— the trading journal for futures traders
					</p>
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// MESSAGE
// =============================================================================

function SharedMessage({ message }: { message: SharedConversationMessage }) {
	if (message.role === "user") {
		return (
			<div>
				<div className="flex gap-2 sm:gap-3">
					<span className="mt-0.5 font-mono text-primary text-xs sm:text-sm">
						$
					</span>
					<div className="min-w-0 flex-1 border-primary/30 border-l-2 pl-3">
						{message.content && (
							<p className="break-words font-mono text-foreground text-sm">
								{message.content}
							</p>
						)}
						{message.attachments.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{message.attachments.map((att) => (
									<a
										className="block h-20 w-28 overflow-hidden rounded border border-primary/20 transition-colors hover:border-primary/40"
										href={att.url}
										key={att.id}
										rel="noreferrer"
										target="_blank"
									>
										{/* biome-ignore lint/performance/noImgElement: transient presigned preview */}
										<img
											alt={att.filename ?? "chart"}
											className="h-full w-full object-cover"
											src={att.url}
										/>
									</a>
								))}
							</div>
						)}
					</div>
				</div>
			</div>
		);
	}

	// Assistant message
	return (
		<div>
			<div className="flex gap-2 sm:gap-3">
				<span className="mt-0.5 font-mono text-accent text-xs sm:text-sm">
					{"→"}
				</span>
				<div className="min-w-0 flex-1 rounded border border-white/5 bg-white/[0.01] p-3 sm:p-4">
					{message.toolNames.length > 0 && (
						<ToolBadges toolNames={message.toolNames} />
					)}
					{message.content && <MessageRenderer content={message.content} />}
					{message.proposal && <ProposalSummary proposal={message.proposal} />}
				</div>
			</div>
		</div>
	);
}

// =============================================================================
// TOOL BADGES (static)
// =============================================================================

function ToolBadges({ toolNames }: { toolNames: string[] }) {
	return (
		<div className="mb-3 flex flex-wrap gap-1.5">
			{toolNames.map((name) => {
				const tool = TOOL_LABELS[name];
				const Icon = tool?.icon ?? Zap;
				return (
					<span
						className="inline-flex items-center gap-1.5 rounded border border-accent/20 bg-accent/5 px-2 py-0.5 font-mono text-[10px] text-accent uppercase tracking-wider"
						key={name}
					>
						<Icon className="h-3 w-3" />
						{tool?.label ?? name}
					</span>
				);
			})}
		</div>
	);
}

// =============================================================================
// READ-ONLY TRADE PROPOSAL SUMMARY
// =============================================================================

function ProposalSummary({
	proposal,
}: {
	proposal: SharedConversationProposal;
}) {
	const isClosed = proposal.isClosed ?? Boolean(proposal.exitPrice);

	const rows: { label: string; value: string | undefined }[] = [
		{ label: "Symbol", value: proposal.symbol },
		{
			label: "Direction",
			value: proposal.direction
				? proposal.direction.charAt(0).toUpperCase() +
					proposal.direction.slice(1)
				: undefined,
		},
		{ label: "Contracts", value: proposal.quantity },
		{ label: "Entry", value: proposal.entryPrice },
		{ label: "Stop", value: proposal.stopLoss },
		{ label: "Target", value: proposal.takeProfit },
		...(isClosed
			? [
					{ label: "Exit", value: proposal.exitPrice },
					{ label: "Realized P&L", value: proposal.realizedPnl },
					{ label: "Fees", value: proposal.fees },
				]
			: []),
		{ label: "Setup", value: proposal.setupType },
	];

	const visibleRows = rows.filter((r) => r.value);

	if (visibleRows.length === 0 && !proposal.notes) return null;

	return (
		<div
			className="mt-3 rounded border bg-white/[0.01] p-3"
			style={{ borderColor: `${AI_ACCENT}33` }}
		>
			<div className="mb-2 flex items-center gap-2">
				<Sparkles className="h-3 w-3" style={{ color: AI_ACCENT }} />
				<span className="font-mono text-[10px] text-foreground uppercase tracking-wider">
					Proposed Trade
				</span>
			</div>
			{visibleRows.length > 0 && (
				<dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
					{visibleRows.map((row) => (
						<div className="space-y-0.5" key={row.label}>
							<dt className="font-mono text-[9px] text-muted-foreground/70 uppercase tracking-widest">
								{row.label}
							</dt>
							<dd className="font-mono text-foreground text-xs">{row.value}</dd>
						</div>
					))}
				</dl>
			)}
			{proposal.notes && (
				<p className="mt-2 break-words font-mono text-[11px] text-muted-foreground leading-relaxed">
					{proposal.notes}
				</p>
			)}
		</div>
	);
}
