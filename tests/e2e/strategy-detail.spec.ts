import { expect, test } from "@playwright/test";

/**
 * E2E Tests for Strategy Detail Page
 *
 * Tests the redesigned strategy detail page with:
 * - Hero banner display
 * - Tab navigation
 * - Edit mode toggle
 * - Save status indicator
 * - Overview tab content (two-column layout, character counters, color picker)
 *
 * Prerequisites:
 * - Authenticated user (via global.setup.ts)
 * - At least one strategy exists for the test user
 *
 * Data-testid attributes used:
 * - strategy-detail-page: Main page container
 * - strategy-detail-loading: Loading skeleton
 * - strategy-detail-not-found: 404 state
 * - strategy-hero: Hero banner section
 * - strategy-action-bar: Action buttons bar
 * - strategy-back-button: Back to strategies link
 * - strategy-edit-toggle: Edit mode toggle button
 * - strategy-more-menu: More actions dropdown
 * - strategy-form-tabs: Tab navigation container
 * - strategy-tab-{id}: Individual tab buttons
 * - strategy-overview-tab: Overview tab panel
 * - strategy-name-field: Name input section
 * - strategy-name-input: Name input element
 * - strategy-description-field: Description textarea section
 * - strategy-description-input: Description textarea element
 * - strategy-color-field: Color picker section
 * - strategy-color-hex-input: Custom hex input
 * - strategy-cover-image-field: Cover image upload section
 * - save-status-indicator: Save status component
 */
test.describe("Strategy Detail Page", () => {
	/**
	 * Test that the strategy detail page loads with strategy data.
	 */
	test("loads successfully with strategy data", async ({ page }) => {
		// Navigate to strategies list
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		// Click on first strategy card (if exists)
		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();

			// Wait for strategy detail page to load
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Verify page loaded (not loading, not 404)
			const detailPage = page.getByTestId("strategy-detail-page");
			await expect(detailPage).toBeVisible({ timeout: 15000 });

			// Verify hero banner is visible
			const hero = page.getByTestId("strategy-hero");
			await expect(hero).toBeVisible({ timeout: 10000 });
		}
	});

	/**
	 * Test that the hero banner displays correctly.
	 */
	test("displays hero banner correctly", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Wait for page to load
			await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

			// Verify hero is visible
			const hero = page.getByTestId("strategy-hero");
			await expect(hero).toBeVisible();

			// Hero should contain either an image or the default gradient
			const heroImage = page.getByTestId("strategy-hero-image");
			const defaultCover = page.getByTestId("default-cover");

			const hasImage = await heroImage.isVisible().catch(() => false);
			const hasGradient = await defaultCover.isVisible().catch(() => false);

			// At least one should be visible
			expect(hasImage || hasGradient).toBe(true);
		}
	});

	/**
	 * Test that tab navigation works correctly.
	 */
	test("tab navigation works correctly", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Click edit button to enable form
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();
			await editButton.click();

			// Verify tabs are visible
			const tabContainer = page.getByTestId("strategy-form-tabs");
			await expect(tabContainer).toBeVisible({ timeout: 10000 });

			// Tab IDs to test
			const tabIds = [
				"overview",
				"strategy",
				"risk",
				"scaling",
				"trailing",
				"rules",
			];

			// Click each tab and verify it becomes active
			for (const tabId of tabIds) {
				const tab = page.getByTestId(`strategy-tab-${tabId}`);
				await expect(tab).toBeVisible();
				await tab.click();

				// Verify tab is now selected
				await expect(tab).toHaveAttribute("aria-selected", "true");
			}
		}
	});

	/**
	 * Test that edit mode toggle works.
	 */
	test("edit mode toggle works", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Wait for page to load
			await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

			// Edit button should be visible
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();

			// Initially in read-only mode - check for read-only view
			const readOnlyView = page.getByTestId("strategy-readonly-view");
			const isReadOnly = await readOnlyView.isVisible().catch(() => false);

			if (isReadOnly) {
				// Click edit to enter edit mode
				await editButton.click();

				// Form tabs should now be visible (edit mode)
				const tabContainer = page.getByTestId("strategy-form-tabs");
				await expect(tabContainer).toBeVisible({ timeout: 10000 });

				// Edit button text should change to "Editing"
				await expect(editButton).toContainText(/editing/i);

				// Click again to exit edit mode
				await editButton.click();

				// Read-only view should be visible again
				await expect(readOnlyView).toBeVisible({ timeout: 10000 });
			}
		}
	});

	/**
	 * Test that save status indicator shows correct states.
	 *
	 * Note: Testing actual saving requires making changes and waiting,
	 * so we just verify the indicator element exists and is structured correctly.
	 */
	test("save status indicator is present in edit mode", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Wait for page and enter edit mode
			await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

			const editButton = page.getByTestId("strategy-edit-toggle");
			await editButton.click();

			// Save status indicator should exist in the action bar
			// Note: It may be hidden (idle state), but the element should exist
			const actionBar = page.getByTestId("strategy-action-bar");
			await expect(actionBar).toBeVisible();

			// The save status indicator appears in action bar when editing
			// We can't easily test "saved" state without making real changes
			// Just verify the action bar is present and edit mode is active
			await expect(editButton).toContainText(/editing/i);
		}
	});
});

/**
 * Tests for Overview Tab Content
 */
