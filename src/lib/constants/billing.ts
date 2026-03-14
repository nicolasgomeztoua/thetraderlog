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
// Analytics is read-only and intentionally ungated — all plans get dashboard access.
// Gate will be added when advanced analytics features are introduced.
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
// PLAN DISPLAY METADATA (for UI rendering)
// =============================================================================

export interface PlanMetadata {
	slug: string;
	name: string;
	price: string;
	description: string;
	features: string[];
}

export const PLAN_METADATA: Record<string, PlanMetadata> = {
	[PLAN_NONE]: {
		slug: PLAN_NONE,
		name: "No Plan",
		price: "$0",
		description: "No active subscription",
		features: [],
	},
	[PLAN_STARTER]: {
		slug: PLAN_STARTER,
		name: "Starter",
		price: "$10/mo",
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
