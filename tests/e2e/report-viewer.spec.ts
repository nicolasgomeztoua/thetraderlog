import { expect, test } from "@playwright/test";

/**
 * Report Viewer Page E2E Tests
 *
 * Tests for the /ai/reports/[reportId] page — MDX report rendering,
 * navigation, responsive layout, and PDF export.
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 *
 * Tests run serially to avoid parallel beforeAll hooks competing for
 * the dev server when finding completed reports via the UI.
 */

// Run serially — beforeAll hooks navigate the UI to find a report ID
test.describe.configure({ mode: "serial" });

// =============================================================================
// Helper: Navigate to a completed report via the reports list
// =============================================================================

async function findCompletedReportId(
	page: import("@playwright/test").Page,
): Promise<string | null> {
	await page.goto("/ai", { waitUntil: "domcontentloaded", timeout: 30000 });
	await expect(page.getByTestId("ai-page")).toBeVisible({ timeout: 30000 });

	// Switch to Report mode
	const reportOption = page.getByTestId("ai-mode-option-report");
	await expect(reportOption).toBeVisible({ timeout: 10000 });
	await reportOption.click();

	// Wait for report interface to appear
	await expect(page.getByTestId("ai-report-interface")).toBeVisible({
		timeout: 30000,
	});

	// Wait for reports list to load (tRPC query)
	await page.waitForTimeout(5000);

	// Look for any "View Report" link (only present on completed reports)
	const viewLinks = page.locator('a[data-testid^="report-view-"]');
	const count = await viewLinks.count();
	if (count === 0) return null;

	// Extract report ID from the first view link's href
	const href = await viewLinks.first().getAttribute("href");
	if (!href) return null;

	// href is /ai/reports/{reportId}
	const parts = href.split("/");
	return parts[parts.length - 1] ?? null;
}

// =============================================================================
// 404 / Not Found
// =============================================================================

test.describe("Report Viewer - Not Found", () => {
	test("shows 404 for non-existent report ID", async ({ page }, testInfo) => {
		testInfo.setTimeout(90000);

		const response = await page.goto(
			"/ai/reports/nonexistent-report-id-12345",
			{ waitUntil: "domcontentloaded", timeout: 60000 },
		);

		// Server should return 404 status, or the page should show not found text
		if (response && response.status() === 404) {
			return;
		}

		await expect(
			page.getByText(/not found|could not be found|404/i),
		).toBeVisible({ timeout: 30000 });
	});
});

// =============================================================================
// Unauthenticated Access
// =============================================================================

test.describe("Report Viewer - Unauthenticated", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user to sign-in", async ({ page }) => {
		await page.goto("/ai/reports/any-report-id");
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });
		expect(page.url()).toContain("/sign-in");
	});
});

// =============================================================================
// Authenticated Report Viewer Tests
// =============================================================================

