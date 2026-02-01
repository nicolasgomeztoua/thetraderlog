# Unit Tests - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/testing/SKILL.md`

---

## Purpose

Unit tests are for **pure functions** that don't need database access. They're fast, reliable, and test logic in isolation.

### Good Candidates for Unit Tests

- Parsers (CSV, rule triggers, date formats)
- Generators (rule generator, hash functions)
- Utilities (formatters, calculators)
- Pure business logic with no DB dependencies

### Bad Candidates (Use Integration Tests Instead)

- tRPC endpoints
- Database operations
- Auth flows
- Anything requiring user/account context

---

## Running Tests

```bash
# Run all unit tests
bunx vitest run --config vitest.config.unit.ts

# Run in watch mode
bunx vitest --config vitest.config.unit.ts

# Run specific test file
bunx vitest run --config vitest.config.unit.ts rule-generator
```

---

## Test Patterns

### Basic Structure

```typescript
import { describe, expect, it } from "vitest";
import { myFunction } from "@/lib/my-module";

describe("myFunction", () => {
  it("should handle normal input", () => {
    expect(myFunction("input")).toBe("expected");
  });

  it("should handle edge cases", () => {
    expect(myFunction(null)).toBeNull();
    expect(myFunction("")).toBe("");
  });
});
```

### Testing Parsers

```typescript
describe("parseRLevelFromTrigger", () => {
  it("should parse +1R pattern", () => {
    expect(parseRLevelFromTrigger("At +1R take 50%")).toBe(1);
  });

  it("should parse decimal R values", () => {
    expect(parseRLevelFromTrigger("At +1.5R")).toBe(1.5);
  });

  it("should return null for invalid input", () => {
    expect(parseRLevelFromTrigger("")).toBeNull();
    expect(parseRLevelFromTrigger("No R here")).toBeNull();
  });
});
```

### Testing Generators

```typescript
describe("hashConfig", () => {
  it("should return consistent hash for same input", () => {
    const config = { maxRisk: 100 };
    const hash1 = hashConfig(config);
    const hash2 = hashConfig(config);
    expect(hash1).toBe(hash2);
  });

  it("should return different hash for different input", () => {
    const hash1 = hashConfig({ maxRisk: 100 });
    const hash2 = hashConfig({ maxRisk: 200 });
    expect(hash1).not.toBe(hash2);
  });
});
```

---

## Gotchas

### No Database Access
Unit tests don't have access to the database. If your test needs DB, use an integration test instead.

### Import from @/lib
Unit tests import directly from `@/lib/...`, not from tRPC routers.

### Fast Feedback
Unit tests should run in milliseconds. If a test is slow, it probably belongs in integration tests.

---

## Decisions

- Unit tests are for pure functions only - no DB, no tRPC
- Test edge cases: null, undefined, empty strings, boundary values
- Keep tests focused on one function at a time
