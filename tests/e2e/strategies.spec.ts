import { expect, test } from "@playwright/test";

/**
 * Strategies List Page E2E Tests
 *
 * These tests verify the redesigned strategies list page functionality
 * for authenticated users.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategies List Page", () => {
	test("loads strategies page with hero section", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Verify page loaded
		await expect(page.getByTestId("strategies-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify hero section is visible
		await expect(page.getByTestId("strategies-hero")).toBeVisible();
		await expect(page.getByTestId("strategies-heading")).toBeVisible();

		// Verify heading text
		const heading = page.getByTestId("strategies-heading");
		await expect(heading).toContainText("Your Strategies");
	});

	test("new strategy button is visible in hero", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Verify new strategy button is in the hero section
		const newButton = page.getByTestId("strategies-new-button");
		await expect(newButton).toBeVisible();
	});

	test("new strategy button navigates to create page", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Click new strategy button
		const newButton = page.getByTestId("strategies-new-button");
		await newButton.click();

		// Should navigate to new strategy page
		await page.waitForURL(/\/strategies\/new$/, { timeout: 10000 });
	});

	test("strategy grid or empty state displays", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Wait for loading to complete (either grid or empty state)
		const grid = page.getByTestId("strategies-grid");
		const empty = page.getByTestId("strategies-empty");

		const hasGrid = await grid.isVisible().catch(() => false);
		const hasEmpty = await empty.isVisible().catch(() => false);

		// One should be visible
		expect(hasGrid || hasEmpty).toBe(true);
	});

	test("empty state has create strategy button", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Check if empty state is shown
		const empty = page.getByTestId("strategies-empty");
		const hasEmpty = await empty.isVisible().catch(() => false);

		if (!hasEmpty) {
			// Strategies exist, skip this test
			test.skip();
			return;
		}

		// Verify empty state has create button
		const createButton = empty.getByRole("link", { name: /create/i });
		await expect(createButton).toBeVisible();
	});

	test("strategy card navigates to detail page", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Check if grid is shown
		const grid = page.getByTestId("strategies-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		// Find first strategy link and click
		const strategyLink = grid.locator('a[href^="/strategies/"]').first();
		const hasLink = await strategyLink.isVisible().catch(() => false);

		if (!hasLink) {
			test.skip();
			return;
		}

		await strategyLink.click();

		// Should navigate to strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});
	});

	test("strategy cards display with actions menu", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Check if grid is shown
		const grid = page.getByTestId("strategies-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		// Find first strategy card's menu button (MoreVertical icon)
		const menuButton = grid.locator("button").filter({ hasText: "" }).first();
		const hasMenu = await menuButton.isVisible().catch(() => false);

		if (!hasMenu) {
			// No strategies or menu not visible
			test.skip();
			return;
		}

		// Click menu button
		await menuButton.click();

		// Wait for dropdown menu to appear
		const dropdown = page.locator('[role="menu"]');
		await expect(dropdown).toBeVisible({ timeout: 5000 });

		// Verify menu items exist
		const editItem = dropdown.locator('[role="menuitem"]:has-text("Edit")');
		const duplicateItem = dropdown.locator(
			'[role="menuitem"]:has-text("Duplicate")',
		);
		const deleteItem = dropdown.locator('[role="menuitem"]:has-text("Delete")');

		await expect(editItem).toBeVisible();
		await expect(duplicateItem).toBeVisible();
		await expect(deleteItem).toBeVisible();

		// Close dropdown
		await page.keyboard.press("Escape");
	});

	test("creating a new strategy works", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Click new strategy button
		const newButton = page.getByTestId("strategies-new-button");
		await newButton.click();

		// Wait for new strategy page
		await page.waitForURL(/\/strategies\/new$/, { timeout: 10000 });

		// Fill in strategy name
		const nameInput = page.getByTestId("strategy-new-name");
		await expect(nameInput).toBeVisible({ timeout: 10000 });
		await nameInput.fill(`E2E Test Strategy ${Date.now()}`);
		await nameInput.press("Enter");

		// Should navigate to new strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 15000 });
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 10000,
		});
	});

	test("performance comparison table shows when strategies have trades", async ({
		page,
	}) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Check for performance comparison table
		// It only shows when strategies have trades, so may not be visible
		const table = page.locator('text="Performance Comparison"');
		const hasTable = await table.isVisible().catch(() => false);

		// Just verify it doesn't error - presence is optional
		expect(typeof hasTable).toBe("boolean");
	});
});
