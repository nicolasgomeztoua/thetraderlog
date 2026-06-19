"use client";

import { ANNUAL_DISCOUNT_PERCENT } from "@/lib/constants/billing";
import type { BillingPeriod } from "@/lib/constants/pricing-plans";

interface BillingToggleProps {
	period: BillingPeriod;
	onChange: (period: BillingPeriod) => void;
}

export function BillingToggle({ period, onChange }: BillingToggleProps) {
	return (
		<div className="inline-flex items-center rounded border border-border bg-muted/30 p-1">
			<button
				className={`rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all sm:px-4 sm:py-2 sm:text-xs ${
					period === "month"
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground"
				}`}
				onClick={() => onChange("month")}
				type="button"
			>
				Monthly
			</button>
			<button
				className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-all sm:gap-2 sm:px-4 sm:py-2 sm:text-xs ${
					period === "year"
						? "bg-primary text-primary-foreground"
						: "text-muted-foreground hover:text-foreground"
				}`}
				onClick={() => onChange("year")}
				type="button"
			>
				Annual
				<span
					className={`rounded px-1.5 py-0.5 font-medium text-[9px] sm:text-[10px] ${
						period === "year"
							? "bg-primary-foreground/20 text-primary-foreground"
							: "bg-primary/10 text-primary"
					}`}
				>
					Save {ANNUAL_DISCOUNT_PERCENT}%
				</span>
			</button>
		</div>
	);
}
