import "@/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { CLERK_THEME } from "@/lib/shared";

const siteTitle = "TheTraderLog - AI Trading Analytics for Serious Traders";
const siteDescription =
	"The professional trading log for futures traders. Track trades, analyze patterns, and get AI-driven insights to trade with clarity.";
const siteUrl = "https://thetraderlog.com";

export const metadata: Metadata = {
	title: {
		default: siteTitle,
		template: "%s | TheTraderLog",
	},
	description: siteDescription,
	icons: [{ rel: "icon", url: "/favicon.ico" }],
	metadataBase: new URL(siteUrl),
	openGraph: {
		type: "website",
		locale: "en_US",
		url: siteUrl,
		siteName: "TheTraderLog",
		title: siteTitle,
		description: siteDescription,
	},
	twitter: {
		card: "summary_large_image",
		title: siteTitle,
		description: siteDescription,
	},
	robots: {
		index: true,
		follow: true,
	},
};

const manrope = Manrope({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

const jetbrainsMono = JetBrains_Mono({
	subsets: ["latin"],
	variable: "--font-jetbrains-mono",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<ClerkProvider
			appearance={{
				baseTheme: dark,
				variables: {
					...CLERK_THEME,
					borderRadius: "4px",
				},
			}}
		>
			<html
				className={`${manrope.variable} ${jetbrainsMono.variable}`}
				lang="en"
			>
				<body>
					{/* tRPC's React Query provider lives in the (protected)/(admin)
					    group layouts so public marketing/share/print pages don't ship
					    the client. */}
					{children}
					<Toaster position="top-right" richColors />
				</body>
			</html>
		</ClerkProvider>
	);
}
