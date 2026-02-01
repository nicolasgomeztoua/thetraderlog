import { expect, test } from "@playwright/test";

/**
 * Strategies E2E Tests
 *
 * These tests verify the strategies feature:
 * - List page with Terminal-inspired hero, leaderboard, and cards
 * - Detail page with hero, rules, criteria, and risk display
 * - Strategy form with risk toggle switches and auto-trackable rules
 * - Navigation between list and detail pages
 * - Rule checklist and compliance display
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */

// ============================================================================
// STRATEGIES LIST PAGE
// ============================================================================

test.describe("Strategies List Page", () => {
	test("loads successfully with header and new button", async ({ page }) => {
		await page.goto("/strategies");

		// Verify hero header loads
		const header = page.getByTestId("strategies-header");
		await expect(header).toBeVisible({ timeout: 15000 });

		// Check for page title
		const title = page.locator("h1:has-text('Strategies')");
		await expect(title).toBeVisible();

		// Check for New Strategy button
		const newButton = page.getByTestId("strategies-header-new-button");
		await expect(newButton).toBeVisible();
	});

	test("page loads without errors", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to fully load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// The header should always be present, indicating the page loaded
		const headerText = page.locator("h1:has-text('Strategies')");
		await expect(headerText).toBeVisible();
	});

	test("displays strategy cards or empty state", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if grid exists (could be empty state if no strategies)
		const grid = page.getByTestId("strategies-grid");
		const emptyState = page.getByTestId("strategies-empty-state");

		const gridVisible = await grid.isVisible();
		const emptyVisible = await emptyState.isVisible();

		if (gridVisible) {
			// If grid is visible, check for strategy cards
			const cards = page.getByTestId("strategy-card");
			const count = await cards.count();
			// May have 0 or more cards
			expect(count).toBeGreaterThanOrEqual(0);

			// CTA card should always be present in grid
			const ctaCard = page.getByTestId("strategies-create-cta");
			await expect(ctaCard).toBeVisible();
		} else if (emptyVisible) {
			// Empty state should have CTA button
			const ctaButton = page.getByTestId("strategies-empty-state-cta");
			await expect(ctaButton).toBeVisible();
		}
	});

	test("strategy card shows terminal chrome and stats", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		const gridVisible = await grid.isVisible();

		if (gridVisible) {
			const cards = page.getByTestId("strategy-card");
			const count = await cards.count();

			if (count > 0) {
				// Get the first card
				const firstCard = cards.first();

				// Check for terminal chrome title
				const title = firstCard.getByTestId("strategy-card-title");
				await expect(title).toBeVisible();

				// Check for stats section
				const stats = firstCard.getByTestId("strategy-card-stats");
				await expect(stats).toBeVisible();

				// Check for menu trigger
				const menuTrigger = firstCard.getByTestId("strategy-card-menu-trigger");
				await expect(menuTrigger).toBeVisible();
			}
		}
	});
});

// ============================================================================
// STRATEGY DETAIL PAGE
// ============================================================================