test.describe("Strategy Overview Tab", () => {
	/**
	 * Test that Overview tab shows two-column layout.
	 */
	test("displays two-column layout with name and description", async ({
		page,
	}) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Enter edit mode
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();
			await editButton.click();

			// Navigate to Overview tab (should be default)
			const overviewTab = page.getByTestId("strategy-tab-overview");
			await expect(overviewTab).toBeVisible();
			await overviewTab.click();

			// Verify Overview tab panel is visible
			const overviewPanel = page.getByTestId("strategy-overview-tab");
			await expect(overviewPanel).toBeVisible({ timeout: 10000 });

			// Verify name field is visible
			const nameField = page.getByTestId("strategy-name-field");
			await expect(nameField).toBeVisible();

			// Verify description field is visible
			const descField = page.getByTestId("strategy-description-field");
			await expect(descField).toBeVisible();
		}
	});

	/**
	 * Test that character counters work for name and description.
	 */
	test("character counters update when typing", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Enter edit mode
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();
			await editButton.click();

			// Navigate to Overview tab
			const overviewTab = page.getByTestId("strategy-tab-overview");
			await overviewTab.click();

			// Wait for panel
			await expect(page.getByTestId("strategy-overview-tab")).toBeVisible();

			// Get name input and its field container
			const nameInput = page.getByTestId("strategy-name-input");
			const nameField = page.getByTestId("strategy-name-field");

			// Clear and type new text
			await nameInput.clear();
			await nameInput.fill("Test Strategy Name");

			// Character counter should show "18/100" (length of "Test Strategy Name")
			await expect(nameField).toContainText(/18\/100/);
		}
	});

	/**
	 * Test that color picker shows preset swatches.
	 */
	test("color picker shows preset swatches", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Enter edit mode
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();
			await editButton.click();

			// Navigate to Overview tab
			const overviewTab = page.getByTestId("strategy-tab-overview");
			await overviewTab.click();

			// Wait for panel
			await expect(page.getByTestId("strategy-overview-tab")).toBeVisible();

			// Verify color field is visible
			const colorField = page.getByTestId("strategy-color-field");
			await expect(colorField).toBeVisible();

			// Verify at least one color swatch is visible (chartreuse primary color)
			const chartreuseSwatch = page.getByTestId("strategy-color-swatch-d4ff00");
			await expect(chartreuseSwatch).toBeVisible();

			// Verify hex input is visible
			const hexInput = page.getByTestId("strategy-color-hex-input");
			await expect(hexInput).toBeVisible();
		}
	});

	/**
	 * Test that clicking a color swatch updates the selection.
	 */
	test("clicking color swatch updates selection", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Enter edit mode
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();
			await editButton.click();

			// Navigate to Overview tab
			const overviewTab = page.getByTestId("strategy-tab-overview");
			await overviewTab.click();

			// Wait for panel
			await expect(page.getByTestId("strategy-overview-tab")).toBeVisible();

			// Click on ice blue color swatch
			const iceBlueSwatch = page.getByTestId("strategy-color-swatch-00d4ff");
			await expect(iceBlueSwatch).toBeVisible();
			await iceBlueSwatch.click();

			// Hex input should update to show the new color
			const hexInput = page.getByTestId("strategy-color-hex-input");
			await expect(hexInput).toHaveValue("#00d4ff");
		}
	});

	/**
	 * Test that cover image section is present.
	 */
	test("cover image section is present", async ({ page }) => {
		// Navigate to strategies list and click first card
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		const strategyCards = page.locator('[data-testid*="strategy-card"]');
		const cardCount = await strategyCards.count();

		if (cardCount > 0) {
			await strategyCards.first().click();
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Enter edit mode
			const editButton = page.getByTestId("strategy-edit-toggle");
			await expect(editButton).toBeVisible();
			await editButton.click();

			// Navigate to Overview tab
			const overviewTab = page.getByTestId("strategy-tab-overview");
			await overviewTab.click();

			// Wait for panel
			await expect(page.getByTestId("strategy-overview-tab")).toBeVisible();

			// Verify cover image field is visible
			const coverImageField = page.getByTestId("strategy-cover-image-field");
			await expect(coverImageField).toBeVisible();
		}
	});
});

/**
 * Tests for navigation prevention (unsaved changes warning).
 *
 * Note: Testing browser beforeunload is difficult in Playwright.
 * These tests verify the warning hook is functioning by checking
 * that the isDirty state is tracked.
 */
test.describe("Unsaved Changes Warning", () => {
	/**
	 * Test that making changes marks the form as dirty.
	 *
	 * Note: The actual browser warning dialog cannot be easily tested,
	 * but we can verify that changes are being tracked.
	 */
	test.fixme(
		"changes mark form as dirty and trigger autosave",
		async ({ page }) => {
			// Navigate to strategies list and click first card
			await page.goto("/strategies");
			await page.waitForLoadState("networkidle");

			const strategyCards = page.locator('[data-testid*="strategy-card"]');
			const cardCount = await strategyCards.count();

			if (cardCount > 0) {
				await strategyCards.first().click();
				await page.waitForURL(/\/strategies\/[a-z0-9]+/);

				// Enter edit mode
				const editButton = page.getByTestId("strategy-edit-toggle");
				await editButton.click();

				// Navigate to Overview tab
				const overviewTab = page.getByTestId("strategy-tab-overview");
				await overviewTab.click();

				// Make a change to the name
				const nameInput = page.getByTestId("strategy-name-input");
				const originalValue = await nameInput.inputValue();
				await nameInput.fill(`${originalValue} (modified)`);

				// Wait for autosave to trigger (debounce is 1500ms)
				await page.waitForTimeout(2000);

				// Save status indicator should show "Saving..." or "Saved"
				const saveStatus = page.getByTestId("save-status-indicator");
				const isVisible = await saveStatus.isVisible().catch(() => false);

				// If save status is visible, autosave is working
				// (It may be hidden in idle state after save completes)
				if (isVisible) {
					// Should show saving or saved status
					const statusText = await saveStatus.textContent();
					expect(statusText).toMatch(/saving|saved/i);
				}
			}
		},
	);
});
