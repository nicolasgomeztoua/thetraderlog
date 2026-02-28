---
name: consistency-audit
description: Detect duplicated logic and inconsistent implementations across the codebase.
---

# Consistency Audit Skill (AI Slop Detector)

Detect duplicated calculations, repeated utilities, and inconsistent implementations across the codebase that could lead to bugs like the R-multiple calculation mismatch.

## Background

AI-assisted development can introduce "slop" - similar implementations of the same logic scattered across the codebase. The R-multiple bug is a perfect example: the same calculation was implemented 3 different ways in journal display, trades router filter, and analytics router, causing filters to exclude trades that should match.

## When to Use
- After significant AI-assisted development sessions
- Before major releases
- When adding new calculations or utilities
- Periodic codebase health checks
- After fixing bugs caused by inconsistent implementations

## Audit Strategy

### Phase 1: Backend Calculations Audit
**Scope**: `src/server/api/routers/`, `src/lib/analytics/`, `src/lib/trades/`

Look for:
- [ ] Duplicate P&L calculations
- [ ] Duplicate R-multiple/risk calculations
- [ ] Duplicate point value lookups
- [ ] Duplicate currency/decimal formatting
- [ ] Duplicate date/time calculations
- [ ] Inline calculations that should use shared utilities

**Search patterns**:
```bash
# P&L calculations
grep -rn "parseFloat.*netPnl\|netPnl.*parseFloat" src/server/ src/lib/
grep -rn "grossPnl\|gross.*pnl\|pnl.*gross" src/

# Risk calculations
grep -rn "stopLoss.*entry\|entry.*stopLoss" src/
grep -rn "Math.abs.*entry\|Math.abs.*stop" src/

# Point value lookups
grep -rn "pointValue\|getPointValue\|FUTURES_SPECS" src/

# R-multiple patterns
grep -rn "rMultiple\|r-multiple\|R-Multiple" src/
```

### Phase 2: Frontend Display Audit
**Scope**: `src/app/(protected)/`, `src/components/`

Look for:
- [ ] Inline calculations that duplicate backend logic
- [ ] Inconsistent number formatting (decimals, currency)
- [ ] Duplicate color logic (profit/loss coloring)
- [ ] Inline date formatting vs shared utilities
- [ ] Duplicate filter state transformations

**Search patterns**:
```bash
# Inline calculations in components
grep -rn "parseFloat\|parseInt" src/app/ src/components/ | grep -v "node_modules"

# Currency formatting
grep -rn "toFixed\|formatCurrency\|Intl.NumberFormat" src/app/ src/components/

# Color classes
grep -rn "text-profit\|text-loss\|text-green\|text-red" src/

# Date formatting
grep -rn "toLocaleDateString\|formatDate\|formatDateTime" src/app/ src/components/
```

### Phase 3: Shared Utilities Audit
**Scope**: `src/lib/`

Look for:
- [ ] Functions doing the same thing with different names
- [ ] Duplicate constant definitions
- [ ] Helper functions that should be consolidated
- [ ] Missing exports (private functions that should be shared)

**Search patterns**:
```bash
# List all exported functions
grep -rn "^export function\|^export const" src/lib/

# Find similar function names
grep -rn "calculate\|compute\|get.*Value\|format" src/lib/ | grep "export"

# Find constant definitions
grep -rn "^export const [A-Z]" src/lib/
```

### Phase 3b: Local Helper Extraction Audit (CRITICAL)
**Scope**: `src/components/`, `src/app/`, `src/server/api/routers/`

This phase catches "hidden" utilities - local helper functions that should be extracted to shared libs.

Look for:
- [ ] Local `function` definitions inside components/hooks that do calculations
- [ ] Functions named `calculate*`, `compute*`, `format*`, `get*` that aren't imported
- [ ] Logic that duplicates existing `src/lib/` utilities
- [ ] Helper functions at bottom of files (after main export)

**Search patterns**:
```bash
# Find local calculate/compute functions NOT exported (likely should be shared)
grep -rn "^function calculate\|^function compute\|^function format\|^function get" src/components/ src/app/ src/server/api/routers/

# Find local const functions (arrow functions) doing calculations
grep -rn "^const calculate\|^const compute\|^const format" src/components/ src/app/

# Compare against existing lib exports - look for similar names
grep -rn "^export function" src/lib/trades/ src/lib/market-data/ src/lib/analytics/

# Find helper functions defined INSIDE hooks (useCallback/useMemo with calculation logic)
grep -rn "useCallback\|useMemo" src/components/ -A 5 | grep "calculate\|compute\|pnl\|P&L"
```

