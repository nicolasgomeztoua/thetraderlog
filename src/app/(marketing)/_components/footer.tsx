import Link from "next/link";

const footerLinks = {
	Product: [
		{ name: "Features", href: "#features" },
		{ name: "AI Insights", href: "#ai" },
		{ name: "Pricing", href: "#pricing" },
		{ name: "Changelog", href: "#" },
	],
	Resources: [
		{ name: "Documentation", href: "#" },
		{ name: "API Reference", href: "#" },
		{ name: "Blog", href: "#" },
		{ name: "Community", href: "#" },
	],
	Company: [
		{ name: "About", href: "#" },
		{ name: "Contact", href: "#" },
		{ name: "Privacy", href: "#" },
		{ name: "Terms", href: "#" },
	],
};

export function Footer() {
	return (
		<footer className="relative border-white/5 border-t bg-black/50">
			<div className="mx-auto max-w-6xl px-6 py-16">
				<div className="grid gap-12 lg:grid-cols-5">
					{/* Brand column */}
					<div className="lg:col-span-2">
						<Link className="group flex items-center gap-3" href="/">
							{/* Logo */}
							<svg
								aria-labelledby="footer-logo-title"
								className="h-8 w-8"
								fill="none"
								role="img"
								viewBox="0 0 32 32"
								xmlns="http://www.w3.org/2000/svg"
							>
								<title id="footer-logo-title">EdgeJournal Logo</title>
								<rect className="fill-primary" height="32" rx="2" width="32" />
								<path
									className="fill-primary-foreground"
									d="M8 8h16v3H11v5h11v3H11v5h13v3H8V8z"
								/>
							</svg>
							<span className="font-medium font-mono text-sm uppercase tracking-tight">
								Edge<span className="text-primary">Journal</span>
							</span>
						</Link>
						<p className="mt-6 max-w-xs font-mono text-muted-foreground text-sm leading-relaxed">
							The professional trading journal for futures and forex traders who
							want to find their edge.
						</p>

						{/* Status indicator */}
						<div className="mt-6 inline-flex items-center gap-2 rounded border border-profit/20 bg-profit/5 px-3 py-1.5">
							<span className="pulse-dot h-2 w-2 rounded-full bg-profit" />
							<span className="font-mono text-profit text-xs">
								All systems operational
							</span>
						</div>
					</div>

					{/* Link columns */}
					{Object.entries(footerLinks).map(([category, links]) => (
						<div key={category}>
							<h3 className="font-medium font-mono text-foreground text-xs uppercase tracking-wider">
								{category}
							</h3>
							<ul className="mt-6 space-y-4">
								{links.map((link) => (
									<li key={link.name}>
										<Link
											className="font-mono text-muted-foreground text-sm transition-colors hover:text-primary"
											href={link.href}
										>
											{link.name}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				{/* Bottom bar */}
				<div className="mt-16 flex flex-col items-center justify-between gap-6 border-white/5 border-t pt-8 lg:flex-row">
					<p className="font-mono text-muted-foreground text-xs">
						© {new Date().getFullYear()} EdgeJournal. All rights reserved.
					</p>

					{/* Social links */}
					<div className="flex items-center gap-6">
						<Link
							className="font-mono text-muted-foreground text-xs transition-colors hover:text-primary"
							href="https://twitter.com"
							target="_blank"
						>
							Twitter
						</Link>
						<Link
							className="font-mono text-muted-foreground text-xs transition-colors hover:text-primary"
							href="https://discord.com"
							target="_blank"
						>
							Discord
						</Link>
						<Link
							className="font-mono text-muted-foreground text-xs transition-colors hover:text-primary"
							href="https://github.com"
							target="_blank"
						>
							GitHub
						</Link>
					</div>
				</div>
			</div>

			{/* Large background text */}
			<div className="pointer-events-none absolute right-0 bottom-0 left-0 overflow-hidden">
				<div className="translate-y-1/2 text-center font-bold text-[20vw] text-white/2 leading-none">
					EDGE
				</div>
			</div>
		</footer>
	);
}
