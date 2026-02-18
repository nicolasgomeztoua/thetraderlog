# Deep Research: Futures CSV Import Targets

Verified on: 2026-02-18

## Scope
Futures-oriented platform coverage from roadmap/parser expansion planning:
- ProjectX
- TopstepX
- NinjaTrader
- Tradovate
- Rithmic (R | Trader)
- Apex (as underlying Rithmic/Tradovate workflows)

## ProjectX
- Sample file: `docs/research/futures-platform-csvs/platforms/projectx.csv`
- Export workflow: Trades tab -> Export.
- Header pattern: `Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type`
- Data shape: one row per closed trade; includes both entry and exit timestamps/prices.
- Parser implications:
  - `ContractName` includes expiration code (for example `NQM4`) and should be normalized to base symbol when needed.
  - Timestamp values include timezone offsets in many exports.
  - `Type` maps directly to long/short.
- Confidence: medium-high (official docs + API schema + ecosystem sample alignment).
- Sources:
  - https://help.projectx.com/en/articles/10894496-exporting-your-trade-history
  - https://docs.projectx.com/api-reference/rest-api/trades/get-trade-history
  - https://help.tradezella.com/en/articles/11943188-projectx-how-to-import-trades-from-projectx-prop-firms-platforms-into-tradezella-using-the-file-upload-method

## TopstepX
- Sample file: `docs/research/futures-platform-csvs/platforms/topstepx.csv`
- Export workflow: Trades tab -> Export (not Orders tab).
- Header pattern: `Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay`
- Data shape: ProjectX-like trade rows with extra `TradeDay` field.
- Parser implications:
  - Reuse ProjectX parser logic with optional `TradeDay` passthrough/ignore.
  - Contract code normalization is identical to ProjectX.
- Confidence: high (live CSV sample captured).
- Sources:
  - https://help.tradezella.com/en/articles/9557681-topstepx-how-to-import-trades-from-topstepx-into-tradezella-using-the-file-upload-method

## NinjaTrader
- Sample file: `docs/research/futures-platform-csvs/platforms/ninjatrader.csv`
- Export workflow: Control Center -> Account Performance -> Trade Performance -> Display: Executions -> Export CSV.
- Header pattern: `Instrument,Action,Quantity,Price,Time,ID,E/X,Position,Order ID,Name,Commission,Rate,Account,Connection`
- Data shape: execution-level rows (entries/exits), not always one row per round-trip trade.
- Parser implications:
  - Need execution aggregation logic to build round-trip trades.
  - `E/X` marks entry vs exit; `Action` gives buy/sell; both are required to infer direction.
  - Trailing comma appears in header and row lines in sample exports.
- Confidence: high (official docs + live import sample).
- Sources:
  - https://ninjatrader.com/support/helpGuides/nt8/trades_display.htm
  - https://help.tradezella.com/en/articles/6499264-ninjatrader-how-to-import-trades-from-ninjatrader-into-tradezella-using-the-file-upload-method

## Tradovate
- Sample file: `docs/research/futures-platform-csvs/platforms/tradovate.csv`
- Export workflow: Accounts tab -> account settings -> Orders tab -> Download Report.
- Header pattern: order-centric schema (`orderId`, `B/S`, `Contract`, `Status`, `Type`, etc.; 29 columns in sample).
- Data shape: order-level export containing filled and canceled rows.
- Parser implications:
  - Must filter by status/state and handle canceled orders.
  - Need fill consolidation to produce trade records.
  - Commission is typically absent in this CSV flow, so fees may need defaults/manual rules.
- Confidence: high (official workflow + live sample).
- Sources:
  - https://docs.tradovate.com/hc/en-us/articles/21504115534099-Trading-Other-Items-in-the-Accounts-Tab
  - https://help.tradezella.com/en/articles/6472250-tradovate-how-to-import-trades-from-tradovate-into-tradezella-using-the-file-upload-method

## Rithmic (R | Trader)
- Sample files:
  - `docs/research/futures-platform-csvs/platforms/rithmic-rtrader-full.csv`
  - `docs/research/futures-platform-csvs/platforms/apex-via-rithmic-completed-orders.csv`
- Export workflow: File -> Orders History -> Completed Orders section -> add required columns -> export CSV.
- Header pattern:
  - Mixed file sections (`Working Orders` and `Completed Orders`)
  - Completed section starts with `Account,Status,Remarks,Buy/Sell,Qty To Fill,...`
- Data shape: order rows with filled/canceled statuses.
- Parser implications:
  - Detect section boundaries and parse Completed Orders only.
  - Filter to filled rows, then aggregate by symbol/time/order where needed.
  - Commission field can be empty; `Commission Fill Rate` may exist even if `Commission` is blank.
- Confidence: high (live sample + implementation guides).
- Sources:
  - https://help.tradezella.com/en/articles/6839918-rithmic-r-trader-how-to-import-trades-from-rithmic-r-trader-into-tradezella-using-the-file-upload-method
  - https://www.tradesviz.com/blog/import-rithmic/

## Apex
- Sample file: `docs/research/futures-platform-csvs/platforms/apex-via-rithmic-completed-orders.csv`
- Research finding: no distinct Apex-only CSV schema confirmed.
- Platform reality: Apex accounts run through platform/feed options (commonly Rithmic/Tradovate/others), so export format follows that underlying platform.
- Parser implications:
  - Do not build Apex parser as wholly separate schema unless a native Apex export is confirmed.
  - Route Apex imports through detected underlying CSV schema (Rithmic/Tradovate/ProjectX-style) based on headers.
- Confidence: medium.
- Sources:
  - https://support.apextraderfunding.com/hc/en-us/articles/21823634644123-What-are-the-different-platform-options-at-Apex
  - https://help.tradezella.com/en/articles/6839918-rithmic-r-trader-how-to-import-trades-from-rithmic-r-trader-into-tradezella-using-the-file-upload-method
  - https://help.tradezella.com/en/articles/6472250-tradovate-how-to-import-trades-from-tradovate-into-tradezella-using-the-file-upload-method

## Coverage Notes
- Also captured (outside core futures scope): `docs/research/futures-platform-csvs/raw/tradingview.csv`.
- No dedicated Apex attachment/sample was found; Apex sample here is a real Rithmic export containing `APEX-` account identifiers.
