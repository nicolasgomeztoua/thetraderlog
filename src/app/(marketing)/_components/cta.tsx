"use client";

import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTA() {
	return (
		<section className="relative overflow-hidden py-32">
			{/* Background gradient */}
			<div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent" />

			{/* Grid background */}
			<div className="grid-bg absolute inset-0 opacity-30" />

			{/* Glow effect */}
			<div className="absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[150px]" />

			<div className="relative mx-auto max-w-4xl px-6 text-center">
				{/* Main content */}
				<SignedOut>
					<h2 className="font-bold text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						Ready to find your
						<br />
						<span className="text-glow-primary text-primary">
							trading edge?
						</span>
					</h2>

					<p className="mx-auto mt-6 max-w-xl font-mono text-base text-muted-foreground">
						Join thousands of traders who use EdgeJournal to track, analyze, and
						improve their trading performance.
					</p>

					{/* CTA buttons */}
					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<SignUpButton mode="modal">
							<Button
								className="group h-14 gap-3 px-10 font-mono text-sm uppercase tracking-wider"
								size="lg"
							>
								Start Free Trial
								<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
							</Button>
						</SignUpButton>
					</div>

					{/* Trust elements */}
					<div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 font-mono text-muted-foreground text-xs">
						<span>✓ No credit card required</span>
						<span>✓ 14-day Pro trial</span>
						<span>✓ Cancel anytime</span>
					</div>
				</SignedOut>

				<SignedIn>
					<h2 className="font-bold text-4xl leading-tight tracking-tight sm:text-5xl lg:text-6xl">
						Ready to continue
						<br />
						<span className="text-glow-primary text-primary">
							your journey?
						</span>
					</h2>

					<p className="mx-auto mt-6 max-w-xl font-mono text-base text-muted-foreground">
						Your trading data is waiting. Jump back in and keep improving.
					</p>

					{/* CTA buttons */}
					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Button
							asChild
							className="group h-14 gap-3 px-10 font-mono text-sm uppercase tracking-wider"
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
				<div className="mx-auto mt-16 max-w-lg rounded border border-white/5 bg-white/[0.01] p-4">
					<div className="flex items-center gap-3 font-mono text-sm">
						<span className="text-primary">$</span>
						<span className="text-muted-foreground">
							Start your journey to consistent profitability
						</span>
						<span className="animate-pulse text-primary">▌</span>
					</div>
				</div>
			</div>
		</section>
	);
}
