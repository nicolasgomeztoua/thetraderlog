"use client";

import { Check, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/shared";
import { darkThemes, lightThemes, type Theme } from "@/lib/ui";

function ThemeSwatch({ theme }: { theme: Theme }) {
	return (
		<div
			className="flex h-5 w-8 overflow-hidden rounded border border-white/10"
			style={{ backgroundColor: theme.preview.background }}
		>
			<div
				className="h-full w-1/2"
				style={{ backgroundColor: theme.preview.primary }}
			/>
			<div
				className="h-full w-1/2"
				style={{ backgroundColor: theme.preview.accent }}
			/>
		</div>
	);
}

function ThemeMenuItem({
	theme,
	isActive,
	onClick,
}: {
	theme: Theme;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<DropdownMenuItem
			className={cn(
				"flex cursor-pointer items-center gap-3 font-mono text-xs",
				isActive && "bg-accent/10",
			)}
			onClick={onClick}
		>
			<ThemeSwatch theme={theme} />
			<span className="flex-1">{theme.name}</span>
			{isActive && <Check className="h-4 w-4 text-primary" />}
		</DropdownMenuItem>
	);
}

export function ThemeSelector() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Prevent hydration mismatch with Radix UI dropdown IDs
	useEffect(() => {
		setMounted(true);
	}, []);

	const currentTheme =
		darkThemes.find((t) => t.id === theme) ||
		lightThemes.find((t) => t.id === theme);
	const isDark = currentTheme?.isDark ?? true;

	if (!mounted) {
		return (
			<SidebarMenuButton
				className="font-mono text-xs uppercase tracking-wider"
				disabled
			>
				<Moon className="h-4 w-4" />
				<span>Theme</span>
			</SidebarMenuButton>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton className="font-mono text-xs uppercase tracking-wider">
					{isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
					<span>{currentTheme?.name ?? "Theme"}</span>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[200px]" side="right">
				<DropdownMenuLabel className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					<Moon className="h-3 w-3" />
					Dark Themes
				</DropdownMenuLabel>
				{darkThemes.map((t) => (
					<ThemeMenuItem
						isActive={theme === t.id}
						key={t.id}
						onClick={() => setTheme(t.id)}
						theme={t}
					/>
				))}

				<DropdownMenuSeparator />

				<DropdownMenuLabel className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
					<Sun className="h-3 w-3" />
					Light Themes
				</DropdownMenuLabel>
				{lightThemes.map((t) => (
					<ThemeMenuItem
						isActive={theme === t.id}
						key={t.id}
						onClick={() => setTheme(t.id)}
						theme={t}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
