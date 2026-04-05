"use client";

import { SignUpButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, BarChart3, Play, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Simulated live ticker data
const tickerItems = [
	{ symbol: "ES", price: "5,892.50", change: "+0.43%", positive: true },
	{ symbol: "NQ", price: "21,245.75", change: "+0.67%", positive: true },
	{ symbol: "MES", price: "5,892.25", change: "+0.41%", positive: true },
	{ symbol: "MNQ", price: "21,244.50", change: "+0.65%", positive: true },
	{ symbol: "CL", price: "72.45", change: "-0.89%", positive: false },
	{ symbol: "GC", price: "2,645.30", change: "+0.34%", positive: true },
	{ symbol: "YM", price: "43,892.00", change: "+0.28%", positive: true },
	{ symbol: "RTY", price: "2,245.60", change: "-0.15%", positive: false },
];

// Demo trades for the preview (for logged out users)
const demoTrades = [
	{ symbol: "ES", direction: "LONG", pnl: 425.0, positive: true },
	{ symbol: "NQ", direction: "SHORT", pnl: -180.0, positive: false },
	{ symbol: "MNQ", direction: "LONG", pnl: 312.5, positive: true },
	{ symbol: "ES", direction: "LONG", pnl: 287.0, positive: true },
	{ symbol: "CL", direction: "SHORT", pnl: -95.0, positive: false },
];

// Demo equity curve data points
const demoEquityCurve = [
	0, 425, 245, 557, 844, 749, 1061, 1248, 1153, 1465, 1652, 1557, 1869, 2156,
	2061, 2373, 2560, 2847,
];

function Ticker() {
	return (
		<div className="relative overflow-hidden border-border/50 border-y bg-black/50 py-3">
			<div className="ticker-scroll flex">
				{[...tickerItems, ...tickerItems].map((item, idx) => (
					<div
						className="flex shrink-0 items-center gap-8 px-8"
						key={`${item.symbol}-${idx}`}
					>
						<span className="font-mono text-muted-foreground text-xs">
							{item.symbol}
						</span>
						<span className="font-medium font-mono text-sm">{item.price}</span>
						<span
							className={`font-mono text-xs ${
								item.positive ? "text-profit" : "text-loss"
							}`}
						>
							{item.change}
						</span>
						<span className="text-border">│</span>
					</div>
				))}
			</div>
		</div>
	);
}

function AnimatedCounter({
	end,
	suffix = "",
	prefix = "",
	duration = 2000,
}: {
	end: number;
	suffix?: string;
	prefix?: string;
	duration?: number;
}) {
	const [count, setCount] = useState(0);
	const [hasAnimated, setHasAnimated] = useState(false);

	useEffect(() => {
		if (hasAnimated) return;
		const timer = setTimeout(() => {
			setHasAnimated(true);
			const startTime = Date.now();
			const animate = () => {
				const elapsed = Date.now() - startTime;
				const progress = Math.min(elapsed / duration, 1);
				const easeOut = 1 - (1 - progress) ** 3;
				setCount(Math.floor(end * easeOut));
				if (progress < 1) {
					requestAnimationFrame(animate);
				}
			};
			requestAnimationFrame(animate);
		}, 500);
		return () => clearTimeout(timer);
	}, [end, duration, hasAnimated]);

	return (
		<span>
			{prefix}
			{count.toLocaleString()}
			{suffix}
		</span>
	);
}

// Demo dashboard
function DemoDashboard() {
	const [animatedEquity, setAnimatedEquity] = useState<number[]>([]);

	useEffect(() => {
		// Animate the equity curve in
		demoEquityCurve.forEach((_, index) => {
			setTimeout(() => {
				setAnimatedEquity(demoEquityCurve.slice(0, index + 1));
			}, index * 100);
		});
	}, []);

	const maxEquity = Math.max(...demoEquityCurve);

	return (
		<div className="flex h-full flex-col gap-3 p-3 sm:p-4">
			{/* Stats row - responsive grid */}
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
				<div className="rounded border border-border/50 bg-muted/50 p-2 sm:p-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Net P&L
						</span>
						<TrendingUp className="h-3 w-3 text-profit" />
					</div>
					<div className="mt-1 font-bold font-mono text-profit text-sm sm:text-lg">
						+$2,847.50
					</div>
					<div className="hidden font-mono text-[10px] text-muted-foreground sm:block">
						47 trades
					</div>
				</div>
				<div className="rounded border border-border/50 bg-muted/50 p-2 sm:p-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Win Rate
						</span>
						<Target className="h-3 w-3 text-primary" />
					</div>
					<div className="mt-1 font-bold font-mono text-sm sm:text-lg">
						68.1%
					</div>
					<div className="hidden font-mono text-[10px] text-muted-foreground sm:block">
						32W · 15L
					</div>
				</div>
				<div className="rounded border border-border/50 bg-muted/50 p-2 sm:p-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Best Trade
						</span>
						<TrendingUp className="h-3 w-3 text-profit" />
					</div>
					<div className="mt-1 font-bold font-mono text-profit text-sm sm:text-lg">
						+$892.00
					</div>
					<div className="hidden font-mono text-[10px] text-muted-foreground sm:block">
						ES · Long
					</div>
				</div>
				<div className="rounded border border-border/50 bg-muted/50 p-2 sm:p-3">
					<div className="flex items-center justify-between">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Avg Win
						</span>
						<BarChart3 className="h-3 w-3 text-accent" />
					</div>
					<div className="mt-1 font-bold font-mono text-sm sm:text-lg">
						$187.50
					</div>
					<div className="hidden font-mono text-[10px] text-muted-foreground sm:block">
						vs -$94.20 loss
					</div>
				</div>
			</div>

			{/* Chart and trades - responsive layout */}
			<div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
				{/* Equity curve */}
				<div className="rounded border border-border/50 bg-muted/50 p-2 sm:col-span-2 sm:p-3">
					<div className="mb-2 flex items-center justify-between sm:mb-3">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider sm:text-[10px]">
							Equity Curve
						</span>
						<span className="font-mono text-[9px] text-profit sm:text-[10px]">
							+$2,847.50
						</span>
					</div>
					<div className="flex h-20 items-end gap-0.5 sm:h-32">
						{animatedEquity.map((value, i) => (
							<div
								className="flex-1 rounded-t bg-linear-to-t from-primary/60 to-primary/30 transition-all duration-300"
								key={`demo-equity-${value.toFixed(2)}-${i}`}
								style={{
									height: `${(value / maxEquity) * 100}%`,
									minHeight: "2px",
								}}
							/>
						))}
					</div>
				</div>

				{/* Recent trades - hidden on smallest screens */}
				<div className="hidden rounded border border-border/50 bg-muted/50 p-2 sm:block sm:p-3">
					<div className="mb-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Recent Trades
					</div>
					<div className="space-y-2">
						{demoTrades.map((trade) => (
							<div
								className="flex items-center justify-between rounded bg-muted/50 px-2 py-1"
								key={`${trade.symbol}-${trade.direction}-${trade.pnl}`}
							>
								<div className="flex items-center gap-2">
									<span className="font-mono text-[10px] text-muted-foreground">
										{trade.symbol}
									</span>
									<span
										className={`font-mono text-[10px] ${trade.direction === "LONG" ? "text-profit" : "text-loss"}`}
									>
										{trade.direction}
									</span>
								</div>
								<span
									className={`font-medium font-mono text-[10px] ${trade.positive ? "text-profit" : "text-loss"}`}
								>
									{trade.positive ? "+" : ""}
									{trade.pnl.toFixed(2)}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// Dashboard preview - always show demo
function DashboardPreview() {
	return <DemoDashboard />;
}

// CTA button that shows "Start Free" by default until signed in
function HeroCTA() {
	const { isLoaded, isSignedIn } = useAuth();

	// Show dashboard button only when we're certain user is signed in
	if (isLoaded && isSignedIn) {
		return (
			<Button
				asChild
				className="group h-11 w-full gap-2 px-6 font-mono text-xs uppercase tracking-wider sm:h-12 sm:w-auto sm:gap-3 sm:px-8 sm:text-sm"
				size="lg"
			>
				<Link href="/dashboard">
					Go to Dashboard
					<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
				</Link>
			</Button>
		);
	}

	// Default: show signup button (while loading or when signed out)
	return (
		<SignUpButton mode="modal">
			<Button
				className="group h-11 w-full gap-2 px-6 font-mono text-xs uppercase tracking-wider sm:h-12 sm:w-auto sm:gap-3 sm:px-8 sm:text-sm"
				size="lg"
			>
				Start Free
				<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
			</Button>
		</SignUpButton>
	);
}

export function Hero() {
	return (
		<section className="relative min-h-screen overflow-hidden">
			{/* Background layers */}
			<div className="grid-bg absolute inset-0" />
			<div className="scanlines pointer-events-none absolute inset-0" />

			{/* Gradient orbs */}
			<div className="-left-32 absolute top-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
			<div className="-right-32 absolute bottom-1/4 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[120px]" />

			{/* Content */}
			<div className="relative flex min-h-screen flex-col pt-16">
				{/* Ticker */}
				<Ticker />

				{/* Main hero content */}
				<div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
					<div className="mx-auto max-w-5xl text-center">
						{/* Status badge */}
						<div className="mb-4 inline-flex items-center gap-2 rounded-none border border-border bg-muted/50 px-3 py-1.5 sm:mb-6 sm:gap-3 sm:px-4 sm:py-2">
							<span className="pulse-dot h-2 w-2 rounded-full bg-profit" />
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-xs">
								Now in public beta
							</span>
						</div>

						{/* Main headline */}
						<h1 className="mb-4 font-bold text-3xl leading-none tracking-tight sm:mb-5 sm:text-5xl lg:text-6xl xl:text-7xl">
							<span className="block">Your Trades.</span>
							<span className="block text-glow-primary text-primary">
								Your Edge.
							</span>
						</h1>

						{/* Subheadline */}
						<p className="mx-auto max-w-xl font-mono text-muted-foreground text-xs sm:text-sm md:text-base">
							The trading journal built for futures.
							<br className="hidden sm:block" />
							Log trades, spot patterns, and let AI surface what you{" "}
							<span className="text-foreground">keep missing.</span>
						</p>

						{/* CTA buttons */}
						<div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
							<HeroCTA />
							<Button
								asChild
								className="h-11 w-full gap-2 px-6 font-mono text-xs uppercase tracking-wider sm:h-12 sm:w-auto sm:gap-3 sm:px-8 sm:text-sm"
								size="lg"
								variant="outline"
							>
								<a href="#features">
									<Play className="h-4 w-4" />
									<span className="sm:hidden">Demo</span>
									<span className="hidden sm:inline">Watch Demo</span>
								</a>
							</Button>
						</div>

						{/* Stats row */}
						<div className="mt-8 grid grid-cols-2 gap-4 border-border/50 border-t pt-6 sm:mt-12 sm:gap-6 sm:pt-8 md:grid-cols-4">
							<div className="text-center">
								<div className="font-bold font-mono text-2xl text-primary sm:text-3xl md:text-4xl">
									<AnimatedCounter end={12} prefix="+" suffix="%" />
								</div>
								<div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:mt-2 sm:text-xs">
									Avg Win Rate Gain
								</div>
							</div>
							<div className="text-center">
								<div className="font-bold font-mono text-2xl sm:text-3xl md:text-4xl">
									<AnimatedCounter end={50} suffix="K" />
								</div>
								<div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:mt-2 sm:text-xs">
									Trades Analyzed
								</div>
							</div>
							<div className="text-center">
								<div className="font-bold font-mono text-2xl text-accent sm:text-3xl md:text-4xl">
									<AnimatedCounter end={2} prefix="<" suffix="s" />
								</div>
								<div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:mt-2 sm:text-xs">
									AI Response Time
								</div>
							</div>
							<div className="text-center">
								<div className="font-bold font-mono text-2xl sm:text-3xl md:text-4xl">
									<AnimatedCounter end={99} suffix="%" />
								</div>
								<div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:mt-2 sm:text-xs">
									Uptime SLA
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Terminal preview section */}
				<div className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6 sm:pb-12">
					<div className="overflow-hidden rounded border border-border bg-black/90 shadow-2xl">
						{/* Terminal header */}
						<div className="flex items-center justify-between border-border/50 border-b bg-muted/50 px-3 py-2 sm:px-4">
							<div className="flex items-center gap-1.5 sm:gap-2">
								<div className="h-2 w-2 rounded-full bg-loss/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-breakeven/60 sm:h-2.5 sm:w-2.5" />
								<div className="h-2 w-2 rounded-full bg-profit/60 sm:h-2.5 sm:w-2.5" />
							</div>
							<span className="hidden font-mono text-[10px] text-muted-foreground sm:block">
								traderlog — dashboard
							</span>
							<div className="hidden w-14 sm:block" />
						</div>

						{/* Terminal content */}
						<div className="relative aspect-4/3 overflow-hidden sm:aspect-16/8">
							<DashboardPreview />

							{/* Gradient overlay */}
							<div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background to-transparent sm:h-16" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
