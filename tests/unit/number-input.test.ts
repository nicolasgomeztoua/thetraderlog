import { describe, expect, it } from "vitest";
import {
	formatValue,
	isValidIntermediateValue,
	roundToPrecision,
} from "@/components/ui/number-input";

describe("NumberInput utility functions", () => {
	describe("isValidIntermediateValue", () => {
		it("should accept empty string as intermediate value", () => {
			expect(isValidIntermediateValue("")).toBe(true);
		});

		it("should accept minus sign as intermediate value", () => {
			expect(isValidIntermediateValue("-")).toBe(true);
		});

		it("should accept period as intermediate value", () => {
			expect(isValidIntermediateValue(".")).toBe(true);
		});

		it("should accept numbers ending with decimal point", () => {
			expect(isValidIntermediateValue("0.")).toBe(true);
			expect(isValidIntermediateValue("5.")).toBe(true);
			expect(isValidIntermediateValue("123.")).toBe(true);
		});

		it("should accept negative numbers ending with decimal point", () => {
			expect(isValidIntermediateValue("-5.")).toBe(true);
			expect(isValidIntermediateValue("-123.")).toBe(true);
		});

		it("should accept -0 for starting negative decimals", () => {
			expect(isValidIntermediateValue("-0")).toBe(true);
		});

		it("should reject complete numbers", () => {
			expect(isValidIntermediateValue("5")).toBe(false);
			expect(isValidIntermediateValue("123")).toBe(false);
			expect(isValidIntermediateValue("0.5")).toBe(false);
			expect(isValidIntermediateValue("-123.45")).toBe(false);
		});
	});

	describe("formatValue", () => {
		it("should return empty string for null", () => {
			expect(formatValue(null, undefined)).toBe("");
		});

		it("should return empty string for undefined", () => {
			expect(formatValue(undefined, undefined)).toBe("");
		});

		it("should format zero as string", () => {
			expect(formatValue(0, undefined)).toBe("0");
		});

		it("should format positive numbers as string", () => {
			expect(formatValue(123, undefined)).toBe("123");
			expect(formatValue(5.5, undefined)).toBe("5.5");
		});

		it("should format negative numbers as string", () => {
			expect(formatValue(-123, undefined)).toBe("-123");
			expect(formatValue(-5.5, undefined)).toBe("-5.5");
		});

		it("should apply precision when specified", () => {
			expect(formatValue(5, 2)).toBe("5.00");
			expect(formatValue(5.1, 2)).toBe("5.10");
			expect(formatValue(5.123, 2)).toBe("5.12");
		});

		it("should format zero with precision", () => {
			expect(formatValue(0, 2)).toBe("0.00");
		});

		it("should format integers with zero precision", () => {
			expect(formatValue(5, 0)).toBe("5");
			expect(formatValue(5.9, 0)).toBe("6");
		});
	});

	describe("roundToPrecision", () => {
		it("should return value unchanged when no precision specified", () => {
			expect(roundToPrecision(5.123456, undefined)).toBe(5.123456);
		});

		it("should round to zero decimal places", () => {
			expect(roundToPrecision(5.4, 0)).toBe(5);
			expect(roundToPrecision(5.5, 0)).toBe(6);
			expect(roundToPrecision(5.9, 0)).toBe(6);
		});

		it("should round to one decimal place", () => {
			expect(roundToPrecision(5.14, 1)).toBe(5.1);
			expect(roundToPrecision(5.15, 1)).toBe(5.2);
			expect(roundToPrecision(5.19, 1)).toBe(5.2);
		});

		it("should round to two decimal places", () => {
			expect(roundToPrecision(5.123, 2)).toBe(5.12);
			expect(roundToPrecision(5.125, 2)).toBe(5.13);
			expect(roundToPrecision(5.129, 2)).toBe(5.13);
		});

		it("should handle zero correctly", () => {
			expect(roundToPrecision(0, 2)).toBe(0);
			expect(roundToPrecision(0, 0)).toBe(0);
		});

		it("should handle negative numbers", () => {
			expect(roundToPrecision(-5.123, 2)).toBe(-5.12);
			expect(roundToPrecision(-5.126, 2)).toBe(-5.13);
		});
	});

	describe("zero value handling", () => {
		it("formatValue should preserve zero as '0', not convert to empty string", () => {
			// This is the critical bug the NumberInput component was created to fix
			// parseFloat(x) || undefined would convert 0 to undefined
			const zeroValue = 0;
			const formatted = formatValue(zeroValue, undefined);
			expect(formatted).toBe("0");
			expect(formatted).not.toBe("");
		});

		it("formatValue with precision should preserve zero as '0.00'", () => {
			const zeroValue = 0;
			const formatted = formatValue(zeroValue, 2);
			expect(formatted).toBe("0.00");
		});

		it("roundToPrecision should preserve zero", () => {
			expect(roundToPrecision(0, 2)).toBe(0);
			expect(roundToPrecision(0, 0)).toBe(0);
			expect(roundToPrecision(0, undefined)).toBe(0);
		});
	});

	describe("empty/null handling for optional fields", () => {
		it("formatValue returns empty string for null (allowing clear in optional fields)", () => {
			expect(formatValue(null, undefined)).toBe("");
			expect(formatValue(null, 2)).toBe("");
		});

		it("formatValue returns empty string for undefined", () => {
			expect(formatValue(undefined, undefined)).toBe("");
			expect(formatValue(undefined, 2)).toBe("");
		});
	});

	describe("currency symbol stripping simulation", () => {
		// These tests simulate what the handlePaste function does
		const stripCurrencySymbols = (value: string): string => {
			return value.replace(/[$€£¥₹,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
		};

		it("should strip dollar sign", () => {
			expect(stripCurrencySymbols("$100")).toBe("100");
			expect(stripCurrencySymbols("$100.50")).toBe("100.50");
		});

		it("should strip euro sign", () => {
			expect(stripCurrencySymbols("€100")).toBe("100");
		});

		it("should strip pound sign", () => {
			expect(stripCurrencySymbols("£100")).toBe("100");
		});

		it("should strip yen sign", () => {
			expect(stripCurrencySymbols("¥100")).toBe("100");
		});

		it("should strip rupee sign", () => {
			expect(stripCurrencySymbols("₹100")).toBe("100");
		});

		it("should strip commas (thousands separators)", () => {
			expect(stripCurrencySymbols("1,000")).toBe("1000");
			expect(stripCurrencySymbols("1,000,000")).toBe("1000000");
			expect(stripCurrencySymbols("$1,234.56")).toBe("1234.56");
		});

		it("should strip spaces", () => {
			expect(stripCurrencySymbols("100 000")).toBe("100000");
			expect(stripCurrencySymbols(" 100 ")).toBe("100");
		});

		it("should convert parentheses to negative", () => {
			expect(stripCurrencySymbols("(100)")).toBe("-100");
			expect(stripCurrencySymbols("(1,234.56)")).toBe("-1234.56");
		});

		it("should handle combined formatting", () => {
			expect(stripCurrencySymbols("$1,234.56")).toBe("1234.56");
			// Parentheses convert to negative, then $ is stripped
			expect(stripCurrencySymbols("($1,234.56)")).toBe("-1234.56");
			// European formatting: € stripped, space stripped, comma remains (not decimal separator)
			expect(stripCurrencySymbols("€ 1 000,50")).toBe("100050");
		});

		it("should preserve valid numbers without formatting", () => {
			expect(stripCurrencySymbols("100")).toBe("100");
			expect(stripCurrencySymbols("100.50")).toBe("100.50");
			expect(stripCurrencySymbols("-100")).toBe("-100");
		});
	});
});
