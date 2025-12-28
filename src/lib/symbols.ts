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
// FOREX SPECIFICATIONS
// Pip sizes and values per standard lot
// ============================================

export interface ForexSpec {
	symbol: string;
	pipSize: number; // Size of 1 pip (0.0001 for most, 0.01 for JPY pairs)
	pipValuePerLot: number; // USD value of 1 pip per standard lot (approximate, varies with rates)
	baseCurrency: string;
	quoteCurrency: string;
}

export const FOREX_SPECS: Record<string, ForexSpec> = {
	// Major pairs (USD quote = fixed pip value)
	"EUR/USD": {
		symbol: "EUR/USD",
		pipSize: 0.0001,
		pipValuePerLot: 10,
		baseCurrency: "EUR",
		quoteCurrency: "USD",
	},
	"GBP/USD": {
		symbol: "GBP/USD",
		pipSize: 0.0001,
		pipValuePerLot: 10,
		baseCurrency: "GBP",
		quoteCurrency: "USD",
	},
	"AUD/USD": {
		symbol: "AUD/USD",
		pipSize: 0.0001,
		pipValuePerLot: 10,
		baseCurrency: "AUD",
		quoteCurrency: "USD",
	},
	"NZD/USD": {
		symbol: "NZD/USD",
		pipSize: 0.0001,
		pipValuePerLot: 10,
		baseCurrency: "NZD",
		quoteCurrency: "USD",
	},
	// USD base pairs (pip value varies with exchange rate)
	"USD/JPY": {
		symbol: "USD/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "USD",
		quoteCurrency: "JPY",
	},
	"USD/CHF": {
		symbol: "USD/CHF",
		pipSize: 0.0001,
		pipValuePerLot: 11.2,
		baseCurrency: "USD",
		quoteCurrency: "CHF",
	},
	"USD/CAD": {
		symbol: "USD/CAD",
		pipSize: 0.0001,
		pipValuePerLot: 7.4,
		baseCurrency: "USD",
		quoteCurrency: "CAD",
	},
	// Cross pairs
	"EUR/JPY": {
		symbol: "EUR/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "EUR",
		quoteCurrency: "JPY",
	},
	"GBP/JPY": {
		symbol: "GBP/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "GBP",
		quoteCurrency: "JPY",
	},
	"AUD/JPY": {
		symbol: "AUD/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "AUD",
		quoteCurrency: "JPY",
	},
	"NZD/JPY": {
		symbol: "NZD/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "NZD",
		quoteCurrency: "JPY",
	},
	"CAD/JPY": {
		symbol: "CAD/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "CAD",
		quoteCurrency: "JPY",
	},
	"CHF/JPY": {
		symbol: "CHF/JPY",
		pipSize: 0.01,
		pipValuePerLot: 9.1,
		baseCurrency: "CHF",
		quoteCurrency: "JPY",
	},
	"EUR/GBP": {
		symbol: "EUR/GBP",
		pipSize: 0.0001,
		pipValuePerLot: 12.5,
		baseCurrency: "EUR",
		quoteCurrency: "GBP",
	},
	"EUR/AUD": {
		symbol: "EUR/AUD",
		pipSize: 0.0001,
		pipValuePerLot: 6.5,
		baseCurrency: "EUR",
		quoteCurrency: "AUD",
	},
	"EUR/CAD": {
		symbol: "EUR/CAD",
		pipSize: 0.0001,
		pipValuePerLot: 7.4,
		baseCurrency: "EUR",
		quoteCurrency: "CAD",
	},
	"EUR/CHF": {
		symbol: "EUR/CHF",
		pipSize: 0.0001,
		pipValuePerLot: 11.2,
		baseCurrency: "EUR",
		quoteCurrency: "CHF",
	},
	"EUR/NZD": {
		symbol: "EUR/NZD",
		pipSize: 0.0001,
		pipValuePerLot: 5.9,
		baseCurrency: "EUR",
		quoteCurrency: "NZD",
	},
	"GBP/AUD": {
		symbol: "GBP/AUD",
		pipSize: 0.0001,
		pipValuePerLot: 6.5,
		baseCurrency: "GBP",
		quoteCurrency: "AUD",
	},
	"GBP/CAD": {
		symbol: "GBP/CAD",
		pipSize: 0.0001,
		pipValuePerLot: 7.4,
		baseCurrency: "GBP",
		quoteCurrency: "CAD",
	},
	"GBP/CHF": {
		symbol: "GBP/CHF",
		pipSize: 0.0001,
		pipValuePerLot: 11.2,
		baseCurrency: "GBP",
		quoteCurrency: "CHF",
	},
	"GBP/NZD": {
		symbol: "GBP/NZD",
		pipSize: 0.0001,
		pipValuePerLot: 5.9,
		baseCurrency: "GBP",
		quoteCurrency: "NZD",
	},
	"AUD/CAD": {
		symbol: "AUD/CAD",
		pipSize: 0.0001,
		pipValuePerLot: 7.4,
		baseCurrency: "AUD",
		quoteCurrency: "CAD",
	},
	"AUD/CHF": {
		symbol: "AUD/CHF",
		pipSize: 0.0001,
		pipValuePerLot: 11.2,
		baseCurrency: "AUD",
		quoteCurrency: "CHF",
	},
	"AUD/NZD": {
		symbol: "AUD/NZD",
		pipSize: 0.0001,
		pipValuePerLot: 5.9,
		baseCurrency: "AUD",
		quoteCurrency: "NZD",
	},
	"NZD/CAD": {
		symbol: "NZD/CAD",
		pipSize: 0.0001,
		pipValuePerLot: 7.4,
		baseCurrency: "NZD",
		quoteCurrency: "CAD",
	},
	"NZD/CHF": {
		symbol: "NZD/CHF",
		pipSize: 0.0001,
		pipValuePerLot: 11.2,
		baseCurrency: "NZD",
		quoteCurrency: "CHF",
	},
	"CAD/CHF": {
		symbol: "CAD/CHF",
		pipSize: 0.0001,
		pipValuePerLot: 11.2,
		baseCurrency: "CAD",
		quoteCurrency: "CHF",
	},
};

