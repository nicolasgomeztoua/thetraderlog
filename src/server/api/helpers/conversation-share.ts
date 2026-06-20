import { asc, eq } from "drizzle-orm";
import { getPresignedDownloadUrl, isS3Configured } from "@/lib/storage/s3";
import type { db } from "@/server/db";
import { aiConversations, aiMessages } from "@/server/db/schema";

type Database = typeof db;

const PROPOSE_TRADE_TOOL = "propose_trade";

/**
 * Renderable subset of a `propose_trade` tool call. Mirrors the public-safe
 * fields of the in-app confirmation card — deliberately excludes anything that
 * ties the proposal to an account (the raw tool arguments carry no account id,
 * and we never add one here).
 */
export type SharedConversationProposal = {
	symbol?: string;
	direction?: "long" | "short";
	entryPrice?: string;
	entryTime?: string;
	quantity?: string;
	exitPrice?: string;
	exitTime?: string;
	stopLoss?: string;
	takeProfit?: string;
	fees?: string;
	realizedPnl?: string;
	setupType?: string;
	notes?: string;
	isClosed?: boolean;
};

/** A user-attached image, projected to a public URL (never the raw S3 key). */
export type SharedConversationAttachment = {
	id: string;
	url: string;
	mimeType: string;
	filename?: string;
};

export type SharedConversationMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	/** Tool names that ran (for badges) — `propose_trade` excluded, raw args dropped. */
	toolNames: string[];
	/** The last `propose_trade` proposal in this message, rendered read-only. */
	proposal: SharedConversationProposal | null;
	attachments: SharedConversationAttachment[];
};

/**
 * Public-safe payload for a shared AI conversation.
 *
 * Deliberately excludes anything that exposes the trader's infrastructure or the
 * mechanics of the analysis: user/conversation ids, the conversation's
 * date-range scope and initial prompt, and — critically — the raw tool-call
 * arguments. Those arguments carry generated SQL, Python, and internal schema /
 * account references; only the *names* of the tools that ran are surfaced (for
 * the activity badges). S3 keys (which embed the owner's user id) are never
 * returned — only freshly presigned download URLs.
 */
export type SharedConversationPayload = NonNullable<
	Awaited<ReturnType<typeof getSharedConversationPayload>>
>;

type ParsedToolCall = {
	function?: { name?: string; arguments?: string };
};

function parseToolCalls(toolCallsJson: string | null): ParsedToolCall[] {
	if (!toolCallsJson) return [];
	try {
		const parsed = JSON.parse(toolCallsJson);
		if (Array.isArray(parsed)) return parsed as ParsedToolCall[];
	} catch {
		// Malformed tool-call JSON — treat as no tools.
	}
	return [];
}

/** Project raw `propose_trade` arguments to the public-safe renderable subset. */
function parseProposal(
	args: string | undefined,
): SharedConversationProposal | null {
	if (!args) return null;
	let raw: Record<string, unknown>;
	try {
		const parsed = JSON.parse(args);
		if (!parsed || typeof parsed !== "object") return null;
		raw = parsed as Record<string, unknown>;
	} catch {
		return null;
	}

	const str = (v: unknown): string | undefined =>
		typeof v === "string" && v.length > 0 ? v : undefined;

	return {
		symbol: str(raw.symbol),
		direction:
			raw.direction === "long" || raw.direction === "short"
				? raw.direction
				: undefined,
		entryPrice: str(raw.entryPrice),
		entryTime: str(raw.entryTime),
		quantity: str(raw.quantity),
		exitPrice: str(raw.exitPrice),
		exitTime: str(raw.exitTime),
		stopLoss: str(raw.stopLoss),
		takeProfit: str(raw.takeProfit),
		fees: str(raw.fees),
		realizedPnl: str(raw.realizedPnl),
		setupType: str(raw.setupType),
		notes: str(raw.notes),
		isClosed: typeof raw.isClosed === "boolean" ? raw.isClosed : undefined,
	};
}

/**
 * Load a conversation by id and project it to the public share shape.
 * Returns null when the conversation is missing or has no shareable messages.
 *
 * Note: callers are responsible for validating the share link (active, not
 * expired, resourceType "conversation") before calling this.
 */
export async function getSharedConversationPayload(
	database: Database,
	conversationId: string,
) {
	const conversation = await database.query.aiConversations.findFirst({
		where: eq(aiConversations.id, conversationId),
		with: {
			messages: { orderBy: [asc(aiMessages.createdAt)] },
			user: { columns: { name: true, imageUrl: true } },
		},
	});

	if (!conversation) return null;

	const s3Ready = isS3Configured();

	const messages: SharedConversationMessage[] = [];
	for (const message of conversation.messages) {
		// Internal/system turns never reach the public view.
		if (message.role !== "user" && message.role !== "assistant") continue;

		const toolCalls =
			message.role === "assistant"
				? parseToolCalls(message.toolCalls ?? null)
				: [];

		// Distinct tool names, in first-seen order, excluding propose_trade.
		const seen = new Set<string>();
		const toolNames: string[] = [];
		for (const tc of toolCalls) {
			const name = tc.function?.name;
			if (!name || name === PROPOSE_TRADE_TOOL || seen.has(name)) continue;
			seen.add(name);
			toolNames.push(name);
		}

		// If several proposals were emitted, the last is the most refined.
		const proposeCalls = toolCalls.filter(
			(tc) => tc.function?.name === PROPOSE_TRADE_TOOL,
		);
		const proposal = parseProposal(
			proposeCalls[proposeCalls.length - 1]?.function?.arguments,
		);

		// Regenerate presigned URLs per request; never expose the raw S3 key
		// (it embeds the owner's user id). Drop attachments we can't presign.
		const attachments: SharedConversationAttachment[] = s3Ready
			? (message.attachments ?? []).map((a, i) => ({
					id: `${message.id}-att-${i}`,
					url: getPresignedDownloadUrl(a.key, 3600),
					mimeType: a.mimeType,
					filename: a.filename,
				}))
			: [];

		// Skip turns with nothing to show (e.g. an empty assistant tool-only turn
		// whose only call was an excluded/no-op tool).
		if (
			!message.content &&
			toolNames.length === 0 &&
			!proposal &&
			attachments.length === 0
		) {
			continue;
		}

		messages.push({
			id: message.id,
			role: message.role,
			content: message.content,
			toolNames,
			proposal,
			attachments,
		});
	}

	if (messages.length === 0) return null;

	return {
		title: conversation.title,
		model: conversation.model,
		createdAt: conversation.createdAt,
		trader: {
			name: conversation.user?.name ?? null,
			imageUrl: conversation.user?.imageUrl ?? null,
		},
		messages,
	};
}
