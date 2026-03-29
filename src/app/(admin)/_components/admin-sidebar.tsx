"use client";

import {
	Activity,
	ArrowLeft,
	BarChart3,
	Bot,
	Bug,
	LayoutDashboard,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV_ITEMS } from "@/lib/constants/admin";
import { cn } from "@/lib/shared";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
	LayoutDashboard,
	Bug,
	Users,
	Bot,
	BarChart3,
	Activity,
};

export function AdminSidebar() {
	const pathname = usePathname();

	return (
		<aside className="flex h-full w-60 shrink-0 flex-col border-border border-r bg-sidebar">
			{/* Header */}
			<div className="border-border border-b px-4 py-4">
				<Link className="flex items-center gap-3" href="/admin">
					<svg
						aria-labelledby="admin-logo-title"
						className="h-8 w-8"
						fill="none"
						role="img"
						viewBox="0 0 32 32"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title id="admin-logo-title">TheTraderLog Admin Logo</title>
						<rect className="fill-primary" height="32" rx="2" width="32" />
						<path
							className="fill-primary-foreground"
							d="M8 8h16v3H11v5h11v3H11v5h13v3H8V8z"
						/>
					</svg>
					<div className="flex flex-col">
						<span className="font-medium font-mono text-sm uppercase tracking-tight">
							The<span className="text-primary">TraderLog</span>
						</span>
						<span className="font-mono text-[10px] text-primary uppercase tracking-widest">
							Admin
						</span>
					</div>
				</Link>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto px-3 py-4">
				<div className="mb-2 px-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					Management
				</div>
				<ul className="space-y-1">
					{ADMIN_NAV_ITEMS.map((item) => {
						const Icon = ICON_MAP[item.icon];
						const isActive =
							item.href === "/admin"
								? pathname === "/admin"
								: pathname.startsWith(item.href);

						return (
							<li key={item.href}>
								<Link
									className={cn(
										"flex items-center gap-3 rounded px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors",
										isActive
											? "bg-primary/10 text-primary"
											: "text-muted-foreground hover:bg-secondary hover:text-foreground",
									)}
									href={item.href}
								>
									{Icon && <Icon className="h-4 w-4" />}
									<span>{item.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</nav>

			{/* Footer — Back to App */}
			<div className="border-border border-t px-3 py-4">
				<Link
					className="flex items-center gap-3 rounded px-3 py-2 font-mono text-muted-foreground text-xs uppercase tracking-wider transition-colors hover:bg-secondary hover:text-foreground"
					href="/dashboard"
				>
					<ArrowLeft className="h-4 w-4" />
					<span>Back to App</span>
				</Link>
			</div>
		</aside>
	);
}
