// ============================================
// CSV Parser Types
// ============================================

export type TradingPlatform =
	| "mt4"
	| "mt5"
	| "projectx"
	| "ninjatrader"
	| "other";

export interface ParsedTrade {
	// Required fields
	symbol: string;
	instrumentType: "futures" | "forex";
	direction: "long" | "short";
	entryPrice: string;
	entryTime: Date;
	exitPrice: string;
	exitTime: Date;
	quantity: string;

	// Optional fields
	stopLoss?: string;
	takeProfit?: string;
	stopLossHit?: boolean;
	takeProfitHit?: boolean;
	fees?: string;
	commission?: string;
	swap?: string;
	profit?: string; // Platform-reported profit (for verification)

	// Metadata
	externalId?: string; // Platform's trade ID
	comment?: string;
	magicNumber?: string; // MT4/5 magic number
}

export interface ParseResult {
	success: boolean;
	trades: ParsedTrade[];
	errors: ParseError[];
	warnings: string[];
	totalRows: number;
	parsedRows: number;
	skippedRows: number;
}

export interface ParseError {
	row: number;
	field?: string;
	message: string;
	rawData?: string;
}

export interface CSVParser {
	platform: TradingPlatform;
	name: string;
	description: string;

	/**
	 * Validate if the CSV headers match this platform's format
	 */
	validateHeaders(headers: string[]): boolean;

	/**
	 * Parse the CSV content into trades
	 */
	parse(csvContent: string): Promise<ParseResult>;

	/**
	 * Get expected column mappings for this platform
	 */
	getExpectedColumns(): string[];
}
