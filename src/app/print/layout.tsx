/**
 * Minimal layout for /print/* pages.
 * Root layout already provides <html>, <body>, fonts, and CSS.
 * No sidebar, no nav, no providers — just the content.
 */
export default function PrintLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