**Red flags**:
- Local function with same name as lib/ export (should import instead)
- Local function doing P&L, R-multiple, or point value calculations
- Functions with comments like "// Helper" or "// Calculate" that aren't exported
- Multiple components with similar local helper functions

### Phase 4: Type Consistency Audit
**Scope**: `src/types/`, `src/server/db/schema.ts`

Look for:
- [ ] Duplicate type definitions
- [ ] Inconsistent field naming (camelCase vs snake_case)
- [ ] Missing type reuse from schema
- [ ] Inline types that should be shared

**Search patterns**:
```bash
# Type definitions
grep -rn "^export type\|^export interface" src/

# Inline types in function signatures
grep -rn "}: {" src/ | head -50
```

### Phase 5: API Contract Consistency
**Scope**: `src/server/api/routers/`, frontend API calls

Look for:
- [ ] Frontend calculating what backend should provide
- [ ] Same data transformed differently in different places
- [ ] Missing server-side calculations pushed to client

## Common Anti-Patterns to Find

### 1. Duplicate Calculations
```typescript
// BAD: Same calculation in multiple places
// File A
const rMultiple = (exit - entry) / (entry - stop);

// File B
const rMultiple = netPnl / (riskPerUnit * pointValue * qty);

// GOOD: Single source of truth
import { calculateActualRMultiple } from "@/lib/trades/calculations";
```

### 2. Inline Constants
```typescript
// BAD: Magic numbers scattered
if (pnl > 3.0) return "win";  // breakeven threshold
if (pnl < -3.0) return "loss";

// GOOD: Centralized constants
import { BREAKEVEN_THRESHOLD } from "@/lib/constants/trading";
```

### 3. Duplicate Formatting
```typescript
// BAD: Formatting logic repeated
const formatted = `$${value.toFixed(2)}`;
const formatted2 = new Intl.NumberFormat('en-US', {...}).format(value);

// GOOD: Shared utility
import { formatCurrency } from "@/lib/shared";
```

### 4. Inconsistent Null Handling
```typescript
// BAD: Different null handling
const pnl = trade.netPnl ? parseFloat(trade.netPnl) : 0;
const pnl2 = parseFloat(trade.netPnl ?? "0");
const pnl3 = trade.netPnl != null ? parseFloat(trade.netPnl) : null;

// GOOD: Consistent utility
import { parsePnl } from "@/lib/trades/utils";
```

## Orchestration Plan

When running a full audit, deploy parallel agents for each phase:

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                              │
│  Coordinates audit, collects findings, generates report     │
└─────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Backend    │      │  Frontend   │      │  Utilities  │
│  Audit      │      │  Audit      │      │  Audit      │
└─────────────┘      └─────────────┘      └─────────────┘
       │                      │                      │
       └──────────────────────┼──────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  FINAL REPORT   │
                    │  with fixes     │
                    └─────────────────┘
```

## Report Format

```markdown
## Consistency Audit Report - [DATE]

### Critical (Same bug in multiple places)
- **Issue**: [Description]
- **Locations**:
  - file1.ts:123
  - file2.ts:456
- **Fix**: Consolidate to [utility function]

### High (Duplicate implementations)
- **Issue**: [Description]
- **Locations**: [files]
- **Recommended consolidation**: [approach]

### Medium (Inconsistent patterns)
- **Issue**: [Description]
- **Locations**: [files]

### Low (Minor duplication)
- [Finding]

### Consolidation Recommendations
1. Create `src/lib/[domain]/[utility].ts` for [purpose]
2. Deprecate inline calculations in [files]
3. Add shared constants for [values]

### Files Modified in Fix
- [ ] file1.ts - Use shared utility
- [ ] file2.ts - Use shared utility
- [ ] new-utility.ts - New shared function
```

## Quick Start Commands

```bash
# Find all parseFloat usages (potential calculation duplication)
grep -rn "parseFloat" src/server/ src/app/ --include="*.ts" --include="*.tsx" | wc -l

# Find all Math operations
grep -rn "Math\." src/server/ src/app/ --include="*.ts" --include="*.tsx"

# Find inline number formatting
grep -rn "\.toFixed(" src/app/ src/components/

# Find potential duplicate constants
grep -rn "= [0-9]\+\." src/server/ src/lib/ | grep -v "node_modules"

# List all calculation functions
grep -rn "^export function calculate" src/lib/
```

## Integration with CI (Future)

Consider adding to pre-commit or CI:
- Lint rule for inline calculations in components
- Detection of duplicate function signatures
- Required use of shared utilities for common patterns
