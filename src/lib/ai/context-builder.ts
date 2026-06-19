import { and, desc, eq, gte } from "drizzle-orm";
import {
	getTimezoneAbbreviation,
	utcHourToLocalHour,
} from "@/lib/shared/timezone";
import type { db as DbType } from "@/server/db";
import {
	accounts,
	dailyJournals,
	strategies,
	strategyRules,
	tags,
	userSettings,
} from "@/server/db/schema";

type Db = typeof DbType;

/**
 * Builds user-specific context for the AI system prompt.
 * Loads the user's strategies, tags, trading sessions, accounts,
 * recent journal entries, and breakeven threshold.
 *
 * Returns a formatted string suitable for system prompt injection.
 */
export async function buildUserContext(
	userId: string,
	db: Db,
): Promise<string> {
	const [userStrategies, userTags, userAccounts, settings, recentJournals] =
		await Promise.all([
			loadStrategies(db, userId),
			loadTags(db, userId),
			loadAccounts(db, userId),
			loadSettings(db, userId),
			loadRecentJournals(db, userId),
		]);

	const sections: string[] = [
		"# User Context",
		"",
		formatAccounts(userAccounts),
		formatStrategies(userStrategies),
		formatTags(userTags),
		formatSettings(settings),
		formatJournals(recentJournals),
	];

	return sections.join("\n");
}

// =============================================================================
// DATA LOADERS
// =============================================================================

async function loadStrategies(db: Db, userId: string) {
	return db.query.strategies.findMany({
		where: and(eq(strategies.userId, userId), eq(strategies.isActive, true)),
		columns: {
			name: true,
			description: true,
			entryCriteria: true,
			exitRules: true,
			riskParameters: true,
		},
		with: {
			rules: {
				columns: { text: true, category: true },
				orderBy: [strategyRules.order],
			},
		},
	});
}

async function loadTags(db: Db, userId: string) {
	return db.query.tags.findMany({
		where: eq(tags.userId, userId),
		columns: { name: true, color: true },
	});
}

async function loadAccounts(db: Db, userId: string) {
	return db.query.accounts.findMany({
		where: eq(accounts.userId, userId),
		columns: {
			name: true,
			accountType: true,
			broker: true,
			currency: true,
			initialBalance: true,
			isActive: true,
		},
	});
}

async function loadSettings(db: Db, userId: string) {
	return db.query.userSettings.findFirst({
		where: eq(userSettings.userId, userId),
		columns: {
			timezone: true,
			breakevenThreshold: true,
			currency: true,
			tradingSessions: true,
		},
	});
}

async function loadRecentJournals(db: Db, userId: string) {
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

	return db.query.dailyJournals.findMany({
		where: and(
			eq(dailyJournals.userId, userId),
			gte(dailyJournals.date, sevenDaysAgo),
		),
		columns: { date: true, content: true },
		orderBy: [desc(dailyJournals.date)],
		limit: 7,
	});
}

// =============================================================================
// FORMATTERS
// =============================================================================

type AccountRow = Awaited<ReturnType<typeof loadAccounts>>[number];
type StrategyRow = Awaited<ReturnType<typeof loadStrategies>>[number];
type TagRow = Awaited<ReturnType<typeof loadTags>>[number];
type SettingsRow = Awaited<ReturnType<typeof loadSettings>>;
type JournalRow = Awaited<ReturnType<typeof loadRecentJournals>>[number];

function formatAccounts(rows: AccountRow[]): string {
	if (rows.length === 0) {
		return "## Accounts\nNo accounts configured yet.";
	}

	const lines = rows.map((a) => {
		const parts = [
			`- **${a.name}** (${a.accountType})`,
			a.broker ? `broker: ${a.broker}` : null,
			a.currency ? `currency: ${a.currency}` : null,
			a.initialBalance ? `initial balance: ${a.initialBalance}` : null,
			`active: ${a.isActive ? "yes" : "no"}`,
		];
		return parts.filter(Boolean).join(", ");
	});

	return `## Accounts\n${lines.join("\n")}`;
}

function formatStrategies(rows: StrategyRow[]): string {
	if (rows.length === 0) {
		return "## Strategies\nNo strategies defined yet.";
	}

	const formatted = rows.map((s) => {
		const parts: string[] = [`### ${s.name}`];

		if (s.description) {
			parts.push(s.description);
		}

		if (s.entryCriteria) {
			parts.push(`**Entry Criteria:** ${stripHtml(s.entryCriteria)}`);
		}

		if (s.exitRules) {
			parts.push(`**Exit Rules:** ${stripHtml(s.exitRules)}`);
		}

		if (s.riskParameters) {
			try {
				const risk = JSON.parse(s.riskParameters);
				parts.push(`**Risk Parameters:** ${JSON.stringify(risk)}`);
			} catch {
				// Skip malformed JSON
			}
		}

		if (s.rules.length > 0) {
			const grouped: Record<string, string[]> = {};
			for (const rule of s.rules) {
				const cat = rule.category ?? "general";
				if (!grouped[cat]) grouped[cat] = [];
				grouped[cat].push(rule.text);
			}
			for (const [category, ruleTexts] of Object.entries(grouped)) {
				parts.push(`**${category} rules:**`);
				for (const t of ruleTexts) {
					parts.push(`  - ${t}`);
				}
			}
		}

		return parts.join("\n");
	});

	return `## Strategies\n${formatted.join("\n\n")}`;
}

function formatTags(rows: TagRow[]): string {
	if (rows.length === 0) {
		return "## Tags\nNo tags created yet.";
	}

	const tagList = rows.map((t) => `${t.name} (${t.color})`).join(", ");
	return `## Tags\nAvailable tags: ${tagList}`;
}

function formatSettings(settings: SettingsRow): string {
	if (!settings) {
		return "## Settings\nDefault settings (UTC timezone, $3.00 breakeven threshold, USD).";
	}

	const lines = [
		`- Timezone: ${settings.timezone ?? "UTC"}`,
		`- Breakeven threshold: $${settings.breakevenThreshold ?? "3.00"}`,
		`- Currency: ${settings.currency ?? "USD"}`,
	];

	if (settings.tradingSessions) {
		try {
			const sessions = JSON.parse(settings.tradingSessions);
			if (Array.isArray(sessions) && sessions.length > 0) {
				const tz = settings.timezone ?? "UTC";
				const tzAbbr = getTimezoneAbbreviation(tz);
				lines.push("- Trading sessions:");
				for (const s of sessions) {
					const localStart = utcHourToLocalHour(s.startHour, tz);
					const localEnd = utcHourToLocalHour(s.endHour, tz);
					lines.push(
						`  - ${s.name}: ${localStart}:00–${localEnd}:00 ${tzAbbr} (UTC ${s.startHour}:00–${s.endHour}:00)`,
					);
				}
			}
		} catch {
			// Skip malformed JSON
		}
	}

	return `## Settings\n${lines.join("\n")}`;
}

function formatJournals(rows: JournalRow[]): string {
	if (rows.length === 0) {
		return "## Recent Journal Entries\nNo journal entries in the last 7 days.";
	}

	const entries = rows.map((j) => {
		const dateStr = j.date.toISOString().split("T")[0];
		const summary = j.content ? truncate(stripHtml(j.content), 300) : "(empty)";
		return `### ${dateStr}\n${summary}`;
	});

	return `## Recent Journal Entries (Last 7 Days)\n${entries.join("\n\n")}`;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, "").trim();
}

/** Truncate a string to maxLen characters, appending "..." if truncated */
function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.slice(0, maxLen)}...`;
}