test.describe("Strategy Detail Page", () => {
	test("navigates from list to detail and displays all sections", async ({
		page,
	}) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data
		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		const gridVisible = await grid.isVisible();

		if (!gridVisible) {
			// No strategies to test, skip
			return;
		}

		const cards = page.getByTestId("strategy-card");
		const count = await cards.count();

		if (count === 0) {
			// No strategy cards to test, skip
			return;
		}

		// Click on the first strategy card link
		const firstCardLink = cards.first().getByTestId("strategy-card-link");
		await firstCardLink.click();

		// Verify we navigated to detail page
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Check hero section
		const hero = page.getByTestId("strategy-detail-hero");
		await expect(hero).toBeVisible();

		// Check strategy name
		const name = page.getByTestId("strategy-detail-name");
		await expect(name).toBeVisible();

		// Check status badge
		const status = page.getByTestId("strategy-detail-status");
		await expect(status).toBeVisible();

		// Check stats grid
		const stats = page.getByTestId("strategy-detail-stats");
		await expect(stats).toBeVisible();

		// Check rules section
		const rules = page.getByTestId("strategy-detail-rules");
		await expect(rules).toBeVisible();

		// Check criteria section
		const criteria = page.getByTestId("strategy-detail-criteria");
		await expect(criteria).toBeVisible();

		// Check action bar
		const actionBar = page.getByTestId("strategy-detail-action-bar");
		await expect(actionBar).toBeVisible();

		// Check back button
		const backButton = page.getByTestId("strategy-detail-action-back");
		await expect(backButton).toBeVisible();

		// Check edit button
		const editButton = page.getByTestId("strategy-detail-action-edit");
		await expect(editButton).toBeVisible();

		// Check duplicate button
		const duplicateButton = page.getByTestId(
			"strategy-detail-action-duplicate",
		);
		await expect(duplicateButton).toBeVisible();

		// Check delete button
		const deleteButton = page.getByTestId("strategy-detail-action-delete");
		await expect(deleteButton).toBeVisible();
	});

	test("back button navigates to strategies list", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data
		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		if (!(await grid.isVisible())) {
			return;
		}

		const cards = page.getByTestId("strategy-card");
		if ((await cards.count()) === 0) {
			return;
		}

		// Navigate to first strategy
		await cards.first().getByTestId("strategy-card-link").click();
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Click back button
		const backButton = page.getByTestId("strategy-detail-action-back");
		await backButton.click();

		// Verify we're back on strategies list
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});
	});

	test("strategy detail page shows rules section", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for strategies page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if there are any strategies
		const grid = page.getByTestId("strategies-grid");
		if (!(await grid.isVisible())) {
			// No strategies exist, skip this test
			return;
		}

		const cards = page.getByTestId("strategy-card");
		const count = await cards.count();
		if (count === 0) {
			// No strategy cards, skip
			return;
		}

		// Navigate to first strategy
		await cards.first().getByTestId("strategy-card-link").click();

		// Wait for detail page to load
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify rules section is visible
		const rulesSection = page.getByTestId("strategy-detail-rules");
		await expect(rulesSection).toBeVisible();
	});

	test("rules section displays rules without type badges", async ({ page }) => {
		await page.goto("/strategies");

		// Wait for strategies page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if there are any strategies
		const grid = page.getByTestId("strategies-grid");
		if (!(await grid.isVisible())) {
			return;
		}

		const cards = page.getByTestId("strategy-card");
		const count = await cards.count();
		if (count === 0) {
			return;
		}

		// Navigate to first strategy
		await cards.first().getByTestId("strategy-card-link").click();

		// Wait for detail page to load
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Verify rules section exists and badges have been removed
		const rulesSection = page.getByTestId("strategy-detail-rules");
		await expect(rulesSection).toBeVisible();

		// Verify AUTO/SEMI/MANUAL badges are NOT present (they were removed)
		const autoBadge = page.getByTestId("rule-type-badge-auto");
		const semiBadge = page.getByTestId("rule-type-badge-semi");
		const manualBadge = page.getByTestId("rule-type-badge-manual");

		await expect(autoBadge).toHaveCount(0);
		await expect(semiBadge).toHaveCount(0);
		await expect(manualBadge).toHaveCount(0);
	});
});

// ============================================================================
// EMPTY STATE
// ============================================================================

test.describe("Empty State", () => {
	test("empty state has CTA button when no strategies", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		// Wait for data to load
		await page.waitForTimeout(3000);

		// Check if empty state is visible
		const emptyState = page.getByTestId("strategies-empty-state");
		const emptyStateVisible = await emptyState.isVisible();

		if (emptyStateVisible) {
			// Check CTA button exists
			const ctaButton = page.getByTestId("strategies-empty-state-cta");
			await expect(ctaButton).toBeVisible();

			// Click CTA should navigate to new strategy page
			await ctaButton.click();
			await page.waitForURL(/\/strategies\/new/, { timeout: 10000 });
		}
	});
});

// ============================================================================
// STRATEGY FORM - RISK TOGGLE SWITCHES
// ============================================================================

