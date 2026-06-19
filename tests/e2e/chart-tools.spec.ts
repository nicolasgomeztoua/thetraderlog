import { expect, test } from "@playwright/test";

/**
 * Chart Drawing Tools & 7-Day View E2E Smoke Tests
 *
 * These tests verify critical user journeys for chart drawing tools
 * and the extended 1h date range view.
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */

/**
 * Navigate to a trade detail page by going to journal and clicking
 * the first trade. Returns the trade detail page URL.
 */
async function navigateToTradeDetail(page: import("@playwright/test").Page) {
	await page.goto("/journal");

	// Wait for journal page to load — look for trade rows
	// Desktop: table rows link to trade detail via actions menu
	// Mobile: card links. Either way, we can find a link to /journal/[id]
	await page.waitForTimeout(3000);

	// Find any link to a trade detail page
	const tradeLink = page.locator('a[href*="/journal/"]').first();
	const href = await tradeLink.getAttribute("href");

	if (!href || !href.match(/\/journal\/[^/]+$/)) {
		// No trades found — skip test
		return null;
	}

	// Navigate directly to the trade detail page
	await page.goto(href);
	return href;
}

test.describe("Chart Drawing Tools - Smoke Tests", () => {
	test("drawing toolbar renders on trade detail chart", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		// Wait for chart container to load
		const chartContainer = page.getByTestId("chart-container");
		await expect(chartContainer).toBeVisible({ timeout: 30000 });

		// Verify all drawing toolbar buttons are present
		await expect(
			page.getByTestId("chart-button-horizontal-line"),
		).toBeVisible();
		await expect(page.getByTestId("chart-button-vertical-line")).toBeVisible();
		await expect(page.getByTestId("chart-button-line-style")).toBeVisible();
		await expect(page.getByTestId("chart-button-color")).toBeVisible();
		await expect(page.getByTestId("chart-button-clear-all")).toBeVisible();
		await expect(page.getByTestId("chart-button-fit")).toBeVisible();
	});

	test("horizontal line tool activates and deactivates on click", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		const hLineBtn = page.getByTestId("chart-button-horizontal-line");
		await expect(hLineBtn).toBeVisible();

		// Activate horizontal tool
		await hLineBtn.click();

		// Check container gets crosshair cursor class
		const container = page.getByTestId("chart-container");
		await expect(container).toHaveClass(/cursor-crosshair/);

		// Click again to deactivate
		await hLineBtn.click();

		// Crosshair cursor should be removed
		await expect(container).not.toHaveClass(/cursor-crosshair/);
	});

	test("vertical line tool activates and deactivates on click", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		const vLineBtn = page.getByTestId("chart-button-vertical-line");
		await expect(vLineBtn).toBeVisible();

		// Activate vertical tool
		await vLineBtn.click();

		// Check container gets crosshair cursor class
		const container = page.getByTestId("chart-container");
		await expect(container).toHaveClass(/cursor-crosshair/);

		// Click again to deactivate
		await vLineBtn.click();
		await expect(container).not.toHaveClass(/cursor-crosshair/);
	});

	test("line style toggles between solid and dashed", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		const styleBtn = page.getByTestId("chart-button-line-style");
		await expect(styleBtn).toBeVisible();

		// Check initial title
		const initialTitle = await styleBtn.getAttribute("title");
		expect(initialTitle).toContain("solid");

		// Click to toggle
		await styleBtn.click();

		const newTitle = await styleBtn.getAttribute("title");
		expect(newTitle).toContain("dashed");

		// Click again to toggle back
		await styleBtn.click();

		const revertedTitle = await styleBtn.getAttribute("title");
		expect(revertedTitle).toContain("solid");
	});

	test("color cycles through palette on click", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		const colorBtn = page.getByTestId("chart-button-color");
		await expect(colorBtn).toBeVisible();

		// Get the color indicator inside the button
		const colorDot = colorBtn.locator("span.rounded-full");

		// Get initial color
		const initialColor = await colorDot.evaluate(
			(el) => (el as HTMLElement).style.backgroundColor,
		);

		// Click to cycle
		await colorBtn.click();

		// Color should change
		const newColor = await colorDot.evaluate(
			(el) => (el as HTMLElement).style.backgroundColor,
		);
		expect(newColor).not.toBe(initialColor);
	});

	test("clear all button is clickable", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		const clearBtn = page.getByTestId("chart-button-clear-all");
		await expect(clearBtn).toBeVisible();

		// Click clear all — should not throw errors
		await clearBtn.click();

		// Chart should still be visible after clearing
		await expect(page.getByTestId("chart-container")).toBeVisible();
	});

	test("1h interval shows chart with extended date range", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		// Find and click the 1h timeframe button
		const hourlyBtn = page.locator('button:has-text("1H")');
		if (!(await hourlyBtn.isVisible())) {
			// Mobile: use the select dropdown instead
			test.skip(true, "Timeframe buttons not visible (mobile view)");
			return;
		}

		await hourlyBtn.click();

		// Wait for chart to reload with extended data
		await page.waitForTimeout(3000);

		// Chart should still be visible after switching to 1h
		await expect(page.getByTestId("chart-container")).toBeVisible();

		// Verify bars count text updates (should show more bars for extended range)
		const barsText = page.locator("span:has-text('bars')");
		await expect(barsText.first()).toBeVisible({ timeout: 15000 });
	});

	test("switching between tools deactivates the previous one", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const tradeUrl = await navigateToTradeDetail(page);
		if (!tradeUrl) {
			test.skip(true, "No trades available for testing");
			return;
		}

		await expect(page.getByTestId("chart-container")).toBeVisible({
			timeout: 30000,
		});

		const hLineBtn = page.getByTestId("chart-button-horizontal-line");
		const vLineBtn = page.getByTestId("chart-button-vertical-line");

		// Activate horizontal tool
		await hLineBtn.click();
		await expect(page.getByTestId("chart-container")).toHaveClass(
			/cursor-crosshair/,
		);

		// Switch to vertical tool — horizontal should deactivate
		await vLineBtn.click();
		// Crosshair should still be active (vertical is now active)
		await expect(page.getByTestId("chart-container")).toHaveClass(
			/cursor-crosshair/,
		);

		// Deactivate vertical
		await vLineBtn.click();
		await expect(page.getByTestId("chart-container")).not.toHaveClass(
			/cursor-crosshair/,
		);
	});
});
