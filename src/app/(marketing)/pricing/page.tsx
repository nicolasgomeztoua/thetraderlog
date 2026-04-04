import type { Metadata } from "next";
import { FAQ_ITEMS } from "@/lib/constants/pricing-plans";
import {
	breadcrumbJsonLd,
	faqJsonLd,
	JsonLd,
	pricingJsonLd,
} from "@/lib/seo/json-ld";
import { PricingPageContent } from "./_components/pricing-page-content";

export const metadata: Metadata = {
	title: "Pricing",
	description:
		"Choose the plan that fits your trading journey. Start with a 30-day free trial.",
	openGraph: {
		title: "Pricing | TheTraderLog",
		description:
			"Choose the plan that fits your trading journey. Start with a 30-day free trial.",
		url: "https://thetraderlog.com/pricing",
	},
};

export default function PricingPage() {
	return (
		<>
			<JsonLd data={pricingJsonLd()} />
			<JsonLd data={faqJsonLd(FAQ_ITEMS)} />
			<JsonLd
				data={breadcrumbJsonLd([
					{ name: "Home", url: "https://thetraderlog.com" },
					{ name: "Pricing", url: "https://thetraderlog.com/pricing" },
				])}
			/>
			<PricingPageContent />
		</>
	);
}
