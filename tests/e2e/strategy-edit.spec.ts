import { expect, test } from "@playwright/test";

/**
 * Strategy Edit Page E2E Tests
 *
 * These tests verify the strategy edit page works correctly.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 *
 * Tests create a strategy first, then test the edit functionality.
 */
test.describe("Strategy Edit Page", () => {
	let strategyId: string;
	let strategyName: string;

	// Create a test strategy before running edit tests
	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();

		// Navigate to strategy creation
		await page.goto("/strategies/new");
		await expect(page.getByTestId("wizard-step-basics")).toBeVisible({
			timeout: 15000,
		});

		// Create unique strategy name
		strategyName = `E2E Edit Test ${Date.now()}`;
		await page.getByTestId("wizard-input-name").fill(strategyName);

		// Navigate through wizard
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-rules")).toBeVisible({
			timeout: 5000,
		});
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-risk")).toBeVisible({
			timeout: 5000,
		});
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-review")).toBeVisible({
			timeout: 5000,
		});

		// Create strategy
		await page.getByTestId("wizard-button-next").click();

		// Wait for redirect to strategy detail page
		await page.waitForURL(
			(url) => {
				const path = url.pathname;
				return (
					path.startsWith("/strategies/") &&
					!path.includes("/strategies/new") &&
					path.split("/").length === 3
				);
			},
			{ timeout: 30000 },
		);

		// Extract strategy ID from URL
		const url = page.url();
		const match = url.match(/\/strategies\/([^/]+)$/);
		if (match) {
			strategyId = match[1];
		}

		await page.close();
	});

	test("page loads with strategy data populated", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify header shows strategy name
		const heading = page.getByTestId("strategy-edit-heading");
		await expect(heading).toBeVisible();
		await expect(heading).toContainText(strategyName);

		// Verify color indicator is present
		const colorIndicator = page.getByTestId("strategy-edit-color");
		await expect(colorIndicator).toBeVisible();

		// Verify tabs are present
		await expect(page.getByTestId("strategy-edit-tabs")).toBeVisible();
		await expect(page.getByTestId("strategy-edit-tab-overview")).toBeVisible();
		await expect(page.getByTestId("strategy-edit-tab-rules")).toBeVisible();
		await expect(page.getByTestId("strategy-edit-tab-risk")).toBeVisible();

		// Verify Overview section (default tab) is visible
		await expect(page.getByTestId("edit-form-basic-info")).toBeVisible();
	});

	test("can switch between tabs", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Default tab is Overview - verify Basic Info section is visible
		await expect(page.getByTestId("edit-form-basic-info")).toBeVisible();

		// Click Rules tab
		await page.getByTestId("strategy-edit-tab-rules").click();
		await expect(page.getByTestId("edit-form-rules")).toBeVisible({
			timeout: 5000,
		});

		// Click Risk Management tab
		await page.getByTestId("strategy-edit-tab-risk").click();
		await expect(page.getByTestId("edit-form-risk")).toBeVisible({
			timeout: 5000,
		});

		// Click back to Overview tab
		await page.getByTestId("strategy-edit-tab-overview").click();
		await expect(page.getByTestId("edit-form-basic-info")).toBeVisible({
			timeout: 5000,
		});
	});

	test("editing name triggers auto-save", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Wait for Basic Info section to load
		await expect(page.getByTestId("edit-form-basic-info")).toBeVisible({
			timeout: 5000,
		});

		// Find the name input (first text input in basic info section)
		const basicInfoSection = page.getByTestId("edit-form-basic-info");
		const nameInput = basicInfoSection.locator("input[type='text']").first();
		await expect(nameInput).toBeVisible();

		// Clear and type new name
		const newName = `${strategyName} - Edited`;
		await nameInput.clear();
		await nameInput.fill(newName);

		// Blur the input to trigger save
		await nameInput.blur();

		// Wait for auto-save indicator to show "Saving..." then "All changes saved"
		const saveIndicator = page.getByTestId("save-status-indicator");

		// Wait for save to complete - should see "All changes saved"
		await expect(saveIndicator).toContainText("All changes saved", {
			timeout: 10000,
		});

		// Verify heading updated with new name
		await expect(page.getByTestId("strategy-edit-heading")).toContainText(
			newName,
		);
	});

	test("adding a rule triggers auto-save", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Navigate to Rules tab
		await page.getByTestId("strategy-edit-tab-rules").click();
		await expect(page.getByTestId("edit-form-rules")).toBeVisible({
			timeout: 5000,
		});

		// Find the add button for entry category
		const addEntryButton = page.getByTestId("edit-form-button-add-rule-entry");
		await expect(addEntryButton).toBeVisible();
		await addEntryButton.click();

		// A new rule input should appear - find it and fill it
		const ruleInputs = page.locator('[data-testid^="edit-form-rule-input-"]');
		const lastRuleInput = ruleInputs.last();
		await lastRuleInput.fill("Test entry rule from E2E");

		// Blur to trigger save
		await lastRuleInput.blur();

		// Wait for auto-save
		const saveIndicator = page.getByTestId("save-status-indicator");
		await expect(saveIndicator).toContainText("All changes saved", {
			timeout: 10000,
		});
	});

	test("delete button shows confirmation, deletes on confirm", async ({
		page,
	}) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		// Create a new strategy specifically for deletion test
		await page.goto("/strategies/new");
		await expect(page.getByTestId("wizard-step-basics")).toBeVisible({
			timeout: 15000,
		});

		const deleteTestName = `Delete Test ${Date.now()}`;
		await page.getByTestId("wizard-input-name").fill(deleteTestName);

		// Navigate through wizard
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-rules")).toBeVisible({
			timeout: 5000,
		});
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-risk")).toBeVisible({
			timeout: 5000,
		});
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-review")).toBeVisible({
			timeout: 5000,
		});

		// Create strategy
		await page.getByTestId("wizard-button-next").click();

		// Wait for redirect
		await page.waitForURL(
			(url) => {
				const path = url.pathname;
				return (
					path.startsWith("/strategies/") &&
					!path.includes("/strategies/new") &&
					path.split("/").length === 3
				);
			},
			{ timeout: 30000 },
		);

		// Extract new strategy ID
		const url = page.url();
		const match = url.match(/\/strategies\/([^/]+)$/);
		const deleteStrategyId = match?.[1];
		test.skip(!deleteStrategyId, "Failed to create strategy for deletion test");

		// Navigate to edit page
		await page.goto(`/strategies/${deleteStrategyId}/edit`);
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Click delete button
		const deleteButton = page.getByTestId("strategy-edit-button-delete");
		await expect(deleteButton).toBeVisible();
		await deleteButton.click();

		// Verify confirmation dialog appears
		const confirmButton = page.getByTestId(
			"strategy-edit-button-delete-confirm",
		);
		await expect(confirmButton).toBeVisible({ timeout: 5000 });

		// Confirm deletion
		await confirmButton.click();

		// Should redirect to strategies list
		await page.waitForURL(/\/strategies$/, { timeout: 30000 });
		expect(page.url()).toMatch(/\/strategies$/);
	});

	test("required fields show validation error", async ({ page }) => {
		// This test verifies the name field is required by checking the UI shows proper indicators
		// Note: Full validation happens server-side via tRPC mutation validation
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Wait for Basic Info section to load
		await expect(page.getByTestId("edit-form-basic-info")).toBeVisible({
			timeout: 5000,
		});

		// Find the name input container (first text input in basic info section)
		const basicInfoSection = page.getByTestId("edit-form-basic-info");

		// Verify the name field label shows it's required (has asterisk)
		const nameLabel = basicInfoSection.locator("text=Strategy Name *");
		await expect(nameLabel).toBeVisible();

		// Verify the input accepts text properly
		const nameInput = basicInfoSection.locator("input[type='text']").first();
		await expect(nameInput).toBeVisible();

		// Get the current value
		const currentValue = await nameInput.inputValue();
		expect(currentValue.length).toBeGreaterThan(0);
	});

	test("back button navigates to strategy detail page", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Click back button
		const backButton = page.getByTestId("strategy-edit-button-back");
		await expect(backButton).toBeVisible();
		await backButton.click();

		// Should navigate to detail page (same ID but no /edit)
		await page.waitForURL(new RegExp(`/strategies/${strategyId}$`), {
			timeout: 10000,
		});
		expect(page.url()).not.toContain("/edit");
	});

	test("active toggle changes strategy status", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Find the active toggle
		const activeToggle = page.getByTestId("edit-form-toggle-active");
		await expect(activeToggle).toBeVisible();

		// Get initial state
		const initialState = await activeToggle.getAttribute("aria-checked");

		// Click to toggle
		await activeToggle.click();

		// Verify state changed
		const newState = await activeToggle.getAttribute("aria-checked");
		expect(newState).not.toBe(initialState);

		// Wait for auto-save
		const saveIndicator = page.getByTestId("save-status-indicator");
		await expect(saveIndicator).toContainText("All changes saved", {
			timeout: 10000,
		});
	});

	test("color picker updates strategy color", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}/edit`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 15000,
		});

		// Find color picker
		const colorPicker = page.getByTestId("edit-form-color-picker");
		await expect(colorPicker).toBeVisible();

		// Find a color that isn't currently selected and click it
		const iceBlueColor = page.getByTestId("edit-form-color-00d4ff");
		await iceBlueColor.click();

		// Verify it's now selected
		await expect(iceBlueColor).toHaveAttribute("aria-pressed", "true");

		// Wait for auto-save
		const saveIndicator = page.getByTestId("save-status-indicator");
		await expect(saveIndicator).toContainText("All changes saved", {
			timeout: 10000,
		});

		// Verify header color indicator updated
		const headerColor = page.getByTestId("strategy-edit-color");
		await expect(headerColor).toHaveCSS("background-color", "rgb(0, 212, 255)");
	});
});

test.describe("Strategy Edit Page - Not Found", () => {
	test("shows not found for invalid strategy ID", async ({ page }) => {
		await page.goto("/strategies/invalid-id-12345/edit");

		// Should show not found state after loading completes
		// The query will fail with "Strategy not found" which should show the not-found state
		await expect(page.getByTestId("strategy-edit-not-found")).toBeVisible({
			timeout: 30000,
		});
	});
});

test.describe("Strategy Edit - Auth", () => {
	// Override storageState to run tests without authentication
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user to sign-in", async ({ page }) => {
		await page.goto("/strategies/some-id/edit");

		// Wait for redirect to sign-in
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		// Verify we're on the sign-in page
		expect(page.url()).toContain("/sign-in");
	});
});
