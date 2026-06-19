export type WithContext<T extends Record<string, unknown>> = T & {
	"@context": "https://schema.org";
};

export type Organization = {
	"@type": "Organization";
	name: string;
	url: string;
	logo: string;
	description: string;
	sameAs: string[];
};

export type WebApplication = {
	"@type": "WebApplication";
	name: string;
	url: string;
	applicationCategory: string;
	operatingSystem: string;
	description: string;
	offers: {
		"@type": "AggregateOffer";
		priceCurrency: string;
		lowPrice: string;
		highPrice: string;
		offerCount: string;
	};
	featureList: string[];
};

export type Product = {
	"@type": "Product";
	name: string;
	description: string;
	brand: {
		"@type": "Organization";
		name: string;
	};
	offers: Array<{
		"@type": "Offer";
		name: string;
		price: string;
		priceCurrency: string;
		priceValidUntil?: string;
		description: string;
		availability: string;
	}>;
};

export type BreadcrumbList = {
	"@type": "BreadcrumbList";
	itemListElement: Array<{
		"@type": "ListItem";
		position: number;
		name: string;
		item: string;
	}>;
};

export type FAQPage = {
	"@type": "FAQPage";
	mainEntity: Array<{
		"@type": "Question";
		name: string;
		acceptedAnswer: {
			"@type": "Answer";
			text: string;
		};
	}>;
};
