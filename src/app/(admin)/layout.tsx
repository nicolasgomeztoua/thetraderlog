import { redirect } from "next/navigation";
import { TRPCReactProvider } from "@/trpc/react";
import { api } from "@/trpc/server";
import { AdminGuard } from "./_components/admin-guard";
import { AdminSidebar } from "./_components/admin-sidebar";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await api.settings.me();

	// Server-side primary guard: redirect non-admins immediately
	if (user.role !== "admin") {
		redirect("/dashboard");
	}

	return (
		<TRPCReactProvider>
			<div className="flex h-screen bg-background">
				<AdminSidebar />
				<main className="relative flex-1 overflow-auto">
					{/* Background grid for content area */}
					<div className="grid-bg pointer-events-none fixed inset-0 opacity-20" />
					<div className="relative p-6">
						{/* Client-side secondary guard: validates role on navigation */}
						<AdminGuard initialRole={user.role}>{children}</AdminGuard>
					</div>
				</main>
			</div>
		</TRPCReactProvider>
	);
}
