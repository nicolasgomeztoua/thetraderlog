/**
 * One-off script to calculate MAE/MFE for all closed trades
 * that haven't been processed yet.
 *
 * Usage: npx tsx scripts/process-maemfe.ts
 */

import { and, eq, isNull, or } from "drizzle-orm";
import { calculateAndStoreMAEMFE } from "@/lib/market-data/maemfe";
import { db } from "@/server/db";
import { trades } from "@/server/db/schema";

async function main() {
	console.log("Finding closed trades without MAE/MFE data...\n");

	// Find all closed trades that need processing
	const unprocessedTrades = await db.query.trades.findMany({
		where: and(
			eq(trades.status, "closed"),
			or(
				isNull(trades.marketDataQuality),
				eq(trades.marketDataQuality, "pending"),
			),
		),
		columns: {
			id: true,
			symbol: true,
			entryTime: true,
			exitTime: true,
		},
	});

	console.log(`Found ${unprocessedTrades.length} trades to process.\n`);

	if (unprocessedTrades.length === 0) {
		console.log("All trades already have MAE/MFE data!");
		process.exit(0);
	}

	let processed = 0;
	let succeeded = 0;
	let failed = 0;

	for (const trade of unprocessedTrades) {
		processed++;
		console.log(
			`[${processed}/${unprocessedTrades.length}] Processing ${trade.symbol} (${trade.id.slice(0, 8)}...)`,
		);

		const result = await calculateAndStoreMAEMFE(trade.id, {
			skipAlreadyProcessed: false,
		});

		if (result.success) {
			succeeded++;
			console.log(`  ✓ ${result.dataQuality} - ${result.message ?? "OK"}`);
		} else {
			failed++;
			console.log(`  ✗ ${result.message}`);
		}

		// Small delay to avoid rate limiting
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	console.log("\n--- Summary ---");
	console.log(`Total: ${processed}`);
	console.log(`Succeeded: ${succeeded}`);
	console.log(`Failed: ${failed}`);
}

main().catch(console.error);
