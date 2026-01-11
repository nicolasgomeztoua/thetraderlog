"use client";

import { Brain, ChevronRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const queries = [
	{
		question: "What's my best time to trade?",
		response: `Based on 847 trades over 6 months:

**Peak Performance Window**
→ 09:30 - 11:00 EST (Win Rate: 71%)
→ Avg profit: $412/trade

**Avoid Trading**
→ 12:00 - 14:00 EST (Win Rate: 38%)
→ Avg loss: -$156/trade

Your morning sessions show 2.3x better
risk-adjusted returns than afternoons.`,
	},
	{
		question: "Are my stop losses optimal?",
		response: `Analyzing your stop loss patterns:

**The Problem**
→ 47% of trades hit SL within 3 pts of reversal
→ Estimated missed gains: $12,400/month

**Recommendation**
Consider a 2-tier stop approach:
1. Initial SL at 8 pts (current: 5 pts)
2. Move to BE after +6 pts gain

Backtested improvement: +23% win rate.`,
	},
	{
		question: "Which setups have the best win rate?",
		response: `**Top 3 Setups (by Win Rate)**

1. Opening Range Breakout
   → Win Rate: 78% | Avg RR: 2.1
   → Best on: ES, NQ

2. VWAP Reversal
   → Win Rate: 65% | Avg RR: 1.8
   → Best on: CL

3. Gap Fill
   → Win Rate: 61% | Avg RR: 2.4
   → Best on: NQ

Focus on ORB setups in the first hour.`,
	},
	{
		question: "Why am I cutting winners early?",
		response: `**Pattern Detected: Premature Exits**

→ 62% of winning trades closed before TP
→ Avg missed profit per trade: $287

**Root Cause Analysis**
Your exit timing correlates with:
1. After 15+ minutes in trade (anxiety)
2. When up exactly 1R (satisfaction)

**Suggested Fix**
Use a mechanical trail stop at 0.5R
instead of discretionary exits.`,
	},
];

function TypewriterText({
	text,
	speed = 15,
}: {
	text: string;
	speed?: number;
}) {
	const [displayedText, setDisplayedText] = useState("");
	const [isComplete, setIsComplete] = useState(false);

	useEffect(() => {
		setDisplayedText("");
		setIsComplete(false);
		let index = 0;
		const timer = setInterval(() => {
			if (index < text.length) {
				setDisplayedText(text.slice(0, index + 1));
				index++;
			} else {
				setIsComplete(true);
				clearInterval(timer);
			}
		}, speed);
		return () => clearInterval(timer);
	}, [text, speed]);

	return (
		<span>
			{displayedText}
			{!isComplete && <span className="animate-pulse text-primary">▌</span>}
		</span>
	);
}

export function AIShowcase() {
	const [activeIndex, setActiveIndex] = useState(0);
	const [showResponse, setShowResponse] = useState(false);
	const [key, setKey] = useState(0);

	const handleQuerySelect = (index: number) => {
		if (index === activeIndex && showResponse) return;
		setActiveIndex(index);
		setShowResponse(false);
		setTimeout(() => {
			setShowResponse(true);
			setKey((prev) => prev + 1);
		}, 300);
	};

	return (
		<section className="relative py-32" id="ai">
			{/* Background */}
			<div className="absolute inset-0 bg-linear-to-b from-transparent via-primary/2 to-transparent" />

			<div className="relative mx-auto max-w-6xl px-6">
				{/* Header */}
				<div className="mb-16 flex flex-col items-center text-center">
					<div className="mb-6 inline-flex items-center gap-2 rounded-none border border-accent/20 bg-accent/5 px-4 py-2">
						<Sparkles className="h-4 w-4 text-accent" />
						<span className="font-mono text-accent text-xs uppercase tracking-wider">
							AI-Powered
						</span>
					</div>
					<h2 className="font-bold text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						Ask anything about
						<br />
						<span className="text-accent text-glow-accent">your trading</span>
					</h2>
					<p className="mt-6 max-w-xl font-mono text-base text-muted-foreground">
						Natural language queries powered by your choice of AI. Get insights
						that would take hours to analyze manually.
					</p>
				</div>

				{/* Terminal interface */}
				<div className="mx-auto max-w-4xl">
					<div className="overflow-hidden rounded border border-white/10 bg-black/80 shadow-2xl">
						{/* Terminal header */}
						<div className="flex items-center justify-between border-white/5 border-b bg-white/2 px-4 py-3">
							<div className="flex items-center gap-3">
								<div className="flex items-center gap-2">
									<div className="h-3 w-3 rounded-full bg-loss/60" />
									<div className="h-3 w-3 rounded-full bg-breakeven/60" />
									<div className="h-3 w-3 rounded-full bg-profit/60" />
								</div>
								<span className="ml-4 font-mono text-muted-foreground text-xs">
									edge-ai
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Brain className="h-4 w-4 text-accent" />
								<span className="font-mono text-muted-foreground text-xs">
									Claude 3.5 Sonnet
								</span>
							</div>
						</div>

						{/* Query selector */}
						<div className="border-white/5 border-b p-4">
							<div className="flex flex-wrap gap-2">
								{queries.map((query, index) => (
									<button
										className={`flex items-center gap-2 rounded border px-3 py-2 font-mono text-xs transition-all ${
											activeIndex === index
												? "border-primary/50 bg-primary/10 text-primary"
												: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground"
										}`}
										key={query.question}
										onClick={() => handleQuerySelect(index)}
										type="button"
									>
										<ChevronRight className="h-3 w-3" />
										{query.question}
									</button>
								))}
							</div>
						</div>

						{/* Terminal content */}
						<div className="min-h-[400px] p-6">
							{/* User input */}
							<div className="mb-6 flex items-start gap-3">
								<span className="font-mono text-primary text-sm">$</span>
								<span className="font-mono text-sm">
									{queries[activeIndex]?.question}
								</span>
							</div>

							{/* AI Response */}
							{showResponse ? (
								<div className="flex items-start gap-3">
									<span className="font-mono text-accent text-sm">→</span>
									<div className="whitespace-pre-wrap font-mono text-muted-foreground text-sm leading-relaxed">
										<TypewriterText
											key={key}
											speed={8}
											text={queries[activeIndex]?.response ?? ""}
										/>
									</div>
								</div>
							) : (
								<div className="flex items-center justify-center py-20">
									<Button
										className="gap-2 font-mono text-xs uppercase tracking-wider"
										onClick={() => {
											setShowResponse(true);
											setKey((prev) => prev + 1);
										}}
									>
										<Brain className="h-4 w-4" />
										Run Query
									</Button>
								</div>
							)}
						</div>

						{/* Terminal footer */}
						<div className="border-white/5 border-t bg-white/2 px-4 py-3">
							<div className="flex items-center justify-between">
								<span className="font-mono text-muted-foreground text-xs">
									Powered by your API key
								</span>
								<div className="flex items-center gap-4 font-mono text-muted-foreground text-xs">
									<span>OpenAI</span>
									<span>Anthropic</span>
									<span>Google</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Trust badges */}
				<div className="mt-12 flex flex-wrap items-center justify-center gap-8 font-mono text-muted-foreground text-xs">
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-profit" />
						<span>Your data stays private</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-accent" />
						<span>Use your own API keys</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="h-2 w-2 rounded-full bg-primary" />
						<span>Choose your AI provider</span>
					</div>
				</div>
			</div>
		</section>
	);
}
