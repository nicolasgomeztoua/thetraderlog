"use client";

import {
	BarChart3,
	Brain,
	FileSpreadsheet,
	LineChart,
	Lock,
	Sparkles,
	Target,
	Zap,
} from "lucide-react";

const features = [
	{
		icon: LineChart,
		title: "Trade Journal",
		description:
			"Log every trade with entry/exit prices, position sizing, stop losses, take profits, and detailed notes.",
		highlight: true,
		className: "md:col-span-2",
		visual: (
			<div className="mt-6 space-y-3">
				<div className="flex items-center gap-4 rounded border border-border/50 bg-muted/50 p-3">
					<span className="font-mono text-muted-foreground text-xs">
						ES 03/15
					</span>
					<span className="font-medium font-mono text-sm">LONG</span>
					<span className="ml-auto font-mono text-profit text-sm">
						+$425.00
					</span>
				</div>
				<div className="flex items-center gap-4 rounded border border-border/50 bg-muted/50 p-3">
					<span className="font-mono text-muted-foreground text-xs">
						NQ 03/15
					</span>
					<span className="font-medium font-mono text-sm">SHORT</span>
					<span className="ml-auto font-mono text-loss text-sm">-$180.00</span>
				</div>
				<div className="flex items-center gap-4 rounded border border-border/50 bg-muted/50 p-3">
					<span className="font-mono text-muted-foreground text-xs">
						EUR/USD
					</span>
					<span className="font-medium font-mono text-sm">LONG</span>
					<span className="ml-auto font-mono text-profit text-sm">
						+$312.50
					</span>
				</div>
			</div>
		),
	},
	{
		icon: BarChart3,
		title: "Analytics",
		description:
			"Equity curves, P&L breakdowns, win rates, time analysis, and risk metrics.",
		highlight: false,
		className: "md:col-span-1",
		visual: (
			<div className="mt-6 flex h-24 items-end justify-between gap-1">
				{[35, 55, 42, 78, 65, 88, 72, 95, 82, 68].map((h) => (
					<div
						className="flex-1 rounded-t bg-linear-to-t from-primary/60 to-primary/20"
						key={`bar-${h}`}
						style={{ height: `${h}%` }}
					/>
				))}
			</div>
		),
	},
	{
		icon: Brain,
		title: "AI Insights",
		description:
			'Ask "What\'s my best setup?" and get instant, intelligent answers.',
		highlight: true,
		className: "md:col-span-1",
		visual: (
			<div className="mt-6 space-y-2">
				<div className="rounded bg-muted/50 p-3">
					<p className="font-mono text-muted-foreground text-xs">
						&gt; Analyze my morning trades
					</p>
				</div>
				<div className="rounded bg-primary/5 p-3">
					<p className="font-mono text-primary text-xs">
						Your morning win rate is 67%...
					</p>
				</div>
			</div>
		),
	},
	{
		icon: FileSpreadsheet,
		title: "CSV Import",
		description:
			"Import from any broker. Map columns, batch import thousands of trades.",
		highlight: false,
		className: "md:col-span-1",
		visual: null,
	},
	{
		icon: Target,
		title: "Risk Tracking",
		description:
			"Track planned vs actual stops. Optimize your risk-reward ratios.",
		highlight: false,
		className: "md:col-span-1",
		visual: (
			<div className="mt-6 space-y-2">
				<div className="flex justify-between font-mono text-xs">
					<span className="text-muted-foreground">RR Target</span>
					<span className="text-primary">2.5:1</span>
				</div>
				<div className="h-2 overflow-hidden rounded-full bg-muted">
					<div className="h-full w-3/4 bg-linear-to-r from-primary to-accent" />
				</div>
				<div className="flex justify-between font-mono text-xs">
					<span className="text-muted-foreground">Actual RR</span>
					<span>1.8:1</span>
				</div>
			</div>
		),
	},
	{
		icon: Sparkles,
		title: "Setup Tags",
		description: "Categorize trades by setup. Find what works best for you.",
		highlight: false,
		className: "md:col-span-1",
		visual: (
			<div className="mt-6 flex flex-wrap gap-2">
				{["Breakout", "Reversal", "Trend", "Range"].map((tag) => (
					<span
						className="rounded border border-border bg-muted/50 px-2 py-1 font-mono text-xs"
						key={tag}
					>
						{tag}
					</span>
				))}
			</div>
		),
	},
	{
		icon: Zap,
		title: "Futures & Forex",
		description:
			"Built for ES, NQ, CL, EUR/USD, GBP/USD with proper lot sizing.",
		highlight: false,
		className: "md:col-span-1",
		visual: (
			<div className="mt-6 grid grid-cols-3 gap-2">
				{["ES", "NQ", "CL", "EUR", "GBP", "JPY"].map((symbol) => (
					<div
						className="rounded border border-border/50 bg-muted/50 p-2 text-center font-mono text-xs"
						key={symbol}
					>
						{symbol}
					</div>
				))}
			</div>
		),
	},
	{
		icon: Lock,
		title: "Your Data, Your Keys",
		description:
			"Bring your own AI API keys. Your trading data stays private. Always.",
		highlight: true,
		className: "md:col-span-1",
		visual: (
			<div className="mt-6 font-mono text-xs">
				<div className="rounded border border-profit/20 bg-profit/5 p-3">
					<span className="text-profit">✓</span>{" "}
					<span className="text-muted-foreground">Data encrypted at rest</span>
				</div>
			</div>
		),
	},
];

