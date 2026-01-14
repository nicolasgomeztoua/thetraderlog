"use client";

import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
	return (
		<section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
			{/* Background gradient */}
			<div className="absolute inset-0 bg-linear-to-t from-primary/5 via-transparent to-transparent" />

			{/* Grid background */}
			<div className="grid-bg absolute inset-0 opacity-30" />

			{/* Glow effect */}
			<div className="-translate-x-1/2 absolute bottom-0 left-1/2 h-[300px] w-[400px] rounded-full bg-primary/10 blur-[120px] sm:h-[400px] sm:w-[600px] sm:blur-[150px]" />

			<div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
				{/* Main content */}
				<SignedOut>
					<h2 className="font-bold text-2xl leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
						Ready to find your
						<br />
						<span className="text-glow-primary text-primary">
							trading edge?
						</span>
					</h2>

					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Join thousands of traders who use EdgeJournal to track, analyze, and
						improve their trading performance.
					</p>

					{/* CTA buttons */}
					<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
						<SignUpButton mode="modal">
							<Button
								className="group h-12 w-full gap-2 px-6 font-mono text-xs uppercase tracking-wider sm:h-14 sm:w-auto sm:gap-3 sm:px-10 sm:text-sm"
								size="lg"
							>
								Start Free Trial
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Button>
						</SignUpButton>
					</div>

					{/* Trust elements */}
					<div className="mt-8 flex flex-col items-center justify-center gap-2 font-mono text-[10px] text-muted-foreground sm:mt-12 sm:flex-row sm:gap-x-8 sm:text-xs">
						<span>✓ No credit card required</span>
						<span>✓ 14-day Pro trial</span>
						<span>✓ Cancel anytime</span>
					</div>
				</SignedOut>

				<SignedIn>
					<h2 className="font-bold text-2xl leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
						Ready to continue
						<br />
						<span className="text-glow-primary text-primary">
							your journey?
						</span>
					</h2>

					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Your trading data is waiting. Jump back in and keep improving.
					</p>

					{/* CTA buttons */}
					<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
						<Button
							asChild
							className="group h-12 w-full gap-2 px-6 font-mono text-xs uppercase tracking-wider sm:h-14 sm:w-auto sm:gap-3 sm:px-10 sm:text-sm"
							size="lg"
						>
							<Link href="/dashboard">
								Go to Dashboard
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Link>
						</Button>
					</div>
				</SignedIn>

				{/* Decorative terminal line */}
				<div className="mx-auto mt-10 max-w-lg rounded border border-white/5 bg-white/1 p-3 sm:mt-16 sm:p-4">
					<div className="flex items-center gap-2 font-mono text-xs sm:gap-3 sm:text-sm">
						<span className="text-primary">$</span>
						<span className="text-muted-foreground">
							<span className="hidden sm:inline">
								Start your journey to consistent profitability
							</span>
							<span className="sm:hidden">Start your trading journey</span>
						</span>
						<span className="animate-pulse text-primary">▌</span>
					</div>
				</div>
			</div>
		</section>
	);
}
