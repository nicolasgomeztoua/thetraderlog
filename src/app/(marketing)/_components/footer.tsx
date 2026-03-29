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
		<footer className="relative border-border/50 border-t bg-black/50">
			<div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
				<div className="grid gap-8 sm:gap-12 md:grid-cols-2 lg:grid-cols-5">
					{/* Brand column */}
					<div className="md:col-span-2 lg:col-span-2">
						<Link className="group flex items-center gap-2 sm:gap-3" href="/">
							{/* Logo */}
							<svg
								aria-labelledby="footer-logo-title"
								className="h-7 w-7 sm:h-8 sm:w-8"
								fill="none"
								role="img"
								viewBox="0 0 32 32"
								xmlns="http://www.w3.org/2000/svg"
							>
								<title id="footer-logo-title">TheTraderLog Logo</title>
								<rect className="fill-primary" height="32" rx="2" width="32" />
								<path
									className="fill-primary-foreground"
									d="M8 8h16v3H11v5h11v3H11v5h13v3H8V8z"
								/>
							</svg>
							<span className="font-medium font-mono text-sm uppercase tracking-tight">
								The<span className="text-primary">TraderLog</span>
							</span>
						</Link>
						<p className="mt-4 max-w-xs font-mono text-muted-foreground text-xs leading-relaxed sm:mt-6 sm:text-sm">
							The professional trading log for futures traders who demand
							clarity.
						</p>

						{/* Status indicator */}
						<div className="mt-4 inline-flex items-center gap-2 rounded border border-profit/20 bg-profit/5 px-2.5 py-1 sm:mt-6 sm:px-3 sm:py-1.5">
							<span className="pulse-dot h-2 w-2 rounded-full bg-profit" />
							<span className="font-mono text-[10px] text-profit sm:text-xs">
								All systems operational
							</span>
						</div>
					</div>

					{/* Link columns - grid on mobile */}
					<div className="grid grid-cols-3 gap-4 sm:contents sm:gap-0">
						{Object.entries(footerLinks).map(([category, links]) => (
							<div key={category}>
								<h3 className="font-medium font-mono text-[10px] text-foreground uppercase tracking-wider sm:text-xs">
									{category}
								</h3>
								<ul className="mt-3 space-y-2 sm:mt-6 sm:space-y-4">
									{links.map((link) => (
										<li key={link.name}>
											<Link
												className="font-mono text-muted-foreground text-xs transition-colors hover:text-primary sm:text-sm"
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
				</div>

				{/* Bottom bar */}
				<div className="mt-10 flex flex-col items-center justify-between gap-4 border-border/50 border-t pt-6 sm:mt-16 sm:gap-6 sm:pt-8 lg:flex-row">
					<p className="font-mono text-[10px] text-muted-foreground sm:text-xs">
						© {new Date().getFullYear()} TheTraderLog. All rights reserved.
					</p>

					{/* Social links */}
					<div className="flex items-center gap-4 sm:gap-6">
						<Link
							className="flex min-h-[44px] items-center font-mono text-muted-foreground text-xs transition-colors hover:text-primary"
							href="https://twitter.com"
							target="_blank"
						>
							Twitter
						</Link>
						<Link
							className="flex min-h-[44px] items-center font-mono text-muted-foreground text-xs transition-colors hover:text-primary"
							href="https://discord.com"
							target="_blank"
						>
							Discord
						</Link>
						<Link
							className="flex min-h-[44px] items-center font-mono text-muted-foreground text-xs transition-colors hover:text-primary"
							href="https://github.com"
							target="_blank"
						>
							GitHub
						</Link>
					</div>
				</div>
			</div>

			{/* Large background text - smaller on mobile */}
			<div className="pointer-events-none absolute right-0 bottom-0 left-0 overflow-hidden">
				<div className="translate-y-1/2 text-center font-bold text-[25vw] text-muted/20 leading-none sm:text-[20vw]">
					LOG
				</div>
			</div>
		</footer>
	);
}
