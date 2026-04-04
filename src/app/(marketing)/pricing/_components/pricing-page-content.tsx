"use client";

import { SignUpButton, useAuth } from "@clerk/nextjs";
import { ArrowRight, Check, HelpCircle, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	type BillingPeriod,
	buildPricingPlans,
	COMPARISON_CATEGORIES,
	FAQ_ITEMS,
	type PricingPlan,
} from "@/lib/constants/pricing-plans";
import { BillingToggle } from "../../_components/shared/billing-toggle";
import { PlanCTA } from "../../_components/shared/plan-cta";

const PLAN_ICONS: Record<string, React.ReactNode> = {
	starter: <Zap className="h-4 w-4" />,
	pro: <Sparkles className="h-4 w-4" />,
};

export function PricingPageContent() {
	const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("year");
	const plans = buildPricingPlans(billingPeriod);

	return (
		<section className="relative py-16 sm:py-24 lg:py-32">
			{/* Background */}
			<div className="grid-bg absolute inset-0 opacity-30" />
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,255,0,0.03),transparent_60%)]" />

			<div className="relative mx-auto max-w-5xl px-4 sm:px-6">
				{/* Header */}
				<div className="mb-12 text-center sm:mb-20">
					<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:mb-4 sm:text-xs">
						[ Pricing ]
					</span>
					<h1
						className="font-bold text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl"
						data-testid="pricing-page-heading"
					>
						Know your edge.
						<br />
						<span className="text-primary">Choose your plan.</span>
					</h1>
					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Start with a 30-day free trial.
						<br className="hidden sm:block" />
						No credit card required.
					</p>

					{/* Billing toggle */}
					<div className="mt-8 sm:mt-10">
						<BillingToggle onChange={setBillingPeriod} period={billingPeriod} />
					</div>
				</div>

				{/* Pricing cards */}
				<div
					className="mx-auto grid max-w-4xl gap-4 sm:gap-6 lg:grid-cols-2"
					data-testid="pricing-page-cards"
				>
					{plans.map((plan) => (
						<PricingCard
							billingPeriod={billingPeriod}
							key={plan.slug}
							plan={plan}
						/>
					))}
				</div>

				{/* Feature comparison table */}
				<ComparisonTable />

				{/* FAQ */}
				<div className="mx-auto mt-16 max-w-3xl sm:mt-24">
					<div className="mb-8 text-center sm:mb-12">
						<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:text-xs">
							[ FAQ ]
						</span>
						<h2 className="font-bold text-xl sm:text-2xl lg:text-3xl">
							Common questions
						</h2>
					</div>

					<div className="space-y-3 sm:space-y-4">
						{FAQ_ITEMS.map((item) => (
							<FAQItem key={item.q} {...item} />
						))}
					</div>
				</div>

				{/* Bottom CTA */}
				<BottomCTA />
			</div>
		</section>
	);
}

// =============================================================================
// PRICING CARD
// =============================================================================

