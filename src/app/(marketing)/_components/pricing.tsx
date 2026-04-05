"use client";

import { Check, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import {
	type BillingPeriod,
	buildPricingPlans,
} from "@/lib/constants/pricing-plans";
import { BillingToggle } from "./shared/billing-toggle";
import { PlanCTA } from "./shared/plan-cta";

const PLAN_ICONS: Record<string, React.ReactNode> = {
	starter: <Zap className="h-4 w-4" />,
	pro: <Sparkles className="h-4 w-4" />,
};

export function Pricing() {
	const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("year");
	const plans = buildPricingPlans(billingPeriod);

	return (
		<section
			className="relative py-16 sm:py-24 lg:py-32"
			data-testid="pricing-section"
			id="pricing"
		>
			{/* Background */}
			<div className="grid-bg absolute inset-0 opacity-30" />

			<div className="relative mx-auto max-w-4xl px-4 sm:px-6">
				{/* Header */}
				<div className="mb-10 text-center sm:mb-16">
					<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:mb-4 sm:text-xs">
						Pricing
					</span>
					<h2 className="font-bold text-2xl leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
						Know your edge.
						<br />
						<span className="text-primary">Choose your plan.</span>
					</h2>
					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Start with a 30-day free trial. No credit card required.
					</p>

					{/* Billing toggle */}
					<div className="mt-8 sm:mt-10">
						<BillingToggle onChange={setBillingPeriod} period={billingPeriod} />
					</div>
				</div>

				{/* Pricing cards */}
				<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
					{plans.map((plan) => (
						<div
							className={`relative flex flex-col rounded border p-5 transition-all sm:p-8 ${
								plan.highlighted
									? "border-primary/30 bg-primary/[0.02] shadow-lg shadow-primary/5"
									: "border-border bg-muted/30 hover:border-border/80"
							}`}
							data-testid={`pricing-card-${plan.slug}`}
							key={plan.slug}
						>
							{/* Popular badge */}
							{plan.highlighted && (
								<div className="-top-3 absolute left-4 flex items-center gap-1.5 rounded bg-primary px-2.5 py-0.5 sm:left-6 sm:px-3 sm:py-1">
									<Sparkles className="h-3 w-3 text-primary-foreground" />
									<span className="font-medium font-mono text-[10px] text-primary-foreground uppercase tracking-wider sm:text-xs">
										Most Popular
									</span>
								</div>
							)}

							{/* Plan header */}
							<div className="mb-4 flex items-start gap-3 sm:mb-6">
								<div
									className={`flex h-8 w-8 items-center justify-center rounded border ${
										plan.highlighted
											? "border-primary/30 bg-primary/10 text-primary"
											: "border-border bg-muted text-muted-foreground"
									}`}
								>
									{PLAN_ICONS[plan.slug]}
								</div>
								<div>
									<h3 className="font-bold text-lg sm:text-xl">{plan.name}</h3>
									<p className="mt-1 font-mono text-muted-foreground text-xs sm:text-sm">
										{plan.tagline}
									</p>
								</div>
							</div>

							{/* Price */}
							<div className="mb-6 sm:mb-8">
								<div className="flex items-baseline gap-1">
									{plan.originalPrice !== null && (
										<span className="mr-1 font-bold text-lg text-muted-foreground line-through sm:text-xl">
											${plan.originalPrice}
										</span>
									)}
									<span className="font-bold text-4xl tracking-tight sm:text-5xl">
										${plan.price}
									</span>
									<span className="font-mono text-muted-foreground text-xs sm:text-sm">
										/month
									</span>
								</div>
								{plan.annualTotal !== null ? (
									<span className="mt-2 inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary sm:text-xs">
										billed annually (${plan.annualTotal}/yr)
									</span>
								) : (
									<span className="mt-2 inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary sm:text-xs">
										{plan.trial}
									</span>
								)}
							</div>

							{/* Features */}
							<ul className="mb-6 flex-1 space-y-3 sm:mb-8 sm:space-y-4">
								{plan.features.map((feature) => (
									<li className="flex items-start gap-2 sm:gap-3" key={feature}>
										<Check
											className={`mt-0.5 h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4 ${
												plan.highlighted ? "text-primary" : "text-[#00ff88]"
											}`}
										/>
										<span className="font-mono text-muted-foreground text-xs sm:text-sm">
											{feature}
										</span>
									</li>
								))}
							</ul>

							{/* CTA */}
							<PlanCTA billingPeriod={billingPeriod} plan={plan} />

							{/* Trust signals */}
							<p className="mt-3 text-center font-mono text-[10px] text-muted-foreground sm:text-xs">
								30-day free trial · Cancel anytime
							</p>
						</div>
					))}
				</div>

				{/* Trial note */}
				<p className="mt-8 text-center font-mono text-muted-foreground text-xs sm:mt-12 sm:text-sm">
					Your data is always yours — even if you change plans.{" "}
					<span className="text-foreground">
						All plans include a 30-day free trial.
					</span>
				</p>
			</div>
		</section>
	);
}
