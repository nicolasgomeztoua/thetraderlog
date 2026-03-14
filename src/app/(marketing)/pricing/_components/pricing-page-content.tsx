"use client";

import { PricingTable } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { CLERK_THEME } from "@/lib/shared";

export function PricingPageContent() {
	return (
		<section className="relative py-16 sm:py-24 lg:py-32">
			<div className="grid-bg absolute inset-0 opacity-30" />

			<div className="relative mx-auto max-w-5xl px-4 sm:px-6">
				{/* Header */}
				<div className="mb-10 text-center sm:mb-16">
					<span className="mb-3 inline-block font-mono text-[10px] text-primary uppercase tracking-wider sm:mb-4 sm:text-xs">
						Pricing
					</span>
					<h2
						className="font-bold text-2xl leading-tight tracking-tight sm:text-4xl lg:text-5xl"
						data-testid="pricing-page-heading"
					>
						Choose your <span className="text-primary">plan</span>
					</h2>
					<p className="mx-auto mt-4 max-w-xl font-mono text-muted-foreground text-sm sm:mt-6 sm:text-base">
						Start with a 30-day free trial. Upgrade or downgrade anytime.
					</p>
				</div>

				{/* Clerk PricingTable */}
				<div data-testid="pricing-page-table">
					<PricingTable
						appearance={{
							baseTheme: dark,
							variables: {
								...CLERK_THEME,
								borderRadius: "4px",
							},
						}}
						newSubscriptionRedirectUrl="/dashboard"
					/>
				</div>
			</div>
		</section>
	);
}
