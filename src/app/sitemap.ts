import type { MetadataRoute } from "next";

import { env } from "@/env";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "https://thetraderlog.com";

	return [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${baseUrl}/pricing`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.8,
		},
		{
			url: `${baseUrl}/sign-up`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.5,
		},
	];
}
