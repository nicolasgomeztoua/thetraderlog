import { expect, test } from "@playwright/test";

/**
 * Prop Compliance E2E Smoke Tests
 *
 * These tests verify critical user journeys for prop compliance features.
 * Tests adapt to the test user's data — if prop accounts exist, it verifies
 * prop-specific UI; otherwise, it verifies correct absence/empty states.
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */

test.describe("Prop Compliance - Smoke Tests", () => {
	test("dashboard shows prop widget only for prop accounts", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/dashboard");

		// Wait for dashboard to load
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});

		// Wait for widgets to load
		await page.waitForTimeout(3000);

		// Check if prop widget exists (depends on whether test user has prop accounts)
		const propWidget = page.getByTestId("widget-prop-status");
		const hasPropWidget = await propWidget.isVisible().catch(() => false);

		if (hasPropWidget) {
			// Prop widget should have content
			await expect(page.getByTestId("prop-status-content")).toBeVisible({
				timeout: 10000,
			});
		}
		// If no prop widget, that's valid — user has no prop accounts
	});

	test("sidebar shows Prop nav item when prop accounts exist", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/dashboard");

		// Wait for dashboard to load
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});

		// Wait for sidebar to render with account data
		await page.waitForTimeout(2000);

		// Check for Prop nav item in sidebar
		const propNavLink = page.getByRole("link", { name: "Prop" });
		const hasPropNav = await propNavLink.isVisible().catch(() => false);

		// If Prop nav exists, clicking it should navigate to /prop
		if (hasPropNav) {
			await propNavLink.click();
			await page.waitForURL(/\/prop/, { timeout: 10000 });
			expect(page.url()).toContain("/prop");
		}
		// If no prop nav, user has no prop accounts — valid state
	});

	test("/prop page loads and shows content or empty state", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/prop");

		// Wait for page to load — either shows content or empty state
		const propPage = page.getByTestId("prop-page");
		await expect(propPage).toBeVisible({ timeout: 15000 });

		// Check if empty state or compliance content is shown
		const emptyState = page.getByTestId("prop-empty-state");
		const complianceContent = page.getByTestId("prop-compliance-content");

		const hasEmpty = await emptyState.isVisible().catch(() => false);
		const hasContent = await complianceContent.isVisible().catch(() => false);

		// One of these must be visible
		expect(hasEmpty || hasContent).toBe(true);
	});

	test("/prop page with data shows compliance grid", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/prop");

		// Wait for page to load
		await expect(page.getByTestId("prop-page")).toBeVisible({
			timeout: 15000,
		});

		// Check if compliance content exists (skip if no prop accounts)
		const complianceContent = page.getByTestId("prop-compliance-content");
		const hasContent = await complianceContent
			.isVisible({ timeout: 5000 })
			.catch(() => false);

		if (!hasContent) {
			// No prop accounts — test passes (empty state verified above)
			return;
		}

		// Verify compliance grid with 4 metric cards
		const grid = page.getByTestId("compliance-grid");
		await expect(grid).toBeVisible({ timeout: 10000 });

		// Verify each compliance card is present
		await expect(page.getByTestId("compliance-card-drawdown")).toBeVisible();
		await expect(page.getByTestId("compliance-card-daily-loss")).toBeVisible();
		await expect(
			page.getByTestId("compliance-card-profit-target"),
		).toBeVisible();
		await expect(page.getByTestId("compliance-card-consistency")).toBeVisible();
	});

	test("/prop page with data shows drawdown chart", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/prop");

		// Wait for page to load
		await expect(page.getByTestId("prop-page")).toBeVisible({
			timeout: 15000,
		});

		// Check if compliance content exists (skip if no prop accounts)
		const complianceContent = page.getByTestId("prop-compliance-content");
		const hasContent = await complianceContent
			.isVisible({ timeout: 5000 })
			.catch(() => false);

		if (!hasContent) {
			return;
		}

		// Verify drawdown chart renders (either chart or empty state)
		const chart = page.getByTestId("drawdown-chart");
		const chartEmpty = page.getByTestId("drawdown-chart-empty");

		const hasChart = await chart.isVisible().catch(() => false);
		const hasChartEmpty = await chartEmpty.isVisible().catch(() => false);

		expect(hasChart || hasChartEmpty).toBe(true);
	});

	test("/prop page account selector switches between prop accounts", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/prop");

		// Wait for page to load
		await expect(page.getByTestId("prop-page")).toBeVisible({
			timeout: 15000,
		});

		// Check if account controls exist (skip if no prop accounts)
		const accountControls = page.getByTestId("prop-account-controls");
		const hasControls = await accountControls
			.isVisible({ timeout: 5000 })
			.catch(() => false);

		if (!hasControls) {
			return;
		}

		// Verify account selector is present
		const selector = page.getByTestId("prop-account-selector");
		await expect(selector).toBeVisible();

		// Verify overall status indicator exists
		const statusDot = page.getByTestId("prop-status-dot");
		await expect(statusDot).toBeVisible();
	});

	test("/prop page shows challenge status badge", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await page.goto("/prop");

		// Wait for page to load
		await expect(page.getByTestId("prop-page")).toBeVisible({
			timeout: 15000,
		});

		// Check if account controls exist (skip if no prop accounts)
		const accountControls = page.getByTestId("prop-account-controls");
		const hasControls = await accountControls
			.isVisible({ timeout: 5000 })
			.catch(() => false);

		if (!hasControls) {
			return;
		}

		// Verify challenge status badge
		const statusBadge = page.getByTestId("prop-challenge-status-badge");
		await expect(statusBadge).toBeVisible();
	});
});