export function Features() {
	return (
		<section className="relative py-16 sm:py-24 lg:py-32" id="features">
			{/* Background */}
			<div className="grid-bg absolute inset-0 opacity-50" />

			<div className="relative mx-auto max-w-6xl px-4 sm:px-6">
				{/* Section header */}
				<div className="mb-10 max-w-2xl sm:mb-16 lg:mb-20">
					<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:mb-4 sm:text-xs">
						Features
					</span>
					<h2 className="font-bold text-2xl leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
						Everything you need to{" "}
						<span className="text-primary">find your edge</span>
					</h2>
					<p className="mt-4 font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						A complete toolkit for serious traders who want to consistently
						improve.
					</p>
				</div>

				{/* Bento grid - responsive: single column on mobile, 2 on tablet, 3 on desktop */}
				<div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
					{features.map((feature) => (
						<div
							className={`group relative overflow-hidden rounded border transition-all duration-300 ${
								feature.highlight
									? "border-primary/20 bg-primary/2 hover:border-primary/40"
									: "border-border/50 bg-muted/30 hover:border-border"
							} p-4 sm:p-6 ${feature.className.includes("md:col-span-2") ? "sm:col-span-2 lg:col-span-2" : ""}`}
							key={feature.title}
						>
							{/* Icon */}
							<div
								className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded sm:mb-4 sm:h-10 sm:w-10 ${
									feature.highlight ? "bg-primary/10" : "bg-muted"
								}`}
							>
								<feature.icon
									className={`h-4 w-4 sm:h-5 sm:w-5 ${
										feature.highlight ? "text-primary" : "text-muted-foreground"
									}`}
								/>
							</div>

							{/* Content */}
							<h3 className="font-semibold text-base sm:text-lg">
								{feature.title}
							</h3>
							<p className="mt-1.5 font-mono text-muted-foreground text-xs leading-relaxed sm:mt-2 sm:text-sm">
								{feature.description}
							</p>

							{/* Visual element - hidden on mobile for cleaner look */}
							<div className="hidden sm:block">{feature.visual}</div>

							{/* Hover glow effect for highlighted cards */}
							{feature.highlight && (
								<div className="-inset-px absolute rounded opacity-0 transition-opacity duration-300 group-hover:opacity-100">
									<div className="absolute inset-0 rounded bg-linear-to-r from-primary/10 via-transparent to-transparent" />
								</div>
							)}
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
