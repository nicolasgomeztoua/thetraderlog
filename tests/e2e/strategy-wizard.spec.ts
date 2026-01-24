import { expect, test } from "@playwright/test";

/**
 * Strategy Wizard E2E Tests
 *
 * These tests verify the strategy creation wizard works correctly.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategy Wizard", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to new strategy page before each test
		await page.goto("/strategies/new");

		// Wait for wizard to load
		await expect(page.getByTestId("strategy-wizard")).toBeVisible({
			timeout: 15000,
		});
	});

	test("loads new strategy page with wizard", async ({ page }) => {
		// Verify page heading
		const heading = page.getByTestId("new-strategy-heading");
		await expect(heading).toBeVisible();
		await expect(heading).toContainText("New Strategy");

		// Verify wizard container
		const wizard = page.getByTestId("strategy-wizard");
		await expect(wizard).toBeVisible();

		// Verify stepper is visible
		const stepper = page.getByTestId("strategy-stepper");
		await expect(stepper).toBeVisible();

		// Verify we're on step 1 (Basic Info) - check for name input
		const nameInput = page.getByTestId("strategy-wizard-input-name");
		await expect(nameInput).toBeVisible();
	});

	test("navigates through all wizard steps using Next button", async ({
		page,
	}) => {
		// Step 1: Basic Info (default)
		await expect(page.getByTestId("strategy-wizard-input-name")).toBeVisible();
		await page.getByTestId("strategy-wizard-button-next").click();

		// Step 2: Strategy - should have entry criteria
		await expect(page.getByTestId("strategy-wizard-input-entry")).toBeVisible();
		await page.getByTestId("strategy-wizard-button-next").click();

		// Step 3: Risk Management
		// Check for a risk-related field (RiskConfig content)
		await expect(page.locator('text="Risk Management"')).toBeVisible();
		await page.getByTestId("strategy-wizard-button-next").click();

		// Step 4: Scaling
		await expect(page.locator('text="Scaling Configuration"')).toBeVisible();
		await page.getByTestId("strategy-wizard-button-next").click();

		// Step 5: Trailing Stops
		await expect(
			page.locator('text="Trailing Stop Configuration"'),
		).toBeVisible();
		await page.getByTestId("strategy-wizard-button-next").click();

		// Step 6: Rules Checklist - should have "Add Rule" button
		await expect(
			page.getByTestId("strategy-wizard-button-add-rule"),
		).toBeVisible();

		// On final step, should see "Create Strategy" button instead of "Next"
		await expect(
			page.getByTestId("strategy-wizard-button-submit"),
		).toBeVisible();
		await expect(
			page.getByTestId("strategy-wizard-button-next"),
		).not.toBeVisible();
	});

	test("navigates backward using Back button", async ({ page }) => {
		// Navigate to step 2
		await page.getByTestId("strategy-wizard-button-next").click();
		await expect(page.getByTestId("strategy-wizard-input-entry")).toBeVisible();

		// Navigate back to step 1
		await page.getByTestId("strategy-wizard-button-back").click();
		await expect(page.getByTestId("strategy-wizard-input-name")).toBeVisible();

		// Back button should be hidden on step 1
		await expect(
			page.getByTestId("strategy-wizard-button-back"),
		).not.toBeVisible();
	});

	test("navigates steps by clicking sidebar stepper", async ({ page }) => {
		// Click on step 3 (Risk Management) in stepper
		await page.getByTestId("strategy-stepper-step-risk").click();
		await expect(page.locator('text="Risk Management"')).toBeVisible();

		// Click on step 6 (Rules Checklist)
		await page.getByTestId("strategy-stepper-step-rules").click();
		await expect(
			page.getByTestId("strategy-wizard-button-add-rule"),
		).toBeVisible();

		// Click back to step 1
		await page.getByTestId("strategy-stepper-step-basic").click();
		await expect(page.getByTestId("strategy-wizard-input-name")).toBeVisible();
	});

	test("preserves form data when navigating between steps", async ({
		page,
	}) => {
		// Fill in strategy name
		const testName = "My Test Strategy";
		await page.getByTestId("strategy-wizard-input-name").fill(testName);

		// Navigate to step 2
		await page.getByTestId("strategy-wizard-button-next").click();
		await expect(page.getByTestId("strategy-wizard-input-entry")).toBeVisible();

		// Navigate back to step 1
		await page.getByTestId("strategy-wizard-button-back").click();

		// Verify name is preserved
		const nameInput = page.getByTestId("strategy-wizard-input-name");
		await expect(nameInput).toHaveValue(testName);
	});

	test("validates required fields on submit", async ({ page }) => {
		// Navigate to final step without filling required name
		await page.getByTestId("strategy-stepper-step-rules").click();

		// Try to submit
		await page.getByTestId("strategy-wizard-button-submit").click();

		// Should navigate back to step 1 or show validation error
		// The form should not submit without a name
		// Check we're still on the page (not redirected to /strategies)
		await expect(page).toHaveURL(/\/strategies\/new/);
	});

	test("completes wizard flow and creates strategy", async ({ page }) => {
		// Fill in required fields
		const testStrategyName = `E2E Test Strategy ${Date.now()}`;
		await page.getByTestId("strategy-wizard-input-name").fill(testStrategyName);
		await page
			.getByTestId("strategy-wizard-input-description")
			.fill("Created by E2E test");

		// Navigate to last step
		await page.getByTestId("strategy-stepper-step-rules").click();

		// Submit
		await page.getByTestId("strategy-wizard-button-submit").click();

		// Should redirect to the strategy detail page or list page
		// Wait for navigation away from /strategies/new
		await page.waitForURL(/\/strategies\/(?!new)/, { timeout: 15000 });

		// Verify success toast appears (optional - may not be testable)
		// The key verification is the successful navigation
	});

	test("can add a rule in rules step", async ({ page }) => {
		// Navigate to rules step
		await page.getByTestId("strategy-stepper-step-rules").click();

		// Click add rule button
		await page.getByTestId("strategy-wizard-button-add-rule").click();

		// Should see a new rule input (rule-0)
		await expect(page.getByTestId("strategy-wizard-rule-0")).toBeVisible();

		// Add another rule
		await page.getByTestId("strategy-wizard-button-add-rule").click();
		await expect(page.getByTestId("strategy-wizard-rule-1")).toBeVisible();
	});

	test("can select strategy color", async ({ page }) => {
		// Click on color picker
		const colorPicker = page.getByTestId("strategy-wizard-color-picker");
		await colorPicker.click();

		// Select a color (use a specific color that we know exists)
		// Using the red color option
		const redColor = page.getByTestId("strategy-wizard-color-ef4444");
		if (await redColor.isVisible()) {
			await redColor.click();
		}
	});
});
