import {
	JsonLd,
	organizationJsonLd,
	webApplicationJsonLd,
} from "@/lib/seo/json-ld";
import { AIShowcase } from "./_components/ai-showcase";
import { CTA } from "./_components/cta";
import { Features } from "./_components/features";
import { Hero } from "./_components/hero";
import { Pricing } from "./_components/pricing";

export default function LandingPage() {
	return (
		<>
			<JsonLd data={organizationJsonLd()} />
			<JsonLd data={webApplicationJsonLd()} />
			<Hero />
			<Features />
			<AIShowcase />
			<Pricing />
			<CTA />
		</>
	);
}
