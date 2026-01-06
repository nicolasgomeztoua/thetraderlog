import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/shared";

// =============================================================================
// TYPES
// =============================================================================

interface FilterSectionProps {
	/** Section title (e.g., "WHAT", "WHEN", "HOW", "RESULT") */
	title: string;
	/** Section content */
	children: React.ReactNode;
	/** Whether the section is collapsible */
	collapsible?: boolean;
	/** Default collapsed state */
	defaultCollapsed?: boolean;
	/** Optional class name */
	className?: string;
}

interface FilterFieldProps {
	/** Field label */
	label: string;
	/** Field content */
	children: React.ReactNode;
	/** Optional class name */
	className?: string;
}

// =============================================================================
// FILTER SECTION
// Semantic zone wrapper with terminal-style header
// =============================================================================

export function FilterSection({
	title,
	children,
	collapsible = false,
	defaultCollapsed = false,
	className,
}: FilterSectionProps) {
	const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

	return (
		<div
			className={cn(
				"overflow-hidden rounded border border-white/5 bg-white/1",
				className,
			)}
		>
			{/* Section Header */}
			<button
				className={cn(
					"flex w-full items-center justify-between border-white/5 border-b bg-white/2 px-4 py-2.5",
					collapsible && "cursor-pointer transition-colors hover:bg-white/3",
					!collapsible && "cursor-default",
				)}
				disabled={!collapsible}
				onClick={() => collapsible && setIsCollapsed(!isCollapsed)}
				type="button"
			>
				<div className="flex items-center gap-2">
					<span className="font-mono text-[10px] text-muted-foreground">─</span>
					<span className="font-mono text-primary text-xs uppercase tracking-widest">
						{title}
					</span>
					<span className="font-mono text-[10px] text-muted-foreground">
						─────────────────────
					</span>
				</div>
				{collapsible && (
					<ChevronDown
						className={cn(
							"size-4 text-muted-foreground transition-transform duration-200",
							isCollapsed && "-rotate-90",
						)}
					/>
				)}
			</button>

			{/* Section Content */}
			<div
				className={cn(
					"transition-all duration-200 ease-out",
					isCollapsed ? "h-0 opacity-0" : "h-auto opacity-100",
				)}
			>
				<div className="p-4">{children}</div>
			</div>
		</div>
	);
}

// =============================================================================
// FILTER FIELD
// Individual field with $ prefix label
// =============================================================================

export function FilterField({ label, children, className }: FilterFieldProps) {
	return (
		<div className={cn("space-y-2", className)}>
			<div className="flex items-center gap-1.5">
				<span className="font-mono text-[10px] text-muted-foreground">$</span>
				<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					{label}
				</span>
			</div>
			{children}
		</div>
	);
}

// =============================================================================
// FILTER PILL BUTTON
// Reusable pill button for multi-select filters
// =============================================================================

interface FilterPillProps {
	/** Button label */
	label: string;
	/** Whether the pill is selected */
	selected: boolean;
	/** Click handler */
	onClick: () => void;
	/** Optional color dot */
	color?: string;
	/** Optional class name */
	className?: string;
}

export function FilterPill({
	label,
	selected,
	onClick,
	color,
	className,
}: FilterPillProps) {
	return (
		<button
			className={cn(
				"inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs transition-all",
				selected
					? "border-primary/40 bg-primary/10 text-primary"
					: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground",
				className,
			)}
			onClick={onClick}
			type="button"
		>
			{color && (
				<span
					className="size-2 rounded-full"
					style={{ backgroundColor: color }}
				/>
			)}
			{label}
		</button>
	);
}

// =============================================================================
// FILTER TOGGLE BUTTON
// For radio-like single-select options
// =============================================================================

interface FilterToggleProps {
	/** Button label */
	label: string;
	/** Whether the toggle is active */
	active: boolean;
	/** Click handler */
	onClick: () => void;
	/** Visual variant */
	variant?: "default" | "profit" | "loss" | "neutral";
	/** Optional class name */
	className?: string;
}

export function FilterToggle({
	label,
	active,
	onClick,
	variant = "default",
	className,
}: FilterToggleProps) {
	const variantClasses = {
		default: active
			? "border-primary/40 bg-primary/10 text-primary"
			: "border-white/10 bg-white/[0.02] text-muted-foreground",
		profit: active
			? "border-profit/40 bg-profit/10 text-profit"
			: "border-white/10 bg-white/[0.02] text-muted-foreground",
		loss: active
			? "border-loss/40 bg-loss/10 text-loss"
			: "border-white/10 bg-white/[0.02] text-muted-foreground",
		neutral: active
			? "border-yellow-500/40 bg-yellow-500/10 text-yellow-500"
			: "border-white/10 bg-white/[0.02] text-muted-foreground",
	};

	return (
		<button
			className={cn(
				"rounded border px-3 py-1.5 font-mono text-xs transition-all hover:border-white/20",
				variantClasses[variant],
				className,
			)}
			onClick={onClick}
			type="button"
		>
			{label}
		</button>
	);
}
