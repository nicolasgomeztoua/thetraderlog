"use client";

import { UserButton } from "@clerk/nextjs";
import {
	BarChart3,
	BookMarked,
	BookOpen,
	Brain,
	Calendar,
	Check,
	ChevronsUpDown,
	FileSpreadsheet,
	FolderOpen,
	LayoutDashboard,
	Plus,
	PlusCircle,
	Settings,
	Shield,
	Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAccount } from "@/contexts/account-context";
import { isPropAccountType } from "@/lib/constants/prop";
import { ACCOUNT_TYPE_COLORS, cn } from "@/lib/shared";
import { api } from "@/trpc/react";

const mainNavItems = [
	{
		title: "Dashboard",
		href: "/dashboard",
		icon: LayoutDashboard,
	},
	{
		title: "Trades",
		href: "/journal",
		icon: BookOpen,
	},
	{
		title: "Daily Journal",
		href: "/daily-journal",
		icon: Calendar,
	},
	{
		title: "Strategies",
		href: "/strategies",
		icon: BookMarked,
	},
	{
		title: "Analytics",
		href: "/analytics",
		icon: BarChart3,
	},
	{
		title: "AI Insights",
		href: "/ai",
		icon: Brain,
	},
];

// ACCOUNT_TYPE_COLORS imported from shared

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
	prop_challenge: "Challenge",
	prop_funded: "Funded",
	live: "Live",
	demo: "Demo",
};

