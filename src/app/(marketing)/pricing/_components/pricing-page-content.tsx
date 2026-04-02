"use client";

import { SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import {
	ArrowRight,
	Check,
	Crown,
	HelpCircle,
	Sparkles,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { isBetaFromMetadata } from "@/lib/billing/utils";
import {
	CLERK_PLAN_ID_PRO,
	CLERK_PLAN_ID_STARTER,
	PLAN_METADATA,
	PLAN_NONE,
	PLAN_PRO,
	PLAN_STARTER,
	type PlanMetadata,
} from "@/lib/constants/billing";

const PLAN_HIERARCHY = [PLAN_NONE, PLAN_STARTER, PLAN_PRO] as const;

const starterMeta = PLAN_METADATA[PLAN_STARTER] as PlanMetadata;
const proMeta = PLAN_METADATA[PLAN_PRO] as PlanMetadata;

interface PricingPlan {
	slug: string;
	clerkPlanId: string;
	name: string;
	tagline: string;
	price: string;
	period: string;
	features: string[];
	highlighted: boolean;
	trial: string;
	icon: React.ReactNode;
}

const plans: PricingPlan[] = [
	{
		slug: PLAN_STARTER,
		clerkPlanId: CLERK_PLAN_ID_STARTER,
		name: starterMeta.name,
		tagline: starterMeta.description,
		price: "$10",
		period: "/month",
		features: starterMeta.features,
		highlighted: false,
		trial: "30-day free trial",
		icon: <Zap className="h-4 w-4" />,
	},
	{
		slug: PLAN_PRO,
		clerkPlanId: CLERK_PLAN_ID_PRO,
		name: proMeta.name,
		tagline: proMeta.description,
		price: "$24",
		period: "/month",
		features: proMeta.features,
		highlighted: true,
		trial: "30-day free trial",
		icon: <Sparkles className="h-4 w-4" />,
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
				className="min-h-[48px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
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
				: getPlanIndex(PLAN_NONE)
		: -1;

	const planIndex = getPlanIndex(plan.slug);
	const isCurrentPlan = isSignedIn && userPlanIndex === planIndex;
	const hasHigherPlan = isSignedIn && userPlanIndex > planIndex;

	if (!isSignedIn) {
		return (
			<SignUpButton forceRedirectUrl="/pricing" mode="modal">
				<Button
					className={`min-h-[48px] w-full gap-2 font-mono text-xs uppercase tracking-wider ${
						plan.highlighted
							? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(212,255,0,0.15)] hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(212,255,0,0.25)]"
							: ""
					}`}
					data-testid={`pricing-cta-${plan.slug}`}
					variant={plan.highlighted ? "default" : "outline"}
				>
					{`Start ${plan.name} Trial`}
					<ArrowRight className="h-4 w-4" />
				</Button>
			</SignUpButton>
		);
	}

	if (isCurrentPlan) {
		return (
			<Button
				asChild
				className="min-h-[48px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
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
				className="min-h-[48px] w-full gap-2 font-mono text-xs uppercase tracking-wider"
				data-testid={`pricing-cta-${plan.slug}`}
				variant="outline"
			>
				<Link href="/dashboard">Go to Dashboard</Link>
			</Button>
		);
	}

	// Signed in, needs to upgrade — use Clerk CheckoutButton
	return (
		<CheckoutButton
			newSubscriptionRedirectUrl="/dashboard"
			planId={plan.clerkPlanId}
			planPeriod="month"
		>
			<Button
				className={`min-h-[48px] w-full gap-2 font-mono text-xs uppercase tracking-wider ${
					plan.highlighted
						? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(212,255,0,0.15)] hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(212,255,0,0.25)]"
						: ""
				}`}
				data-testid={`pricing-cta-${plan.slug}`}
				variant={plan.highlighted ? "default" : "outline"}
			>
				{`Upgrade to ${plan.name}`}
				<ArrowRight className="h-4 w-4" />
			</Button>
		</CheckoutButton>
	);
}

const COMPARISON_CATEGORIES = [
	{
		name: "Core",
		features: [
			{
				label: "Trade management & logging",
				starter: true,
				pro: true,
			},
			{
				label: "Full analytics suite",
				starter: true,
				pro: true,
			},
			{
				label: "CSV import/export",
				starter: true,
				pro: true,
			},
			{
				label: "Custom tags & strategies",
				starter: true,
				pro: true,
			},
			{
				label: "Prop firm compliance tracking",
				starter: true,
				pro: true,
			},
		],
	},
	{
		name: "AI & Advanced",
		features: [
			{
				label: "AI Chat",
				starter: false,
				pro: "50 messages/day",
			},
			{
				label: "AI Reports",
				starter: false,
				pro: "5/month",
			},
			{
				label: "PDF export",
				starter: false,
				pro: true,
			},
			{
				label: "Priority support",
				starter: false,
				pro: true,
			},
			{
				label: "Priority feature requests",
				starter: false,
				pro: true,
			},
		],
	},
	{
		name: "Storage & Limits",
		features: [
			{
				label: "Unlimited trades",
				starter: true,
				pro: true,
			},
			{
				label: "Unlimited accounts",
				starter: true,
				pro: true,
			},
			{
				label: "Unlimited storage",
				starter: true,
				pro: true,
			},
		],
	},
];

const FAQ_ITEMS = [
	{
		q: "Can I switch plans anytime?",
		a: "Yes. Upgrades take effect immediately. Downgrades apply at the end of your current billing cycle.",
	},
	{
		q: "What happens to my data if I cancel?",
		a: "Your data is always yours. You can export everything via CSV at any time, even after canceling.",
	},
	{
		q: "How does the free trial work?",
		a: "You get full access to your chosen plan for 30 days. A credit card is required to start your trial, but you won't be charged until it ends. Cancel anytime.",
	},
	{
		q: "Do you support annual billing?",
		a: "Not yet — but it's on our roadmap. Monthly billing keeps things simple for now.",
	},
];

export function PricingPageContent() {
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
						Simple, transparent
						<br />
						<span className="text-primary">pricing</span>
					</h1>
					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Start with a 30-day free trial.
						<br className="hidden sm:block" />
						Upgrade when you're ready.
					</p>
				</div>

				{/* Pricing cards */}
				<div
					className="mx-auto grid max-w-4xl gap-4 sm:gap-6 lg:grid-cols-2"
					data-testid="pricing-page-cards"
				>
					{plans.map((plan) => (
						<div
							className={`group relative flex flex-col rounded border p-6 transition-all sm:p-8 ${
								plan.highlighted
									? "border-primary/30 bg-primary/[0.02] shadow-lg shadow-primary/5"
									: "border-border bg-muted/30 hover:border-border/80"
							}`}
							data-testid={`pricing-card-${plan.slug}`}
							key={plan.slug}
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
									{plan.icon}
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
									<span className="font-bold text-4xl tracking-tight sm:text-5xl">
										{plan.price}
									</span>
									<span className="font-mono text-muted-foreground text-xs sm:text-sm">
										{plan.period}
									</span>
								</div>
								<span className="mt-2 inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary sm:text-xs">
									{plan.trial}
								</span>
							</div>

							{/* Features */}
							<ul className="mb-8 flex-1 space-y-3 sm:space-y-4">
								{plan.features.map((feature) => (
									<li
										className="flex items-start gap-2.5 sm:gap-3"
										key={feature}
									>
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
							<PlanCTA plan={plan} />
						</div>
					))}
				</div>

				{/* Feature comparison table */}
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

				{/* Bottom note */}
				<p className="mt-12 text-center font-mono text-muted-foreground text-xs sm:mt-16 sm:text-sm">
					Your data is always yours — even if you change plans.{" "}
					<span className="text-foreground">
						All plans include a 30-day free trial.
					</span>
				</p>
			</div>
		</section>
	);
}

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
