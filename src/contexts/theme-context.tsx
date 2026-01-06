"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { DEFAULT_THEME, getThemeById, getThemeClass } from "@/lib/ui";
import { api } from "@/trpc/react";

interface ThemeContextValue {
	theme: string;
	setTheme: (themeId: string) => void;
	isLoading: boolean;
	pendingTheme: string | null;
	clearPending: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
	children: React.ReactNode;
	initialTheme?: string;
}

/**
 * ThemeProvider - Pure React state context (no tRPC dependency)
 * Handles theme state and DOM updates without requiring tRPC context
 */
export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
	const [theme, setThemeState] = useState(initialTheme ?? DEFAULT_THEME);
	const [pendingTheme, setPendingTheme] = useState<string | null>(null);

	// Apply theme class to document
	useEffect(() => {
		const root = document.documentElement;

		// Remove all theme classes
		const classes = Array.from(root.classList);
		for (const cls of classes) {
			if (cls.startsWith("theme-")) {
				root.classList.remove(cls);
			}
		}

		// Add new theme class
		const themeClass = getThemeClass(theme);
		root.classList.add(themeClass);

		// Store in localStorage for faster initial load
		localStorage.setItem("edgejournal-theme", theme);
	}, [theme]);

	const setTheme = useCallback((themeId: string) => {
		// Validate theme exists
		if (!getThemeById(themeId)) {
			console.warn(`Theme "${themeId}" not found, using default`);
			themeId = DEFAULT_THEME;
		}

		setThemeState(themeId);
		setPendingTheme(themeId); // Signal for persistence
	}, []);

	const clearPending = useCallback(() => {
		setPendingTheme(null);
	}, []);

	return (
		<ThemeContext.Provider
			value={{ theme, setTheme, isLoading: false, pendingTheme, clearPending }}
		>
			{children}
		</ThemeContext.Provider>
	);
}

/**
 * ThemePersistence - Syncs theme changes to the database via tRPC
 * Must be rendered inside TRPCReactProvider and ThemeProvider
 */
export function ThemePersistence() {
	const { pendingTheme, clearPending } = useTheme();
	const utils = api.useUtils();

	const { mutate: updateSettings } = api.settings.update.useMutation({
		onSuccess: () => {
			utils.settings.get.invalidate();
			clearPending();
		},
	});

	useEffect(() => {
		if (pendingTheme) {
			updateSettings({ theme: pendingTheme });
		}
	}, [pendingTheme, updateSettings]);

	return null; // Render nothing, just handles side effects
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}

// Script to prevent flash of unstyled content (FOUC)
// This runs before React hydrates to set the initial theme class
export const themeScript = `
(function() {
  try {
    const stored = localStorage.getItem('edgejournal-theme');
    if (stored) {
      document.documentElement.classList.add('theme-' + stored);
    }
  } catch {
    // localStorage may be unavailable in SSR or private browsing
  }
})();
`;
