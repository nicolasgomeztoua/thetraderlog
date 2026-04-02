import type { WithContext, Organization, WebApplication, Product, BreadcrumbList } from "./types";

const BASE_URL = "https://thetraderlog.com";

export function JsonLd<T extends Record<string, unknown>>({
	data,
}: { data: WithContext<T> }) {
	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
		/>
	);
}

export function organizationJsonLd(): WithContext<Organization> {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "TheTraderLog",
		url: BASE_URL,
		logo: `${BASE_URL}/favicon.ico`,
		description:
			"The professional trading log for futures traders. Track trades, analyze patterns, and get AI-driven insights.",
		sameAs: [],
	};
}

export function webApplicationJsonLd(): WithContext<WebApplication> {
	return {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: "TheTraderLog",
		url: BASE_URL,
		applicationCategory: "FinanceApplication",
		operatingSystem: "Web",
		description:
			"AI-powered trading journal for futures traders. Track trades, analyze performance patterns, and get actionable insights.",
		offers: {
			"@type": "AggregateOffer",
			priceCurrency: "USD",
			lowPrice: "0",
			highPrice: "50",
			offerCount: "2",
		},
		featureList: [
			"Trade logging and tracking",
			"Performance analytics",
			"AI-powered trade insights",
			"Partial exit tracking",
			"Multi-account support",
		],
	};
}

export function pricingJsonLd(): WithContext<Product> {
	return {
		"@context": "https://schema.org",
		"@type": "Product",
		name: "TheTraderLog",
		description:
			"Professional trading journal with AI analytics for futures traders.",
		brand: {
			"@type": "Organization",
			name: "TheTraderLog",
		},
		offers: [
			{
				"@type": "Offer",
				name: "Starter",
				price: "0",
				priceCurrency: "USD",
				description: "Free plan for getting started with trade journaling",
				availability: "https://schema.org/InStock",
			},
			{
				"@type": "Offer",
				name: "Pro",
				price: "50",
				priceCurrency: "USD",
				priceValidUntil: "2026-12-31",
				description:
					"Full-featured plan with AI insights and advanced analytics",
				availability: "https://schema.org/InStock",
			},
		],
	};
}

export function breadcrumbJsonLd(
	items: { name: string; url: string }[],
): WithContext<BreadcrumbList> {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	};
}
