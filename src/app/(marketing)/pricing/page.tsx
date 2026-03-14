import type { Metadata } from "next";
import { PricingPageContent } from "./_components/pricing-page-content";

export const metadata: Metadata = {
	title: "Pricing | EdgeJournal",
	description:
		"Choose the plan that fits your trading journey. Start with a 30-day free trial.",
};

export default function PricingPage() {
	return <PricingPageContent />;
}
