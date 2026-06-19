import type { MetadataRoute } from "next";

import { env } from "@/env";

export default function robots(): MetadataRoute.Robots {
	const baseUrl = env.NEXT_PUBLIC_APP_URL ?? "https://thetraderlog.com";

	return {
		rules: [
			{
				userAgent: "*",
				allow: ["/", "/pricing"],
				disallow: [
					"/dashboard",
					"/journal",
					"/analytics",
					"/ai",
					"/import",
					"/settings",
					"/strategies",
					"/trade",
					"/prop",
					"/daily-journal",
					"/admin",
					"/print",
					"/share",
				],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
