"use client";

import {
	AlertCircle,
	ArrowLeft,
	ArrowRight,
	Check,
	FileSpreadsheet,
	Info,
	Loader2,
	Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { useAccount } from "@/contexts/account-context";
import { useImportProgressContext } from "@/contexts/import-progress-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { FEATURE_CSV_IMPORT_EXPORT } from "@/lib/constants/billing";
import {
	ERR_CSV_AUTOPARSE_FAILED,
	ERR_CSV_HEADERS_AND_DATA,
	ERR_CSV_MISSING_HEADERS,
	ERR_IMPORT_FAILED,
	ERR_VALIDATION_CSV_UPLOAD,
	ERR_VALIDATION_SELECT_ACCOUNT,
} from "@/lib/constants/errors";
import type { ParsedTrade, TradingPlatform } from "@/lib/trades";
import { detectPlatform, getParser, TRADING_PLATFORMS } from "@/lib/trades";
import { api } from "@/trpc/react";

type Step = "select-account" | "upload" | "mapping" | "preview" | "complete";

interface ParsedRow {
	[key: string]: string;
}

const REQUIRED_FIELDS = [
	{ key: "symbol", label: "Symbol", required: true },
	{ key: "direction", label: "Direction (Long/Short)", required: true },
	{ key: "entryPrice", label: "Entry Price", required: true },
	{ key: "entryTime", label: "Entry Date/Time", required: true },
	{ key: "quantity", label: "Quantity/Lot Size", required: true },
];

const OPTIONAL_FIELDS = [
	{ key: "exitPrice", label: "Exit Price", required: false },
	{ key: "exitTime", label: "Exit Date/Time", required: false },
	{ key: "stopLoss", label: "Stop Loss", required: false },
	{ key: "takeProfit", label: "Take Profit", required: false },
	{ key: "fees", label: "Fees/Commission", required: false },
	{ key: "notes", label: "Notes", required: false },
	{ key: "setupType", label: "Setup Type", required: false },
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const PLATFORM_INFO: Record<
	TradingPlatform,
	{ description: string; status: "ready" | "coming-soon" | "manual" }
> = {
	projectx: {
		description: "Auto-import from ProjectX Trades CSV export",
		status: "ready",
	},
	topstepx: {
		description: "Auto-import from TopstepX Trades CSV export",
		status: "ready",
	},
	ninjatrader: {
		description: "Auto-import from NinjaTrader execution export",
		status: "ready",
	},
	tradovate: {
		description: "Auto-import from Tradovate order report export",
		status: "ready",
	},
	rithmic: {
		description: "Auto-import from Rithmic Completed Orders export",
		status: "ready",
	},
	apex: {
		description:
			"Auto-detect Apex CSV format (Rithmic/Tradovate/ProjectX-family)",
		status: "ready",
	},
	other: { description: "Manual column mapping", status: "manual" },
};

export default function ImportPage() {
	const router = useRouter();
	const isMobile = useIsMobile();
	const { selectedAccountId } = useAccount();
	const { data: accounts = [] } = api.accounts.getAll.useQuery();

	const [step, setStep] = useState<Step>(
		selectedAccountId ? "upload" : "select-account",
	);
	const [selectedImportAccountId, setSelectedImportAccountId] = useState<
		string | null
	>(selectedAccountId);
	// Manual mapping state
	const [csvData, setCsvData] = useState<ParsedRow[]>([]);
	const [headers, setHeaders] = useState<string[]>([]);
	const [mapping, setMapping] = useState<Record<string, string>>({});

	// Platform parsing state
	const [parsedTrades, setParsedTrades] = useState<ParsedTrade[]>([]);
	const [parseErrors, setParseErrors] = useState<string[]>([]);

	const [importing, setImporting] = useState(false);
	const [importedCount, setImportedCount] = useState(0);

	const { startTracking } = useImportProgressContext();
	const utils = api.useUtils();
	const batchImport = api.trades.batchImport.useMutation();

	const selectedImportAccount = accounts.find(
		(a) => a.id === selectedImportAccountId,
	);
	const accountPlatform = (selectedImportAccount?.platform ??
		"other") as TradingPlatform;
	const platformStatus = PLATFORM_INFO[accountPlatform]?.status ?? "manual";

	const parseCSV = useCallback(
		(text: string) => {
			const lines = text.trim().split("\n");
			if (lines.length < 2) {
				toast.error(ERR_CSV_HEADERS_AND_DATA);
				return;
			}

			const headerLine = lines[0];
			if (!headerLine) {
				toast.error(ERR_CSV_MISSING_HEADERS);
				return;
			}
			const parsedHeaders = headerLine
				.split(",")
				.map((h) => h.trim().replace(/"/g, ""));
			setHeaders(parsedHeaders);
			setParsedTrades([]);
			setParseErrors([]);

			const rows: ParsedRow[] = [];
			for (let i = 1; i < lines.length; i++) {
				const line = lines[i];
				if (!line) continue;
				const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
				const row: ParsedRow = {};
				parsedHeaders.forEach((header, index) => {
					row[header] = values[index] || "";
				});
				rows.push(row);
			}

			setCsvData(rows);

			void (async () => {
				const parserCandidates: TradingPlatform[] = [];
				const addCandidate = (platform: TradingPlatform | null) => {
					if (!platform) return;
					if (parserCandidates.includes(platform)) return;
					if (PLATFORM_INFO[platform]?.status !== "ready") return;
					if (!getParser(platform)) return;
					parserCandidates.push(platform);
				};

				addCandidate(accountPlatform);
				addCandidate(detectPlatform(parsedHeaders));

				for (const [platform, info] of Object.entries(PLATFORM_INFO)) {
					if (info.status !== "ready") continue;
					addCandidate(platform as TradingPlatform);
				}

				if (parserCandidates.length === 0) {
					setStep("mapping");
					return;
				}

				let latestErrors: string[] = [];
				for (const platform of parserCandidates) {
					const parser = getParser(platform);
					if (!parser) continue;

					const result = await parser.parse(text);
					if (result.success && result.trades.length > 0) {
						setParsedTrades(result.trades);
						setParseErrors(
							result.errors.map(
								(error) => `Row ${error.row}: ${error.message}`,
							),
						);
						setStep("preview");
						return;
					}

					if (result.errors.length > 0) {
						latestErrors = result.errors.map(
							(error) => `Row ${error.row}: ${error.message}`,
						);
					}
				}

				if (latestErrors.length > 0) {
					setParseErrors(latestErrors);
					toast.error(ERR_CSV_AUTOPARSE_FAILED);
				}

				setStep("mapping");
			})();

			// Auto-map headers if they match field names
			const autoMapping: Record<string, string> = {};
			parsedHeaders.forEach((header) => {
				const lowerHeader = header.toLowerCase().replace(/[^a-z]/g, "");
				ALL_FIELDS.forEach((field) => {
					const lowerField = field.key.toLowerCase();
					if (
						lowerHeader.includes(lowerField) ||
						lowerField.includes(lowerHeader)
					) {
						autoMapping[field.key] = header;
					}
				});
			});
			setMapping(autoMapping);
		},
		[accountPlatform],
	);

	const handleFileUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			if (!file.name.endsWith(".csv")) {
				toast.error(ERR_VALIDATION_CSV_UPLOAD);
				return;
			}

			const reader = new FileReader();
			reader.onload = (event) => {
				const text = event.target?.result as string;
				parseCSV(text);
			};
			reader.readAsText(file);
		},
		[parseCSV],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			const file = e.dataTransfer.files[0];
			if (!file) return;

			if (!file.name.endsWith(".csv")) {
				toast.error(ERR_VALIDATION_CSV_UPLOAD);
				return;
			}

			const reader = new FileReader();
			reader.onload = (event) => {
				const text = event.target?.result as string;
				parseCSV(text);
			};
			reader.readAsText(file);
		},
		[parseCSV],
	);

	const isValidMapping = () => {
		return REQUIRED_FIELDS.every(
			(field) => mapping[field.key] && mapping[field.key] !== "__skip__",
		);
	};

	const getMappedValue = (row: ParsedRow, fieldKey: string): string => {
		const csvHeader = mapping[fieldKey];
		if (!csvHeader || csvHeader === "__skip__") return "";
		return row[csvHeader] || "";
	};

	const parseDirection = (value: string): "long" | "short" => {
		const lower = value.toLowerCase();
		if (lower.includes("long") || lower === "buy" || lower === "b")
			return "long";
		return "short";
	};

	const parseDateTime = (value: string): string => {
		try {
			const date = new Date(value);
			if (Number.isNaN(date.getTime())) {
				// Try common formats
				const parts = value.split(/[/\-\s]/);
				if (parts.length >= 3) {
					const [m, d, y] = parts;
					const date = new Date(
						`${y}-${m?.padStart(2, "0")}-${d?.padStart(2, "0")}`,
					);
					if (!Number.isNaN(date.getTime())) return date.toISOString();
				}
				return new Date().toISOString();
			}
			return date.toISOString();
		} catch {
			return new Date().toISOString();
		}
	};

	const handleImport = async () => {
		if (!selectedImportAccountId) {
			toast.error(ERR_VALIDATION_SELECT_ACCOUNT);
			return;
		}

		setImporting(true);

		try {
			// Prepare trades array for batch import
			let tradesToInsert: Array<{
				symbol: string;
				direction: "long" | "short";
				entryPrice: string;
				entryTime: string;
				exitPrice?: string;
				exitTime?: string;
				quantity: string;
				stopLoss?: string;
				takeProfit?: string;
				stopLossHit?: boolean;
				takeProfitHit?: boolean;
				fees?: string;
				notes?: string;
				externalId?: string;
				profit?: string; // Broker-reported P&L
			}>;

			if (parsedTrades.length > 0) {
				// Using platform-parsed data
				tradesToInsert = parsedTrades.map((trade) => ({
					symbol: trade.symbol.toUpperCase(),
					direction: trade.direction,
					entryPrice: trade.entryPrice,
					entryTime: trade.entryTime.toISOString(),
					exitPrice: trade.exitPrice || undefined,
					exitTime: trade.exitTime?.toISOString(),
					quantity: trade.quantity,
					stopLoss: trade.stopLoss || undefined,
					takeProfit: trade.takeProfit || undefined,
					stopLossHit: trade.stopLossHit,
					takeProfitHit: trade.takeProfitHit,
					fees: trade.fees || undefined,
					notes: trade.comment || undefined,
					externalId: trade.externalId || undefined,
					profit: trade.profit || undefined, // Broker-reported P&L
				}));
			} else {
				// Using manual mapping
				tradesToInsert = csvData.map((csvRow) => {
					const entryTime = parseDateTime(getMappedValue(csvRow, "entryTime"));
					const exitPrice = getMappedValue(csvRow, "exitPrice");
					const exitTimeRaw = getMappedValue(csvRow, "exitTime");

					return {
						symbol: getMappedValue(csvRow, "symbol").toUpperCase(),
						direction: parseDirection(getMappedValue(csvRow, "direction")),
						entryPrice: getMappedValue(csvRow, "entryPrice"),
						entryTime,
						exitPrice: exitPrice || undefined,
						exitTime: exitTimeRaw ? parseDateTime(exitTimeRaw) : undefined,
						quantity: getMappedValue(csvRow, "quantity") || "1",
						stopLoss: getMappedValue(csvRow, "stopLoss") || undefined,
						takeProfit: getMappedValue(csvRow, "takeProfit") || undefined,
						notes: getMappedValue(csvRow, "notes") || undefined,
					};
				});
			}

			// Single batch insert - much faster!
			const result = await batchImport.mutateAsync({
				accountId: selectedImportAccountId,
				trades: tradesToInsert,
			});

			setImportedCount(result.imported);

			// Start tracking MAE/MFE processing progress
			if (
				result.processingCount &&
				result.processingCount > 0 &&
				result.tradeIds
			) {
				startTracking(result.tradeIds);
				toast.success(
					`Imported ${result.imported} trades. Processing market data in background...`,
				);
			} else {
				toast.success(`Imported ${result.imported} trades`);
			}

			setStep("complete");
		} catch (error) {
			console.error("Failed to import trades:", error);
			toast.error(ERR_IMPORT_FAILED);
		} finally {
			setImporting(false);
		}
	};

	const totalRows =
		parsedTrades.length > 0 ? parsedTrades.length : csvData.length;

	return (
		<UpgradePrompt feature={FEATURE_CSV_IMPORT_EXPORT}>
			<div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
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
							Data Import
						</span>
						<h1 className="font-bold text-xl tracking-tight sm:text-2xl">
							Import Trades
						</h1>
						<p className="hidden font-mono text-muted-foreground text-xs sm:block">
							Import trades from a CSV file
						</p>
					</div>
				</div>

				{/* Progress */}
				<div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
					<div className="flex min-w-max items-center justify-center gap-2 sm:gap-4">
						{["select-account", "upload", "mapping", "preview", "complete"].map(
							(s, i) => {
								// Skip mapping step display if using auto-parser
								if (s === "mapping" && parsedTrades.length > 0) return null;

								return (
									<div className="flex items-center gap-1 sm:gap-2" key={s}>
										<div
											className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-xs sm:h-8 sm:w-8 ${
												step === s
													? "border-primary bg-primary text-primary-foreground"
													: [
																"select-account",
																"upload",
																"mapping",
																"preview",
																"complete",
															].indexOf(step) > i
														? "border-profit/50 bg-profit/20 text-profit"
														: "border-border bg-secondary text-muted-foreground"
											}`}
										>
											{[
												"select-account",
												"upload",
												"mapping",
												"preview",
												"complete",
											].indexOf(step) > i ? (
												<Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
											) : (
												i + 1
											)}
										</div>
										<span
											className={`font-mono text-[9px] uppercase tracking-wider sm:text-[10px] ${
												step === s ? "text-foreground" : "text-muted-foreground"
											}`}
										>
											{s === "select-account"
												? "Account"
												: s.charAt(0).toUpperCase() + s.slice(1)}
										</span>
										{i < 4 && <div className="h-px w-4 bg-muted/300 sm:w-8" />}
									</div>
								);
							},
						)}
					</div>
				</div>

				{/* Step: Select Account */}
				{step === "select-account" && (
					<div className="overflow-hidden rounded border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
							<div className="flex items-center gap-1.5 sm:gap-2">
								<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
							</div>
							<span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
								select-account
							</span>
							<div className="hidden w-14 sm:block" />
						</div>
						<div className="border-border border-b px-4 py-3 sm:px-6 sm:py-4">
							<h3 className="font-medium">Select Account</h3>
							<p className="hidden font-mono text-[10px] text-muted-foreground sm:block">
								Choose which trading account to import trades into
							</p>
						</div>
						<div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
							{accounts.length === 0 ? (
								<Alert>
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>No Accounts</AlertTitle>
									<AlertDescription>
										You need to create a trading account before importing
										trades.{" "}
										<Link className="underline" href="/settings?tab=accounts">
											Create an account
										</Link>
									</AlertDescription>
								</Alert>
							) : (
								<>
									<Select
										onValueChange={(value) => setSelectedImportAccountId(value)}
										value={selectedImportAccountId?.toString() || ""}
									>
										<SelectTrigger className="min-h-[44px] w-full">
											<SelectValue placeholder="Select an account" />
										</SelectTrigger>
										<SelectContent>
											{accounts.map((account) => (
												<SelectItem
													className="min-h-[44px]"
													key={account.id}
													value={account.id.toString()}
												>
													{account.name} (
													{TRADING_PLATFORMS.find(
														(p) => p.value === account.platform,
													)?.label || "Other"}
													)
												</SelectItem>
											))}
										</SelectContent>
									</Select>

									{selectedImportAccount && (
										<Alert>
											<Info className="h-4 w-4" />
											<AlertTitle>
												{TRADING_PLATFORMS.find(
													(p) => p.value === accountPlatform,
												)?.label || "Manual"}{" "}
												Import
											</AlertTitle>
											<AlertDescription>
												{PLATFORM_INFO[accountPlatform]?.description}
												{platformStatus === "coming-soon" && (
													<span className="mt-1 block text-yellow-500">
														Auto-parsing coming soon. Manual column mapping will
														be used.
													</span>
												)}
											</AlertDescription>
										</Alert>
									)}

									<div className="flex justify-end">
										<Button
											className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
											disabled={!selectedImportAccountId}
											onClick={() => setStep("upload")}
										>
											Continue
											<ArrowRight className="ml-2 h-3.5 w-3.5" />
										</Button>
									</div>
								</>
							)}
						</div>
					</div>
				)}

				{/* Step: Upload */}
				{step === "upload" && (
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<CardTitle className="text-lg sm:text-xl">
								Upload CSV File
							</CardTitle>
							<CardDescription>
								Importing to: <strong>{selectedImportAccount?.name}</strong>
								{accountPlatform === "projectx" && (
									<span className="mt-1 block text-primary">
										Export your Trades CSV from ProjectX
									</span>
								)}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
							{/* Standard Single-File Upload */}
							<section
								aria-label="File drop zone"
								className="flex flex-col items-center justify-center rounded-lg border-2 border-border border-dashed p-6 transition-colors hover:border-primary/50 sm:p-12"
								onDragOver={(e) => e.preventDefault()}
								onDrop={handleDrop}
							>
								<FileSpreadsheet className="mb-3 h-10 w-10 text-muted-foreground sm:mb-4 sm:h-12 sm:w-12" />
								<p className="mb-1 text-center font-medium text-base sm:mb-2 sm:text-lg">
									<span className="hidden sm:inline">
										Drop your CSV file here
									</span>
									<span className="sm:hidden">Tap to select CSV file</span>
								</p>
								<p className="mb-3 text-center text-muted-foreground text-sm sm:mb-4">
									<span className="hidden sm:inline">or click to browse</span>
									<span className="sm:hidden">Import from your device</span>
								</p>
								<input
									accept=".csv"
									className="hidden"
									id="csv-upload"
									onChange={handleFileUpload}
									type="file"
								/>
								<Button asChild className="min-h-[44px]">
									<label className="cursor-pointer" htmlFor="csv-upload">
										<Upload className="mr-2 h-4 w-4" />
										Select File
									</label>
								</Button>
							</section>

							<div className="flex justify-start">
								<Button
									className="min-h-[44px] w-full sm:w-auto"
									onClick={() => setStep("select-account")}
									variant="outline"
								>
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Step: Manual Mapping */}
				{step === "mapping" && (
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<CardTitle className="text-lg sm:text-xl">Map Columns</CardTitle>
							<CardDescription>
								Match your CSV columns to trade fields
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
							{parseErrors.length > 0 && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Parse Warnings</AlertTitle>
									<AlertDescription>
										<ul className="mt-2 list-inside list-disc text-sm">
											{parseErrors.slice(0, 3).map((err) => (
												<li key={err}>{err}</li>
											))}
										</ul>
									</AlertDescription>
								</Alert>
							)}

							<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
								{ALL_FIELDS.map((field) => (
									<div className="space-y-1.5 sm:space-y-2" key={field.key}>
										<span className="font-medium text-xs sm:text-sm">
											{field.label}
											{field.required && (
												<span className="ml-1 text-destructive">*</span>
											)}
										</span>
										<Select
											onValueChange={(value) =>
												setMapping({ ...mapping, [field.key]: value })
											}
											value={mapping[field.key] || ""}
										>
											<SelectTrigger className="min-h-[44px]">
												<SelectValue placeholder="Select column" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem className="min-h-[44px]" value="__skip__">
													-- Skip --
												</SelectItem>
												{headers.map((header) => (
													<SelectItem
														className="min-h-[44px]"
														key={header}
														value={header}
													>
														{header}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								))}
							</div>

							<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
								<Button
									className="min-h-[44px] w-full sm:w-auto"
									onClick={() => setStep("upload")}
									variant="outline"
								>
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back
								</Button>
								<Button
									className="min-h-[44px] w-full sm:w-auto"
									disabled={!isValidMapping()}
									onClick={() => setStep("preview")}
								>
									Preview
									<ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Step: Preview */}
				{step === "preview" && (
					<Card>
						<CardHeader className="p-4 sm:p-6">
							<CardTitle className="text-lg sm:text-xl">
								Preview Import
							</CardTitle>
							<CardDescription>
								Review {totalRows} trades before importing to{" "}
								{selectedImportAccount?.name}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
							{/* Mobile: Card View */}
							{isMobile ? (
								<div className="max-h-96 space-y-2 overflow-auto">
									{(parsedTrades.length > 0 ? parsedTrades : csvData)
										.slice(0, 10)
										.map((row, i) => {
											const isParsed = parsedTrades.length > 0;
											const trade = isParsed ? (row as ParsedTrade) : null;
											const csvRow = !isParsed ? (row as ParsedRow) : null;

											const symbol =
												trade?.symbol ||
												(csvRow ? getMappedValue(csvRow, "symbol") : "");
											const direction =
												trade?.direction ||
												parseDirection(
													csvRow ? getMappedValue(csvRow, "direction") : "",
												);
											const entryPrice =
												trade?.entryPrice ||
												(csvRow ? getMappedValue(csvRow, "entryPrice") : "");
											const exitPrice =
												trade?.exitPrice ||
												(csvRow ? getMappedValue(csvRow, "exitPrice") : "");
											const quantity =
												trade?.quantity ||
												(csvRow ? getMappedValue(csvRow, "quantity") : "") ||
												"1";

											return (
												<div
													className="rounded-lg border border-border bg-secondary/30 p-3"
													key={`trade-preview-mobile-${i.toString()}`}
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2">
															<span className="font-mono font-semibold text-sm">
																{symbol.toUpperCase()}
															</span>
															<Badge
																className={`text-[10px] ${
																	direction === "long"
																		? "border-profit/50 text-profit"
																		: "border-loss/50 text-loss"
																}`}
																variant="outline"
															>
																{direction}
															</Badge>
														</div>
														<span className="font-mono text-muted-foreground text-xs">
															Qty: {quantity}
														</span>
													</div>
													<div className="mt-2 flex items-center justify-between font-mono text-muted-foreground text-xs">
														<span>Entry: {entryPrice}</span>
														<span>Exit: {exitPrice || "-"}</span>
													</div>
												</div>
											);
										})}
								</div>
							) : (
								/* Desktop: Table View */
								<div className="max-h-96 overflow-auto rounded-lg border">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Symbol</TableHead>
												<TableHead>Direction</TableHead>
												<TableHead>Entry</TableHead>
												<TableHead>Exit</TableHead>
												<TableHead>Qty</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{(parsedTrades.length > 0 ? parsedTrades : csvData)
												.slice(0, 10)
												.map((row, i) => {
													const isParsed = parsedTrades.length > 0;
													const trade = isParsed ? (row as ParsedTrade) : null;
													const csvRow = !isParsed ? (row as ParsedRow) : null;

													const symbol =
														trade?.symbol ||
														(csvRow ? getMappedValue(csvRow, "symbol") : "");
													const direction =
														trade?.direction ||
														parseDirection(
															csvRow ? getMappedValue(csvRow, "direction") : "",
														);
													const entryPrice =
														trade?.entryPrice ||
														(csvRow
															? getMappedValue(csvRow, "entryPrice")
															: "");
													const exitPrice =
														trade?.exitPrice ||
														(csvRow ? getMappedValue(csvRow, "exitPrice") : "");
													const quantity =
														trade?.quantity ||
														(csvRow
															? getMappedValue(csvRow, "quantity")
															: "") ||
														"1";

													return (
														<TableRow key={`trade-preview-${i.toString()}`}>
															<TableCell className="font-mono text-xs">
																{symbol.toUpperCase()}
															</TableCell>
															<TableCell>
																<Badge
																	className={`text-xs ${
																		direction === "long"
																			? "border-profit/50 text-profit"
																			: "border-loss/50 text-loss"
																	}`}
																	variant="outline"
																>
																	{direction}
																</Badge>
															</TableCell>
															<TableCell className="font-mono text-xs">
																{entryPrice}
															</TableCell>
															<TableCell className="font-mono text-xs">
																{exitPrice || "-"}
															</TableCell>
															<TableCell className="font-mono text-xs">
																{quantity}
															</TableCell>
														</TableRow>
													);
												})}
										</TableBody>
									</Table>
								</div>
							)}
							{totalRows > 10 && (
								<p className="text-center text-muted-foreground text-xs sm:text-sm">
									Showing first 10 of {totalRows} trades
								</p>
							)}

							<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
								<Button
									className="min-h-[44px] w-full sm:w-auto"
									onClick={() =>
										setStep(parsedTrades.length > 0 ? "upload" : "mapping")
									}
									variant="outline"
								>
									<ArrowLeft className="mr-2 h-4 w-4" />
									Back
								</Button>
								<Button
									className="min-h-[44px] w-full sm:w-auto"
									disabled={importing}
									onClick={handleImport}
								>
									{importing && (
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									)}
									<span className="sm:hidden">Import {totalRows}</span>
									<span className="hidden sm:inline">
										Import {totalRows} Trades
									</span>
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Step: Complete */}
				{step === "complete" && (
					<div className="overflow-hidden rounded border border-border bg-card">
						<div className="flex items-center justify-between border-border border-b bg-secondary px-3 py-2 sm:px-4">
							<div className="flex items-center gap-1.5 sm:gap-2">
								<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
							</div>
							<span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
								import-complete
							</span>
							<div className="hidden w-14 sm:block" />
						</div>
						<div className="flex flex-col items-center justify-center px-4 py-8 sm:py-12">
							<div className="mb-3 flex h-14 w-14 items-center justify-center rounded border border-profit/30 bg-profit/20 sm:mb-4 sm:h-16 sm:w-16">
								<Check className="h-6 w-6 text-profit sm:h-8 sm:w-8" />
							</div>
							<h2 className="mb-2 text-center font-semibold text-lg sm:text-xl">
								Import Complete!
							</h2>
							<p className="mb-4 text-center font-mono text-muted-foreground text-xs sm:mb-6">
								Successfully imported {importedCount} of {totalRows} trades to{" "}
								{selectedImportAccount?.name}
							</p>
							<div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-4">
								<Button
									className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
									onClick={() => {
										setStep("upload");
										setCsvData([]);
										setHeaders([]);
										setMapping({});
										setParsedTrades([]);
										setParseErrors([]);
									}}
									variant="outline"
								>
									Import More
								</Button>
								<Button
									className="min-h-[44px] w-full font-mono text-xs uppercase tracking-wider sm:w-auto"
									onClick={async () => {
										await utils.trades.getAll.invalidate();
										router.push("/journal");
									}}
								>
									View Journal
								</Button>
							</div>
						</div>
					</div>
				)}
			</div>
		</UpgradePrompt>
	);
}
