// ============================================
// Shared Symbol Definitions
// ============================================

export interface SymbolInfo {
	value: string;
	label: string;
	category?: string;
}

// ============================================
// FUTURES CONTRACT SPECIFICATIONS
// Tick size, tick value, and point value per contract
// ============================================

export interface FuturesSpec {
	tickSize: number; // Minimum price increment
	tickValue: number; // USD value per tick per contract
	pointValue: number; // USD value per full point per contract
}

export const FUTURES_SPECS: Record<string, FuturesSpec> = {
	// Equities - E-mini
	ES: { tickSize: 0.25, tickValue: 12.5, pointValue: 50 },
	NQ: { tickSize: 0.25, tickValue: 5.0, pointValue: 20 },
	YM: { tickSize: 1, tickValue: 5.0, pointValue: 5 },
	RTY: { tickSize: 0.1, tickValue: 5.0, pointValue: 50 },
	// Equities - Micro
	MES: { tickSize: 0.25, tickValue: 1.25, pointValue: 5 },
	MNQ: { tickSize: 0.25, tickValue: 0.5, pointValue: 2 },
	MYM: { tickSize: 1, tickValue: 0.5, pointValue: 0.5 },
	M2K: { tickSize: 0.1, tickValue: 0.5, pointValue: 5 },
	// International
	NKD: { tickSize: 5, tickValue: 25, pointValue: 5 },
	// Energy
	CL: { tickSize: 0.01, tickValue: 10.0, pointValue: 1000 },
	MCL: { tickSize: 0.01, tickValue: 1.0, pointValue: 100 },
	NG: { tickSize: 0.001, tickValue: 10.0, pointValue: 10000 },
	MNG: { tickSize: 0.001, tickValue: 1.0, pointValue: 1000 },
	// Metals
	GC: { tickSize: 0.1, tickValue: 10.0, pointValue: 100 },
	MGC: { tickSize: 0.1, tickValue: 1.0, pointValue: 10 },
	SI: { tickSize: 0.005, tickValue: 25.0, pointValue: 5000 },
	SIL: { tickSize: 0.005, tickValue: 2.5, pointValue: 500 },
	// Currencies - Standard
	"6A": { tickSize: 0.0001, tickValue: 10.0, pointValue: 100000 },
	"6B": { tickSize: 0.0001, tickValue: 6.25, pointValue: 62500 },
	"6C": { tickSize: 0.00005, tickValue: 5.0, pointValue: 100000 },
	"6E": { tickSize: 0.00005, tickValue: 6.25, pointValue: 125000 },
	"6J": { tickSize: 0.0000005, tickValue: 6.25, pointValue: 12500000 },
	"6M": { tickSize: 0.000005, tickValue: 2.5, pointValue: 500000 },
	"6N": { tickSize: 0.0001, tickValue: 10.0, pointValue: 100000 },
	"6S": { tickSize: 0.0001, tickValue: 12.5, pointValue: 125000 },
	// Currencies - Micro
	M6A: { tickSize: 0.0001, tickValue: 1.0, pointValue: 10000 },
	M6B: { tickSize: 0.0001, tickValue: 0.625, pointValue: 6250 },
	M6E: { tickSize: 0.0001, tickValue: 1.25, pointValue: 12500 },
	MCD: { tickSize: 0.0001, tickValue: 1.0, pointValue: 10000 },
	MSF: { tickSize: 0.0001, tickValue: 1.25, pointValue: 12500 },
	MBT: { tickSize: 5, tickValue: 0.5, pointValue: 0.1 },
	// Interest Rates
	ZB: { tickSize: 0.03125, tickValue: 31.25, pointValue: 1000 },
	ZN: { tickSize: 0.015625, tickValue: 15.625, pointValue: 1000 },
	ZF: { tickSize: 0.0078125, tickValue: 7.8125, pointValue: 1000 },
	ZT: { tickSize: 0.0078125, tickValue: 15.625, pointValue: 2000 },
	TN: { tickSize: 0.015625, tickValue: 15.625, pointValue: 1000 },
	UB: { tickSize: 0.03125, tickValue: 31.25, pointValue: 1000 },
	// Agriculture - Grains
	ZC: { tickSize: 0.25, tickValue: 12.5, pointValue: 50 },
	XC: { tickSize: 0.125, tickValue: 1.25, pointValue: 10 },
	ZW: { tickSize: 0.25, tickValue: 12.5, pointValue: 50 },
	ZO: { tickSize: 0.25, tickValue: 12.5, pointValue: 50 },
	ZR: { tickSize: 0.005, tickValue: 10.0, pointValue: 2000 },
	// Agriculture - Soy
	ZS: { tickSize: 0.25, tickValue: 12.5, pointValue: 50 },
	ZL: { tickSize: 0.01, tickValue: 6.0, pointValue: 600 },
	ZM: { tickSize: 0.1, tickValue: 10.0, pointValue: 100 },
	// Livestock
	LE: { tickSize: 0.025, tickValue: 10.0, pointValue: 400 },
	GF: { tickSize: 0.025, tickValue: 12.5, pointValue: 500 },
	HE: { tickSize: 0.025, tickValue: 10.0, pointValue: 400 },
};