test.describe("Report Viewer - Authenticated", () => {
	let reportId: string | null = null;

	test.beforeAll(async ({ browser }) => {
		test.setTimeout(90000);
		const context = await browser.newContext({
			storageState: "playwright/.clerk/user.json",
		});
		const page = await context.newPage();
		reportId = await findCompletedReportId(page);
		await context.close();
	});

	// --- Page Structure ---

	test("loads report viewer with header elements", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});

		await expect(page.getByTestId("report-viewer-header")).toBeVisible();
		await expect(page.getByTestId("report-viewer-title")).toBeVisible();
		await expect(page.getByTestId("report-viewer-back")).toBeVisible();
	});

	test("displays report title and metadata", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});

		const title = page.getByTestId("report-viewer-title");
		await expect(title).toBeVisible();
		const titleText = await title.textContent();
		expect(titleText?.length).toBeGreaterThan(0);

		await expect(page.getByTestId("report-viewer-model")).toBeVisible();
		await expect(page.getByTestId("report-viewer-date")).toBeVisible();
	});

	test("back button navigates to AI reports tab", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});

		await page.getByTestId("report-viewer-back").click();
		await page.waitForURL(/\/ai$/, { timeout: 15000 });
		expect(page.url()).toMatch(/\/ai$/);
	});

	// --- MDX Content ---

	test("MDX content renders with heading elements", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});

		const content = page.getByTestId("report-viewer-content");
		await expect(content).toBeVisible({ timeout: 30000 });

		const headings = content.locator("h1, h2, h3");
		const headingCount = await headings.count();
		expect(headingCount).toBeGreaterThan(0);
	});

	// --- Action Buttons ---

	test("action buttons are visible", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});

		await expect(page.getByTestId("report-viewer-download-pdf")).toBeVisible();
		await expect(page.getByTestId("report-viewer-copy-link")).toBeVisible();
	});

	test("PDF download button is clickable", async ({ page }, testInfo) => {
		testInfo.setTimeout(90000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});

		await expect(page.getByTestId("report-viewer-content")).toBeVisible({
			timeout: 30000,
		});

		const pdfButton = page.getByTestId("report-viewer-download-pdf");
		await expect(pdfButton).toBeVisible();
		await expect(pdfButton).toBeEnabled();

		// Click triggers PDF generation — verify button remains visible after click
		await pdfButton.click();
		await expect(pdfButton).toBeVisible({ timeout: 30000 });
	});

	// --- MDX Components (best-effort — depends on report content) ---

	test("MetricCard components render if present", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-content")).toBeVisible({
			timeout: 30000,
		});

		// MetricCard uses analytics component — look for metric cards in content
		const content = page.getByTestId("report-viewer-content");
		const metricGrids = content.locator('[data-testid="mdx-metric-grid"]');
		const gridCount = await metricGrids.count();

		if (gridCount > 0) {
			// MetricGrid contains MetricCard children — verify grid is rendered
			await expect(metricGrids.first()).toBeVisible();
		}
		// Skip silently if no MetricCard/MetricGrid in this report
	});

	test("Callout components render with correct styling", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-content")).toBeVisible({
			timeout: 30000,
		});

		const content = page.getByTestId("report-viewer-content");
		const callouts = content.locator('[data-testid^="mdx-callout-"]');
		const calloutCount = await callouts.count();

		if (calloutCount > 0) {
			// Verify first callout is visible and has correct structure
			const firstCallout = callouts.first();
			await expect(firstCallout).toBeVisible();

			// Callout should have a border-l-2 styling (left border indicator)
			await expect(firstCallout).toHaveClass(/border-l-2/);
		}
		// Skip silently if no Callout in this report
	});

	test("DataTable renders with data if present", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-content")).toBeVisible({
			timeout: 30000,
		});

		const content = page.getByTestId("report-viewer-content");
		const dataTables = content.locator('[data-testid="mdx-data-table"]');
		const tableCount = await dataTables.count();

		if (tableCount > 0) {
			// Verify table is rendered with rows
			const firstTable = dataTables.first();
			await expect(firstTable).toBeVisible();

			// Table should have at least a header row
			const rows = firstTable.locator("tr");
			const rowCount = await rows.count();
			expect(rowCount).toBeGreaterThan(0);
		}
		// Skip silently if no DataTable in this report
	});

	// --- Responsive ToC ---

	test("ToC sidebar visible on xl+ viewport", async ({ browser }, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		const context = await browser.newContext({
			storageState: "playwright/.clerk/user.json",
			viewport: { width: 1440, height: 900 },
		});
		const page = await context.newPage();

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});
		await expect(page.getByTestId("report-viewer-content")).toBeVisible({
			timeout: 30000,
		});

		const toc = page.getByTestId("report-viewer-toc");
		await expect(toc).toBeVisible({ timeout: 5000 });

		await context.close();
	});

	test("ToC sidebar hidden on mobile viewport", async ({
		browser,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		test.skip(!reportId, "No completed reports available for test user");

		const context = await browser.newContext({
			storageState: "playwright/.clerk/user.json",
			viewport: { width: 375, height: 812 },
		});
		const page = await context.newPage();

		await page.goto(`/ai/reports/${reportId}`);
		await expect(page.getByTestId("report-viewer-page")).toBeVisible({
			timeout: 30000,
		});
		await expect(page.getByTestId("report-viewer-content")).toBeVisible({
			timeout: 30000,
		});

		const toc = page.getByTestId("report-viewer-toc");
		await expect(toc).toBeHidden();

		await context.close();
	});
});
