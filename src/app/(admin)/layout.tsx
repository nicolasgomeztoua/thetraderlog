import { redirect } from "next/navigation";
import { api } from "@/trpc/server";
import { AdminSidebar } from "./_components/admin-sidebar";

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await api.settings.me();

	if (user.role !== "admin") {
		redirect("/dashboard");
	}

	return (
		<div className="flex h-screen bg-background">
			<AdminSidebar />
			<main className="relative flex-1 overflow-auto">
				{/* Background grid for content area */}
				<div className="grid-bg pointer-events-none fixed inset-0 opacity-20" />
				<div className="relative p-6">{children}</div>
			</main>
		</div>
	);
}