/**
 * Get futures spec for a symbol (handles month codes like MNQ, MNQH24, MNQH2024)
 */
export function getFuturesSpec(symbol: string): FuturesSpec | null {
	// Try exact match first
	if (FUTURES_SPECS[symbol]) return FUTURES_SPECS[symbol];

	// Strip month/year codes (e.g., MNQH24 -> MNQ, ESZ2024 -> ES)
	const baseSymbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2,4}$/, "");
	return FUTURES_SPECS[baseSymbol] ?? null;
}

// ============================================
// FUTURES SYMBOLS
// ============================================

export const FUTURES_SYMBOLS: SymbolInfo[] = [
	// Equities - US Index
	{ value: "ES", label: "ES - S&P 500", category: "Equities" },
	{ value: "NQ", label: "NQ - Nasdaq 100", category: "Equities" },
	{ value: "YM", label: "YM - Dow Jones", category: "Equities" },
	{ value: "RTY", label: "RTY - Russell 2000", category: "Equities" },
	// Equities - Micro Index
	{ value: "MES", label: "MES - Micro S&P 500", category: "Equities" },
	{ value: "MNQ", label: "MNQ - Micro Nasdaq", category: "Equities" },
	{ value: "MYM", label: "MYM - Micro Dow", category: "Equities" },
	{ value: "M2K", label: "M2K - Micro Russell 2000", category: "Equities" },
	// Equities - International
	{ value: "NKD", label: "NKD - Nikkei Dollar Index", category: "Equities" },
	// Energy
	{ value: "CL", label: "CL - Crude Oil", category: "Energy" },
	{ value: "MCL", label: "MCL - Micro Crude Oil", category: "Energy" },
	{ value: "NG", label: "NG - Natural Gas", category: "Energy" },
	{ value: "MNG", label: "MNG - Micro Natural Gas", category: "Energy" },
	// Metals
	{ value: "GC", label: "GC - Gold", category: "Metals" },
	{ value: "MGC", label: "MGC - Micro Gold", category: "Metals" },
	{ value: "SI", label: "SI - Silver", category: "Metals" },
	{ value: "SIL", label: "SIL - Micro Silver", category: "Metals" },
	// Currencies - Standard
	{ value: "6A", label: "6A - Australian Dollar", category: "Currencies" },
	{ value: "6B", label: "6B - British Pound", category: "Currencies" },
	{ value: "6C", label: "6C - Canadian Dollar", category: "Currencies" },
	{ value: "6E", label: "6E - Euro", category: "Currencies" },
	{ value: "6J", label: "6J - Japanese Yen", category: "Currencies" },
	{ value: "6M", label: "6M - Mexican Peso", category: "Currencies" },
	{ value: "6N", label: "6N - New Zealand Dollar", category: "Currencies" },
	{ value: "6S", label: "6S - Swiss Franc", category: "Currencies" },
	// Currencies - Micro
	{ value: "M6A", label: "M6A - Micro AUD", category: "Currencies" },
	{ value: "M6B", label: "M6B - Micro GBP", category: "Currencies" },
	{ value: "M6E", label: "M6E - Micro EUR", category: "Currencies" },
	{ value: "MCD", label: "MCD - Micro CAD", category: "Currencies" },
	{ value: "MSF", label: "MSF - Micro CHF", category: "Currencies" },
	{ value: "MBT", label: "MBT - Micro Bitcoin", category: "Currencies" },
	// Interest Rates
	{ value: "ZB", label: "ZB - 30-Year Treasury", category: "Interest Rates" },
	{ value: "ZN", label: "ZN - 10-Year Treasury", category: "Interest Rates" },
	{ value: "ZF", label: "ZF - 5-Year Treasury", category: "Interest Rates" },
	{ value: "ZT", label: "ZT - 2-Year Treasury", category: "Interest Rates" },
	{ value: "TN", label: "TN - T-Note", category: "Interest Rates" },
	{ value: "UB", label: "UB - Ultra 10-Year", category: "Interest Rates" },
	// Agriculture - Grains
	{ value: "ZC", label: "ZC - Corn", category: "Agriculture" },
	{ value: "XC", label: "XC - Mini Corn", category: "Agriculture" },
	{ value: "ZW", label: "ZW - Wheat", category: "Agriculture" },
	{ value: "ZO", label: "ZO - Oats", category: "Agriculture" },
	{ value: "ZR", label: "ZR - Rough Rice", category: "Agriculture" },
	// Agriculture - Soy
	{ value: "ZS", label: "ZS - Soybeans", category: "Agriculture" },
	{ value: "ZL", label: "ZL - Soybean Oil", category: "Agriculture" },
	{ value: "ZM", label: "ZM - Soybean Meal", category: "Agriculture" },
	// Livestock
	{ value: "LE", label: "LE - Live Cattle", category: "Livestock" },
	{ value: "GF", label: "GF - Feeder Cattle", category: "Livestock" },
	{ value: "HE", label: "HE - Lean Hogs", category: "Livestock" },
];

