"use client";

import { ArrowUpRight, Check, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
	EditableField,
	EditableSelect,
	EditableTextarea,
} from "@/components/trade-detail/editable-field";
import { useAccount } from "@/contexts/account-context";
import {
	calculateFuturesPnL,
	FUTURES_SYMBOLS,
} from "@/lib/market-data/symbols";
import { cn } from "@/lib/shared";
import { directionEnum, emotionalStateEnum } from "@/lib/shared/schemas";
import type { RouterInputs, RouterOutputs } from "@/trpc/react";

type CreateTradeInput = RouterInputs["trades"]["create"];
type ChatAttachment = NonNullable<
	RouterOutputs["ai"]["getConversation"]["messages"][number]["attachments"]
>[number];

/** Parsed `propose_trade` tool arguments (all optional — treat as untrusted). */
export interface TradeProposal {
	symbol?: string;
	direction?: "long" | "short";
	entryPrice?: string;
	entryTime?: string;
	quantity?: string;
	exitPrice?: string;
	exitTime?: string;
	stopLoss?: string;
	takeProfit?: string;
	fees?: string;
	realizedPnl?: string;
	riskRewardRatio?: string;
	setupType?: string;
	notes?: string;
	isClosed?: boolean;
	lowConfidenceFields?: string[];
}

interface TradeConfirmationCardProps {
	messageId: string;
	proposal: TradeProposal;
	chartAttachments: ChatAttachment[];
	defaultAccountId: string | null;
	/** True only for the latest, not-yet-logged proposal. */
	interactive: boolean;
	/** Set once logged — renders the success state. */
	loggedTradeId: string | null;
	onConfirmTrade: (
		messageId: string,
		input: CreateTradeInput,
		chartAttachments: ChatAttachment[],
	) => Promise<string | null>;
}

const AI_ACCENT = "#00d4ff";
const DIRECTION_OPTIONS = directionEnum.options.map((d) => ({
	value: d,
	label: d === "long" ? "Long" : "Short",
}));
const EMOTION_OPTIONS = emotionalStateEnum.options.map((e) => ({
	value: e,
	label: e.charAt(0).toUpperCase() + e.slice(1),
}));
const SYMBOL_OPTIONS = FUTURES_SYMBOLS.map((s) => ({
	value: s.value,
	label: s.label,
}));

interface FormState {
	symbol: string;
	direction: "long" | "short";
	entryPrice: string;
	entryTime: string; // datetime-local value
	quantity: string;
	exitPrice: string;
	exitTime: string; // datetime-local value
	realizedPnl: string;
	stopLoss: string;
	takeProfit: string;
	fees: string;
	setupType: string;
	emotionalState: string;
	notes: string;
	accountId: string;
}

function pad(n: number): string {
	return String(n).padStart(2, "0");
}

