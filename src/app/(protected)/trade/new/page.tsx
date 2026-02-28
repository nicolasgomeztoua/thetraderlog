"use client";

import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/contexts/account-context";
import {
	ERR_TRADE_CREATE_FAILED,
	ERR_VALIDATION_ACCOUNT_REQUIRED,
	ERR_VALIDATION_EXIT_DETAILS,
	ERR_VALIDATION_PNL_REQUIRED,
	ERR_VALIDATION_REQUIRED_FIELDS,
} from "@/lib/constants/errors";
import { FUTURES_SYMBOLS } from "@/lib/market-data";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

const SETUP_TYPES = [
	"Breakout",
	"Reversal",
	"Trend Continuation",
	"Range Trade",
	"News Trade",
	"Scalp",
	"Swing",
	"Gap Fill",
	"Support/Resistance",
	"Moving Average",
	"Other",
];

const EMOTIONAL_STATES = [
	{ value: "confident", label: "Confident" },
	{ value: "fearful", label: "Fearful" },
	{ value: "greedy", label: "Greedy" },
	{ value: "neutral", label: "Neutral" },
	{ value: "frustrated", label: "Frustrated" },
	{ value: "excited", label: "Excited" },
	{ value: "anxious", label: "Anxious" },
];

export default function NewTradePage() {
	const router = useRouter();
	const { selectedAccountId, accounts } = useAccount();

	// Form state
	const [symbol, setSymbol] = useState("");
	const [direction, setDirection] = useState<"long" | "short">("long");
	const [entryPrice, setEntryPrice] = useState("");
	const [entryDate, setEntryDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [entryTime, setEntryTime] = useState("");
	const [quantity, setQuantity] = useState("");
	const [isStillOpen, setIsStillOpen] = useState(false);
	const [exitPrice, setExitPrice] = useState("");
	const [exitDate, setExitDate] = useState(
		new Date().toISOString().split("T")[0],
	);
	const [exitTime, setExitTime] = useState("");
	const [stopLoss, setStopLoss] = useState("");
	const [takeProfit, setTakeProfit] = useState("");
	const [fees, setFees] = useState("");
	const [realizedPnl, setRealizedPnl] = useState("");
	const [setupType, setSetupType] = useState("");
	const [emotionalState, setEmotionalState] = useState<
		| "confident"
		| "fearful"
		| "greedy"
		| "neutral"
		| "frustrated"
		| "excited"
		| "anxious"
	>("neutral");
	const [notes, setNotes] = useState("");
	const [accountId, setAccountId] = useState<string | undefined>(
		selectedAccountId ?? undefined,
	);

	const createTrade = api.trades.create.useMutation({
		onSuccess: () => {
			toast.success("Trade logged successfully");
			router.push("/journal");
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_TRADE_CREATE_FAILED));
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!accountId) {
			toast.error(ERR_VALIDATION_ACCOUNT_REQUIRED);
			return;
		}

		if (!symbol || !entryPrice || !entryDate || !entryTime || !quantity) {
			toast.error(ERR_VALIDATION_REQUIRED_FIELDS);
			return;
		}

		if (!isStillOpen && (!exitPrice || !exitDate || !exitTime)) {
			toast.error(ERR_VALIDATION_EXIT_DETAILS);
			return;
		}

		if (!isStillOpen && !realizedPnl) {
			toast.error(ERR_VALIDATION_PNL_REQUIRED);
			return;
		}

		const entryDateTime = new Date(`${entryDate}T${entryTime}`).toISOString();
		const exitDateTime =
			!isStillOpen && exitDate && exitTime
				? new Date(`${exitDate}T${exitTime}`).toISOString()
				: undefined;

		createTrade.mutate({
			symbol,
			instrumentType: "futures",
			direction,
			entryPrice,
			entryTime: entryDateTime,
			exitPrice: !isStillOpen ? exitPrice || undefined : undefined,
			exitTime: exitDateTime,
			quantity,
			stopLoss: stopLoss || undefined,
			takeProfit: takeProfit || undefined,
			fees: !isStillOpen && fees ? fees : undefined,
			realizedPnl: !isStillOpen && realizedPnl ? realizedPnl : undefined,
			setupType: setupType || undefined,
			emotionalState,
			notes: notes || undefined,
			accountId,
		});
	};

	const symbols = FUTURES_SYMBOLS;
	const isPending = createTrade.isPending;

	return (
		<div className="mx-auto max-w-2xl space-y-4 pb-6 sm:space-y-6">
			{/* Header */}
			<div className="flex items-center gap-3 sm:gap-4">
				<Button
					asChild
					className="min-h-[44px] min-w-[44px]"
					size="icon"
					variant="ghost"
				>
					<Link href="/journal">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<div>
					<span className="mb-1 block font-mono text-primary text-xs uppercase tracking-wider">
						New Entry
					</span>
					<h1 className="font-bold text-xl tracking-tight sm:text-2xl">
						Log Trade
					</h1>
					<p className="hidden font-mono text-muted-foreground text-xs sm:block">
						Record a completed trade
					</p>
				</div>
			</div>

			<form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
				{/* Account Selection */}
				{accounts.length > 0 && (
					<div className="rounded border border-border bg-card p-3 sm:p-4">
						<div className="mb-3 flex items-center gap-2">
							<Wallet className="h-4 w-4 text-muted-foreground" />
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Trading Account
							</span>
						</div>
						<Select
							onValueChange={(value) => setAccountId(value || undefined)}
							value={accountId ?? ""}
						>
							<SelectTrigger className="font-mono text-xs">
								<SelectValue placeholder="Select account" />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((acc) => (
									<SelectItem
										className="font-mono text-xs"
										key={acc.id}
										value={acc.id.toString()}
									>
										{acc.name} {acc.broker ? `(${acc.broker})` : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}

				{/* Symbol */}
				<div className="space-y-4 rounded border border-border bg-card p-3 sm:p-4">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Instrument
					</div>
					<div className="space-y-2">
						<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Symbol <span className="text-loss">*</span>
						</Label>
						<Select onValueChange={setSymbol} value={symbol}>
							<SelectTrigger className="font-mono text-xs">
								<SelectValue placeholder="Select a symbol" />
							</SelectTrigger>
							<SelectContent>
								{symbols.map((s) => (
									<SelectItem
										className="font-mono text-xs"
										key={s.value}
										value={s.value}
									>
										{s.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{/* Entry Details */}
				<div className="space-y-4 rounded border border-border bg-card p-3 sm:p-4">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Entry
					</div>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Direction
							</Label>
							<Tabs
								onValueChange={(v) => setDirection(v as "long" | "short")}
								value={direction}
							>
								<TabsList className="grid w-full grid-cols-2 border border-border bg-secondary">
									<TabsTrigger
										className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-profit/20 data-[state=active]:text-profit"
										value="long"
									>
										Long
									</TabsTrigger>
									<TabsTrigger
										className="font-mono text-xs uppercase tracking-wider data-[state=active]:bg-loss/20 data-[state=active]:text-loss"
										value="short"
									>
										Short
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Entry Price <span className="text-loss">*</span>
								</Label>
								<Input
									className="font-mono text-sm"
									inputMode="decimal"
									onChange={(e) => setEntryPrice(e.target.value)}
									placeholder="0.00"
									step="any"
									type="number"
									value={entryPrice}
								/>
							</div>

							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Contracts <span className="text-loss">*</span>
								</Label>
								<Input
									className="font-mono text-sm"
									inputMode="decimal"
									onChange={(e) => setQuantity(e.target.value)}
									placeholder="1"
									step="any"
									type="number"
									value={quantity}
								/>
							</div>
						</div>

						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Entry Date <span className="text-loss">*</span>
								</Label>
								<Input
									className="font-mono text-sm"
									onChange={(e) => setEntryDate(e.target.value)}
									type="date"
									value={entryDate}
								/>
							</div>

							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Entry Time <span className="text-loss">*</span>
								</Label>
								<Input
									className="font-mono text-sm"
									onChange={(e) => setEntryTime(e.target.value)}
									type="time"
									value={entryTime}
								/>
							</div>
						</div>
					</div>
				</div>

				{/* Exit Details */}
				<div className="rounded border border-border bg-card p-3 sm:p-4">
					<div className="flex items-center justify-between pb-4">
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Exit
						</div>
						<div className="flex items-center gap-2">
							<Checkbox
								checked={isStillOpen}
								id="stillOpen"
								onCheckedChange={(checked) => setIsStillOpen(checked === true)}
							/>
							<Label
								className="cursor-pointer font-mono text-[10px] uppercase tracking-wider"
								htmlFor="stillOpen"
							>
								Trade still open
							</Label>
						</div>
					</div>
					{!isStillOpen && (
						<div className="space-y-3 sm:space-y-4">
							<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
								<div className="space-y-2">
									<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Exit Price <span className="text-loss">*</span>
									</Label>
									<Input
										className="font-mono text-sm"
										inputMode="decimal"
										onChange={(e) => setExitPrice(e.target.value)}
										placeholder="0.00"
										step="any"
										type="number"
										value={exitPrice}
									/>
								</div>

								<div className="space-y-2">
									<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Realized P&L <span className="text-loss">*</span>
									</Label>
									<Input
										className="font-mono text-sm"
										inputMode="decimal"
										onChange={(e) => setRealizedPnl(e.target.value)}
										placeholder="e.g. 150.00 or -75.50"
										step="any"
										type="number"
										value={realizedPnl}
									/>
								</div>
							</div>

							<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
								<div className="space-y-2">
									<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Fees / Commission
									</Label>
									<Input
										className="font-mono text-sm"
										inputMode="decimal"
										onChange={(e) => setFees(e.target.value)}
										placeholder="0.00"
										step="any"
										type="number"
										value={fees}
									/>
								</div>

								<div className="space-y-2">
									<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
										Exit Date <span className="text-loss">*</span>
									</Label>
									<Input
										className="font-mono text-sm"
										onChange={(e) => setExitDate(e.target.value)}
										type="date"
										value={exitDate}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Exit Time <span className="text-loss">*</span>
								</Label>
								<Input
									className="w-full font-mono text-sm sm:w-1/2"
									onChange={(e) => setExitTime(e.target.value)}
									type="time"
									value={exitTime}
								/>
							</div>
						</div>
					)}
				</div>

				{/* Risk Management */}
				<div className="space-y-4 rounded border border-border bg-card p-3 sm:p-4">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Risk Management
					</div>
					<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Stop Loss
							</Label>
							<Input
								className="font-mono text-sm"
								inputMode="decimal"
								onChange={(e) => setStopLoss(e.target.value)}
								placeholder="Optional"
								step="any"
								type="number"
								value={stopLoss}
							/>
						</div>

						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Take Profit
							</Label>
							<Input
								className="font-mono text-sm"
								inputMode="decimal"
								onChange={(e) => setTakeProfit(e.target.value)}
								placeholder="Optional"
								step="any"
								type="number"
								value={takeProfit}
							/>
						</div>
					</div>
				</div>

				{/* Trade Context */}
				<div className="space-y-4 rounded border border-border bg-card p-3 sm:p-4">
					<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Trade Context
					</div>
					<div className="space-y-3 sm:space-y-4">
						<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Setup Type
								</Label>
								<Select onValueChange={setSetupType} value={setupType}>
									<SelectTrigger className="font-mono text-xs">
										<SelectValue placeholder="Select setup type" />
									</SelectTrigger>
									<SelectContent>
										{SETUP_TYPES.map((setup) => (
											<SelectItem
												className="font-mono text-xs"
												key={setup}
												value={setup}
											>
												{setup}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
									Emotional State
								</Label>
								<Select
									onValueChange={(v) =>
										setEmotionalState(
											v as
												| "confident"
												| "fearful"
												| "greedy"
												| "neutral"
												| "frustrated"
												| "excited"
												| "anxious",
										)
									}
									value={emotionalState}
								>
									<SelectTrigger className="font-mono text-xs">
										<SelectValue placeholder="How were you feeling?" />
									</SelectTrigger>
									<SelectContent>
										{EMOTIONAL_STATES.map((state) => (
											<SelectItem
												className="font-mono text-xs"
												key={state.value}
												value={state.value}
											>
												{state.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Notes
							</Label>
							<Textarea
								className="font-mono text-sm"
								onChange={(e) => setNotes(e.target.value)}
								placeholder="What was your reasoning? What did you learn?"
								rows={4}
								value={notes}
							/>
						</div>
					</div>
				</div>

				{/* Submit */}
				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
					<Button
						asChild
						className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
						type="button"
						variant="outline"
					>
						<Link href="/journal">Cancel</Link>
					</Button>
					<Button
						className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
						disabled={isPending}
						type="submit"
					>
						{isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
						Log Trade
					</Button>
				</div>
			</form>
		</div>
	);
}
