import { expect, test } from "@playwright/test";

/**
 * Strategy Detail Page E2E Tests
 *
 * These tests verify the strategy detail page displays correctly with all elements.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 *
 * Tests create a strategy first, then test the detail view functionality.
 */
test.describe("Strategy Detail Page", () => {
	let strategyId: string;
	let strategyName: string;

	// Create a test strategy before running tests
	test.beforeAll(async ({ browser }) => {
		const page = await browser.newPage();

		// Navigate to strategy creation
		await page.goto("/strategies/new");
		await expect(page.getByTestId("wizard-step-basics")).toBeVisible({
			timeout: 15000,
		});

		// Create unique strategy name
		strategyName = `E2E Detail Test ${Date.now()}`;
		await page.getByTestId("wizard-input-name").fill(strategyName);
		await page
			.getByTestId("wizard-textarea-description")
			.fill("Test strategy description for E2E testing");

		// Navigate through wizard
		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-rules")).toBeVisible({
			timeout: 5000,
		});

		// Add a rule
		await page.getByTestId("wizard-button-add-rule-entry").click();
		const ruleInput = page.getByTestId("wizard-rule-input-0");
		await expect(ruleInput).toBeVisible();
		await ruleInput.fill("Test entry rule");
		await ruleInput.blur();

		await page.getByTestId("wizard-button-next").click();
		await expect(page.getByTestId("wizard-step-risk")).toBeVisible({
			timeout: 5000,
		});

		// Add a risk parameter (min R:R ratio)
		const minRRInput = page.getByTestId("wizard-risk-min-rr").locator("input");
		await minRRInput.fill("2");
		await minRRInput.blur();

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

	test("page loads with strategy details", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);

		// Wait for page to load
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify header with strategy name
		const heading = page.getByTestId("strategy-detail-heading");
		await expect(heading).toBeVisible();
		await expect(heading).toContainText(strategyName);

		// Verify color indicator is present
		await expect(page.getByTestId("strategy-detail-color")).toBeVisible();

		// Verify back button is present
		await expect(page.getByTestId("strategy-detail-button-back")).toBeVisible();

		// Verify edit button is present
		await expect(page.getByTestId("strategy-detail-button-edit")).toBeVisible();

		// Verify actions dropdown is present
		await expect(
			page.getByTestId("strategy-detail-button-actions"),
		).toBeVisible();
	});

	test("displays description when present", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify description is shown
		const description = page.getByTestId("strategy-detail-description");
		await expect(description).toBeVisible();
		await expect(description).toContainText("Test strategy description");
	});

	test("stats display with correct values", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Stats section should be visible
		const statsSection = page.getByTestId("strategy-detail-stats");
		await expect(statsSection).toBeVisible();

		// Verify stat labels are present (Win Rate, Total P&L, etc.)
		// Note: Values may be "—" for a new strategy with no trades
		await expect(statsSection.locator("text=Win Rate")).toBeVisible();
		await expect(statsSection.locator("text=Total P")).toBeVisible();
		await expect(statsSection.locator("text=Profit Factor")).toBeVisible();
		await expect(statsSection.locator("text=Trades")).toBeVisible();
		await expect(statsSection.locator("text=Avg R")).toBeVisible();
	});

	test("rules section shows when rules exist", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Rules section should be visible (we added a rule in beforeAll)
		const rulesSection = page.getByTestId("strategy-detail-rules");
		await expect(rulesSection).toBeVisible();

		// Verify the rule text is displayed
		await expect(rulesSection).toContainText("Test entry rule");

		// Should show "Entry" category header
		await expect(rulesSection).toContainText("Entry");
	});

	test("risk parameters section shows when params exist", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Risk params section should be visible (we added min R:R in beforeAll)
		const riskSection = page.getByTestId("strategy-detail-risk-params");
		await expect(riskSection).toBeVisible();

		// Should show Auto-Checked badge
		await expect(riskSection).toContainText("Auto-Checked");

		// Should show Min R:R Ratio
		await expect(riskSection).toContainText("Min R:R Ratio");
		await expect(riskSection).toContainText("2R");
	});

	test("Edit button navigates to edit page", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Click Edit button
		await page.getByTestId("strategy-detail-button-edit").click();

		// Should navigate to edit page
		await page.waitForURL(`/strategies/${strategyId}/edit`, {
			timeout: 15000,
		});
		expect(page.url()).toContain(`/strategies/${strategyId}/edit`);
	});

	test("back button navigates to strategies list", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Click back button
		await page.getByTestId("strategy-detail-button-back").click();

		// Should navigate to strategies list
		await page.waitForURL("/strategies", { timeout: 15000 });
		expect(page.url()).toContain("/strategies");
	});

	test("actions dropdown shows duplicate and delete options", async ({
		page,
	}) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Open actions dropdown
		await page.getByTestId("strategy-detail-button-actions").click();

		// Verify duplicate option is visible
		await expect(
			page.getByTestId("strategy-detail-action-duplicate"),
		).toBeVisible();

		// Verify delete option is visible
		await expect(
			page.getByTestId("strategy-detail-action-delete"),
		).toBeVisible();
	});

	test("duplicate action creates a copy", async ({ page }) => {
		test.skip(!strategyId, "No strategy was created in beforeAll");

		await page.goto(`/strategies/${strategyId}`);
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Open actions dropdown
		await page.getByTestId("strategy-detail-button-actions").click();

		// Click duplicate
		await page.getByTestId("strategy-detail-action-duplicate").click();

		// Should navigate to new strategy detail page (different ID)
		await page.waitForURL(
			(url) => {
				const path = url.pathname;
				return (
					path.startsWith("/strategies/") &&
					!path.includes(strategyId) &&
					path.split("/").length === 3
				);
			},
			{ timeout: 30000 },
		);

		// New strategy should have "(Copy)" in name
		const heading = page.getByTestId("strategy-detail-heading");
		await expect(heading).toBeVisible();
		await expect(heading).toContainText("(Copy)");
	});

	test("delete action shows confirmation and deletes on confirm", async ({
		browser,
	}) => {
		// Create a fresh strategy for deletion to avoid affecting other tests
		const deletePage = await browser.newPage();
		await deletePage.goto("/strategies/new");
		await expect(deletePage.getByTestId("wizard-step-basics")).toBeVisible({
			timeout: 15000,
		});

		const deleteStrategyName = `Delete Test ${Date.now()}`;
		await deletePage.getByTestId("wizard-input-name").fill(deleteStrategyName);

		await deletePage.getByTestId("wizard-button-next").click();
		await expect(deletePage.getByTestId("wizard-step-rules")).toBeVisible({
			timeout: 5000,
		});
		await deletePage.getByTestId("wizard-button-next").click();
		await expect(deletePage.getByTestId("wizard-step-risk")).toBeVisible({
			timeout: 5000,
		});
		await deletePage.getByTestId("wizard-button-next").click();
		await expect(deletePage.getByTestId("wizard-step-review")).toBeVisible({
			timeout: 5000,
		});
		await deletePage.getByTestId("wizard-button-next").click();

		await deletePage.waitForURL(
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

		// Now test the delete flow
		await expect(deletePage.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Open actions dropdown
		await deletePage.getByTestId("strategy-detail-button-actions").click();

		// Click delete
		await deletePage.getByTestId("strategy-detail-action-delete").click();

		// Confirmation dialog should appear
		await expect(
			deletePage.getByTestId("strategy-detail-button-delete-confirm"),
		).toBeVisible();

		// Confirm delete
		await deletePage
			.getByTestId("strategy-detail-button-delete-confirm")
			.click();

		// Should navigate back to strategies list
		await deletePage.waitForURL("/strategies", { timeout: 30000 });
		expect(deletePage.url()).toContain("/strategies");

		await deletePage.close();
	});
});

test.describe("Strategy Detail - Not Found", () => {
	// Increase timeout for this test since it depends on tRPC error handling
	test.setTimeout(60000);

	test("shows not found for invalid strategy ID", async ({ page }) => {
		await page.goto("/strategies/invalid-strategy-id-that-does-not-exist");

		// Wait for page content (either loading or not found)
		// Loading state shows briefly, then switches to not found
		const notFoundLocator = page.getByTestId("strategy-detail-not-found");

		// Use polling assertion which handles transitions better than waitFor
		await expect(notFoundLocator).toBeVisible({ timeout: 45000 });

		// Should show "Strategy not found" message
		await expect(page.locator("text=Strategy not found")).toBeVisible();

		// Should have link back to strategies
		await expect(page.locator("text=Back to Strategies")).toBeVisible();
	});
});

test.describe("Strategy Detail - Auth", () => {
	// Clear auth state for this block
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user to sign-in", async ({ page }) => {
		await page.goto("/strategies/some-strategy-id");
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		expect(page.url()).toContain("/sign-in");
		await expect(page.locator('[data-clerk-component="SignIn"]')).toBeVisible();
	});
});
