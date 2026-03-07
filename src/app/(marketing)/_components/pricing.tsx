"use client";

import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const plans = [
	{
		name: "Free Trial",
		tagline: "30 days, full access",
		price: "$0",
		period: "for 30 days",
		features: [
			"Unlimited trades",
			"Full analytics",
			"AI chat & reports",
			"CSV import",
			"Data kept forever",
		],
		cta: "Start Free Trial",
		ctaLoggedIn: "Go to Dashboard",
		highlighted: false,
	},
	{
		name: "Starter",
		tagline: "Everything you need",
		price: "$10",
		period: "/month",
		features: [
			"Unlimited trades",
			"Full analytics",
			"CSV import & export",
			"Prop compliance tracking",
			"Custom tags & strategies",
			"Data kept forever",
		],
		cta: "Get Started",
		ctaLoggedIn: "Upgrade to Starter",
		highlighted: false,
	},
	{
		name: "Pro",
		tagline: "AI-powered edge",
		price: "$24",
		period: "/month",
		features: [
			"Everything in Starter",
			"AI chat (50 msgs/day)",
			"AI reports (5/month)",
			"Export to PDF",
			"Priority support",
		],
		cta: "Start Free Trial",
		ctaLoggedIn: "Upgrade to Pro",
		highlighted: true,
	},
];

export function Pricing() {
	return (
		<section className="relative py-16 sm:py-24 lg:py-32" id="pricing">
			{/* Background */}
			<div className="grid-bg absolute inset-0 opacity-30" />

			<div className="relative mx-auto max-w-6xl px-4 sm:px-6">
				{/* Header */}
				<div className="mb-10 text-center sm:mb-16">
					<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:mb-4 sm:text-xs">
						Pricing
					</span>
					<h2 className="font-bold text-2xl leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
						Simple, transparent
						<br />
						<span className="text-primary">pricing</span>
					</h2>
					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Start free. Upgrade when you need more.
					</p>
				</div>

				{/* Pricing cards - Pro card first on mobile for importance */}
				<div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
					{plans.map((plan) => (
						<div
							className={`relative flex flex-col rounded border p-5 transition-all sm:p-8 ${
								plan.highlighted
									? "order-first border-primary/30 bg-primary/2 shadow-lg shadow-primary/5 lg:order-none"
									: "border-border bg-muted/30 hover:border-border"
							}`}
							key={plan.name}
						>
							{/* Popular badge */}
							{plan.highlighted && (
								<div className="-top-3 absolute left-4 flex items-center gap-1 rounded bg-primary px-2.5 py-0.5 sm:left-6 sm:px-3 sm:py-1">
									<Sparkles className="h-3 w-3 text-primary-foreground" />
									<span className="font-medium font-mono text-[10px] text-primary-foreground uppercase tracking-wider sm:text-xs">
										Popular
									</span>
								</div>
							)}

							{/* Plan header */}
							<div className="mb-4 sm:mb-6">
								<h3 className="font-bold text-lg sm:text-xl">{plan.name}</h3>
								<p className="mt-1 font-mono text-muted-foreground text-xs sm:text-sm">
									{plan.tagline}
								</p>
							</div>

							{/* Price */}
							<div className="mb-6 sm:mb-8">
								<span className="font-bold text-4xl tracking-tight sm:text-5xl">
									{plan.price}
								</span>
								<span className="font-mono text-muted-foreground text-xs sm:text-sm">
									{plan.period}
								</span>
							</div>

							{/* Features */}
							<ul className="mb-6 flex-1 space-y-3 sm:mb-8 sm:space-y-4">
								{plan.features.map((feature) => (
									<li className="flex items-start gap-2 sm:gap-3" key={feature}>
										<Check
											className={`mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${
												plan.highlighted ? "text-primary" : "text-profit"
											}`}
										/>
										<span className="font-mono text-muted-foreground text-xs sm:text-sm">
											{feature}
										</span>
									</li>
								))}
							</ul>

							{/* CTA */}
							<SignedOut>
								<SignUpButton mode="modal">
									<Button
										className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
										variant={plan.highlighted ? "default" : "outline"}
									>
										{plan.cta}
										<ArrowRight className="h-4 w-4" />
									</Button>
								</SignUpButton>
							</SignedOut>
							<SignedIn>
								<Button
									asChild
									className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
									variant={plan.highlighted ? "default" : "outline"}
								>
									<Link
										href={plan.highlighted ? "/settings" : "/dashboard"}
									>
										{plan.ctaLoggedIn}
										<ArrowRight className="h-4 w-4" />
									</Link>
								</Button>
							</SignedIn>
						</div>
					))}
				</div>

				{/* Trial note */}
				<p className="mt-8 text-center font-mono text-muted-foreground text-xs sm:mt-12 sm:text-sm">
					Your data stays even after your trial ends.{" "}
					<span className="text-foreground">
						No credit card required to start.
					</span>
				</p>
			</div>
		</section>
	);
}
