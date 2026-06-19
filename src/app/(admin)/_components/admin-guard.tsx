"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/trpc/react";

interface AdminGuardProps {
	children: React.ReactNode;
	/** Initial role from server-side check to avoid loading flash */
	initialRole: string;
}

/**
 * Client-side admin guard that validates role on navigation.
 * Server-side layout.tsx handles the primary redirect — this is
 * a secondary check for client-side navigations and role changes.
 */
export function AdminGuard({ children, initialRole }: AdminGuardProps) {
	const router = useRouter();
	const { data: user, isLoading } = api.settings.me.useQuery(undefined, {
		// Only refetch if initial role is already admin (server passed the check)
		enabled: initialRole === "admin",
		staleTime: 30_000,
	});

	// Redirect if role is not admin (covers role changes mid-session)
	useEffect(() => {
		if (!isLoading && user && user.role !== "admin") {
			router.replace("/dashboard");
		}
	}, [isLoading, user, router]);

	// If server-side check already determined non-admin, redirect immediately
	if (initialRole !== "admin") {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4">
					<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
						Redirecting...
					</span>
				</div>
			</div>
		);
	}

	// While client-side check is loading, show children (server already validated)
	return <>{children}</>;
}
