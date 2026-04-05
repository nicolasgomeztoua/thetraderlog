"use client";

import { SignUpButton, useAuth, useUser } from "@clerk/nextjs";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import { ArrowRight, Crown } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isBetaFromMetadata } from "@/lib/billing/utils";
import { PLAN_NONE, PLAN_PRO, PLAN_STARTER } from "@/lib/constants/billing";
import {
	type BillingPeriod,
	getPlanIndex,
	type PricingPlan,
} from "@/lib/constants/pricing-plans";

interface PlanCTAProps {
	plan: PricingPlan;
	billingPeriod: BillingPeriod;
}

export function PlanCTA({ plan, billingPeriod }: PlanCTAProps) {
	const { isSignedIn, has, isLoaded } = useAuth();
	const { user } = useUser();

	if (!isLoaded) {
		return (
			<Button
				className="min-h-12 w-full gap-2 font-mono text-xs uppercase tracking-wider"
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

	const highlightedClass = plan.highlighted
		? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(212,255,0,0.15)] hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(212,255,0,0.25)]"
		: "";

	if (!isSignedIn) {
		return (
			<SignUpButton forceRedirectUrl="/pricing" mode="modal">
				<Button
					className={`min-h-12 w-full gap-2 font-mono text-xs uppercase tracking-wider ${highlightedClass}`}
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
				className="min-h-12 w-full gap-2 font-mono text-xs uppercase tracking-wider"
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
				className="min-h-12 w-full gap-2 font-mono text-xs uppercase tracking-wider"
				data-testid={`pricing-cta-${plan.slug}`}
				variant="outline"
			>
				<Link href="/dashboard">Go to Dashboard</Link>
			</Button>
		);
	}

	// Signed in, needs to upgrade — use Clerk CheckoutButton
	const clerkPlanPeriod = billingPeriod === "year" ? "annual" : "month";
	return (
		<CheckoutButton
			newSubscriptionRedirectUrl="/dashboard"
			planId={plan.clerkPlanId}
			planPeriod={clerkPlanPeriod}
		>
			<Button
				className={`min-h-12 w-full gap-2 font-mono text-xs uppercase tracking-wider ${highlightedClass}`}
				data-testid={`pricing-cta-${plan.slug}`}
				variant={plan.highlighted ? "default" : "outline"}
			>
				{`Upgrade to ${plan.name}`}
				<ArrowRight className="h-4 w-4" />
			</Button>
		</CheckoutButton>
	);
}