// ============================================
// ALL SYMBOLS
// ============================================

export const ALL_SYMBOLS = FUTURES_SYMBOLS;

// ============================================
// TRADINGVIEW SYMBOL MAPPING
// Maps our symbols to TradingView's exchange:symbol format
// ============================================

export const TRADINGVIEW_SYMBOL_MAP: Record<string, string> = {
	// Equities - E-mini (CME)
	ES: "CME_MINI:ES1!",
	NQ: "CME_MINI:NQ1!",
	YM: "CBOT_MINI:YM1!",
	RTY: "CME_MINI:RTY1!",
	// Equities - Micro (CME)
	MES: "CME_MINI:MES1!",
	MNQ: "CME_MINI:MNQ1!",
	MYM: "CBOT_MINI:MYM1!",
	M2K: "CME_MINI:M2K1!",
	// International
	NKD: "CME:NKD1!",
	// Energy (NYMEX)
	CL: "NYMEX:CL1!",
	MCL: "NYMEX:MCL1!",
	NG: "NYMEX:NG1!",
	MNG: "NYMEX:MNG1!",
	// Metals (COMEX)
	GC: "COMEX:GC1!",
	MGC: "COMEX:MGC1!",
	SI: "COMEX:SI1!",
	SIL: "COMEX:SIL1!",
	// Currency Futures (CME)
	"6A": "CME:6A1!",
	"6B": "CME:6B1!",
	"6C": "CME:6C1!",
	"6E": "CME:6E1!",
	"6J": "CME:6J1!",
	"6M": "CME:6M1!",
	"6N": "CME:6N1!",
	"6S": "CME:6S1!",
	// Micro Currency Futures
	M6A: "CME:M6A1!",
	M6B: "CME:M6B1!",
	M6E: "CME:M6E1!",
	MCD: "CME:MCD1!",
	MSF: "CME:MSF1!",
	MBT: "CME:MBT1!",
	// Interest Rates (CBOT)
	ZB: "CBOT:ZB1!",
	ZN: "CBOT:ZN1!",
	ZF: "CBOT:ZF1!",
	ZT: "CBOT:ZT1!",
	TN: "CBOT:TN1!",
	UB: "CBOT:UB1!",
	// Agriculture - Grains (CBOT)
	ZC: "CBOT:ZC1!",
	XC: "CBOT:XC1!",
	ZW: "CBOT:ZW1!",
	ZO: "CBOT:ZO1!",
	ZR: "CBOT:ZR1!",
	// Agriculture - Soy (CBOT)
	ZS: "CBOT:ZS1!",
	ZL: "CBOT:ZL1!",
	ZM: "CBOT:ZM1!",
	// Livestock (CME)
	LE: "CME:LE1!",
	GF: "CME:GF1!",
	HE: "CME:HE1!",
};

