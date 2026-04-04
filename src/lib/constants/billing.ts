// =============================================================================
// PLAN SLUGS (must match Clerk dashboard plan identifiers)
// =============================================================================

export const PLAN_NONE = "none";
export const PLAN_STARTER = "starter";
export const PLAN_PRO = "pro";

// =============================================================================
// FEATURE SLUGS (must match Clerk dashboard feature identifiers)
// =============================================================================

export const FEATURE_TRADE_MANAGEMENT = "trade_management";
// Overview tab is free; advanced tabs (Time, Risk, Symbols, Behavior) gated to Starter+.
export const FEATURE_ANALYTICS = "analytics";
export const FEATURE_CSV_IMPORT_EXPORT = "csv_import_export";
// Prop compliance is intentionally ungated for now — gate will be added with prop-firm-specific features.
export const FEATURE_PROP_COMPLIANCE = "prop_compliance";
export const FEATURE_CUSTOM_TAGS = "custom_tags";
export const FEATURE_CUSTOM_STRATEGIES = "custom_strategies";
export const FEATURE_AI_CHAT = "ai_chat";
export const FEATURE_AI_REPORTS = "ai_reports";
export const FEATURE_PDF_EXPORT = "pdf_export";
export const FEATURE_PRIORITY_SUPPORT = "priority_support";

// =============================================================================
// USAGE LIMITS
// =============================================================================

export const AI_CHAT_DAILY_LIMIT = 50;
export const AI_REPORTS_MONTHLY_LIMIT = 5;

// =============================================================================
// CLERK PLAN IDs (environment-specific, set in .env)
// =============================================================================

export const CLERK_PLAN_ID_STARTER =
	process.env.NEXT_PUBLIC_CLERK_PLAN_ID_STARTER ?? "";
export const CLERK_PLAN_ID_PRO =
	process.env.NEXT_PUBLIC_CLERK_PLAN_ID_PRO ?? "";
export const CLERK_PLAN_ID_STARTER_ANNUAL =
	process.env.NEXT_PUBLIC_CLERK_PLAN_ID_STARTER_ANNUAL ?? "";
export const CLERK_PLAN_ID_PRO_ANNUAL =
	process.env.NEXT_PUBLIC_CLERK_PLAN_ID_PRO_ANNUAL ?? "";

// =============================================================================
// ANNUAL BILLING
// =============================================================================

export const ANNUAL_DISCOUNT_PERCENT = 20;

// =============================================================================
// PLAN DISPLAY METADATA (for UI rendering)
// =============================================================================

export interface PlanMetadata {
	slug: string;
	name: string;
	price: string;
	priceMonthly: number;
	priceAnnualMonthly: number;
	priceAnnualTotal: number;
	description: string;
	features: string[];
}

export const PLAN_METADATA: Record<string, PlanMetadata> = {
	[PLAN_NONE]: {
		slug: PLAN_NONE,
		name: "No Plan",
		price: "$0",
		priceMonthly: 0,
		priceAnnualMonthly: 0,
		priceAnnualTotal: 0,
		description: "No active subscription",
		features: [],
	},
	[PLAN_STARTER]: {
		slug: PLAN_STARTER,
		name: "Starter",
		price: "$10/mo",
		priceMonthly: 10,
		priceAnnualMonthly: 8,
		priceAnnualTotal: 96,
		description: "Essential tools for active traders",
		features: [
			"Trade management & logging",
			"Full analytics suite",
			"CSV import/export",
			"Custom tags & strategies",
			"Prop firm compliance tracking",
		],
	},
	[PLAN_PRO]: {
		slug: PLAN_PRO,
		name: "Pro",
		price: "$24/mo",
		priceMonthly: 24,
		priceAnnualMonthly: 19,
		priceAnnualTotal: 228,
		description: "AI-powered insights for serious traders",
		features: [
			"Everything in Starter",
			"AI Chat (50 messages/day)",
			"AI Reports (5/month)",
			"PDF export",
			"Priority support",
		],
	},
};