function PricingCard({
	plan,
	billingPeriod,
}: {
	plan: PricingPlan;
	billingPeriod: BillingPeriod;
}) {
	return (
		<div
			className={`group relative flex flex-col rounded border p-6 transition-all sm:p-8 ${
				plan.highlighted
					? "border-primary/30 bg-primary/[0.02] shadow-lg shadow-primary/5"
					: "border-border bg-muted/30 hover:border-border/80"
			}`}
			data-testid={`pricing-card-${plan.slug}`}
		>
			{/* Popular badge */}
			{plan.highlighted && (
				<div className="-top-3 absolute left-5 flex items-center gap-1.5 rounded bg-primary px-3 py-1 sm:left-7">
					<Sparkles className="h-3 w-3 text-primary-foreground" />
					<span className="font-medium font-mono text-[10px] text-primary-foreground uppercase tracking-wider sm:text-xs">
						Most Popular
					</span>
				</div>
			)}

			{/* Plan header */}
			<div className="mb-5 flex items-start gap-3 sm:mb-6">
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
					<h2 className="font-bold text-lg sm:text-xl">{plan.name}</h2>
					<p className="font-mono text-muted-foreground text-xs sm:text-sm">
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
			<ul className="mb-8 flex-1 space-y-3 sm:space-y-4">
				{plan.features.map((feature) => (
					<li className="flex items-start gap-2.5 sm:gap-3" key={feature}>
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
	);
}

// =============================================================================
// COMPARISON TABLE
// =============================================================================

function ComparisonTable() {
	return (
		<div className="mx-auto mt-16 max-w-4xl sm:mt-24">
			<div className="mb-8 text-center sm:mb-12">
				<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:text-xs">
					[ Compare ]
				</span>
				<h2 className="font-bold text-xl sm:text-2xl lg:text-3xl">
					Feature comparison
				</h2>
			</div>

			<div className="overflow-hidden rounded border border-border">
				{/* Table header */}
				<div className="grid grid-cols-[1fr_100px_100px] border-border border-b bg-muted/50 px-4 py-3 sm:grid-cols-[1fr_140px_140px] sm:px-6 sm:py-4">
					<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-xs">
						Feature
					</span>
					<span className="text-center font-mono text-[10px] text-muted-foreground uppercase tracking-wider sm:text-xs">
						Starter
					</span>
					<span className="text-center font-mono text-[10px] text-primary uppercase tracking-wider sm:text-xs">
						Pro
					</span>
				</div>

				{/* Table body */}
				{COMPARISON_CATEGORIES.map((category) => (
					<div key={category.name}>
						{/* Category header */}
						<div className="border-border border-b bg-muted/20 px-4 py-2 sm:px-6">
							<span className="font-medium font-mono text-[10px] text-foreground uppercase tracking-wider sm:text-xs">
								{category.name}
							</span>
						</div>
						{/* Features */}
						{category.features.map((feature, i) => (
							<div
								className={`grid grid-cols-[1fr_100px_100px] px-4 py-2.5 sm:grid-cols-[1fr_140px_140px] sm:px-6 sm:py-3 ${
									i < category.features.length - 1
										? "border-border/50 border-b"
										: "border-border border-b"
								}`}
								key={feature.label}
							>
								<span className="font-mono text-muted-foreground text-xs sm:text-sm">
									{feature.label}
								</span>
								<div className="flex items-center justify-center">
									{feature.starter === true ? (
										<Check className="h-3.5 w-3.5 text-[#00ff88]" />
									) : feature.starter === false ? (
										<span className="font-mono text-muted-foreground/40 text-xs">
											—
										</span>
									) : (
										<span className="font-mono text-[10px] text-muted-foreground sm:text-xs">
											{feature.starter}
										</span>
									)}
								</div>
								<div className="flex items-center justify-center">
									{feature.pro === true ? (
										<Check className="h-3.5 w-3.5 text-primary" />
									) : feature.pro === false ? (
										<span className="font-mono text-muted-foreground/40 text-xs">
											—
										</span>
									) : (
										<span className="font-mono text-[10px] text-primary sm:text-xs">
											{feature.pro}
										</span>
									)}
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

// =============================================================================
// FAQ
// =============================================================================

function FAQItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);

	return (
		<button
			className={`w-full rounded border text-left transition-all ${
				open
					? "border-border/80 bg-muted/30"
					: "border-border/50 bg-transparent hover:border-border/80"
			}`}
			onClick={() => setOpen(!open)}
			type="button"
		>
			<div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
				<span className="font-mono text-xs sm:text-sm">{q}</span>
				<HelpCircle
					className={`h-3.5 w-3.5 shrink-0 transition-colors sm:h-4 sm:w-4 ${
						open ? "text-primary" : "text-muted-foreground"
					}`}
				/>
			</div>
			{open && (
				<div className="border-border/50 border-t px-4 py-3 sm:px-6 sm:py-4">
					<p className="font-mono text-muted-foreground text-xs sm:text-sm">
						{a}
					</p>
				</div>
			)}
		</button>
	);
}

// =============================================================================
// BOTTOM CTA
// =============================================================================

function BottomCTA() {
	const { isLoaded, isSignedIn } = useAuth();
	const showSignUp = isLoaded && !isSignedIn;

	return (
		<div className="mx-auto mt-16 max-w-2xl rounded border border-border/50 bg-muted/20 p-6 text-center sm:mt-24 sm:p-10">
			<h3 className="font-bold text-lg sm:text-xl">
				Your data is always yours
			</h3>
			<p className="mt-2 font-mono text-muted-foreground text-xs sm:text-sm">
				Export everything via CSV at any time, even after canceling.{" "}
				<span className="text-foreground">
					All plans include a 30-day free trial.
				</span>
			</p>
			{showSignUp && (
				<div className="mt-6">
					<SignUpButton mode="modal">
						<Button
							className="group h-12 gap-2 px-8 font-mono text-xs uppercase tracking-wider"
							size="lg"
						>
							Start Free Trial
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Button>
					</SignUpButton>
					<p className="mt-3 font-mono text-[10px] text-muted-foreground sm:text-xs">
						No credit card required · Cancel anytime
					</p>
				</div>
			)}
		</div>
	);
}