/**
 * Convert our symbol to TradingView format
 * @param symbol - Our internal symbol (e.g., "ES", "MNQH24")
 * @returns TradingView formatted symbol (e.g., "CME_MINI:ES1!")
 */
export function getTradingViewSymbol(symbol: string): string {
	// Try exact match first
	if (TRADINGVIEW_SYMBOL_MAP[symbol]) {
		return TRADINGVIEW_SYMBOL_MAP[symbol];
	}

	// Strip month/year codes for futures (e.g., MNQH24 -> MNQ, ESZ2024 -> ES)
	const baseSymbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2,4}$/, "");
	if (TRADINGVIEW_SYMBOL_MAP[baseSymbol]) {
		return TRADINGVIEW_SYMBOL_MAP[baseSymbol];
	}

	// Fallback: return the symbol as-is (TradingView might still resolve it)
	return symbol;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

export function getSymbolInfo(symbol: string): SymbolInfo | undefined {
	return ALL_SYMBOLS.find((s) => s.value === symbol);
}

export function getSymbolLabel(symbol: string): string {
	return getSymbolInfo(symbol)?.label ?? symbol;
}

export function isValidSymbol(symbol: string): boolean {
	return ALL_SYMBOLS.some((s) => s.value === symbol);
}

export function getSymbolCategory(symbol: string): string | undefined {
	return getSymbolInfo(symbol)?.category;
}

// ============================================
// P&L CALCULATION FUNCTIONS
// ============================================

/**
 * Calculate P&L for a futures trade
 * @param symbol - The futures symbol (e.g., "ES", "NQ")
 * @param entryPrice - Entry price
 * @param exitPrice - Exit price
 * @param contracts - Number of contracts
 * @param direction - "long" or "short"
 * @returns P&L in USD
 */
export function calculateFuturesPnL(
	symbol: string,
	entryPrice: number,
	exitPrice: number,
	contracts: number,
	direction: "long" | "short",
): number {
	const spec = getFuturesSpec(symbol);
	if (!spec) {
		console.warn(`No contract spec found for ${symbol}, using raw calculation`);
		// Fallback: assume point value of 1
		const priceDiff =
			direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
		return priceDiff * contracts;
	}

	const priceDiff =
		direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
	return priceDiff * spec.pointValue * contracts;
}

/**
 * Get the point value for a futures symbol
 */
export function getPointValue(symbol: string): number {
	return getFuturesSpec(symbol)?.pointValue ?? 1;
}

/**
 * Get tick size for a futures symbol
 */
export function getTickSize(symbol: string): number {
	return getFuturesSpec(symbol)?.tickSize ?? 0.01;
}

// ============================================
// DATABENTO SYMBOL MAPPING
// Maps our futures symbols to Databento format
// Dataset: GLBX.MDP3 (CME Globex)
// ============================================