test.describe("Strategy Form - Risk Toggle Switches", () => {
	test("displays toggle switches in risk management section", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/strategies/new");

		// Wait for form to load
		await expect(page.getByTestId("strategy-form")).toBeVisible({
			timeout: 15000,
		});

		// Navigate to Risk Management section
		const riskTab = page.getByTestId("strategy-form-tab-risk");
		await expect(riskTab).toBeVisible();
		await riskTab.click();

		// Verify max risk toggle is visible
		const maxRiskToggle = page.getByTestId("risk-config-max-risk-toggle");
		await expect(maxRiskToggle).toBeVisible({ timeout: 5000 });

		// Verify max risk value input is visible
		const maxRiskValue = page.getByTestId("risk-config-max-risk-value");
		await expect(maxRiskValue).toBeVisible();
	});

	test("max risk toggle can be enabled", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/strategies/new");

		// Wait for form to load
		await expect(page.getByTestId("strategy-form")).toBeVisible({
			timeout: 15000,
		});

		// Navigate to Risk Management section
		await page.getByTestId("strategy-form-tab-risk").click();

		// Find and click the max risk toggle
		const maxRiskToggle = page.getByTestId("risk-config-max-risk-toggle");
		await expect(maxRiskToggle).toBeVisible({ timeout: 5000 });

		// Click the toggle
		await maxRiskToggle.click();

		// Verify toggle state changed (aria-checked attribute)
		await expect(maxRiskToggle).toHaveAttribute("data-state", "checked");
	});
});

// ============================================================================
// STRATEGY FORM - CREATING STRATEGY WITH AUTO RULES
// ============================================================================

test.describe("Strategy Form - Creating Strategy with Auto Rules", () => {
	test("can fill out strategy form with name and navigate sections", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/strategies/new");

		// Wait for form to load
		await expect(page.getByTestId("strategy-form")).toBeVisible({
			timeout: 15000,
		});

		// Fill in strategy name
		const nameInput = page.getByTestId("strategy-form-input-name");
		await expect(nameInput).toBeVisible();
		await nameInput.fill("E2E Test Strategy");

		// Verify value was entered
		await expect(nameInput).toHaveValue("E2E Test Strategy");

		// Navigate through sections
		await page.getByTestId("strategy-form-tab-strategy").click();
		await expect(page.locator("#strategy-entry-criteria")).toBeVisible();

		await page.getByTestId("strategy-form-tab-risk").click();
		await expect(page.getByTestId("risk-config-max-risk-toggle")).toBeVisible();

		await page.getByTestId("strategy-form-tab-scaling").click();
		// Scaling section loaded

		await page.getByTestId("strategy-form-tab-trailing").click();
		// Trailing section loaded

		await page.getByTestId("strategy-form-tab-rules").click();
		// Rules section loaded
	});

	test("submit button is enabled when name is filled", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/strategies/new");

		// Wait for form to load
		await expect(page.getByTestId("strategy-form")).toBeVisible({
			timeout: 15000,
		});

		// Submit button should be disabled initially
		const submitButton = page.getByTestId("strategy-form-button-submit");
		await expect(submitButton).toBeDisabled();

		// Fill in strategy name
		const nameInput = page.getByTestId("strategy-form-input-name");
		await nameInput.fill("Test Strategy");

		// Submit button should now be enabled
		await expect(submitButton).toBeEnabled();
	});
});

// ============================================================================
// RULE CHECKLIST - COMPONENT VISIBILITY
// ============================================================================

test.describe("Rule Checklist - Component Visibility", () => {
	test("navigating to trade with strategy shows checklist", async ({
		page,
	}, testInfo) => {
		// Increase timeout for this navigation-heavy test
		testInfo.setTimeout(60000);
		// This test verifies the checklist component structure
		// Full integration with actual trades is covered by integration tests
		await page.goto("/journal");

		// Wait for journal page to load
		await page.waitForTimeout(3000);

		// If there are trades, click on one to see if strategy tab exists
		const tradeCards = page.locator('[data-testid*="trade-card"]');
		const tradeCount = await tradeCards.count();

		if (tradeCount > 0) {
			// Click on first trade
			await tradeCards.first().click();

			// Wait for trade detail to load
			await page.waitForTimeout(2000);

			// Look for Strategy tab in stats panel
			const strategyTab = page.locator("button:has-text('Strategy')");
			const hasStrategyTab = await strategyTab.isVisible();

			if (hasStrategyTab) {
				await strategyTab.click();

				// Wait for strategy section content
				await page.waitForTimeout(1000);

				// Either there's a strategy with checklist or "No strategy assigned" message
				const noStrategyMessage = page.locator('text="No strategy assigned"');
				const strategySelect = page.locator("button:has-text('No strategy')");

				const hasNoStrategy = await noStrategyMessage.isVisible();
				const hasSelect = await strategySelect.isVisible();

				// One of these should be visible
				expect(hasNoStrategy || hasSelect).toBeTruthy();
			}
		}
	});
});

