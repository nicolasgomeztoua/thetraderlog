import { BugReportButton } from "@/components/bug-report/bug-report-button";
import { Separator } from "@/components/ui/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";
import { AccountProvider } from "@/contexts/account-context";
import { ImportProgressProvider } from "@/contexts/import-progress-context";
import { ThemePersistence, ThemeProvider } from "@/contexts/theme-context";
import { SettingsHydration } from "@/hooks/use-settings-hydration";
import { api } from "@/trpc/server";
import { AppSidebar } from "./_components/app-sidebar";

export default async function ProtectedLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Fetch initial theme from user settings
	const settings = await api.settings.get();
	const initialTheme = settings?.theme ?? "edgejournal";

	return (
		<ThemeProvider initialTheme={initialTheme}>
			<ThemePersistence />
			<AccountProvider>
				<ImportProgressProvider>
					<SidebarProvider>
						<AppSidebar />
						<SidebarInset className="min-w-0 overflow-hidden bg-background">
							<header className="relative flex h-12 shrink-0 items-center gap-2 border-border bg-secondary/50 px-4">
								{/* Subtle grid pattern */}
								<div className="grid-bg pointer-events-none absolute inset-0 opacity-30" />
								<SidebarTrigger className="-ml-1 relative text-muted-foreground hover:text-foreground" />
								<Separator
									className="relative mr-2 h-4 bg-border"
									orientation="vertical"
								/>
								<div className="relative ml-auto">
									<BugReportButton />
								</div>
							</header>
							<main className="relative flex-1 overflow-auto p-4 sm:p-6">
								{/* Background grid for content area */}
								<div className="grid-bg pointer-events-none fixed inset-0 opacity-20" />
								<div className="relative">
									<SettingsHydration>{children}</SettingsHydration>
								</div>
							</main>
						</SidebarInset>
					</SidebarProvider>
				</ImportProgressProvider>
			</AccountProvider>
		</ThemeProvider>
	);
}
