import { expect, test } from "@playwright/test";

/**
 * Strategy Edit Page E2E Tests
 *
 * These tests verify the strategy edit page functionality for authenticated users.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategy Edit Page", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to strategies list first
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});
	});

	test("navigates to edit page from strategy detail", async ({ page }) => {
		// Click on first strategy card or create new if none exist
		const newButton = page.getByTestId("strategies-new-button");
		const strategyLink = page.locator('[href^="/strategies/"]').first();

		// Check if any strategies exist
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			// Create a new strategy if none exist
			await newButton.click();
			await page.waitForURL(/\/strategies\/new/, { timeout: 10000 });

			// Fill in strategy name
			const nameInput = page.getByTestId("strategy-new-name");
			await nameInput.fill("E2E Test Strategy");
			await nameInput.press("Enter");

			// Wait for redirect to strategy detail
			await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 15000 });
		} else {
			// Navigate to first strategy
			await strategyLink.click();
			await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
		}

		// Verify strategy detail page loaded
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await expect(editButton).toBeVisible();
		await editButton.click();

		// Wait for edit page
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Verify edit page loaded
		await expect(page.getByTestId("strategy-edit-page")).toBeVisible({
			timeout: 10000,
		});
		await expect(page.getByTestId("strategy-edit-heading")).toBeVisible();
	});

	test("shows auto-save indicator when editing fields", async ({ page }) => {
		// Navigate to a strategy edit page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await editButton.click();
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Verify edit form is visible
		await expect(page.getByTestId("strategy-edit-form")).toBeVisible({
			timeout: 10000,
		});

		// Get the status indicator
		const statusIndicator = page.getByTestId("strategy-edit-form-status");
		await expect(statusIndicator).toBeVisible();

		// Edit the description field to trigger auto-save
		const descriptionInput = page.getByTestId("strategy-edit-form-description");
		await descriptionInput.fill(`E2E Test Description - ${Date.now()}`);

		// Wait for saving indicator
		await expect(statusIndicator).toContainText(/saving|saved/i, {
			timeout: 10000,
		});
	});

	test("navigates between tabs", async ({ page }) => {
		// Navigate to a strategy edit page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await editButton.click();
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Verify tabs container is visible
		await expect(page.getByTestId("strategy-edit-tabs")).toBeVisible({
			timeout: 10000,
		});

		// Test tab navigation - Overview tab should be active by default
		await expect(
			page.getByTestId("strategy-edit-content-overview"),
		).toBeVisible();

		// Click Rules tab
		await page.getByTestId("strategy-edit-tab-rules").click();
		await expect(page.getByTestId("strategy-edit-content-rules")).toBeVisible();
		await expect(
			page.getByTestId("strategy-edit-content-overview"),
		).not.toBeVisible();

		// Click Risk Management tab
		await page.getByTestId("strategy-edit-tab-risk").click();
		await expect(page.getByTestId("strategy-edit-content-risk")).toBeVisible();
		await expect(
			page.getByTestId("strategy-edit-content-rules"),
		).not.toBeVisible();

		// Click Advanced tab
		await page.getByTestId("strategy-edit-tab-advanced").click();
		await expect(
			page.getByTestId("strategy-edit-content-advanced"),
		).toBeVisible();
		await expect(
			page.getByTestId("strategy-edit-content-risk"),
		).not.toBeVisible();

		// Go back to Overview tab
		await page.getByTestId("strategy-edit-tab-overview").click();
		await expect(
			page.getByTestId("strategy-edit-content-overview"),
		).toBeVisible();
	});

	test("color picker interaction works", async ({ page }) => {
		// Navigate to a strategy edit page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await editButton.click();
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Verify color picker section is visible
		const colorPicker = page.getByTestId("strategy-edit-form-colors");
		await expect(colorPicker).toBeVisible({ timeout: 10000 });

		// Click on a different color (cyan #00d4ff)
		const cyanColor = page.getByTestId("strategy-edit-form-color-00d4ff");
		await cyanColor.click();

		// Verify the color is selected (has scale-110 class)
		await expect(cyanColor).toHaveClass(/scale-110/, { timeout: 5000 });
	});

	test("instruments selection works", async ({ page }) => {
		// Navigate to a strategy edit page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await editButton.click();
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Click instruments dropdown
		const instrumentsButton = page.getByTestId(
			"strategy-edit-form-instruments",
		);
		await expect(instrumentsButton).toBeVisible({ timeout: 10000 });
		await instrumentsButton.click();

		// Wait for popover to open
		const popover = page.locator("[data-radix-popper-content-wrapper]");
		await expect(popover).toBeVisible({ timeout: 5000 });

		// Click on an instrument option (e.g., ES)
		const esOption = popover.locator('label:has-text("ES")');
		if (await esOption.isVisible()) {
			await esOption.click();
		}

		// Close popover by clicking outside
		await page.keyboard.press("Escape");
	});

	test("categories selection works", async ({ page }) => {
		// Navigate to a strategy edit page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await editButton.click();
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Click categories dropdown
		const categoriesButton = page.getByTestId("strategy-edit-form-categories");
		await expect(categoriesButton).toBeVisible({ timeout: 10000 });
		await categoriesButton.click();

		// Wait for popover to open
		const popover = page.locator("[data-radix-popper-content-wrapper]");
		await expect(popover).toBeVisible({ timeout: 5000 });

		// Click on a category option (e.g., Scalping)
		const scalpingOption = popover.locator('label:has-text("Scalping")');
		if (await scalpingOption.isVisible()) {
			await scalpingOption.click();
		}

		// Close popover by clicking outside
		await page.keyboard.press("Escape");
	});

	test("back button returns to strategy detail", async ({ page }) => {
		// Navigate to a strategy edit page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Click edit button
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await editButton.click();
		await page.waitForURL(/\/strategies\/[^/]+\/edit/, { timeout: 10000 });

		// Click back button
		const backButton = page.getByTestId("strategy-edit-back");
		await expect(backButton).toBeVisible({ timeout: 10000 });
		await backButton.click();

		// Verify we're back on strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});
	});
});