/**
 * Get forex spec for a symbol
 */
export function getForexSpec(symbol: string): ForexSpec | null {
	return FOREX_SPECS[symbol] ?? null;
}

/**
 * Get pip size for forex pair
 */
export function getForexPipSize(symbol: string): number {
	const spec = FOREX_SPECS[symbol];
	if (spec) return spec.pipSize;
	// Fallback: JPY pairs have 2 decimal places
	if (symbol.includes("JPY")) return 0.01;
	return 0.0001;
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
// FOREX SYMBOLS
// ============================================

export const FOREX_SYMBOLS: SymbolInfo[] = [
	// Majors
	{ value: "EUR/USD", label: "EUR/USD - Euro/US Dollar", category: "Majors" },
	{
		value: "GBP/USD",
		label: "GBP/USD - British Pound/US Dollar",
		category: "Majors",
	},
	{
		value: "USD/JPY",
		label: "USD/JPY - US Dollar/Japanese Yen",
		category: "Majors",
	},
	{
		value: "USD/CHF",
		label: "USD/CHF - US Dollar/Swiss Franc",
		category: "Majors",
	},
	{
		value: "AUD/USD",
		label: "AUD/USD - Australian Dollar/US Dollar",
		category: "Majors",
	},
	{
		value: "USD/CAD",
		label: "USD/CAD - US Dollar/Canadian Dollar",
		category: "Majors",
	},
	{
		value: "NZD/USD",
		label: "NZD/USD - New Zealand Dollar/US Dollar",
		category: "Majors",
	},
	// JPY Crosses
	{ value: "EUR/JPY", label: "EUR/JPY - Euro/Yen", category: "JPY Crosses" },
	{ value: "GBP/JPY", label: "GBP/JPY - Pound/Yen", category: "JPY Crosses" },
	{ value: "AUD/JPY", label: "AUD/JPY - Aussie/Yen", category: "JPY Crosses" },
	{ value: "NZD/JPY", label: "NZD/JPY - Kiwi/Yen", category: "JPY Crosses" },
	{ value: "CAD/JPY", label: "CAD/JPY - Loonie/Yen", category: "JPY Crosses" },
	{ value: "CHF/JPY", label: "CHF/JPY - Swissy/Yen", category: "JPY Crosses" },
	// EUR Crosses
	{ value: "EUR/GBP", label: "EUR/GBP - Euro/Pound", category: "EUR Crosses" },
	{ value: "EUR/AUD", label: "EUR/AUD - Euro/Aussie", category: "EUR Crosses" },
	{ value: "EUR/CAD", label: "EUR/CAD - Euro/Loonie", category: "EUR Crosses" },
	{ value: "EUR/CHF", label: "EUR/CHF - Euro/Swissy", category: "EUR Crosses" },
	{ value: "EUR/NZD", label: "EUR/NZD - Euro/Kiwi", category: "EUR Crosses" },
	// GBP Crosses
	{
		value: "GBP/AUD",
		label: "GBP/AUD - Pound/Aussie",
		category: "GBP Crosses",
	},
	{
		value: "GBP/CAD",
		label: "GBP/CAD - Pound/Loonie",
		category: "GBP Crosses",
	},
	{
		value: "GBP/CHF",
		label: "GBP/CHF - Pound/Swissy",
		category: "GBP Crosses",
	},
	{ value: "GBP/NZD", label: "GBP/NZD - Pound/Kiwi", category: "GBP Crosses" },
	// Other Crosses
	{
		value: "AUD/CAD",
		label: "AUD/CAD - Aussie/Loonie",
		category: "Other Crosses",
	},
	{
		value: "AUD/CHF",
		label: "AUD/CHF - Aussie/Swissy",
		category: "Other Crosses",
	},
	{
		value: "AUD/NZD",
		label: "AUD/NZD - Aussie/Kiwi",
		category: "Other Crosses",
	},
	{
		value: "NZD/CAD",
		label: "NZD/CAD - Kiwi/Loonie",
		category: "Other Crosses",
	},
	{
		value: "NZD/CHF",
		label: "NZD/CHF - Kiwi/Swissy",
		category: "Other Crosses",
	},
	{
		value: "CAD/CHF",
		label: "CAD/CHF - Loonie/Swissy",
		category: "Other Crosses",
	},
];

// ============================================
// ALL SYMBOLS (Combined)
// ============================================

export const ALL_SYMBOLS = [...FUTURES_SYMBOLS, ...FOREX_SYMBOLS];

// ============================================
// SYMBOL MAPPING FOR DATA PROVIDERS
// Maps our symbols to provider-specific formats
// ============================================

export const TWELVE_DATA_SYMBOL_MAP: Record<string, string> = {
	// Futures -> Twelve Data continuous contract format
	...Object.fromEntries(FUTURES_SYMBOLS.map((s) => [s.value, `${s.value}1!`])),
	// Forex stays the same
	...Object.fromEntries(FOREX_SYMBOLS.map((s) => [s.value, s.value])),
};

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
	// Forex pairs (FX exchange)
	"EUR/USD": "FX:EURUSD",
	"GBP/USD": "FX:GBPUSD",
	"USD/JPY": "FX:USDJPY",
	"USD/CHF": "FX:USDCHF",
	"AUD/USD": "FX:AUDUSD",
	"USD/CAD": "FX:USDCAD",
	"NZD/USD": "FX:NZDUSD",
	"EUR/JPY": "FX:EURJPY",
	"GBP/JPY": "FX:GBPJPY",
	"AUD/JPY": "FX:AUDJPY",
	"NZD/JPY": "FX:NZDJPY",
	"CAD/JPY": "FX:CADJPY",
	"CHF/JPY": "FX:CHFJPY",
	"EUR/GBP": "FX:EURGBP",
	"EUR/AUD": "FX:EURAUD",
	"EUR/CAD": "FX:EURCAD",
	"EUR/CHF": "FX:EURCHF",
	"EUR/NZD": "FX:EURNZD",
	"GBP/AUD": "FX:GBPAUD",
	"GBP/CAD": "FX:GBPCAD",
	"GBP/CHF": "FX:GBPCHF",
	"GBP/NZD": "FX:GBPNZD",
	"AUD/CAD": "FX:AUDCAD",
	"AUD/CHF": "FX:AUDCHF",
	"AUD/NZD": "FX:AUDNZD",
	"NZD/CAD": "FX:NZDCAD",
	"NZD/CHF": "FX:NZDCHF",
	"CAD/CHF": "FX:CADCHF",
};