export function AppSidebar() {
	const pathname = usePathname();
	const router = useRouter();
	const { accounts, selectedAccount, setSelectedAccountId, isLoading } =
		useAccount();
	const [mounted, setMounted] = useState(false);
	const { data: me } = api.settings.me.useQuery();

	// Prevent hydration mismatch with Clerk UserButton
	useEffect(() => {
		setMounted(true);
	}, []);

	const navItems = useMemo(() => {
		const hasProp = accounts.some((a) => isPropAccountType(a.accountType));
		if (!hasProp) return mainNavItems;
		// Insert Prop between Analytics (index 4) and AI Insights (index 5)
		const propItem = { title: "Prop", href: "/prop", icon: Shield };
		return [...mainNavItems.slice(0, 5), propItem, ...mainNavItems.slice(5)];
	}, [accounts]);

	// Fetch groups for group selector
	const { data: groups = [] } = api.accounts.getGroups.useQuery();

	// Group accounts by their group
	const groupedAccounts = accounts.reduce(
		(acc, account) => {
			const groupId = account.groupId ?? "ungrouped";
			if (!acc[groupId]) {
				acc[groupId] = [];
			}
			acc[groupId].push(account);
			return acc;
		},
		{} as Record<string | number, typeof accounts>,
	);

	return (
		<Sidebar className="border-border">
			<SidebarHeader className="border-border border-b bg-sidebar">
				{/* Logo */}
				<Link className="flex items-center gap-3 px-2 py-3" href="/dashboard">
					<svg
						aria-labelledby="sidebar-logo-title"
						className="h-8 w-8"
						fill="none"
						role="img"
						viewBox="0 0 32 32"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title id="sidebar-logo-title">TheTraderLog Logo</title>
						<rect className="fill-primary" height="32" rx="2" width="32" />
						<path
							className="fill-primary-foreground"
							d="M7 8h18v4h-7v13h-4V12H7V8z"
						/>
					</svg>
					<span className="font-medium font-mono text-sm uppercase tracking-tight">
						The<span className="text-primary">TraderLog</span>
					</span>
				</Link>

				{/* Account Selector */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							className="flex min-h-[44px] w-full items-center gap-2 rounded border border-border bg-secondary/50 px-3 py-2.5 text-left font-mono text-xs transition-colors hover:border-border hover:bg-secondary"
							type="button"
						>
							{isLoading ? (
								<div className="flex items-center gap-2">
									<div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground/50" />
									<span className="text-muted-foreground uppercase tracking-wider">
										Loading...
									</span>
								</div>
							) : selectedAccount ? (
								<>
									<div
										className={cn(
											"h-2 w-2 rounded-full",
											ACCOUNT_TYPE_COLORS[selectedAccount.accountType],
										)}
									/>
									<div className="flex-1 truncate">
										<span className="font-medium uppercase tracking-wider">
											{selectedAccount.name}
										</span>
										{selectedAccount.accountType.startsWith("prop_") && (
											<span className="ml-1 text-muted-foreground">
												({ACCOUNT_TYPE_LABELS[selectedAccount.accountType]})
											</span>
										)}
									</div>
									<ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
								</>
							) : (
								<>
									<Wallet className="h-3 w-3 text-muted-foreground" />
									<span className="text-muted-foreground uppercase tracking-wider">
										No account
									</span>
									<ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
								</>
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="w-(--radix-dropdown-menu-trigger-width) min-w-[240px]"
					>
						{accounts.length === 0 ? (
							<DropdownMenuItem asChild className="min-h-[44px] py-3">
								<Link
									className="flex items-center gap-2 font-mono text-xs"
									href="/settings?tab=accounts"
								>
									<PlusCircle className="h-4 w-4" />
									Create your first account
								</Link>
							</DropdownMenuItem>
						) : (
							<>
								{/* Groups with accounts */}
								{groups.map((group) => {
									const groupAccounts = groupedAccounts[group.id] || [];
									if (groupAccounts.length === 0) return null;

									return (
										<div key={group.id}>
											<DropdownMenuLabel className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
												<FolderOpen className="h-3 w-3" />
												{group.name}
											</DropdownMenuLabel>
											{groupAccounts.map((account) => (
												<DropdownMenuItem
													className="flex min-h-[44px] items-center gap-2 py-2.5 pl-6 font-mono text-xs"
													key={account.id}
													onClick={() => {
														setSelectedAccountId(account.id);
														router.push("/dashboard");
													}}
												>
													<div
														className={cn(
															"h-2 w-2 rounded-full",
															ACCOUNT_TYPE_COLORS[account.accountType],
														)}
													/>
													<div className="flex-1 truncate">
														<span>{account.name}</span>
														{account.accountType === "prop_challenge" &&
															account.challengeStatus && (
																<span
																	className={cn(
																		"ml-1 text-[10px]",
																		account.challengeStatus === "passed" &&
																			"text-green-500",
																		account.challengeStatus === "failed" &&
																			"text-red-500",
																		account.challengeStatus === "active" &&
																			"text-amber-500",
																	)}
																>
																	({account.challengeStatus})
																</span>
															)}
													</div>
													{selectedAccount?.id === account.id && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</DropdownMenuItem>
											))}
										</div>
									);
								})}

								{/* Ungrouped accounts */}
								{groupedAccounts.ungrouped &&
									groupedAccounts.ungrouped.length > 0 && (
										<>
											{groups.length > 0 && <DropdownMenuSeparator />}
											{groups.length > 0 && (
												<DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
													Ungrouped
												</DropdownMenuLabel>
											)}
											{groupedAccounts.ungrouped.map((account) => (
												<DropdownMenuItem
													className={cn(
														"flex min-h-[44px] items-center gap-2 py-2.5 font-mono text-xs",
														groups.length > 0 && "pl-6",
													)}
													key={account.id}
													onClick={() => {
														setSelectedAccountId(account.id);
														router.push("/dashboard");
													}}
												>
													<div
														className={cn(
															"h-2 w-2 rounded-full",
															ACCOUNT_TYPE_COLORS[account.accountType],
														)}
													/>
													<div className="flex-1 truncate">
														<span>{account.name}</span>
														{account.accountType === "prop_challenge" &&
															account.challengeStatus && (
																<span
																	className={cn(
																		"ml-1 text-[10px]",
																		account.challengeStatus === "passed" &&
																			"text-green-500",
																		account.challengeStatus === "failed" &&
																			"text-red-500",
																		account.challengeStatus === "active" &&
																			"text-amber-500",
																	)}
																>
																	({account.challengeStatus})
																</span>
															)}
													</div>
													{selectedAccount?.id === account.id && (
														<Check className="h-4 w-4 text-primary" />
													)}
												</DropdownMenuItem>
											))}
										</>
									)}

								<DropdownMenuSeparator />
								<DropdownMenuItem asChild className="min-h-[44px] py-2.5">
									<Link
										className="flex items-center gap-2 font-mono text-xs"
										href="/settings?tab=accounts"
									>
										<Settings className="h-4 w-4" />
										Manage accounts
									</Link>
								</DropdownMenuItem>
							</>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Add Trade Dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="mt-3 w-full font-mono text-xs uppercase tracking-wider"
							size="sm"
						>
							<Plus className="mr-2 h-4 w-4" />
							Add Trade
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						className="w-(--radix-dropdown-menu-trigger-width) min-w-[200px]"
					>
						<DropdownMenuItem asChild className="min-h-[44px] py-2.5">
							<Link
								className="flex items-center gap-2 font-mono text-xs"
								href="/trade/new"
							>
								<Plus className="h-4 w-4" />
								Log Trade
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild className="min-h-[44px] py-2.5">
							<Link
								className="flex items-center gap-2 font-mono text-xs"
								href="/import"
							>
								<FileSpreadsheet className="h-4 w-4" />
								Import CSV
							</Link>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarHeader>

			<SidebarContent className="bg-sidebar">
				<SidebarGroup>
					<SidebarGroupLabel className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
						Navigation
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.href}>
									<SidebarMenuButton
										asChild
										className="font-mono text-xs uppercase tracking-wider"
										isActive={pathname === item.href}
									>
										<Link href={item.href}>
											<item.icon className="h-4 w-4" />
											<span>{item.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="border-border border-t bg-sidebar">
				<SidebarMenu>
					<SidebarMenuItem>
						<ThemeSelector />
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="font-mono text-xs uppercase tracking-wider"
							isActive={pathname === "/settings"}
						>
							<Link href="/settings">
								<Settings className="h-4 w-4" />
								<span>Settings</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
					{me?.role === "admin" && (
						<SidebarMenuItem>
							<SidebarMenuButton
								asChild
								className="font-mono text-xs uppercase tracking-wider"
								isActive={pathname.startsWith("/admin")}
							>
								<Link href="/admin">
									<Shield className="h-4 w-4" />
									<span>Admin</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					)}
					<SidebarMenuItem>
						<div className="flex items-center gap-3 px-2 py-2">
							{mounted ? (
								<UserButton
									afterSignOutUrl="/"
									appearance={{
										elements: {
											avatarBox: "h-8 w-8",
										},
									}}
								/>
							) : (
								<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
							)}
							<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Account
							</span>
						</div>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
