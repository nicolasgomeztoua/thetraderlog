import { expect, test } from "@playwright/test";

/**
 * Strategy Detail Page E2E Tests
 *
 * These tests verify the strategy detail page (read-only view) functionality
 * for authenticated users.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategy Detail Page", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to strategies list first
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});
	});

	test("loads strategy detail page with hero banner", async ({ page }) => {
		// Check if any strategies exist
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			// Create a new strategy if none exist
			await page.getByTestId("strategies-new-button").click();
			await page.waitForURL(/\/strategies\/new/, { timeout: 10000 });

			// Fill in strategy name
			const nameInput = page.getByTestId("strategy-new-name");
			await nameInput.fill("E2E Test Strategy Detail");
			await nameInput.press("Enter");

			// Wait for redirect to strategy detail
			await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 15000 });
		} else {
			// Navigate to first strategy
			await strategyLink.click();
			await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
		}

		// Verify strategy detail page loaded with hero
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});
		await expect(page.getByTestId("strategy-detail-hero")).toBeVisible();
		await expect(page.getByTestId("strategy-detail-heading")).toBeVisible();
	});

	test("edit button navigates to edit page", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Verify detail page loaded
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
	});

	test("marketplace section displays correct state", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Verify marketplace section is visible
		const marketplaceSection = page.getByTestId("marketplace-section");
		await expect(marketplaceSection).toBeVisible({ timeout: 10000 });

		// Should show one of the marketplace states:
		// - marketplace-section-disabled (not enough trades)
		// - marketplace-section-publish (can publish)
		// - marketplace-section-published (already published)
		const disabledState = page.getByTestId("marketplace-section-disabled");
		const publishState = page.getByTestId("marketplace-section-publish");
		const publishedState = page.getByTestId("marketplace-section-published");

		// At least one state should be visible
		const hasDisabled = await disabledState.isVisible().catch(() => false);
		const hasPublish = await publishState.isVisible().catch(() => false);
		const hasPublished = await publishedState.isVisible().catch(() => false);

		expect(hasDisabled || hasPublish || hasPublished).toBe(true);
	});

	test("duplicate button opens modal", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Verify detail page loaded
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});

		// Click duplicate button
		const duplicateButton = page.getByTestId(
			"strategy-detail-duplicate-button",
		);
		await expect(duplicateButton).toBeVisible();
		await duplicateButton.click();

		// Verify duplicate dialog opened
		const duplicateDialog = page.getByTestId("strategy-duplicate-dialog");
		await expect(duplicateDialog).toBeVisible({ timeout: 5000 });

		// Verify dialog contains name input
		const nameInput = page.getByTestId("strategy-duplicate-name-input");
		await expect(nameInput).toBeVisible();

		// Verify name is pre-filled with "(Copy)" suffix
		const inputValue = await nameInput.inputValue();
		expect(inputValue).toContain("(Copy)");

		// Verify confirm button is present
		const confirmButton = page.getByTestId("strategy-duplicate-confirm-button");
		await expect(confirmButton).toBeVisible();

		// Close dialog by pressing Escape
		await page.keyboard.press("Escape");
		await expect(duplicateDialog).not.toBeVisible();
	});

	test("action buttons are visible", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Verify actions bar is visible
		const actionsBar = page.getByTestId("strategy-detail-actions");
		await expect(actionsBar).toBeVisible({ timeout: 10000 });

		// Verify edit button is visible
		const editButton = page.getByTestId("strategy-detail-edit-button");
		await expect(editButton).toBeVisible();

		// Verify duplicate button is visible
		const duplicateButton = page.getByTestId(
			"strategy-detail-duplicate-button",
		);
		await expect(duplicateButton).toBeVisible();
	});

	test("back button returns to strategies list", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Find and click the back button (first link in actions bar)
		const actionsBar = page.getByTestId("strategy-detail-actions");
		await expect(actionsBar).toBeVisible({ timeout: 10000 });

		const backLink = actionsBar.locator('a[href="/strategies"]').first();
		await backLink.click();

		// Verify we're back on strategies list
		await page.waitForURL(/\/strategies$/, { timeout: 10000 });
		await expect(page.getByTestId("strategies-heading")).toBeVisible();
	});

	test("stats section displays when trades exist", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Verify detail page loaded
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});

		// Stats section may or may not be visible depending on whether strategy has trades
		// Just verify the page structure is correct
		const statsSection = page.getByTestId("strategy-detail-stats");
		const hasStats = await statsSection.isVisible().catch(() => false);

		if (hasStats) {
			// If stats visible, verify it has expected stat labels
			const tradeLabel = statsSection.locator('text="Trades"');
			await expect(tradeLabel).toBeVisible();
		}
	});

	test("cover image or placeholder displays in hero", async ({ page }) => {
		// Navigate to a strategy detail page
		const strategyLink = page.locator('[href^="/strategies/"]').first();
		const hasStrategies = await strategyLink.isVisible().catch(() => false);

		if (!hasStrategies) {
			test.skip();
			return;
		}

		await strategyLink.click();
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });

		// Verify hero section
		const hero = page.getByTestId("strategy-detail-hero");
		await expect(hero).toBeVisible({ timeout: 10000 });

		// Should have either cover image or placeholder
		const coverImage = page.getByTestId("strategy-detail-cover-image");
		const placeholder = page.getByTestId("strategy-detail-cover-placeholder");

		const hasCover = await coverImage.isVisible().catch(() => false);
		const hasPlaceholder = await placeholder.isVisible().catch(() => false);

		expect(hasCover || hasPlaceholder).toBe(true);
	});
});
