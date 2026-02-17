import type { DrawdownType } from "@/lib/shared/schemas";

// =============================================================================
// PROP FIRM TYPES
// =============================================================================

export interface PropFirmRules {
	maxDrawdown: number;
	drawdownType: DrawdownType;
	dailyLossLimit: number | null;
	profitTarget: number | null;
	consistencyRule: number | null;
	minTradingDays: number | null;
	maxPositionSize: number | null;
}

export interface AccountSize {
	label: string;
	initialBalance: number;
	rules: PropFirmRules;
}

export interface PropFirmTemplate {
	id: string;
	name: string;
	sizes: AccountSize[];
	challengeDays: number | null;
	profitSplit: number | null;
}

// =============================================================================
// PROP FIRM LOCKED REASONS
// =============================================================================

export const PROP_FIRM_LOCKED_PASSED = "Challenge Passed";
export const PROP_FIRM_LOCKED_FAILED = "Challenge Failed";

// =============================================================================
// PROP FIRM TEMPLATES
// =============================================================================

export const PROP_FIRM_TEMPLATES: PropFirmTemplate[] = [
	{
		id: "topstep",
		name: "Topstep",
		sizes: [
			{
				label: "$50K",
				initialBalance: 50000,
				rules: {
					maxDrawdown: 2000,
					drawdownType: "trailing",
					dailyLossLimit: 1000,
					profitTarget: 3000,
					consistencyRule: 50,
					minTradingDays: 5,
					maxPositionSize: 5,
				},
			},
			{
				label: "$100K",
				initialBalance: 100000,
				rules: {
					maxDrawdown: 3000,
					drawdownType: "trailing",
					dailyLossLimit: 2000,
					profitTarget: 6000,
					consistencyRule: 50,
					minTradingDays: 5,
					maxPositionSize: 10,
				},
			},
			{
				label: "$150K",
				initialBalance: 150000,
				rules: {
					maxDrawdown: 4500,
					drawdownType: "trailing",
					dailyLossLimit: 3000,
					profitTarget: 9000,
					consistencyRule: 50,
					minTradingDays: 5,
					maxPositionSize: 15,
				},
			},
		],
		challengeDays: null,
		profitSplit: null,
	},
	{
		id: "apex",
		name: "Apex",
		sizes: [
			{
				label: "$50K",
				initialBalance: 50000,
				rules: {
					maxDrawdown: 2500,
					drawdownType: "eod",
					dailyLossLimit: null,
					profitTarget: 3000,
					consistencyRule: null,
					minTradingDays: null,
					maxPositionSize: 4,
				},
			},
			{
				label: "$100K",
				initialBalance: 100000,
				rules: {
					maxDrawdown: 3000,
					drawdownType: "eod",
					dailyLossLimit: null,
					profitTarget: 6000,
					consistencyRule: null,
					minTradingDays: null,
					maxPositionSize: 12,
				},
			},
			{
				label: "$150K",
				initialBalance: 150000,
				rules: {
					maxDrawdown: 5000,
					drawdownType: "eod",
					dailyLossLimit: null,
					profitTarget: 9000,
					consistencyRule: null,
					minTradingDays: null,
					maxPositionSize: 14,
				},
			},
			{
				label: "$300K",
				initialBalance: 300000,
				rules: {
					maxDrawdown: 7500,
					drawdownType: "eod",
					dailyLossLimit: null,
					profitTarget: 20000,
					consistencyRule: null,
					minTradingDays: null,
					maxPositionSize: 25,
				},
			},
		],
		challengeDays: null,
		profitSplit: null,
	},
	{
		id: "ftmo",
		name: "FTMO",
		sizes: [
			{
				label: "$10K",
				initialBalance: 10000,
				rules: {
					maxDrawdown: 1000,
					drawdownType: "static",
					dailyLossLimit: 500,
					profitTarget: 1000,
					consistencyRule: null,
					minTradingDays: 4,
					maxPositionSize: null,
				},
			},
			{
				label: "$25K",
				initialBalance: 25000,
				rules: {
					maxDrawdown: 2500,
					drawdownType: "static",
					dailyLossLimit: 1250,
					profitTarget: 2500,
					consistencyRule: null,
					minTradingDays: 4,
					maxPositionSize: null,
				},
			},
			{
				label: "$50K",
				initialBalance: 50000,
				rules: {
					maxDrawdown: 5000,
					drawdownType: "static",
					dailyLossLimit: 2500,
					profitTarget: 5000,
					consistencyRule: null,
					minTradingDays: 4,
					maxPositionSize: null,
				},
			},
			{
				label: "$100K",
				initialBalance: 100000,
				rules: {
					maxDrawdown: 10000,
					drawdownType: "static",
					dailyLossLimit: 5000,
					profitTarget: 10000,
					consistencyRule: null,
					minTradingDays: 4,
					maxPositionSize: null,
				},
			},
			{
				label: "$200K",
				initialBalance: 200000,
				rules: {
					maxDrawdown: 20000,
					drawdownType: "static",
					dailyLossLimit: 10000,
					profitTarget: 20000,
					consistencyRule: null,
					minTradingDays: 4,
					maxPositionSize: null,
				},
			},
		],
		challengeDays: 30,
		profitSplit: 80,
	},
	{
		id: "mff",
		name: "MFF",
		sizes: [
			{
				label: "$50K",
				initialBalance: 50000,
				rules: {
					maxDrawdown: 2000,
					drawdownType: "eod",
					dailyLossLimit: 1000,
					profitTarget: null,
					consistencyRule: 35,
					minTradingDays: 3,
					maxPositionSize: null,
				},
			},
			{
				label: "$100K",
				initialBalance: 100000,
				rules: {
					maxDrawdown: 3000,
					drawdownType: "eod",
					dailyLossLimit: 2000,
					profitTarget: null,
					consistencyRule: 35,
					minTradingDays: 3,
					maxPositionSize: null,
				},
			},
		],
		challengeDays: null,
		profitSplit: null,
	},
	{
		id: "custom",
		name: "Custom",
		sizes: [
			{
				label: "Custom",
				initialBalance: 0,
				rules: {
					maxDrawdown: 0,
					drawdownType: "trailing",
					dailyLossLimit: null,
					profitTarget: null,
					consistencyRule: null,
					minTradingDays: null,
					maxPositionSize: null,
				},
			},
		],
		challengeDays: null,
		profitSplit: null,
	},
];
