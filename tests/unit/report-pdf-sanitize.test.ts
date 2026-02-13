import { describe, expect, it } from "vitest";
import { sanitizeMarkdown } from "@/lib/ai/report-pdf";

describe("sanitizeMarkdown", () => {
	it("strips display math blocks ($$...$$) and keeps inner content", () => {
		expect(sanitizeMarkdown("$$P&L = 1234$$")).toBe("P&L = 1234");
	});

	it("strips multi-line display math blocks", () => {
		const input = "$$\nWin Rate = 58.3%\n$$";
		expect(sanitizeMarkdown(input)).toBe("Win Rate = 58.3%");
	});

	it("strips inline math ($...$) and keeps inner content", () => {
		expect(sanitizeMarkdown("$Key Takeaways$")).toBe("Key Takeaways");
	});

	it("preserves currency values like $1,234.56", () => {
		expect(sanitizeMarkdown("$1,234.56")).toBe("$1,234.56");
	});

	it("preserves currency values inside sentences", () => {
		expect(sanitizeMarkdown("You made $1,234.56 today")).toBe(
			"You made $1,234.56 today",
		);
	});

	it("preserves negative currency like -$500.00", () => {
		expect(sanitizeMarkdown("-$500.00")).toBe("-$500.00");
	});

	it("removes standalone $ lines", () => {
		const input = "Hello\n$\nWorld";
		expect(sanitizeMarkdown(input)).toBe("Hello\n\nWorld");
	});

	it("converts \\frac{A}{B} to (A / B)", () => {
		expect(sanitizeMarkdown("\\frac{Net P&L}{Gross Loss}")).toBe(
			"(Net P&L / Gross Loss)",
		);
	});

	it("converts \\text{X} to X", () => {
		expect(sanitizeMarkdown("\\text{Win Rate}")).toBe("Win Rate");
	});

	it("converts \\times to x", () => {
		expect(sanitizeMarkdown("2 \\times 3")).toBe("2 x 3");
	});

	it("converts \\approx to ≈", () => {
		expect(sanitizeMarkdown("x \\approx 1.5")).toBe("x ≈ 1.5");
	});

	it("converts \\sqrt{X} to √(X)", () => {
		expect(sanitizeMarkdown("\\sqrt{variance}")).toBe("√(variance)");
	});

	it("strips remaining \\command LaTeX to just the word", () => {
		expect(sanitizeMarkdown("\\sigma value")).toBe("sigma value");
	});

	it("passes clean markdown through unchanged", () => {
		const clean = `## Performance Summary

| Metric | Value |
|--------|-------|
| Win Rate | 58.3% |

- Key finding one
- Key finding two`;
		expect(sanitizeMarkdown(clean)).toBe(clean);
	});

	it("handles mixed LaTeX and currency in one string", () => {
		const input = "The $profit factor$ was 2.1 with net P&L of $1,500.00";
		expect(sanitizeMarkdown(input)).toBe(
			"The profit factor was 2.1 with net P&L of $1,500.00",
		);
	});

	it("does not collapse legitimate double newlines", () => {
		const input = "Section one\n\nSection two";
		expect(sanitizeMarkdown(input)).toBe("Section one\n\nSection two");
	});
});
