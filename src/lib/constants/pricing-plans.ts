import {
	CLERK_PLAN_ID_PRO,
	CLERK_PLAN_ID_PRO_ANNUAL,
	CLERK_PLAN_ID_STARTER,
	CLERK_PLAN_ID_STARTER_ANNUAL,
	PLAN_METADATA,
	PLAN_NONE,
	PLAN_PRO,
	PLAN_STARTER,
	type PlanMetadata,
} from "./billing";

// =============================================================================
// BILLING PERIOD
// =============================================================================

export type BillingPeriod = "month" | "year";

// =============================================================================
// PLAN HIERARCHY
// =============================================================================

export const PLAN_HIERARCHY = [PLAN_NONE, PLAN_STARTER, PLAN_PRO] as const;

export function getPlanIndex(slug: string): number {
	return PLAN_HIERARCHY.indexOf(slug as (typeof PLAN_HIERARCHY)[number]);
}

// =============================================================================
// PRICING PLAN (UI model)
// =============================================================================

export interface PricingPlan {
	slug: string;
	clerkPlanId: string;
	name: string;
	tagline: string;
	price: number;
	originalPrice: number | null;
	period: BillingPeriod;
	annualTotal: number | null;
	features: string[];
	highlighted: boolean;
	trial: string;
}

const starterMeta = PLAN_METADATA[PLAN_STARTER] as PlanMetadata;
const proMeta = PLAN_METADATA[PLAN_PRO] as PlanMetadata;

export function buildPricingPlans(period: BillingPeriod): PricingPlan[] {
	const isAnnual = period === "year";

	return [
		{
			slug: PLAN_STARTER,
			clerkPlanId: isAnnual
				? CLERK_PLAN_ID_STARTER_ANNUAL || CLERK_PLAN_ID_STARTER
				: CLERK_PLAN_ID_STARTER,
			name: starterMeta.name,
			tagline: starterMeta.description,
			price: isAnnual
				? starterMeta.priceAnnualMonthly
				: starterMeta.priceMonthly,
			originalPrice: isAnnual ? starterMeta.priceMonthly : null,
			period,
			annualTotal: isAnnual ? starterMeta.priceAnnualTotal : null,
			features: starterMeta.features,
			highlighted: false,
			trial: "30-day free trial",
		},
		{
			slug: PLAN_PRO,
			clerkPlanId: isAnnual
				? CLERK_PLAN_ID_PRO_ANNUAL || CLERK_PLAN_ID_PRO
				: CLERK_PLAN_ID_PRO,
			name: proMeta.name,
			tagline: proMeta.description,
			price: isAnnual ? proMeta.priceAnnualMonthly : proMeta.priceMonthly,
			originalPrice: isAnnual ? proMeta.priceMonthly : null,
			period,
			annualTotal: isAnnual ? proMeta.priceAnnualTotal : null,
			features: proMeta.features,
			highlighted: true,
			trial: "30-day free trial",
		},
	];
}

// =============================================================================
// COMPARISON TABLE
// =============================================================================

export const COMPARISON_CATEGORIES = [
	{
		name: "Core",
		features: [
			{ label: "Trade management & logging", starter: true, pro: true },
			{ label: "Full analytics suite", starter: true, pro: true },
			{ label: "CSV import/export", starter: true, pro: true },
			{ label: "Custom tags & strategies", starter: true, pro: true },
			{ label: "Prop firm compliance tracking", starter: true, pro: true },
		],
	},
	{
		name: "AI & Advanced",
		features: [
			{ label: "AI Chat", starter: false, pro: "50 messages/day" },
			{ label: "AI Reports", starter: false, pro: "5/month" },
			{ label: "PDF export", starter: false, pro: true },
			{ label: "Priority support", starter: false, pro: true },
			{ label: "Priority feature requests", starter: false, pro: true },
		],
	},
	{
		name: "Storage & Limits",
		features: [
			{ label: "Unlimited trades", starter: true, pro: true },
			{ label: "Unlimited accounts", starter: true, pro: true },
			{ label: "Unlimited storage", starter: true, pro: true },
		],
	},
];

// =============================================================================
// FAQ
// =============================================================================

export const FAQ_ITEMS = [
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
		a: "Yes! Save 20% with annual billing. Use the toggle above to see annual prices.",
	},
	{
		q: "Is my trading data secure?",
		a: "Absolutely. Your data is encrypted at rest and in transit. We never share your trading data with third parties, and you retain full ownership of everything you import.",
	},
	{
		q: "What payment methods do you accept?",
		a: "We accept all major credit and debit cards via Stripe. All payments are processed securely — we never store your card details.",
	},
];
