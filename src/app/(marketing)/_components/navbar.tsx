"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
	{ href: "#features", label: "Features" },
	{ href: "#ai", label: "AI" },
	{ href: "#pricing", label: "Pricing" },
];

export function Navbar() {
	const { isLoaded, isSignedIn } = useAuth();

	// Only show signed-in content when we're certain user is signed in
	const showSignedIn = isLoaded && isSignedIn;

	return (
		<header className="fixed top-0 z-50 w-full border-border/50 border-b bg-background/80 backdrop-blur-xl">
			<div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
				{/* Logo */}
				<Link className="group flex items-center gap-2 sm:gap-3" href="/">
					<div className="relative flex h-8 w-8 items-center justify-center">
						{/* Logo mark - stylized E */}
						<svg
							aria-labelledby="navbar-logo-title"
							className="h-8 w-8"
							fill="none"
							role="img"
							viewBox="0 0 32 32"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title id="navbar-logo-title">TheTraderLog Logo</title>
							<rect className="fill-primary" height="32" rx="2" width="32" />
							<path
								className="fill-primary-foreground"
								d="M7 8h18v4h-7v13h-4V12H7V8z"
							/>
						</svg>
					</div>
					<span className="font-medium font-mono text-sm uppercase tracking-tight">
						The<span className="text-primary">TraderLog</span>
					</span>
				</Link>

				{/* Desktop Navigation */}
				<nav className="hidden items-center gap-8 md:flex">
					{navLinks.map((link) => (
						<Link
							className="font-mono text-muted-foreground text-xs uppercase tracking-wider transition-colors hover:text-primary"
							href={link.href}
							key={link.href}
						>
							{link.label}
						</Link>
					))}
				</nav>

				{/* Auth */}
				<div className="flex items-center gap-2 sm:gap-3">
					{/* Desktop Auth */}
					<div className="hidden items-center gap-3 sm:flex">
						{showSignedIn ? (
							<>
								<Link href="/dashboard">
									<Button
										className="font-mono text-xs uppercase tracking-wider"
										size="sm"
										variant="ghost"
									>
										Dashboard
									</Button>
								</Link>
								<UserButton afterSignOutUrl="/" />
							</>
						) : (
							<>
								<SignInButton mode="modal">
									<Button
										className="font-mono text-xs uppercase tracking-wider"
										size="sm"
										variant="ghost"
									>
										Login
									</Button>
								</SignInButton>
								<SignUpButton mode="modal">
									<Button
										className="font-mono text-xs uppercase tracking-wider"
										size="sm"
									>
										Get Started
									</Button>
								</SignUpButton>
							</>
						)}
					</div>

					{/* Mobile Auth - Simplified */}
					<div className="flex items-center gap-2 sm:hidden">
						{showSignedIn ? (
							<UserButton afterSignOutUrl="/" />
						) : (
							<SignUpButton mode="modal">
								<Button
									className="min-h-[44px] font-mono text-xs uppercase tracking-wider"
									size="sm"
								>
									Start
								</Button>
							</SignUpButton>
						)}
					</div>
				</div>
			</div>
		</header>
	);
}