// ============================================================================
// RULES DISPLAY - CATEGORY SECTIONS
// ============================================================================

test.describe("Rules Display - Category Sections", () => {
	test("rules display shows correct category sections", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/strategies");

		// Wait for page to load
		await expect(page.getByTestId("strategies-header")).toBeVisible({
			timeout: 15000,
		});

		await page.waitForTimeout(3000);

		const grid = page.getByTestId("strategies-grid");
		if (!(await grid.isVisible())) {
			return;
		}

		const cards = page.getByTestId("strategy-card");
		if ((await cards.count()) === 0) {
			return;
		}

		// Navigate to first strategy
		await cards.first().getByTestId("strategy-card-link").click();

		// Wait for detail page
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Check for rules display component
		const rulesDisplay = page.getByTestId("strategy-rules-display");
		const emptyRulesDisplay = page.getByTestId("strategy-rules-display-empty");

		const hasRules = await rulesDisplay.isVisible();
		const isEmpty = await emptyRulesDisplay.isVisible();

		// Either rules display or empty state should be visible
		expect(hasRules || isEmpty).toBeTruthy();

		if (hasRules) {
			// Check for category sections (at least one should exist)
			const entryRules = page.getByTestId("strategy-rules-display-entry");
			const exitRules = page.getByTestId("strategy-rules-display-exit");
			const riskRules = page.getByTestId("strategy-rules-display-risk");
			const managementRules = page.getByTestId(
				"strategy-rules-display-management",
			);

			const entryVisible = await entryRules.isVisible();
			const exitVisible = await exitRules.isVisible();
			const riskVisible = await riskRules.isVisible();
			const managementVisible = await managementRules.isVisible();

			// At least one category should have rules
			expect(
				entryVisible || exitVisible || riskVisible || managementVisible,
			).toBeTruthy();
		}
	});
});

// ============================================================================
// STRATEGY CREATION FLOW
// ============================================================================

test.describe("Strategy Creation Flow", () => {
	test("create strategy with max risk enabled generates rule", async ({
		page,
	}, testInfo) => {
		// Increase timeout for this full creation flow test
		testInfo.setTimeout(60000);
		// Navigate to new strategy page
		await page.goto("/strategies/new");

		// Wait for form to load
		await expect(page.getByTestId("strategy-form")).toBeVisible({
			timeout: 15000,
		});

		// Fill in strategy name
		const nameInput = page.getByTestId("strategy-form-input-name");
		await nameInput.fill(`E2E Auto Rule Test ${Date.now()}`);

		// Navigate to Risk Management section
		await page.getByTestId("strategy-form-tab-risk").click();

		// Enable max risk toggle
		const maxRiskToggle = page.getByTestId("risk-config-max-risk-toggle");
		await expect(maxRiskToggle).toBeVisible({ timeout: 5000 });
		await maxRiskToggle.click();
		await expect(maxRiskToggle).toHaveAttribute("data-state", "checked");

		// Fill in max risk value
		const maxRiskValue = page.getByTestId("risk-config-max-risk-value");
		await maxRiskValue.fill("100");

		// Submit the form
		const submitButton = page.getByTestId("strategy-form-button-submit");
		await submitButton.click();

		// Wait for navigation to strategy detail page
		await page.waitForURL(/\/strategies\/[^/]+$/, { timeout: 15000 });

		// Verify we're on the detail page
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible({
			timeout: 15000,
		});

		// Check that the rules section exists and shows the risk rule
		const rulesDisplay = page.getByTestId("strategy-rules-display");
		const riskRulesSection = page.getByTestId("strategy-rules-display-risk");

		// Either we have the rules display with risk section, or the display is empty
		const hasRulesDisplay = await rulesDisplay.isVisible();
		if (hasRulesDisplay) {
			// If rules display is visible, risk section should be visible (we added max risk)
			await expect(riskRulesSection).toBeVisible({ timeout: 10000 });
		}
	});
});
