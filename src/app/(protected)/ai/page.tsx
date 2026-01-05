"use client";

import { Brain, Key, Loader2, Send, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency, formatPercent } from "@/lib/shared";
import { api } from "@/trpc/react";

interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

const EXAMPLE_QUERIES = [
	"Are my breakevens optimal?",
	"What's my best trading time?",
	"Which setups win most?",
	"How often do I cut winners?",
	"What's my avg R:R?",
	"Performance by symbol",
];

export default function AIInsightsPage() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);

	const { data: stats } = api.trades.getStats.useQuery();
	const { data: trades } = api.trades.getAll.useQuery({
		status: "closed",
		limit: 100,
	});

	// Scroll to bottom when new messages arrive
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, []);

	// Check if user has API key configured (placeholder - would check settings)
	useEffect(() => {
		// For now, assume no key is set
		setHasApiKey(false);
	}, []);

	const generateLocalInsight = (query: string): string => {
		if (!stats || !trades?.items) {
			return "I don't have enough trade data to analyze. Start logging some trades first!";
		}

		const lowerQuery = query.toLowerCase();
		const closedTrades = trades.items.filter((t) => t.netPnl);

		// Win rate analysis
		if (lowerQuery.includes("win rate") || lowerQuery.includes("winning")) {
			return (
				`Based on ${stats.totalTrades} closed trades:\n\n` +
				`**Win Rate:** ${formatPercent(stats.winRate, 1).replace("+", "")}\n` +
				`- Wins: ${stats.wins}\n` +
				`- Losses: ${stats.losses}\n` +
				`- Breakeven: ${stats.breakevens}\n\n` +
				`**Insight:** ${
					stats.winRate >= 50
						? "Your win rate is above 50%, which is a solid foundation. Focus on improving your risk-reward ratio to maximize profits."
						: "Your win rate is below 50%, but that's not necessarily bad if your winners are larger than your losers. Focus on letting winners run and cutting losers quickly."
				}`
			);
		}

		// Breakeven analysis
		if (lowerQuery.includes("breakeven") || lowerQuery.includes("break even")) {
			const beRate = (stats.breakevens / Math.max(stats.totalTrades, 1)) * 100;
			return (
				`**Breakeven Analysis:**\n\n` +
				`Out of ${stats.totalTrades} trades, ${
					stats.breakevens
				} ended at breakeven (${beRate.toFixed(1)}%).\n\n` +
				`**Insight:** ${
					beRate > 10
						? "You're moving to breakeven frequently. Consider if you're cutting winners too early. Analyze if those breakeven trades would have hit your original targets."
						: "Your breakeven rate is reasonable. You're letting your trades play out."
				}`
			);
		}

		// Setup analysis
		if (lowerQuery.includes("setup") || lowerQuery.includes("strategy")) {
			const setupStats: Record<
				string,
				{ wins: number; losses: number; pnl: number }
			> = {};
			closedTrades.forEach((t) => {
				const setup = t.setupType || "Unclassified";
				if (!setupStats[setup]) {
					setupStats[setup] = { wins: 0, losses: 0, pnl: 0 };
				}
				const pnl = parseFloat(t.netPnl ?? "0");
				setupStats[setup].pnl += pnl;
				if (pnl > 0) setupStats[setup].wins++;
				else if (pnl < 0) setupStats[setup].losses++;
			});

			const setupSummary = Object.entries(setupStats)
				.map(([setup, data]) => {
					const total = data.wins + data.losses;
					const wr = total > 0 ? ((data.wins / total) * 100).toFixed(1) : "0";
					return `- **${setup}:** ${wr}% win rate, ${formatCurrency(
						data.pnl,
					)} P&L`;
				})
				.join("\n");

			return (
				`**Setup Performance:**\n\n${setupSummary}\n\n` +
				`**Insight:** Focus on your highest win rate setups and consider reducing position size or eliminating underperforming setups.`
			);
		}

		// Symbol analysis
		if (lowerQuery.includes("symbol") || lowerQuery.includes("instrument")) {
			const symbolStats: Record<
				string,
				{ wins: number; losses: number; pnl: number }
			> = {};
			closedTrades.forEach((t) => {
				const symbol = t.symbol;
				if (!symbolStats[symbol]) {
					symbolStats[symbol] = { wins: 0, losses: 0, pnl: 0 };
				}
				const pnl = parseFloat(t.netPnl ?? "0");
				symbolStats[symbol].pnl += pnl;
				if (pnl > 0) symbolStats[symbol].wins++;
				else if (pnl < 0) symbolStats[symbol].losses++;
			});

			const symbolSummary = Object.entries(symbolStats)
				.sort((a, b) => b[1].pnl - a[1].pnl)
				.map(([symbol, data]) => {
					const total = data.wins + data.losses;
					const wr = total > 0 ? ((data.wins / total) * 100).toFixed(1) : "0";
					return `- **${symbol}:** ${wr}% win rate, ${formatCurrency(
						data.pnl,
					)} P&L`;
				})
				.join("\n");

			return (
				`**Performance by Symbol:**\n\n${symbolSummary}\n\n` +
				`**Insight:** Focus on your best performing symbols. Consider if you understand certain markets better than others.`
			);
		}

		// Profit factor analysis
		if (
			lowerQuery.includes("profit factor") ||
			lowerQuery.includes("r:r") ||
			lowerQuery.includes("risk")
		) {
			return (
				`**Risk Analysis:**\n\n` +
				`- Profit Factor: ${
					stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
				}\n` +
				`- Average Win: ${formatCurrency(stats.avgWin)}\n` +
				`- Average Loss: ${formatCurrency(stats.avgLoss)}\n` +
				`- Avg R:R: ${
					stats.avgLoss > 0 ? (stats.avgWin / stats.avgLoss).toFixed(2) : "N/A"
				}\n\n` +
				`**Insight:** ${
					stats.profitFactor >= 1.5
						? "Your profit factor is healthy. You're managing risk well."
						: "Consider improving your risk-reward ratio by letting winners run longer or cutting losses quicker."
				}`
			);
		}

		// Default response
		return (
			`**Quick Stats:**\n\n` +
			`- Total P&L: ${formatCurrency(stats.totalPnl)}\n` +
			`- Win Rate: ${formatPercent(stats.winRate, 1).replace("+", "")}\n` +
			`- Profit Factor: ${
				stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
			}\n` +
			`- Total Trades: ${stats.totalTrades}\n\n` +
			`Try asking about specific aspects like "What's my win rate?", "Which setups work best?", or "Show me performance by symbol".`
		);
	};

	const handleSend = async () => {
		if (!input.trim()) return;

		const userMessage: Message = {
			id: Date.now().toString(),
			role: "user",
			content: input.trim(),
			timestamp: new Date(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput("");
		setIsLoading(true);

		// Simulate AI response (in production, this would call your AI endpoint)
		setTimeout(() => {
			const response = generateLocalInsight(userMessage.content);
			const assistantMessage: Message = {
				id: (Date.now() + 1).toString(),
				role: "assistant",
				content: response,
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, assistantMessage]);
			setIsLoading(false);
		}, 1000);
	};

	return (
		<div className="flex h-[calc(100vh-8rem)] flex-col space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<span className="mb-2 block font-mono text-primary text-xs uppercase tracking-wider">
						Analysis
					</span>
					<h1 className="font-bold text-3xl tracking-tight">AI Insights</h1>
					<p className="mt-1 font-mono text-muted-foreground text-sm">
						Ask questions about your trading performance
					</p>
				</div>
				<Button
					asChild
					className="font-mono text-xs uppercase tracking-wider"
					variant="outline"
				>
					<Link href="/settings">
						<Key className="mr-2 h-3.5 w-3.5" />
						API Keys
					</Link>
				</Button>
			</div>

			{/* API Key Notice */}
			{hasApiKey === false && (
				<div className="flex items-center justify-between rounded border border-primary/30 bg-primary/5 p-4">
					<div className="flex items-center gap-3">
						<Sparkles className="h-5 w-5 text-primary" />
						<div>
							<p className="font-medium font-mono text-xs uppercase tracking-wider">
								Using Local Analysis
							</p>
							<p className="font-mono text-[10px] text-muted-foreground">
								Add your AI API key in settings for more advanced insights
							</p>
						</div>
					</div>
					<Button
						asChild
						className="font-mono text-xs uppercase tracking-wider"
						size="sm"
						variant="outline"
					>
						<Link href="/settings">
							<Settings className="mr-2 h-3.5 w-3.5" />
							Settings
						</Link>
					</Button>
				</div>
			)}

			{/* Terminal Chat Container */}
			<div className="flex flex-1 flex-col overflow-hidden rounded border border-border bg-card">
				{/* Terminal header */}
				<div className="flex items-center justify-between border-border border-b bg-secondary px-4 py-2">
					<div className="flex items-center gap-2">
						<div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
						<div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
						<div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
					</div>
					<span className="font-mono text-[10px] text-muted-foreground">
						ai-insights-terminal
					</span>
					<div className="w-14" />
				</div>

				{/* Chat Content */}
				<ScrollArea className="flex-1 p-4" ref={scrollRef}>
					{messages.length === 0 ? (
						<div className="flex h-full flex-col items-center justify-center text-center">
							<div className="mb-4 flex h-16 w-16 items-center justify-center rounded border border-border bg-secondary">
								<Brain className="h-8 w-8 text-primary" />
							</div>
							<h2 className="mb-2 font-semibold text-xl">
								Query your trading data
							</h2>
							<p className="mb-6 max-w-md font-mono text-muted-foreground text-xs">
								I can analyze your trades and provide insights on win rates,
								setups, timing, and more.
							</p>
							<div className="flex flex-wrap justify-center gap-2">
								{EXAMPLE_QUERIES.map((query) => (
									<button
										className="rounded border border-border bg-secondary px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
										key={query}
										onClick={() => setInput(query)}
										type="button"
									>
										{query}
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="space-y-4">
							{messages.map((message) => (
								<div className="flex gap-3" key={message.id}>
									{/* Command prompt character */}
									<span className="mt-0.5 font-mono text-muted-foreground text-sm">
										{message.role === "user" ? "$" : "→"}
									</span>
									<div className="flex-1">
										{message.role === "assistant" ? (
											<div className="font-mono text-muted-foreground text-sm">
												{message.content.split("\n").map((line) => {
													if (line.startsWith("**") && line.includes(":**")) {
														const [title] = line.split(":**");
														return (
															<p
																className="mt-3 font-semibold text-foreground first:mt-0"
																key={`heading-${line}`}
															>
																{title?.replace(/\*\*/g, "") ?? ""}:
															</p>
														);
													}
													if (line.startsWith("- **")) {
														return (
															<p className="ml-2" key={`bold-${line}`}>
																{line.replace(/\*\*/g, "")}
															</p>
														);
													}
													if (line.startsWith("- ")) {
														return (
															<p
																className="ml-4 text-muted-foreground"
																key={`bullet-${line}`}
															>
																{line}
															</p>
														);
													}
													return line ? (
														<p key={`text-${line}`}>{line}</p>
													) : (
														<br key={`br-${message.id}-${Math.random()}`} />
													);
												})}
											</div>
										) : (
											<p className="font-mono text-primary text-sm">
												{message.content}
											</p>
										)}
									</div>
								</div>
							))}
							{isLoading && (
								<div className="flex gap-3">
									<span className="mt-0.5 font-mono text-muted-foreground text-sm">
										→
									</span>
									<div className="flex items-center gap-2">
										<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
										<span className="font-mono text-muted-foreground text-sm">
											Analyzing trades<span className="animate-blink">_</span>
										</span>
									</div>
								</div>
							)}
						</div>
					)}
				</ScrollArea>

				{/* Input */}
				<div className="border-border border-t bg-secondary p-4">
					<form
						className="flex gap-3"
						onSubmit={(e) => {
							e.preventDefault();
							handleSend();
						}}
					>
						<span className="mt-2 font-mono text-muted-foreground text-sm">
							$
						</span>
						<Input
							className="flex-1 border-border bg-transparent font-mono text-sm"
							disabled={isLoading}
							onChange={(e) => setInput(e.target.value)}
							placeholder="Enter query..."
							value={input}
						/>
						<Button
							className="font-mono text-xs uppercase tracking-wider"
							disabled={isLoading || !input.trim()}
							size="sm"
							type="submit"
						>
							<Send className="h-3.5 w-3.5" />
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
}
