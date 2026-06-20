import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { getSharedTradePayload } from "@/server/api/helpers/trade-share";
import { db } from "@/server/db";
import { aiConversations, shareLinks, users } from "@/server/db/schema";

export const alt = "Shared via TheTraderLog";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Terminal design system colors (OG images can't use CSS variables)
const COLORS = {
	background: "#050505",
	surface: "#101010",
	border: "rgba(255, 255, 255, 0.1)",
	primary: "#d4ff00",
	profit: "#00ff88",
	loss: "#ff3b3b",
	foreground: "#fafafa",
	muted: "#71717a",
};

interface OgImageProps {
	params: Promise<{ token: string }>;
}

export default async function OgImage({ params }: OgImageProps) {
	const { token } = await params;

	const link = await db.query.shareLinks.findFirst({
		where: eq(shareLinks.token, token),
	});

	const isUsable =
		link?.isActive && !(link.expiresAt && link.expiresAt < new Date());

	if (link && isUsable && link.resourceType === "trade") {
		const payload = await getSharedTradePayload(db, link.resourceId);
		if (payload) {
			return tradeCard(payload.trade, payload.trader);
		}
	}

	if (link && isUsable && link.resourceType === "conversation") {
		const [conversation, owner] = await Promise.all([
			db.query.aiConversations.findFirst({
				where: eq(aiConversations.id, link.resourceId),
				columns: { title: true },
			}),
			db.query.users.findFirst({
				where: eq(users.id, link.userId),
				columns: { name: true },
			}),
		]);
		return conversationCard(
			conversation?.title ?? "AI Trading Analysis",
			owner?.name ?? null,
		);
	}

	return genericCard();
}

// =============================================================================
// CONVERSATION CARD
// =============================================================================

function conversationCard(title: string, traderName: string | null) {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: COLORS.background,
				padding: 56,
			}}
		>
			{/* Branded header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					fontSize: 24,
					letterSpacing: 4,
				}}
			>
				<span style={{ color: COLORS.primary, fontWeight: 700 }}>
					TRADERLOG
				</span>
				<span style={{ color: COLORS.muted }}>{"// SHARED CHAT"}</span>
			</div>

			{/* Title */}
			<div
				style={{
					display: "flex",
					marginTop: "auto",
					color: COLORS.foreground,
					fontSize: 56,
					fontWeight: 700,
					lineHeight: 1.15,
					letterSpacing: -1,
				}}
			>
				{title.length > 110 ? `${title.slice(0, 110)}…` : title}
			</div>

			{/* Footer: trader identity */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginTop: 40,
					borderTop: `1px solid ${COLORS.border}`,
					paddingTop: 32,
				}}
			>
				<span style={{ color: COLORS.muted, fontSize: 28 }}>
					AI trading analysis · Shared by{" "}
					{traderName ?? "a TheTraderLog trader"}
				</span>
				<span style={{ color: COLORS.primary, fontSize: 26, letterSpacing: 2 }}>
					thetraderlog.com
				</span>
			</div>
		</div>,
		size,
	);
}

// =============================================================================
// TRADE CARD
// =============================================================================

function tradeCard(
	trade: {
		symbol: string;
		direction: "long" | "short";
		status: "open" | "closed";
		netPnl: string | null;
		entryTime: Date;
	},
	trader: { name: string | null },
) {
	const pnl = trade.netPnl ? Number.parseFloat(trade.netPnl) : null;
	const isProfit = pnl !== null && pnl > 0;
	const isLoss = pnl !== null && pnl < 0;
	const pnlColor = isProfit
		? COLORS.profit
		: isLoss
			? COLORS.loss
			: COLORS.muted;
	const pnlText =
		pnl !== null
			? `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", {
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				})}`
			: "OPEN POSITION";
	const directionColor =
		trade.direction === "long" ? COLORS.profit : COLORS.loss;
	const tradeDate = trade.entryTime.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: COLORS.background,
				padding: 56,
			}}
		>
			{/* Branded header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					fontSize: 24,
					letterSpacing: 4,
				}}
			>
				<span style={{ color: COLORS.primary, fontWeight: 700 }}>
					TRADERLOG
				</span>
				<span style={{ color: COLORS.muted }}>{"// SHARED TRADE"}</span>
			</div>

			{/* Symbol + direction */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 24,
					marginTop: 72,
				}}
			>
				<span
					style={{
						color: COLORS.foreground,
						fontSize: 72,
						fontWeight: 700,
						letterSpacing: 2,
					}}
				>
					{trade.symbol}
				</span>
				<span
					style={{
						display: "flex",
						color: directionColor,
						border: `2px solid ${directionColor}`,
						borderRadius: 6,
						padding: "8px 20px",
						fontSize: 32,
						letterSpacing: 4,
					}}
				>
					{trade.direction.toUpperCase()}
				</span>
			</div>

			{/* P&L */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginTop: 32,
				}}
			>
				<span
					style={{
						color: pnlColor,
						fontSize: pnl !== null ? 140 : 80,
						fontWeight: 700,
						letterSpacing: -2,
					}}
				>
					{pnlText}
				</span>
				<span
					style={{
						color: COLORS.muted,
						fontSize: 26,
						letterSpacing: 6,
						marginTop: 8,
					}}
				>
					NET P&L · {tradeDate}
				</span>
			</div>

			{/* Footer: trader identity */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginTop: "auto",
					borderTop: `1px solid ${COLORS.border}`,
					paddingTop: 32,
				}}
			>
				<span style={{ color: COLORS.foreground, fontSize: 30 }}>
					Shared by {trader.name ?? "a TheTraderLog trader"}
				</span>
				<span style={{ color: COLORS.primary, fontSize: 26, letterSpacing: 2 }}>
					thetraderlog.com
				</span>
			</div>
		</div>,
		size,
	);
}

// =============================================================================
// GENERIC CARD (reports, invalid links)
// =============================================================================

function genericCard() {
	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: COLORS.background,
				gap: 24,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 12,
					fontSize: 48,
					letterSpacing: 6,
				}}
			>
				<span style={{ color: COLORS.primary, fontWeight: 700 }}>
					TRADERLOG
				</span>
			</div>
			<span style={{ color: COLORS.muted, fontSize: 28, letterSpacing: 4 }}>
				THE TRADING JOURNAL FOR FUTURES TRADERS
			</span>
		</div>,
		size,
	);
}