/**
 * Databento symbol format for CME futures
 * Uses continuous contract format: [ROOT].[ROLL_RULE].[RANK]
 * - v = volume-based roll (follows liquidity)
 * - c = calendar-based roll (nearest expiration)
 * - n = open interest-based roll
 * - 0 = front month, 1 = second month, etc.
 *
 * We use volume-based roll (.v.0) as it follows market liquidity.
 * See: https://databento.com/docs/standards-and-conventions/symbology
 *
 * Databento supports:
 * - All CME Globex products (ES, NQ, MES, MNQ, etc.)
 * - NYMEX energy products (CL, NG, etc.)
 * - COMEX metals (GC, SI, etc.)
 * - CBOT products (ZB, ZN, ZC, ZW, etc.)
 */
export const DATABENTO_SYMBOL_MAP: Record<string, string | null> = {
	// === EQUITY INDEX FUTURES (Supported) ===
	// E-mini contracts
	ES: "ES.v.0",
	NQ: "NQ.v.0",
	YM: "YM.v.0",
	RTY: "RTY.v.0",
	// Micro contracts
	MES: "MES.v.0",
	MNQ: "MNQ.v.0",
	MYM: "MYM.v.0",
	M2K: "M2K.v.0",
	// International
	NKD: "NKD.v.0",

	// === ENERGY FUTURES (Supported) ===
	CL: "CL.v.0",
	MCL: "MCL.v.0",
	NG: "NG.v.0",
	MNG: "MNG.v.0",

	// === METALS FUTURES (Supported) ===
	GC: "GC.v.0",
	MGC: "MGC.v.0",
	SI: "SI.v.0",
	SIL: "SIL.v.0",

	// === CURRENCY FUTURES (Supported) ===
	"6A": "6A.v.0",
	"6B": "6B.v.0",
	"6C": "6C.v.0",
	"6E": "6E.v.0",
	"6J": "6J.v.0",
	"6M": "6M.v.0",
	"6N": "6N.v.0",
	"6S": "6S.v.0",
	// Micro currency futures
	M6A: "M6A.v.0",
	M6B: "M6B.v.0",
	M6E: "M6E.v.0",
	MCD: "MCD.v.0",
	MSF: "MSF.v.0",
	MBT: "MBT.v.0",

	// === INTEREST RATE FUTURES (Supported) ===
	ZB: "ZB.v.0",
	ZN: "ZN.v.0",
	ZF: "ZF.v.0",
	ZT: "ZT.v.0",
	TN: "TN.v.0",
	UB: "UB.v.0",

	// === AGRICULTURE FUTURES (Supported) ===
	ZC: "ZC.v.0",
	XC: "XC.v.0",
	ZW: "ZW.v.0",
	ZO: "ZO.v.0",
	ZR: "ZR.v.0",
	ZS: "ZS.v.0",
	ZL: "ZL.v.0",
	ZM: "ZM.v.0",
	LE: "LE.v.0",
	GF: "GF.v.0",
	HE: "HE.v.0",
};

/**
 * Check if a symbol is a futures contract (supported by Databento)
 */
export function isFuturesSymbol(symbol: string): boolean {
	// Check if it's in FUTURES_SPECS or matches a futures pattern
	const baseSymbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2,4}$/, "");
	return (
		FUTURES_SPECS[baseSymbol] !== undefined ||
		FUTURES_SPECS[symbol] !== undefined
	);
}

/**
 * Get Databento symbol for a futures contract
 * Handles month codes like MNQH24, ESZ2024
 */
export function getDatabentSymbol(symbol: string): string | null {
	// Try exact match first
	if (DATABENTO_SYMBOL_MAP[symbol] !== undefined) {
		return DATABENTO_SYMBOL_MAP[symbol];
	}

	// Strip month/year codes (e.g., MNQH24 -> MNQ, ESZ2024 -> ES)
	const baseSymbol = symbol.replace(/[FGHJKMNQUVXZ]\d{2,4}$/, "");
	if (DATABENTO_SYMBOL_MAP[baseSymbol] !== undefined) {
		return DATABENTO_SYMBOL_MAP[baseSymbol];
	}

	// Unknown symbol - assume it might be a futures symbol
	// Return with continuous contract format (.v.0 = volume-based, front month)
	if (isFuturesSymbol(symbol)) {
		return `${baseSymbol || symbol}.v.0`;
	}

	return null;
}
