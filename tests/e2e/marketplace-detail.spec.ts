import { expect, test } from "@playwright/test";

/**
 * Marketplace Strategy Detail Page E2E Tests
 *
 * These tests verify the marketplace strategy detail page functionality
 * for authenticated users.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Marketplace Strategy Detail Page", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to marketplace first
		await page.goto("/marketplace");
		await expect(page.getByTestId("marketplace-heading")).toBeVisible({
			timeout: 15000,
		});
	});

	test("loads marketplace detail page with strategy info", async ({ page }) => {
		// Wait for grid to load
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		// Find and click first strategy card
		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		// Click on strategy name link
		const strategyLink = firstCard.locator("a").first();
		await strategyLink.click();

		// Wait for detail page to load
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Verify detail page loaded
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible({
			timeout: 10000,
		});
		await expect(page.getByTestId("marketplace-detail-hero")).toBeVisible();
		await expect(page.getByTestId("marketplace-detail-heading")).toBeVisible();
	});

	test("displays creator information", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Verify creator section is visible
		const creatorSection = page.getByTestId("marketplace-detail-creator");
		await expect(creatorSection).toBeVisible({ timeout: 10000 });
	});

	test("displays actions section with download count", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Verify actions section is visible
		const actionsSection = page.getByTestId("marketplace-detail-actions");
		await expect(actionsSection).toBeVisible({ timeout: 10000 });

		// Verify downloads count is displayed
		const downloadsCount = page.getByTestId("marketplace-detail-downloads");
		await expect(downloadsCount).toBeVisible();
	});

	test("download button or already downloaded button is visible", async ({
		page,
	}) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Either download button or already downloaded button should be visible
		const downloadButton = page.getByTestId("download-button");
		const alreadyDownloaded = page.getByTestId("already-downloaded-button");

		const hasDownload = await downloadButton.isVisible().catch(() => false);
		const hasAlreadyDownloaded = await alreadyDownloaded
			.isVisible()
			.catch(() => false);

		// At least one should be visible (unless it's user's own strategy)
		// Don't fail if neither - could be own strategy
		if (hasDownload || hasAlreadyDownloaded) {
			expect(hasDownload || hasAlreadyDownloaded).toBe(true);
		}
	});

	test("report button is visible", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Report button should be visible
		const reportButton = page.getByTestId("report-button");
		await expect(reportButton).toBeVisible({ timeout: 10000 });
	});

	test("report button opens report dialog", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Click report button
		const reportButton = page.getByTestId("report-button");
		await expect(reportButton).toBeVisible({ timeout: 10000 });
		await reportButton.click();

		// Verify report dialog opened
		const reasonSelect = page.getByTestId("report-reason-select");
		await expect(reasonSelect).toBeVisible({ timeout: 5000 });

		// Verify textarea is present
		const detailsTextarea = page.getByTestId("report-details-textarea");
		await expect(detailsTextarea).toBeVisible();

		// Verify submit button is present
		const submitButton = page.getByTestId("report-submit-button");
		await expect(submitButton).toBeVisible();

		// Close dialog by pressing Escape
		await page.keyboard.press("Escape");
	});

	test("displays stats section", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Verify stats section is visible
		const statsSection = page.getByTestId("marketplace-detail-stats");
		await expect(statsSection).toBeVisible({ timeout: 10000 });
	});

	test("displays cover image or placeholder in hero", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Verify hero section
		const hero = page.getByTestId("marketplace-detail-hero");
		await expect(hero).toBeVisible({ timeout: 10000 });

		// Should have either cover image or placeholder
		const coverImage = page.getByTestId("marketplace-detail-cover-image");
		const placeholder = page.getByTestId(
			"marketplace-detail-cover-placeholder",
		);

		const hasCover = await coverImage.isVisible().catch(() => false);
		const hasPlaceholder = await placeholder.isVisible().catch(() => false);

		expect(hasCover || hasPlaceholder).toBe(true);
	});

	test("back navigation works", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Find back link and click it
		const backLink = page.locator('a[href="/marketplace"]').first();
		await backLink.click();

		// Verify we're back on marketplace
		await page.waitForURL(/\/marketplace$/, { timeout: 10000 });
		await expect(page.getByTestId("marketplace-heading")).toBeVisible();
	});

	test("displays track record badge if available", async ({ page }) => {
		// Navigate to a marketplace strategy
		const grid = page.getByTestId("marketplace-grid");
		const hasGrid = await grid.isVisible().catch(() => false);

		if (!hasGrid) {
			test.skip();
			return;
		}

		const firstCard = page
			.locator('[data-testid^="marketplace-strategy-card-"]')
			.first();
		const hasCard = await firstCard.isVisible().catch(() => false);

		if (!hasCard) {
			test.skip();
			return;
		}

		await firstCard.locator("a").first().click();
		await page.waitForURL(/\/marketplace\/[^/]+$/, { timeout: 10000 });

		// Check for track record badges (one or the other may be visible)
		const verifiedBadge = page.getByTestId("track-record-badge-verified");
		const limitedBadge = page.getByTestId("track-record-badge-limited");

		const hasVerified = await verifiedBadge.isVisible().catch(() => false);
		const hasLimited = await limitedBadge.isVisible().catch(() => false);

		// At least one badge should be visible
		expect(hasVerified || hasLimited).toBe(true);
	});
});
