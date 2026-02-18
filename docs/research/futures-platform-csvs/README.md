# Futures Platform CSV Research (Verified Feb 18, 2026)

Scope for this pack: futures-focused platforms planned in `ROADMAP.md` parser expansion and active import needs.

Included platforms:
- ProjectX
- TopstepX
- NinjaTrader
- Tradovate
- Rithmic (R | Trader)
- Apex (via Rithmic export format)

## What was collected

### Canonical CSV samples
- `docs/research/futures-platform-csvs/platforms/projectx.csv`
- `docs/research/futures-platform-csvs/platforms/topstepx.csv`
- `docs/research/futures-platform-csvs/platforms/ninjatrader.csv`
- `docs/research/futures-platform-csvs/platforms/tradovate.csv`
- `docs/research/futures-platform-csvs/platforms/rithmic-rtrader-full.csv`
- `docs/research/futures-platform-csvs/platforms/apex-via-rithmic-completed-orders.csv`

### Raw downloaded samples
- `docs/research/futures-platform-csvs/raw/`

### Source/metadata
- `docs/research/futures-platform-csvs/manifest.json`
- `docs/research/futures-platform-csvs/platform-research.csv`

## Deep-research highlights by platform

1. ProjectX
- Export path: Trades tab -> Export.
- Known schema: `Id, ContractName, EnteredAt, ExitedAt, EntryPrice, ExitPrice, Fees, PnL, Size, Type`.
- Notes: official ProjectX API uses camelCase (`contractName`, `enteredAt`, etc.); CSVs in ecosystem often PascalCase.

2. TopstepX
- Export path: Trades tab (not Orders tab) -> Export.
- Schema observed: ProjectX schema plus `TradeDay`.
- Notes: sample includes futures symbols with contract months (`NQM4`).

3. NinjaTrader
- Export path: Control Center -> Account Performance -> Trade Performance -> Display: Executions -> Export CSV.
- Schema observed: `Instrument,Action,Quantity,Price,Time,ID,E/X,Position,Order ID,Name,Commission,Rate,Account,Connection`.
- Notes: column names align with TradeZella import requirements; trailing comma appears in exported header row.

4. Tradovate
- Export path: Accounts tab -> account settings -> Orders tab -> Download Report.
- Schema observed: `orderId,Account,Order ID,B/S,...` (29 columns in sample).
- Notes: commissions are not present in this export by default (important for net P&L).

5. Rithmic (R | Trader)
- Export path: File -> Orders History -> Completed Orders -> add required columns -> export CSV.
- Schema observed: file includes `Working Orders` and `Completed Orders` sections. Completed section header is parser-critical.
- Notes: canonical parser input should target Completed Orders section only.

6. Apex
- No unique Apex-native CSV format confirmed.
- Apex platform options are broker/feed dependent (commonly Rithmic/Tradovate paths), so Apex CSV handling should route to underlying platform parser.
- Included sample is `apex-via-rithmic-completed-orders.csv` (real account IDs prefixed `APEX-`).

## Confidence and caveats
- High confidence: NinjaTrader, Tradovate, Rithmic, TopstepX (direct sample files captured).
- Medium-high confidence: ProjectX (official export/API docs; sample normalized from TopstepX-compatible format).
- Medium confidence: Apex as a standalone CSV format (no distinct Apex CSV found; mapped to underlying platform exports).