function isoToLocalInput(iso: string | undefined): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nowLocalInput(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(local: string): string | null {
	if (!local) return null;
	const d = new Date(local);
	if (Number.isNaN(d.getTime())) return null;
	return d.toISOString();
}

/** Label row with an optional ice-blue "AI guess" badge. */
function FieldLabel({ label, flagged }: { label: string; flagged: boolean }) {
	return (
		<div className="flex items-center gap-1.5">
			<span className="font-mono text-[10px] text-muted-foreground/80 uppercase tracking-widest">
				{label}
			</span>
			{flagged && (
				<span
					className="rounded px-1 py-0.5 font-mono text-[9px] uppercase tracking-wider"
					style={{ color: AI_ACCENT, backgroundColor: `${AI_ACCENT}1a` }}
				>
					AI guess
				</span>
			)}
		</div>
	);
}

export function TradeConfirmationCard({
	messageId,
	proposal,
	chartAttachments,
	defaultAccountId,
	interactive,
	loggedTradeId,
	onConfirmTrade,
}: TradeConfirmationCardProps) {
	const { accounts } = useAccount();

	const initialIsClosed = proposal.isClosed ?? Boolean(proposal.exitPrice);
	const entryMissing = !proposal.entryTime;

	const [isClosed, setIsClosed] = useState(initialIsClosed);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [flagged, setFlagged] = useState<Set<string>>(
		() =>
			new Set([
				...(proposal.lowConfidenceFields ?? []),
				...(entryMissing ? ["entryTime"] : []),
			]),
	);

	const [form, setForm] = useState<FormState>(() => ({
		symbol: proposal.symbol ?? "",
		direction: proposal.direction ?? "long",
		entryPrice: proposal.entryPrice ?? "",
		entryTime: proposal.entryTime
			? isoToLocalInput(proposal.entryTime)
			: nowLocalInput(),
		quantity: proposal.quantity ?? "",
		exitPrice: proposal.exitPrice ?? "",
		exitTime: isoToLocalInput(proposal.exitTime),
		realizedPnl: proposal.realizedPnl ?? "",
		stopLoss: proposal.stopLoss ?? "",
		takeProfit: proposal.takeProfit ?? "",
		fees: proposal.fees ?? "",
		setupType: proposal.setupType ?? "",
		emotionalState: "",
		notes: proposal.notes ?? "",
		accountId: defaultAccountId ?? "",
	}));

	// Update a field and clear its low-confidence flag (the user reviewed it).
	function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
		setForm((prev) => ({ ...prev, [key]: value }));
		setFlagged((prev) => {
			if (!prev.has(key)) return prev;
			const next = new Set(prev);
			next.delete(key);
			return next;
		});
	}

	// Live educated-guess P&L from the current prices (closed trades only).
	const suggestedPnl = useMemo(() => {
		if (!isClosed) return null;
		const entry = Number.parseFloat(form.entryPrice);
		const exit = Number.parseFloat(form.exitPrice);
		const qty = Number.parseFloat(form.quantity);
		if (
			!form.symbol ||
			Number.isNaN(entry) ||
			Number.isNaN(exit) ||
			Number.isNaN(qty) ||
			qty <= 0
		) {
			return null;
		}
		return calculateFuturesPnL(form.symbol, entry, exit, qty, form.direction);
	}, [
		isClosed,
		form.symbol,
		form.entryPrice,
		form.exitPrice,
		form.quantity,
		form.direction,
	]);

	const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

	const missingRequired =
		!form.symbol.trim() ||
		!form.entryPrice.trim() ||
		!form.entryTime ||
		!form.quantity.trim() ||
		!form.accountId;

	async function handleConfirm() {
		const entryIso = localInputToIso(form.entryTime);
		if (!entryIso || missingRequired) return;
		const exitIso = isClosed ? localInputToIso(form.exitTime) : null;

		const input: CreateTradeInput = {
			symbol: form.symbol.trim(),
			direction: form.direction,
			entryPrice: form.entryPrice.trim(),
			entryTime: entryIso,
			quantity: form.quantity.trim(),
			accountId: form.accountId,
			...(isClosed && form.exitPrice.trim()
				? { exitPrice: form.exitPrice.trim() }
				: {}),
			...(exitIso ? { exitTime: exitIso } : {}),
			...(isClosed && form.realizedPnl.trim()
				? { realizedPnl: form.realizedPnl.trim() }
				: {}),
			...(form.stopLoss.trim() ? { stopLoss: form.stopLoss.trim() } : {}),
			...(form.takeProfit.trim() ? { takeProfit: form.takeProfit.trim() } : {}),
			...(isClosed && form.fees.trim() ? { fees: form.fees.trim() } : {}),
			...(form.setupType.trim() ? { setupType: form.setupType.trim() } : {}),
			...(form.emotionalState
				? {
						emotionalState: form.emotionalState as NonNullable<
							CreateTradeInput["emotionalState"]
						>,
					}
				: {}),
			...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
		};

		setIsSubmitting(true);
		try {
			await onConfirmTrade(messageId, input, chartAttachments);
		} finally {
			setIsSubmitting(false);
		}
	}

	// ---- Logged success state -------------------------------------------------
	if (loggedTradeId) {
		return (
			<div className="mt-3 rounded border border-profit/30 bg-profit/5 p-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 font-mono text-profit text-xs">
						<Check className="h-3.5 w-3.5" />
						<span>
							Trade logged · {form.symbol || proposal.symbol} {form.direction}
						</span>
					</div>
					<Link
						className="flex items-center gap-1 font-mono text-[11px] text-primary transition-colors hover:text-primary/80"
						href={`/journal/${loggedTradeId}`}
					>
						View trade
						<ArrowUpRight className="h-3 w-3" />
					</Link>
				</div>
			</div>
		);
	}

	// ---- Read-only (superseded) state ----------------------------------------
	if (!interactive) {
		return (
			<div className="mt-3 rounded border border-white/10 bg-white/[0.01] p-3">
				<div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground/70">
					<Sparkles className="h-3 w-3" style={{ color: AI_ACCENT }} />
					<span>
						Proposed: {proposal.symbol} {proposal.direction}
						{proposal.entryPrice ? ` @ ${proposal.entryPrice}` : ""}
					</span>
					<span className="text-muted-foreground/40">
						— reply to revise, or use the latest proposal
					</span>
				</div>
			</div>
		);
	}

	// ---- Editable confirmation card ------------------------------------------
	return (
		<div
			className="mt-3 rounded border bg-white/[0.01] p-4"
			data-testid="trade-confirmation-card"
			style={{ borderColor: `${AI_ACCENT}33` }}
		>
			{/* Header */}
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Sparkles className="h-3.5 w-3.5" style={{ color: AI_ACCENT }} />
					<span className="font-mono text-foreground text-xs uppercase tracking-wider">
						Review &amp; log trade
					</span>
				</div>
				{/* Open / Closed toggle */}
				<div className="flex overflow-hidden rounded border border-border font-mono text-[10px] uppercase">
					<button
						className={cn(
							"px-2 py-1 transition-colors",
							!isClosed
								? "bg-primary/15 text-primary"
								: "text-muted-foreground/60 hover:text-foreground",
						)}
						onClick={() => setIsClosed(false)}
						type="button"
					>
						Open
					</button>
					<button
						className={cn(
							"px-2 py-1 transition-colors",
							isClosed
								? "bg-primary/15 text-primary"
								: "text-muted-foreground/60 hover:text-foreground",
						)}
						onClick={() => setIsClosed(true)}
						type="button"
					>
						Closed
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{/* Symbol */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("symbol")} label="Symbol" />
					<EditableSelect
						allowClear={false}
						onChange={(v) => setField("symbol", v)}
						options={
							form.symbol &&
							!SYMBOL_OPTIONS.some((o) => o.value === form.symbol)
								? [
										{ value: form.symbol, label: form.symbol },
										...SYMBOL_OPTIONS,
									]
								: SYMBOL_OPTIONS
						}
						value={form.symbol}
					/>
				</div>

				{/* Direction */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("direction")} label="Direction" />
					<EditableSelect
						allowClear={false}
						onChange={(v) => setField("direction", v as "long" | "short")}
						options={DIRECTION_OPTIONS}
						value={form.direction}
					/>
				</div>

				{/* Quantity */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("quantity")} label="Contracts" />
					<EditableField
						inputClassName={
							flagged.has("quantity")
								? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
								: undefined
						}
						onChange={(v) => setField("quantity", v)}
						placeholder="0"
						type="number"
						value={form.quantity}
					/>
				</div>

				{/* Entry price */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("entryPrice")} label="Entry" />
					<EditableField
						inputClassName={
							flagged.has("entryPrice")
								? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
								: undefined
						}
						onChange={(v) => setField("entryPrice", v)}
						placeholder="0.00"
						type="number"
						value={form.entryPrice}
					/>
				</div>

				{/* Stop loss */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("stopLoss")} label="Stop" />
					<EditableField
						inputClassName={
							flagged.has("stopLoss")
								? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
								: undefined
						}
						onChange={(v) => setField("stopLoss", v)}
						placeholder="—"
						type="number"
						value={form.stopLoss}
					/>
				</div>

				{/* Take profit */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("takeProfit")} label="Target" />
					<EditableField
						inputClassName={
							flagged.has("takeProfit")
								? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
								: undefined
						}
						onChange={(v) => setField("takeProfit", v)}
						placeholder="—"
						type="number"
						value={form.takeProfit}
					/>
				</div>

				{/* Entry time (required) */}
				<div className="col-span-2 space-y-1.5 sm:col-span-3">
					<FieldLabel flagged={flagged.has("entryTime")} label="Entry time" />
					<input
						className={cn(
							"h-10 w-full rounded-sm border bg-muted/50 px-3 font-mono text-sm transition-all",
							"focus:border-primary/50 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/30",
							flagged.has("entryTime")
								? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
								: "border-border",
						)}
						onChange={(e) => setField("entryTime", e.target.value)}
						type="datetime-local"
						value={form.entryTime}
					/>
				</div>

				{/* Closed-only fields */}
				{isClosed && (
					<>
						<div className="space-y-1.5">
							<FieldLabel flagged={flagged.has("exitPrice")} label="Exit" />
							<EditableField
								inputClassName={
									flagged.has("exitPrice")
										? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
										: undefined
								}
								onChange={(v) => setField("exitPrice", v)}
								placeholder="0.00"
								type="number"
								value={form.exitPrice}
							/>
						</div>

						<div className="space-y-1.5">
							<FieldLabel flagged={flagged.has("fees")} label="Fees" />
							<EditableField
								onChange={(v) => setField("fees", v)}
								placeholder="0.00"
								prefix="$"
								type="number"
								value={form.fees}
							/>
						</div>

						<div className="space-y-1.5">
							<FieldLabel
								flagged={flagged.has("realizedPnl")}
								label="Realized P&L"
							/>
							<EditableField
								inputClassName={
									flagged.has("realizedPnl")
										? "border-[#00d4ff]/50 ring-1 ring-[#00d4ff]/30"
										: undefined
								}
								onChange={(v) => setField("realizedPnl", v)}
								placeholder="0.00"
								prefix="$"
								type="number"
								value={form.realizedPnl}
							/>
						</div>

						<div className="col-span-2 space-y-1.5 sm:col-span-3">
							<FieldLabel flagged={false} label="Exit time" />
							<input
								className={cn(
									"h-10 w-full rounded-sm border border-border bg-muted/50 px-3 font-mono text-sm transition-all",
									"focus:border-primary/50 focus:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/30",
								)}
								onChange={(e) => setField("exitTime", e.target.value)}
								type="datetime-local"
								value={form.exitTime}
							/>
						</div>

						{/* Educated-guess P&L suggestion */}
						{suggestedPnl !== null && (
							<div className="col-span-2 flex items-center gap-2 sm:col-span-3">
								<span className="font-mono text-[11px] text-muted-foreground/70">
									Suggested P&L from prices:{" "}
									<span
										className={suggestedPnl >= 0 ? "text-profit" : "text-loss"}
									>
										{suggestedPnl >= 0 ? "+" : ""}
										{suggestedPnl.toFixed(2)}
									</span>
								</span>
								<button
									className="rounded border border-primary/30 px-2 py-0.5 font-mono text-[10px] text-primary uppercase tracking-wider transition-colors hover:bg-primary/10"
									onClick={() =>
										setField("realizedPnl", suggestedPnl.toFixed(2))
									}
									type="button"
								>
									Use
								</button>
							</div>
						)}
					</>
				)}

				{/* Account */}
				<div className="space-y-1.5">
					<FieldLabel flagged={false} label="Account" />
					<EditableSelect
						allowClear={false}
						onChange={(v) => setField("accountId", v)}
						options={accountOptions}
						placeholder="Select account"
						value={form.accountId}
					/>
				</div>

				{/* Emotional state */}
				<div className="space-y-1.5">
					<FieldLabel flagged={false} label="Emotion" />
					<EditableSelect
						onChange={(v) => setField("emotionalState", v)}
						options={EMOTION_OPTIONS}
						placeholder="—"
						value={form.emotionalState}
					/>
				</div>

				{/* Setup */}
				<div className="space-y-1.5">
					<FieldLabel flagged={flagged.has("setupType")} label="Setup" />
					<EditableField
						onChange={(v) => setField("setupType", v)}
						placeholder="—"
						value={form.setupType}
					/>
				</div>

				{/* Notes */}
				<div className="col-span-2 sm:col-span-3">
					<FieldLabel flagged={flagged.has("notes")} label="Notes" />
					<div className="mt-1.5">
						<EditableTextarea
							onChange={(v) => setField("notes", v)}
							placeholder="What was the idea?"
							rows={2}
							value={form.notes}
						/>
					</div>
				</div>
			</div>

			{/* Footer */}
			<div className="mt-4 flex items-center justify-between gap-3">
				<span className="font-mono text-[10px] text-muted-foreground/50">
					{missingRequired
						? "Fill symbol, entry, contracts, time & account to log"
						: "Edit any field, then confirm"}
				</span>
				<button
					className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-mono text-[11px] text-primary-foreground uppercase tracking-wider transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
					data-testid="confirm-log-trade"
					disabled={missingRequired || isSubmitting}
					onClick={() => void handleConfirm()}
					type="button"
				>
					{isSubmitting ? (
						<Loader2 className="h-3 w-3 animate-spin" />
					) : (
						<Check className="h-3 w-3" />
					)}
					Confirm &amp; Log
				</button>
			</div>
		</div>
	);
}
