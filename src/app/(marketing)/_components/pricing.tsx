"use client";

import { SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import { ArrowRight, Check, Crown, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isBetaFromMetadata } from "@/lib/billing/utils";
import {
	PLAN_FREE,
	PLAN_METADATA,
	PLAN_PRO,
	PLAN_STARTER,
	type PlanMetadata,
} from "@/lib/constants/billing";

const PLAN_HIERARCHY = [PLAN_FREE, PLAN_STARTER, PLAN_PRO] as const;

const freeMeta = PLAN_METADATA[PLAN_FREE] as PlanMetadata;
const starterMeta = PLAN_METADATA[PLAN_STARTER] as PlanMetadata;
const proMeta = PLAN_METADATA[PLAN_PRO] as PlanMetadata;

interface PricingPlan {
	slug: string;
	name: string;
	tagline: string;
	price: string;
	period: string;
	features: string[];
	highlighted: boolean;
	trial?: string;
}

const plans: PricingPlan[] = [
	{
		slug: PLAN_FREE,
		name: freeMeta.name,
		tagline: freeMeta.description,
		price: "$0",
		period: "",
		features: freeMeta.features,
		highlighted: false,
	},
	{
		slug: PLAN_STARTER,
		name: starterMeta.name,
		tagline: starterMeta.description,
		price: "$10",
		period: "/month",
		features: starterMeta.features,
		highlighted: false,
	},
	{
		slug: PLAN_PRO,
		name: proMeta.name,
		tagline: proMeta.description,
		price: "$24",
		period: "/month",
		features: proMeta.features,
		highlighted: true,
		// Trial period is configured in the Clerk dashboard billing settings
		trial: "30-day free trial",
	},
];

function getPlanIndex(slug: string): number {
	return PLAN_HIERARCHY.indexOf(slug as (typeof PLAN_HIERARCHY)[number]);
}

function PlanCTA({ plan }: { plan: PricingPlan }) {
	const { isSignedIn, has, isLoaded } = useAuth();
	const { user } = useUser();

	if (!isLoaded) {
		return (
			<Button
				className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
				data-testid={`pricing-cta-${plan.slug}`}
				disabled
				variant="outline"
			>
				Loading...
			</Button>
		);
	}

	const isBeta = isBetaFromMetadata(
		user?.publicMetadata as Record<string, unknown> | undefined,
	);
	const userPlanIndex = isSignedIn
		? isBeta || has?.({ plan: PLAN_PRO })
			? getPlanIndex(PLAN_PRO)
			: has?.({ plan: PLAN_STARTER })
				? getPlanIndex(PLAN_STARTER)
				: getPlanIndex(PLAN_FREE)
		: -1;

	const planIndex = getPlanIndex(plan.slug);
	const isCurrentPlan = isSignedIn && userPlanIndex === planIndex;
	const hasHigherPlan = isSignedIn && userPlanIndex > planIndex;

	if (!isSignedIn) {
		return (
			<SignUpButton
				forceRedirectUrl={
					plan.slug !== PLAN_FREE ? `/settings?tab=billing` : "/dashboard"
				}
				mode="modal"
			>
				<Button
					className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
					data-testid={`pricing-cta-${plan.slug}`}
					variant={plan.highlighted ? "default" : "outline"}
				>
					{plan.slug === PLAN_FREE ? "Get Started Free" : `Get ${plan.name}`}
					<ArrowRight className="h-4 w-4" />
				</Button>
			</SignUpButton>
		);
	}

	if (isCurrentPlan) {
		return (
			<Button
				asChild
				className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
				data-testid={`pricing-cta-${plan.slug}`}
				variant="outline"
			>
				<Link href="/settings?tab=billing">
					<Crown className="h-4 w-4" />
					Current Plan
				</Link>
			</Button>
		);
	}

	if (hasHigherPlan) {
		return (
			<Button
				asChild
				className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
				data-testid={`pricing-cta-${plan.slug}`}
				variant="outline"
			>
				<Link href="/dashboard">Go to Dashboard</Link>
			</Button>
		);
	}

	return (
		<Button
			asChild
			className="min-h-[44px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
			data-testid={`pricing-cta-${plan.slug}`}
			variant={plan.highlighted ? "default" : "outline"}
		>
			<Link href="/settings?tab=billing">
				{plan.slug === PLAN_FREE
					? "Go to Dashboard"
					: `Upgrade to ${plan.name}`}
				<ArrowRight className="h-4 w-4" />
			</Link>
		</Button>
	);
}

export function Pricing() {
	return (
		<section
			className="relative py-16 sm:py-24 lg:py-32"
			data-testid="pricing-section"
			id="pricing"
		>
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
							data-testid={`pricing-card-${plan.slug}`}
							key={plan.slug}
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
								{plan.trial && (
									<span className="ml-2 inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary sm:text-xs">
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
							<PlanCTA plan={plan} />
						</div>
					))}
				</div>

				{/* Trial note */}
				<p className="mt-8 text-center font-mono text-muted-foreground text-xs sm:mt-12 sm:text-sm">
					Your data is always yours — even if you change plans.{" "}
					<span className="text-foreground">
						Get started for free — no credit card required.
					</span>
				</p>
			</div>
		</section>
	);
}
