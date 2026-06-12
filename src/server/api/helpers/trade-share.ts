import { eq } from "drizzle-orm";
import { transformHtmlWithPresignedUrls } from "@/lib/storage/s3";
import type { db } from "@/server/db";
import { trades } from "@/server/db/schema";

type Database = typeof db;

/**
 * Public-safe payload for a shared trade.
 *
 * Deliberately excludes anything that identifies the trader's infrastructure
 * or finances beyond the single trade: account details, user/trade ids,
 * import metadata, emotional state, review status, and rule checks.
 */
export type SharedTradePayload = NonNullable<
	Awaited<ReturnType<typeof getSharedTradePayload>>
>;

/**
 * Load a trade by id and project it to the public share shape.
 * Returns null when the trade is missing or soft-deleted.
 *
 * Note: callers are responsible for validating the share link
 * (active, not expired, resourceType "trade") before calling this.
 */
export async function getSharedTradePayload(
	database: Database,
	tradeId: string,
) {
	const trade = await database.query.trades.findFirst({
		where: eq(trades.id, tradeId),
		with: {
			executions: true,
			tradeTags: { with: { tag: true } },
			strategy: { columns: { name: true } },
			user: { columns: { name: true, imageUrl: true } },
		},
	});

	if (!trade || trade.deletedAt) return null;

	return {
		trade: {
			symbol: trade.symbol,
			direction: trade.direction,
			status: trade.status,
			entryPrice: trade.entryPrice,
			entryTime: trade.entryTime,
			exitPrice: trade.exitPrice,
			exitTime: trade.exitTime,
			quantity: trade.quantity,
			stopLoss: trade.stopLoss,
			takeProfit: trade.takeProfit,
			stopLossHit: trade.stopLossHit,
			takeProfitHit: trade.takeProfitHit,
			trailedStopLoss: trade.trailedStopLoss,
			wasTrailed: trade.wasTrailed,
			netPnl: trade.netPnl,
			fees: trade.fees,
			maePrice: trade.maePrice,
			mfePrice: trade.mfePrice,
			maeAmount: trade.maeAmount,
			mfeAmount: trade.mfeAmount,
			marketDataQuality: trade.marketDataQuality,
			setupType: trade.setupType,
			rating: trade.rating,
			notes: transformHtmlWithPresignedUrls(trade.notes),
			executions: trade.executions.map((execution) => ({
				id: execution.id,
				executionType: execution.executionType,
				price: execution.price,
				quantity: execution.quantity,
				executedAt: execution.executedAt,
				fees: execution.fees,
				realizedPnl: execution.realizedPnl,
			})),
			tags: trade.tradeTags.map((tradeTag) => ({
				id: tradeTag.tag.id,
				name: tradeTag.tag.name,
				color: tradeTag.tag.color,
			})),
			strategyName: trade.strategy?.name ?? null,
		},
		trader: {
			name: trade.user?.name ?? null,
			imageUrl: trade.user?.imageUrl ?? null,
		},
	};
}
