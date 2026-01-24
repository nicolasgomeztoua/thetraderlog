import { expect, test } from "@playwright/test";

/**
 * Strategy Detail Page E2E Tests
 *
 * These tests verify the strategy detail page works correctly.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 *
 * Note: These tests require at least one strategy to exist.
 * If no strategies exist, tests will skip.
 */
test.describe("Strategy Detail Page", () => {
	let strategyId: string | null = null;

	// Before all tests, get a strategy ID from the list page
	test.beforeAll(async ({ browser }) => {
		const context = await browser.newContext({
			storageState: "playwright/.clerk/user.json",
		});
		const page = await context.newPage();

		await page.goto("/strategies");

		// Wait for content
		await Promise.race([
			page.getByTestId("strategies-grid").waitFor({ timeout: 15000 }),
			page.getByTestId("strategies-empty-state").waitFor({ timeout: 15000 }),
		]);

		// Get first strategy card's ID from the testid
		const firstCard = page.locator("[data-testid^='strategy-card-']").first();
		if (await firstCard.isVisible()) {
			const testId = await firstCard.getAttribute("data-testid");
			if (testId) {
				// Extract ID from "strategy-card-{id}"
				strategyId = testId.replace("strategy-card-", "");
			}
		}

		await context.close();
	});

	test("loads strategy detail page", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);

		// Wait for page to load
		const detailPage = page.getByTestId("strategy-detail-page");
		await expect(detailPage).toBeVisible({ timeout: 15000 });

		// Verify strategy name is visible
		await expect(page.getByTestId("strategy-name")).toBeVisible();
	});

	test("displays quick stats bar", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Verify quick stats are visible
		const quickStats = page.getByTestId("strategy-quick-stats");
		await expect(quickStats).toBeVisible();

		// Should have stat labels
		await expect(quickStats).toContainText(/Trades/i);
		await expect(quickStats).toContainText(/Win Rate/i);
		await expect(quickStats).toContainText(/P&L/i);
		await expect(quickStats).toContainText(/Compliance/i);
	});

	test("displays color indicator matching strategy", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Verify color indicator is present
		const colorIndicator = page.getByTestId("strategy-color-indicator");
		await expect(colorIndicator).toBeVisible();
	});

	test("displays rules compliance panel", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Verify compliance panel is visible
		const compliancePanel = page.getByTestId("rules-compliance-panel");
		await expect(compliancePanel).toBeVisible({ timeout: 10000 });
	});

	test("displays strategy form container", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Verify form container is visible
		const formContainer = page.getByTestId("strategy-form-container");
		await expect(formContainer).toBeVisible();
	});

	test("edit mode toggle switches to edit form", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Initially should show read-only view (not in edit mode)
		const editToggle = page.getByTestId("edit-mode-toggle");
		await expect(editToggle).toBeVisible();
		await expect(editToggle).toContainText(/Edit/i);

		// Click edit toggle
		await editToggle.click();

		// Should now be in edit mode - button text changes to Cancel
		await expect(editToggle).toContainText(/Cancel/i);

		// Form container should have edit styling (border-primary)
		const formContainer = page.getByTestId("strategy-form-container");
		await expect(formContainer).toBeVisible();
	});

	test("edit mode can be cancelled", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		const editToggle = page.getByTestId("edit-mode-toggle");

		// Enter edit mode
		await editToggle.click();
		await expect(editToggle).toContainText(/Cancel/i);

		// Exit edit mode
		await editToggle.click();
		await expect(editToggle).toContainText(/Edit/i);
	});

	test("duplicate button is visible", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Verify duplicate button is visible
		const duplicateBtn = page.getByTestId("duplicate-btn");
		await expect(duplicateBtn).toBeVisible();
	});

	test("delete button opens confirmation dialog", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Click delete button
		const deleteBtn = page.getByTestId("delete-btn");
		await expect(deleteBtn).toBeVisible();
		await deleteBtn.click();

		// Dialog should appear
		const dialog = page.getByRole("alertdialog");
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText(/Delete Strategy/i);

		// Should have Cancel and Delete buttons
		const cancelBtn = page.getByRole("button", { name: /Cancel/i });
		await expect(cancelBtn).toBeVisible();

		// Close dialog
		await cancelBtn.click();
		await expect(dialog).not.toBeVisible();
	});

	test("back link navigates to strategies list", async ({ page }) => {
		if (!strategyId) {
			test.skip();
			return;
		}

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Find and click back link
		const backLink = page.getByRole("link", { name: /Back to Strategies/i });
		await expect(backLink).toBeVisible();
		await backLink.click();

		// Should navigate to strategies list
		await page.waitForURL(/\/strategies$/, { timeout: 10000 });
	});

	test("shows not found for invalid strategy ID", async ({ page }) => {
		// Navigate to a non-existent strategy
		await page.goto("/strategies/non-existent-id-12345");

		// Should show not found message
		const notFound = page.getByTestId("strategy-not-found");
		await expect(notFound).toBeVisible({ timeout: 15000 });
		await expect(notFound).toContainText(/not found/i);
	});
});
