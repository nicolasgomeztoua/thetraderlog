// Theme definitions for EdgeJournal
// Featuring top-rated IDE themes loved by developers worldwide

export interface Theme {
	id: string;
	name: string;
	isDark: boolean;
	description: string;
	// Preview colors for the selector UI
	preview: {
		background: string;
		primary: string;
		accent: string;
	};
}

export const themes: Theme[] = [
	// ============================================
	// DARK THEMES
	// ============================================

	// EdgeJournal - Our signature dark theme
	{
		id: "edgejournal",
		name: "EdgeJournal",
		isDark: true,
		description: "Signature theme - Obsidian black + Electric chartreuse",
		preview: {
			background: "#121212",
			primary: "#d4ff00",
			accent: "#00d4ff",
		},
	},

	// One Dark Pro - #1 most popular VS Code theme, inspired by Atom
	{
		id: "one-dark",
		name: "One Dark Pro",
		isDark: true,
		description: "The iconic Atom-inspired theme loved by millions",
		preview: {
			background: "#282c34",
			primary: "#61afef",
			accent: "#98c379",
		},
	},

	// Dracula - Top 3 theme globally, purple vampire aesthetic
	{
		id: "dracula",
		name: "Dracula",
		isDark: true,
		description: "The famous purple theme with neon accents",
		preview: {
			background: "#282a36",
			primary: "#bd93f9",
			accent: "#ff79c6",
		},
	},

	// Night Owl - Sarah Drasner's accessibility-focused theme
	{
		id: "night-owl",
		name: "Night Owl",
		isDark: true,
		description: "Designed for night coders with accessibility in mind",
		preview: {
			background: "#011627",
			primary: "#7fdbca",
			accent: "#c792ea",
		},
	},

	// Monokai Pro - The classic beloved theme
	{
		id: "monokai",
		name: "Monokai Pro",
		isDark: true,
		description: "The legendary warm theme with vibrant syntax colors",
		preview: {
			background: "#2d2a2e",
			primary: "#ffd866",
			accent: "#78dce8",
		},
	},

	// ============================================
	// LIGHT THEMES
	// ============================================

	// EdgeJournal Light - Our signature theme adapted for light mode
	{
		id: "edgejournal-light",
		name: "EdgeJournal Light",
		isDark: false,
		description: "Signature EdgeJournal aesthetic for daytime trading",
		preview: {
			background: "#fafafa",
			primary: "#4d7c0f",
			accent: "#0891b2",
		},
	},

	// GitHub Light - Clean, familiar, professional
	{
		id: "github-light",
		name: "GitHub Light",
		isDark: false,
		description: "Clean and familiar like the GitHub interface",
		preview: {
			background: "#ffffff",
			primary: "#0969da",
			accent: "#8250df",
		},
	},

	// Ayu Light - Minimalist and elegant
	{
		id: "ayu-light",
		name: "Ayu Light",
		isDark: false,
		description: "Minimalist warmth with soft, balanced colors",
		preview: {
			background: "#fafafa",
			primary: "#ff9940",
			accent: "#a37acc",
		},
	},

	// Solarized Light - The classic light theme
	{
		id: "solarized-light",
		name: "Solarized Light",
		isDark: false,
		description: "The legendary low-contrast theme for long sessions",
		preview: {
			background: "#fdf6e3",
			primary: "#268bd2",
			accent: "#859900",
		},
	},
];

export const darkThemes = themes.filter((t) => t.isDark);
export const lightThemes = themes.filter((t) => !t.isDark);

export const DEFAULT_THEME = "edgejournal";

export function getThemeById(id: string): Theme | undefined {
	return themes.find((t) => t.id === id);
}

export function getThemeClass(themeId: string): string {
	return `theme-${themeId}`;
}
