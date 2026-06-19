import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { TradingPlatform } from "@/lib/trades/csv-parsers";
import {
	apexParser,
	detectPlatform,
	getParser,
	ninjatraderParser,
	rithmicParser,
	topstepxParser,
	tradovateParser,
} from "@/lib/trades/csv-parsers";

function loadFixture(filename: string): string {
	return readFileSync(
		path.join(
			process.cwd(),
			"docs",
			"research",
			"futures-platform-csvs",
			"platforms",
			filename,
		),
		"utf-8",
	);
}

describe("futures CSV parsers", () => {
	it("should parse TopstepX sample and normalize futures symbols", async () => {
		const csv = loadFixture("topstepx.csv");
		const result = await topstepxParser.parse(csv);

		expect(result.success).toBe(true);
		expect(result.trades.length).toBeGreaterThan(0);
		expect(result.trades[0]?.symbol).toBe("NQ");
	});

	it("should parse NinjaTrader executions into closed trades", async () => {
		const csv = loadFixture("ninjatrader.csv");
		const result = await ninjatraderParser.parse(csv);

		expect(result.success).toBe(true);
		expect(result.trades.length).toBeGreaterThan(0);
		expect(result.trades.every((trade) => !trade.symbol.includes(" "))).toBe(
			true,
		);
		expect(result.trades.some((trade) => trade.fees !== undefined)).toBe(true);
	});

	it("should parse Tradovate filled orders and skip canceled rows", async () => {
		const csv = loadFixture("tradovate.csv");
		const result = await tradovateParser.parse(csv);

		expect(result.success).toBe(true);
		expect(result.trades.length).toBeGreaterThan(0);
		expect(
			result.warnings.some((warning) =>
				warning.includes("unfilled/canceled rows were ignored"),
			),
		).toBe(true);
	});

	it("should parse Tradovate Position History with broker-reported P&L", async () => {
		const csv = loadFixture("tradovate-position-history.csv");
		const result = await tradovateParser.parse(csv);

		expect(result.success).toBe(true);
		expect(result.trades).toHaveLength(1);

		const trade = result.trades[0];
		expect(trade?.symbol).toBe("MNQ");
		expect(trade?.direction).toBe("long"); // bought before sold
		expect(trade?.entryPrice).toBe("29402.5");
		expect(trade?.exitPrice).toBe("29501.75");
		expect(trade?.quantity).toBe("1");
		// The whole point: realized P&L flows through from the P/L column.
		expect(trade?.profit).toBe("198.5");
	});

	it("auto-detects Tradovate from Position History headers", async () => {
		const csv = loadFixture("tradovate-position-history.csv");
		const headers = csv.split("\n")[0]?.split(",") ?? [];
		expect(detectPlatform(headers)).toBe("tradovate");
	});

	it("should parse Rithmic mixed exports using Completed Orders section", async () => {
		const csv = loadFixture("rithmic-rtrader-full.csv");
		const result = await rithmicParser.parse(csv);

		expect(result.success).toBe(true);
		expect(result.trades.length).toBeGreaterThan(0);
		expect(result.trades.every((trade) => trade.symbol === "MNQ")).toBe(true);
	});

	it("should parse Apex sample by delegating to an underlying parser", async () => {
		const csv = loadFixture("apex-via-rithmic-completed-orders.csv");
		const result = await apexParser.parse(csv);

		expect(result.success).toBe(true);
		expect(result.trades.length).toBeGreaterThan(0);
		expect(result.warnings[0]).toContain("Detected underlying format");
	});

	it("should expose parser coverage for all expanded futures platforms", () => {
		const parserPlatforms: TradingPlatform[] = [
			"topstepx",
			"ninjatrader",
			"tradovate",
			"rithmic",
			"apex",
		];

		for (const platform of parserPlatforms) {
			expect(getParser(platform)).not.toBeNull();
		}
	});

	it("should detect parser platform from common futures headers", () => {
		expect(
			detectPlatform([
				"Id",
				"ContractName",
				"EnteredAt",
				"ExitedAt",
				"EntryPrice",
				"ExitPrice",
				"Fees",
				"PnL",
				"Size",
				"Type",
				"TradeDay",
			]),
		).toBe("topstepx");

		expect(
			detectPlatform([
				"orderId",
				"Account",
				"Order ID",
				"B/S",
				"Contract",
				"Status",
				"Fill Time",
				"filledQty",
				"avgPrice",
			]),
		).toBe("tradovate");

		expect(
			detectPlatform([
				"Instrument",
				"Action",
				"Quantity",
				"Price",
				"Time",
				"ID",
				"E/X",
			]),
		).toBe("ninjatrader");
	});
});
