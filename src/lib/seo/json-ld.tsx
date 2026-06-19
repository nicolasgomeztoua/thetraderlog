import type {
	BreadcrumbList,
	FAQPage,
	Organization,
	Product,
	WebApplication,
	WithContext,
} from "./types";

const BASE_URL = "https://thetraderlog.com";

export function JsonLd<T extends Record<string, unknown>>({
	data,
}: {
	data: WithContext<T>;
}) {
	return <script type="application/ld+json">{JSON.stringify(data)}</script>;
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
			lowPrice: "10",
			highPrice: "24",
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
				price: "10",
				priceCurrency: "USD",
				description: "Essential tools for active traders",
				availability: "https://schema.org/InStock",
			},
			{
				"@type": "Offer",
				name: "Pro",
				price: "24",
				priceCurrency: "USD",
				priceValidUntil: "2026-12-31",
				description: "AI-powered insights for serious traders",
				availability: "https://schema.org/InStock",
			},
		],
	};
}

export function faqJsonLd(
	items: { q: string; a: string }[],
): WithContext<FAQPage> {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question" as const,
			name: item.q,
			acceptedAnswer: {
				"@type": "Answer" as const,
				text: item.a,
			},
		})),
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
