import { expect, test } from "@playwright/test";

/**
 * NumericInput Component E2E Tests
 *
 * Tests verify the NumericInput component handles edge cases correctly:
 * - Typing values
 * - Clearing field completely
 * - Typing zero as a valid value
 * - Typing decimal values
 * - Editing existing values
 *
 * Uses the strategy wizard Risk Management step which has multiple NumericInput fields.
 */
test.describe("NumericInput Edge Cases", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to strategy wizard
		await page.goto("/strategies/new");

		// Wait for wizard to load
		await expect(page.getByTestId("strategy-wizard")).toBeVisible({
			timeout: 15000,
		});

		// Navigate to Risk Management step (step 3)
		await page.getByTestId("strategy-stepper-step-risk").click();
		await expect(page.locator('text="Risk Management"')).toBeVisible();

		// Select "Fixed Size" position sizing method to reveal the numeric input
		await page
			.locator("text=Position Sizing")
			.locator("..")
			.locator("button[role='combobox']")
			.first()
			.click();
		await page.getByRole("option", { name: "Fixed Size" }).click();

		// Wait for the fixed size input to appear
		await expect(
			page.getByTestId("risk-config-input-fixed-size"),
		).toBeVisible();
	});

	test("allows typing a numeric value", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a value
		await input.fill("25");

		// Verify value is set
		await expect(input).toHaveValue("25");
	});

	test("allows typing zero as a valid value", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type zero
		await input.fill("0");

		// Verify zero is displayed (not empty or converted to something else)
		await expect(input).toHaveValue("0");
	});

	test("allows clearing field completely using clear()", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a value first
		await input.fill("100");
		await expect(input).toHaveValue("100");

		// Clear the field
		await input.clear();

		// Verify field is empty
		await expect(input).toHaveValue("");
	});

	test("allows clearing field by selecting all and pressing backspace", async ({
		page,
	}) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a value first
		await input.fill("100");
		await expect(input).toHaveValue("100");

		// Select all and delete using keyboard
		await input.click();
		await page.keyboard.press("Control+a");
		await page.keyboard.press("Backspace");

		// Verify field is empty
		await expect(input).toHaveValue("");
	});

	test("allows typing decimal values", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a decimal value
		await input.fill("1.5");

		// Verify decimal is preserved
		await expect(input).toHaveValue("1.5");
	});

	test("allows typing more complex decimal values", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a complex decimal
		await input.fill("0.25");

		// Verify value
		await expect(input).toHaveValue("0.25");
	});

	test("allows editing existing value - delete and retype", async ({
		page,
	}) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type initial value
		await input.fill("10");
		await expect(input).toHaveValue("10");

		// Clear and type new value
		await input.clear();
		await expect(input).toHaveValue("");

		// Type new value
		await input.fill("20");
		await expect(input).toHaveValue("20");
	});

	test("allows typing zero after clearing a value", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type initial value
		await input.fill("50");
		await expect(input).toHaveValue("50");

		// Clear the field
		await input.clear();
		await expect(input).toHaveValue("");

		// Type zero
		await input.fill("0");
		await expect(input).toHaveValue("0");
	});

	test("preserves value when navigating away and back", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a value
		await input.fill("75");
		await expect(input).toHaveValue("75");

		// Navigate to another step
		await page.getByTestId("strategy-stepper-step-scaling").click();
		await expect(page.locator('text="Scaling Configuration"')).toBeVisible();

		// Navigate back to Risk Management
		await page.getByTestId("strategy-stepper-step-risk").click();
		await expect(page.locator('text="Risk Management"')).toBeVisible();

		// Verify value is preserved
		await expect(input).toHaveValue("75");
	});

	test("allows typing negative values where applicable", async ({ page }) => {
		// Navigate to a field that might accept negative values
		// Min R:R Ratio input (though practically this wouldn't be negative,
		// the component should still handle the input correctly)
		const input = page.getByTestId("risk-config-input-min-rr");

		// Type a negative value
		await input.fill("-1");

		// The component allows typing, but may clamp on blur
		// For now just verify typing works
		await expect(input).toHaveValue("-1");
	});

	test("integer-only field rejects decimal input", async ({ page }) => {
		// Max Concurrent Positions is configured with allowDecimals={false}
		const input = page.getByTestId("risk-config-input-max-positions");

		// Try to type a decimal value character by character
		await input.click();
		await page.keyboard.type("3.5");

		// Should only have "35" since decimal point is rejected for integer fields
		// The component filters out non-integer characters
		await expect(input).toHaveValue("35");
	});

	test("typing character by character works correctly", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Focus the input
		await input.click();

		// Type character by character like a real user
		await page.keyboard.type("1");
		await expect(input).toHaveValue("1");

		await page.keyboard.type("2");
		await expect(input).toHaveValue("12");

		await page.keyboard.type(".");
		await expect(input).toHaveValue("12.");

		await page.keyboard.type("5");
		await expect(input).toHaveValue("12.5");
	});

	test("backspace deletes characters correctly", async ({ page }) => {
		const input = page.getByTestId("risk-config-input-fixed-size");

		// Type a value
		await input.fill("123");
		await expect(input).toHaveValue("123");

		// Focus and press backspace repeatedly
		await input.click();
		await page.keyboard.press("End"); // Move cursor to end

		await page.keyboard.press("Backspace");
		await expect(input).toHaveValue("12");

		await page.keyboard.press("Backspace");
		await expect(input).toHaveValue("1");

		await page.keyboard.press("Backspace");
		await expect(input).toHaveValue("");
	});
});
