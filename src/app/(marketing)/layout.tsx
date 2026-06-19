import { Footer } from "./_components/footer";
import { Navbar } from "./_components/navbar";

export default function MarketingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="relative flex min-h-screen flex-col">
			{/* Noise texture overlay */}
			<div className="noise-overlay" />

			<Navbar />
			<main className="flex-1">{children}</main>
			<Footer />
		</div>
	);
}