/**
 * Convert our symbol to TradingView format
 * @param symbol - Our internal symbol (e.g., "ES", "EUR/USD", "MNQH24")
 * @returns TradingView formatted symbol (e.g., "CME_MINI:ES1!", "FX:EURUSD")
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

export function getSymbolsByType(type: "futures" | "forex"): SymbolInfo[] {
	return type === "futures" ? FUTURES_SYMBOLS : FOREX_SYMBOLS;
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
 * Calculate P&L for a forex/CFD trade
 * @param symbol - The forex pair (e.g., "EUR/USD")
 * @param entryPrice - Entry price
 * @param exitPrice - Exit price
 * @param lotSize - Lot size (1 = standard lot, 0.1 = mini, 0.01 = micro)
 * @param direction - "long" or "short"
 * @returns P&L in USD (approximate, uses static pip values)
 */
export function calculateForexPnL(
	symbol: string,
	entryPrice: number,
	exitPrice: number,
	lotSize: number,
	direction: "long" | "short",
): number {
	const spec = FOREX_SPECS[symbol];
	if (!spec) {
		console.warn(`No forex spec found for ${symbol}, using raw calculation`);
		const priceDiff =
			direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
		return priceDiff * lotSize * 100000; // Assume standard lot size
	}

	const priceDiff =
		direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
	const pips = priceDiff / spec.pipSize;
	// lotSize of 1 = standard lot (100k units), pip value is per standard lot
	return pips * spec.pipValuePerLot * lotSize;
}

/**
 * Calculate P&L for any trade based on instrument type
 */
export function calculatePnL(
	symbol: string,
	instrumentType: "futures" | "forex",
	entryPrice: number,
	exitPrice: number,
	quantity: number, // contracts for futures, lots for forex
	direction: "long" | "short",
): number {
	if (instrumentType === "futures") {
		return calculateFuturesPnL(
			symbol,
			entryPrice,
			exitPrice,
			quantity,
			direction,
		);
	}
	return calculateForexPnL(symbol, entryPrice, exitPrice, quantity, direction);
}

/**
 * Get the point/pip value for a symbol
 */
export function getPointValue(
	symbol: string,
	instrumentType: "futures" | "forex",
): number {
	if (instrumentType === "futures") {
		return getFuturesSpec(symbol)?.pointValue ?? 1;
	}
	return FOREX_SPECS[symbol]?.pipValuePerLot ?? 10;
}

/**
 * Get tick/pip size for a symbol
 */
export function getTickSize(
	symbol: string,
	instrumentType: "futures" | "forex",
): number {
	if (instrumentType === "futures") {
		return getFuturesSpec(symbol)?.tickSize ?? 0.01;
	}
	return FOREX_SPECS[symbol]?.pipSize ?? 0.0001;
}
