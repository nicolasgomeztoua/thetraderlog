import { expect, test } from "@playwright/test";

/**
 * Report Interface Update E2E Tests
 *
 * Verifies the updated report list interface after the MDX migration:
 * - View Report replaces Download PDF for completed reports
 * - Progress stages no longer include "Compiling report" or "Finalizing"
 * - Progress bar transitions from analyzing to complete without PDF stages
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */

// =============================================================================
// Helper: Navigate to report interface and wait for it to load
// =============================================================================

async function navigateToReportInterface(
	page: import("@playwright/test").Page,
) {
	await page.goto("/ai", { waitUntil: "domcontentloaded", timeout: 30000 });
	await expect(page.getByTestId("ai-page")).toBeVisible({ timeout: 15000 });

	// Switch to Report mode
	await page.getByTestId("ai-mode-option-report").click();
	await expect(page.getByTestId("ai-report-interface")).toBeVisible({
		timeout: 10000,
	});

	// Wait for reports list to load (tRPC query)
	await page.waitForTimeout(3000);
}

// =============================================================================
// View Report Button Tests
// =============================================================================

test.describe("Report Interface - View Report Flow", () => {
	test("completed reports show View Report button, not Download PDF", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await navigateToReportInterface(page);

		// Look for completed report items with View Report links
		const viewLinks = page.locator('a[data-testid^="report-view-"]');
		const viewCount = await viewLinks.count();

		if (viewCount === 0) {
			// No completed reports — verify empty state or active reports only
			// This is acceptable; the test passes because there are no "Download PDF" buttons
			const downloadPdfButtons = page.locator(
				'button:has-text("Download PDF"), a:has-text("Download PDF")',
			);
			const pdfCount = await downloadPdfButtons.count();
			expect(pdfCount).toBe(0);
			return;
		}

		// Verify View Report link has correct structure
		const firstViewLink = viewLinks.first();
		await expect(firstViewLink).toBeVisible();
		await expect(firstViewLink).toContainText("View Report");

		// Verify the link points to /ai/reports/[reportId]
		const href = await firstViewLink.getAttribute("href");
		expect(href).toMatch(/^\/ai\/reports\/.+/);

		// Verify no Download PDF buttons exist in the report list
		const downloadPdfButtons = page.locator(
			'button:has-text("Download PDF"), a:has-text("Download PDF")',
		);
		const pdfCount = await downloadPdfButtons.count();
		expect(pdfCount).toBe(0);
	});

	test("View Report button navigates to report viewer page", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await navigateToReportInterface(page);

		// Find a completed report's View Report link
		const viewLinks = page.locator('a[data-testid^="report-view-"]');
		const viewCount = await viewLinks.count();
		test.skip(viewCount === 0, "No completed reports available for test user");

		const firstViewLink = viewLinks.first();
		const href = await firstViewLink.getAttribute("href");

		// Click the View Report link
		await firstViewLink.click();

		// Should navigate to the report viewer page
		await page.waitForURL(/\/ai\/reports\//, { timeout: 15000 });
		expect(page.url()).toContain("/ai/reports/");

		// Verify the URL matches the expected href
		if (href) {
			expect(page.url()).toContain(href);
		}
	});
});

// =============================================================================
// Progress Stages Tests
// =============================================================================

test.describe("Report Interface - Progress Stages", () => {
	test("progress stages do not include Compiling report or Finalizing", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await navigateToReportInterface(page);

		// Check for any active (generating) reports with progress indicators
		const progressStages = page.locator(
			'[data-testid^="report-progress-stage-"]',
		);
		const stageCount = await progressStages.count();

		if (stageCount > 0) {
			// Verify none of the progress stage labels contain old PDF-related text
			for (let i = 0; i < stageCount; i++) {
				const stageText = await progressStages.nth(i).textContent();
				expect(stageText).not.toContain("Compiling report");
				expect(stageText).not.toContain("Finalizing");
				expect(stageText).not.toContain("generating_pdf");
				expect(stageText).not.toContain("uploading");
			}
		}

		// Also check the full page content for any remnants of old labels
		const pageContent = await page
			.getByTestId("ai-report-interface")
			.textContent();
		expect(pageContent).not.toContain("Compiling report");
		expect(pageContent).not.toContain("Finalizing");
	});

	test("progress bar renders for active reports without PDF stages", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await navigateToReportInterface(page);

		// Look for any progress bars (only present on active/generating reports)
		const progressBars = page.locator('[data-testid^="report-progress-bar-"]');
		const barCount = await progressBars.count();

		if (barCount > 0) {
			// Verify progress bar is rendered and has a width style
			const firstBar = progressBars.first();
			await expect(firstBar).toBeVisible();

			// The inner bar should have a width style set
			const innerBar = firstBar.locator("div");
			const style = await innerBar.getAttribute("style");
			expect(style).toContain("width:");

			// Width should be a percentage between 0 and 100
			const widthMatch = style?.match(/width:\s*([\d.]+)%/);
			if (widthMatch) {
				const width = Number.parseFloat(widthMatch[1]);
				expect(width).toBeGreaterThanOrEqual(0);
				expect(width).toBeLessThanOrEqual(100);
			}
		}
		// If no active reports, progress bars won't be visible — test passes
	});

	test("report status labels show valid stages only", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);
		await navigateToReportInterface(page);

		// Check all visible status badges
		const statusBadges = page.locator('[data-testid^="report-status-"]');
		const statusCount = await statusBadges.count();

		const validStatuses = ["QUEUED", "GENERATING", "COMPLETE", "FAILED"];

		for (let i = 0; i < statusCount; i++) {
			const statusText = (await statusBadges.nth(i).textContent())?.trim();
			if (statusText) {
				expect(validStatuses).toContain(statusText);
			}
		}
	});
});

// =============================================================================
// Unauthenticated Access
// =============================================================================

test.describe("Report Interface - Unauthenticated", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user to sign-in", async ({ page }) => {
		await page.goto("/ai");
		await page.waitForURL(/\/sign-in/, { timeout: 15000 });
		expect(page.url()).toContain("/sign-in");
	});
});
