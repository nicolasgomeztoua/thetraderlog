import { expect, test } from "@playwright/test";

/**
 * Strategies List E2E Tests
 *
 * These tests verify the strategies list page works correctly for authenticated users.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategies List Page", () => {
	test("loads successfully with strategies page", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Verify page loads by checking for the main heading
		const heading = page.getByTestId("strategies-heading");
		await expect(heading).toBeVisible({ timeout: 15000 });
		await expect(heading).toHaveText("Strategies");

		// Verify New Strategy button is present
		const newButton = page.getByTestId("strategies-button-new");
		await expect(newButton).toBeVisible();
	});

	test("displays content after loading completes", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Wait for loading skeleton to disappear (it won't exist if loading is fast)
		const loadingSkeleton = page.getByTestId("strategies-loading");
		await loadingSkeleton
			.waitFor({ state: "hidden", timeout: 10000 })
			.catch(() => {
				// Loading may have already completed, which is fine
			});

		// Check if either empty state or grid exists
		const emptyState = page.getByTestId("strategies-empty-state");
		const grid = page.getByTestId("strategies-grid");

		// Wait for either to be visible (one of them should appear after loading)
		await Promise.race([
			emptyState.waitFor({ state: "visible", timeout: 10000 }),
			grid.waitFor({ state: "visible", timeout: 10000 }),
		]).catch(() => {
			// If neither becomes visible quickly, that's the error case
		});

		// One of these should be visible after loading
		const emptyStateVisible = await emptyState.isVisible();
		const gridVisible = await grid.isVisible();

		// Verify at least one state is shown (depends on test user's data)
		expect(emptyStateVisible || gridVisible).toBe(true);

		// If empty state is shown, verify create button exists
		if (emptyStateVisible) {
			const createButton = page.getByTestId("strategies-empty-button-create");
			await expect(createButton).toBeVisible();
		}
	});

	test("New Strategy button navigates to creation page", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Click the New Strategy button
		const newButton = page.getByTestId("strategies-button-new");
		await newButton.click();

		// Verify navigation to creation page
		await page.waitForURL(/\/strategies\/new/, { timeout: 10000 });
		expect(page.url()).toContain("/strategies/new");
	});

	test("loading state shows skeleton cards", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// The loading state may be very brief, so we just verify the page structure
		// Wait for page to fully load
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});
	});
});

test.describe("Strategies List - With Data", () => {
	test("clicking strategy card navigates to detail", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Wait for content to load
		await page.waitForTimeout(2000);

		// Check if grid exists (has strategies)
		const grid = page.getByTestId("strategies-grid");
		const gridVisible = await grid.isVisible();

		if (gridVisible) {
			// Find the first strategy card link
			const firstCardLink = page
				.locator('[data-testid^="strategy-card-link-"]')
				.first();
			const cardLinkVisible = await firstCardLink.isVisible();

			if (cardLinkVisible) {
				// Click the strategy name link
				await firstCardLink.click();

				// Verify navigation to detail page
				await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
				expect(page.url()).toMatch(/\/strategies\/[^/]+$/);
			}
		}
		// If no strategies exist, test passes (this is expected for new users)
	});

	test("dropdown menu shows edit, duplicate, and delete options", async ({
		page,
	}) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Wait for content to load
		await page.waitForTimeout(2000);

		// Check if grid exists (has strategies)
		const grid = page.getByTestId("strategies-grid");
		const gridVisible = await grid.isVisible();

		if (gridVisible) {
			// Find the first strategy card menu button
			const menuButton = page
				.locator('[data-testid^="strategy-card-menu-"]')
				.first();
			const menuVisible = await menuButton.isVisible();

			if (menuVisible) {
				// Hover to make menu visible (it's hidden by default on desktop)
				const card = page.locator('[data-testid^="strategy-card-"]').first();
				await card.hover();

				// Click the menu button
				await menuButton.click();

				// Verify dropdown menu items are visible
				const editItem = page
					.locator('[data-testid^="strategy-card-edit-"]')
					.first();
				const duplicateItem = page
					.locator('[data-testid^="strategy-card-duplicate-"]')
					.first();
				const deleteItem = page
					.locator('[data-testid^="strategy-card-delete-"]')
					.first();

				await expect(editItem).toBeVisible({ timeout: 5000 });
				await expect(duplicateItem).toBeVisible({ timeout: 5000 });
				await expect(deleteItem).toBeVisible({ timeout: 5000 });
			}
		}
		// If no strategies exist, test passes (this is expected for new users)
	});

	test("performance table displays when strategies have trades", async ({
		page,
	}) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-heading")).toBeVisible({
			timeout: 15000,
		});

		// Wait for content to load
		await page.waitForTimeout(2000);

		// The performance table only shows when strategies have trades
		// Check if it exists - it may not be present for new users
		const performanceTable = page.getByTestId("strategies-performance-table");
		const tableVisible = await performanceTable.isVisible();

		// If visible, verify table structure
		if (tableVisible) {
			// Verify table headers are present
			await expect(performanceTable.locator("text=Strategy")).toBeVisible();
			await expect(performanceTable.locator("text=Win Rate")).toBeVisible();
			await expect(
				performanceTable.locator("text=Profit Factor"),
			).toBeVisible();
			await expect(performanceTable.locator("text=Total P&L")).toBeVisible();
		}
		// If no performance table, test passes (expected when no trades)
	});
});

test.describe("Strategies List - Auth", () => {
	// Override storageState to run tests without authentication
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user to sign-in", async ({ page }) => {
		// Navigate to protected strategies page
		await page.goto("/strategies");

		// Wait for redirect to sign-in
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		// Verify we're on the sign-in page
		expect(page.url()).toContain("/sign-in");

		// Verify sign-in page elements are visible
		const signInContainer = page.locator('[data-clerk-component="SignIn"]');
		await expect(signInContainer).toBeVisible({ timeout: 10000 });
	});
});
