/**
 * Minimal layout for /share/* pages.
 * Root layout already provides <html>, <body>, fonts, and CSS.
 * No sidebar, no nav — just the content.
 */
export default function ShareLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <>{children}</>;
}
