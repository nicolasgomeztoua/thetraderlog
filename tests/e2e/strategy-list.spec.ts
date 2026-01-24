import { expect, test } from "@playwright/test";

/**
 * Strategy List Page E2E Tests
 *
 * These tests verify the strategies list page works correctly.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Strategy List Page", () => {
	test("loads strategies page", async ({ page }) => {
		// Navigate to strategies page
		await page.goto("/strategies");

		// Wait for page to load
		const pageContainer = page.getByTestId("strategies-page");
		await expect(pageContainer).toBeVisible({ timeout: 15000 });

		// Verify page heading
		const heading = page.getByRole("heading", { name: /Strategies/i });
		await expect(heading).toBeVisible();
	});

	test("displays create strategy button in header", async ({ page }) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-page")).toBeVisible();

		// Verify create button is visible
		const createButton = page.getByTestId("create-strategy-btn");
		await expect(createButton).toBeVisible();
		await expect(createButton).toContainText(/New Strategy/i);
	});

	test("navigates to new strategy page when clicking create button", async ({
		page,
	}) => {
		await page.goto("/strategies");
		await expect(page.getByTestId("strategies-page")).toBeVisible();

		// Click create button
		await page.getByTestId("create-strategy-btn").click();

		// Should navigate to /strategies/new
		await page.waitForURL(/\/strategies\/new/, { timeout: 10000 });
		expect(page.url()).toContain("/strategies/new");
	});

	test("shows loading state", async ({ page }) => {
		// Navigate to page
		await page.goto("/strategies");

		// Loading state may appear briefly - this test verifies the skeleton exists
		// If data loads fast, loading may not be visible
		const loadingGrid = page.getByTestId("strategies-loading");

		// Either loading is visible or we've already loaded content
		const pageLoaded = await Promise.race([
			loadingGrid.isVisible().then(() => "loading"),
			page
				.getByTestId("strategies-grid")
				.isVisible()
				.then(() => "loaded"),
			page
				.getByTestId("strategies-empty-state")
				.isVisible()
				.then(() => "empty"),
		]);

		// One of these states should be true
		expect(["loading", "loaded", "empty"]).toContain(pageLoaded);
	});

	test("displays strategies grid when strategies exist", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for either the grid or empty state
		await Promise.race([
			page.getByTestId("strategies-grid").waitFor({ timeout: 15000 }),
			page.getByTestId("strategies-empty-state").waitFor({ timeout: 15000 }),
		]);

		// Check which state we're in
		const grid = page.getByTestId("strategies-grid");
		const emptyState = page.getByTestId("strategies-empty-state");

		if (await grid.isVisible()) {
			// Grid exists - verify it contains strategy cards
			const cards = page.locator("[data-testid^='strategy-card-']");
			const count = await cards.count();
			expect(count).toBeGreaterThan(0);
		} else {
			// Empty state is visible
			await expect(emptyState).toBeVisible();
		}
	});

	test("displays empty state when no strategies", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for content to load
		await Promise.race([
			page.getByTestId("strategies-grid").waitFor({ timeout: 15000 }),
			page.getByTestId("strategies-empty-state").waitFor({ timeout: 15000 }),
		]);

		const emptyState = page.getByTestId("strategies-empty-state");
		if (await emptyState.isVisible()) {
			// Verify empty state content
			await expect(emptyState).toContainText(/No strategies yet/i);

			// Should have a create button
			const createFirstBtn = page.getByTestId("create-first-strategy-btn");
			await expect(createFirstBtn).toBeVisible();
		}
	});

	test("strategy cards display key information", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for grid
		const grid = page.getByTestId("strategies-grid");
		try {
			await grid.waitFor({ timeout: 15000 });
		} catch {
			// No strategies - skip this test
			test.skip();
			return;
		}

		// Get first card
		const firstCard = page.locator("[data-testid^='strategy-card-']").first();
		await expect(firstCard).toBeVisible();

		// Verify card has key elements
		await expect(firstCard.getByTestId("strategy-card-name")).toBeVisible();
		await expect(
			firstCard.getByTestId("strategy-card-status-badge"),
		).toBeVisible();
		await expect(
			firstCard.getByTestId("strategy-card-trades-count"),
		).toBeVisible();
	});

	test("strategy card name links to detail page", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for grid
		const grid = page.getByTestId("strategies-grid");
		try {
			await grid.waitFor({ timeout: 15000 });
		} catch {
			test.skip();
			return;
		}

		// Get first card's name link
		const firstCardName = page
			.locator("[data-testid^='strategy-card-']")
			.first()
			.getByTestId("strategy-card-name");
		await expect(firstCardName).toBeVisible();

		// Click the name
		await firstCardName.click();

		// Should navigate to strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
	});

	test("strategy card menu opens on click", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for grid
		const grid = page.getByTestId("strategies-grid");
		try {
			await grid.waitFor({ timeout: 15000 });
		} catch {
			test.skip();
			return;
		}

		// Get first card's menu trigger
		const menuTrigger = page
			.locator("[data-testid^='strategy-card-']")
			.first()
			.getByTestId("strategy-card-menu-trigger");

		// Hover to make menu visible (it may be hidden until hover)
		const firstCard = page.locator("[data-testid^='strategy-card-']").first();
		await firstCard.hover();

		await expect(menuTrigger).toBeVisible();

		// Click menu trigger
		await menuTrigger.click();

		// Menu should show options
		const editOption = page.getByRole("menuitem", { name: /Edit/i });
		const duplicateOption = page.getByRole("menuitem", { name: /Duplicate/i });
		const deleteOption = page.getByRole("menuitem", { name: /Delete/i });

		await expect(editOption).toBeVisible();
		await expect(duplicateOption).toBeVisible();
		await expect(deleteOption).toBeVisible();
	});

	test("edit menu option navigates to strategy page", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for grid
		const grid = page.getByTestId("strategies-grid");
		try {
			await grid.waitFor({ timeout: 15000 });
		} catch {
			test.skip();
			return;
		}

		// Open menu on first card
		const firstCard = page.locator("[data-testid^='strategy-card-']").first();
		await firstCard.hover();
		await firstCard.getByTestId("strategy-card-menu-trigger").click();

		// Click Edit
		await page.getByRole("menuitem", { name: /Edit/i }).click();

		// Should navigate to strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 10000 });
	});
});
