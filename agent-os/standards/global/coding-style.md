## Coding Style

EdgeJournal enforces code style through Biome (unified linting + formatting) and TypeScript strict mode.

### Biome Configuration
- **Formatter**: Enabled globally for TypeScript, JavaScript, CSS, and JSON
- **Linter**: Recommended rules + nursery rules enabled
- **Tailwind Sorting**: `useSortedClasses` rule for clsx, cva, and cn functions (warn level)
- **Command**: `bun run check` to lint, `bun run check:write` to auto-fix

### TypeScript Conventions
- **Strict Mode**: All strict checks enabled (`noUncheckedIndexedAccess`, `strict: true`)
- **No Non-Null Assertions**: Never use `!` operator - use nullish coalescing with safe defaults instead
  ```ts
  // Bad
  const value = item!.field;

  // Good
  const value = item?.field ?? defaultValue;
  ```
- **Prefer `const`**: Use `const` over `let`, avoid `var` completely
- **Absolute Imports**: Use `~/` alias (maps to `src/`) for imports
  ```ts
  import { db } from "~/server/db";
  import { Button } from "~/components/ui/button";
  ```

### Naming Conventions
- **Files**: kebab-case for all files (`trade-log.tsx`, `metric-card.tsx`)
- **Components**: PascalCase (`MetricCard`, `TradeTable`)
- **Functions**: camelCase (`calculatePnL`, `getActiveAccounts`)
- **Constants**: UPPER_SNAKE_CASE for true constants
- **Database Fields**: snake_case in schema, camelCase in TypeScript (auto-mapped by Drizzle)

### Code Organization
- **Small, Focused Functions**: Single responsibility, composable logic
- **Remove Dead Code**: Delete unused imports, commented code, and unused variables
- **No Backwards Compatibility Hacks**: Unless explicitly required, don't maintain old patterns
  - Don't rename unused params to `_param`
  - Don't re-export removed types
  - Don't add `// removed` comments
  - If code is unused, delete it completely

### UI-Specific Conventions
- **Monospace for Interactive Elements**: All buttons, labels, badges, and form controls use `font-mono`
- **Uppercase Labels**: Form labels and UI labels use `uppercase tracking-wider`
- **Consistent Spacing**: Follow Tailwind's spacing scale (4px base unit)

### Data Handling
- **Decimals as Strings**: Store and transmit decimal values as strings, parse with `parseFloat()` for calculations
  ```ts
  const pnl = parseFloat(trade.netPnl ?? "0");
  if (pnl > 0) { /* profit logic */ }
  ```
- **Enum Usage**: Import from `@/lib/schemas`, use Zod enums for validation
- **JSON Fields**: Use `JSON.stringify()` for write, `JSON.parse()` for read

### Code Quality
- **Meaningful Names**: Descriptive variable/function names that reveal intent
- **DRY Principle**: Extract common logic, but don't over-abstract for single use cases
- **Minimal Comments**: Write self-documenting code; only comment complex business logic
- **Consistent Indentation**: Biome enforces 2-space indentation (tabs for indents, spaces for alignment)
