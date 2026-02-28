// =============================================================================
// ADMIN PANEL CONSTANTS
// =============================================================================

// Navigation items for the admin sidebar
export const ADMIN_NAV_ITEMS = [
	{ label: "Overview", href: "/admin", icon: "LayoutDashboard" },
	{ label: "Bug Reports", href: "/admin/bug-reports", icon: "Bug" },
	{ label: "Users", href: "/admin/users", icon: "Users" },
	{ label: "AI Usage", href: "/admin/ai", icon: "Bot" },
	{ label: "Analytics", href: "/admin/analytics", icon: "BarChart3" },
	{ label: "System Health", href: "/admin/system", icon: "Activity" },
] as const;

// =============================================================================
// BUG REPORT LABEL MAPS
// =============================================================================

export const BUG_REPORT_STATUS_LABELS: Record<string, string> = {
	open: "Open",
	in_progress: "In Progress",
	resolved: "Resolved",
	closed: "Closed",
};

export const BUG_REPORT_SEVERITY_LABELS: Record<string, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

export const BUG_REPORT_CATEGORY_LABELS: Record<string, string> = {
	ui: "UI / Visual",
	data: "Data / Calculations",
	performance: "Performance",
	crash: "Crash / Error",
	other: "Other",
};

// =============================================================================
// BUG REPORT STATUS COLORS (for badges)
// =============================================================================

export const BUG_REPORT_STATUS_COLORS: Record<string, string> = {
	open: "text-red-400 bg-red-400/10",
	in_progress: "text-yellow-400 bg-yellow-400/10",
	resolved: "text-green-400 bg-green-400/10",
	closed: "text-neutral-400 bg-neutral-400/10",
};

export const BUG_REPORT_SEVERITY_COLORS: Record<string, string> = {
	critical: "text-red-400 bg-red-400/10",
	high: "text-orange-400 bg-orange-400/10",
	medium: "text-yellow-400 bg-yellow-400/10",
	low: "text-neutral-400 bg-neutral-400/10",
};

// =============================================================================
// ROLE LABELS
// =============================================================================

export const ROLE_LABELS: Record<string, string> = {
	admin: "Admin",
	user: "User",
};

export const ROLE_COLORS: Record<string, string> = {
	admin: "text-primary bg-primary/10",
	user: "text-neutral-400 bg-neutral-400/10",
};

// =============================================================================
// TABLE / PAGINATION
// =============================================================================

export const ADMIN_TABLE_PAGE_SIZE = 25;
export const ADMIN_TABLE_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
