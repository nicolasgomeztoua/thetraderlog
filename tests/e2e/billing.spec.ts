import { expect, test } from "@playwright/test";

/**
 * Billing UI E2E Tests
 *
 * Tests for the billing tab in settings, pricing page CTAs,
 * upgrade prompts, and usage limit banners.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */

// =========================================================================
// Settings Billing Tab
// =========================================================================

test.describe("Settings Billing Tab", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/settings?tab=billing");

		// Wait for the billing tab to be visible
		await expect(page.getByTestId("billing-tab")).toBeVisible({
			timeout: 15000,
		});

		// Wait for plan data to load (plan name rendered means tRPC query resolved)
		await expect(page.getByTestId("billing-plan-name")).toBeVisible({
			timeout: 10000,
		});
	});

	test("renders current plan card with plan name", async ({ page }) => {
		const planCard = page.getByTestId("billing-plan-card");
		await expect(planCard).toBeVisible();

		const planName = page.getByTestId("billing-plan-name");
		await expect(planName).toBeVisible();
		// Plan name should contain some text (Free, Starter, or Pro)
		await expect(planName).not.toHaveText("");
	});

	test("shows upgrade or manage button based on plan", async ({ page }) => {
		// Either the upgrade button or manage button should be visible
		const upgradeButton = page.getByTestId("billing-button-upgrade");
		const manageButton = page.getByTestId("billing-button-manage");

		const upgradeCount = await upgradeButton.count();
		const manageCount = await manageButton.count();

		// One of the two buttons must be present
		expect(upgradeCount + manageCount).toBeGreaterThanOrEqual(1);
	});

	test("renders plan comparison card with all plans", async ({ page }) => {
		const comparison = page.getByTestId("billing-plans-comparison");
		await expect(comparison).toBeVisible();

		// Should show plan names in the comparison grid
		await expect(comparison).toContainText("Free");
		await expect(comparison).toContainText("Starter");
		await expect(comparison).toContainText("Pro");
	});

	test("displays usage meters for eligible users", async ({ page }) => {
		// Usage card may or may not be visible depending on test user plan
		// If the user is Pro or beta, usage meters should appear
		const usageCard = page.getByTestId("billing-usage-card");
		const usageCount = await usageCard.count();

		if (usageCount > 0) {
			await expect(usageCard).toBeVisible();

			// Chat usage meter
			const chatMeter = page.getByTestId("billing-usage-chat");
			await expect(chatMeter).toBeVisible();

			// Reports usage meter
			const reportsMeter = page.getByTestId("billing-usage-reports");
			await expect(reportsMeter).toBeVisible();
		}
		// If no usage card, test passes — user is on Free/Starter plan
	});

	test("can navigate to billing tab via tab trigger", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		// Go to settings without tab param
		await page.goto("/settings");

		// Click the billing tab trigger
		const billingTab = page.getByTestId("settings-tab-billing");
		await expect(billingTab).toBeVisible({ timeout: 30000 });
		await billingTab.click();

		// Billing tab content should be visible
		await expect(page.getByTestId("billing-tab")).toBeVisible({
			timeout: 10000,
		});
	});
});

// =========================================================================
// Pricing Page
// =========================================================================

test.describe("Pricing Page", () => {
	test("renders pricing section with all plan cards", async ({ page }) => {
		await page.goto("/#pricing");

		const pricingSection = page.getByTestId("pricing-section");
		await expect(pricingSection).toBeVisible({ timeout: 15000 });

		// All three plan cards should be visible
		await expect(page.getByTestId("pricing-card-free")).toBeVisible();
		await expect(page.getByTestId("pricing-card-starter")).toBeVisible();
		await expect(page.getByTestId("pricing-card-pro")).toBeVisible();
	});

	test("pricing cards display plan prices", async ({ page }) => {
		await page.goto("/#pricing");

		await expect(page.getByTestId("pricing-section")).toBeVisible({
			timeout: 15000,
		});

		// Free plan shows $0
		await expect(page.getByTestId("pricing-card-free")).toContainText("$0");

		// Starter plan shows $10
		await expect(page.getByTestId("pricing-card-starter")).toContainText("$10");

		// Pro plan shows $24
		await expect(page.getByTestId("pricing-card-pro")).toContainText("$24");
	});

	test("authenticated user sees CTA buttons on each plan", async ({ page }) => {
		await page.goto("/#pricing");

		await expect(page.getByTestId("pricing-section")).toBeVisible({
			timeout: 15000,
		});

		// Each plan card should have a CTA button
		await expect(page.getByTestId("pricing-cta-free")).toBeVisible();
		await expect(page.getByTestId("pricing-cta-starter")).toBeVisible();
		await expect(page.getByTestId("pricing-cta-pro")).toBeVisible();
	});

	test("CTA buttons have plan-aware text for authenticated user", async ({
		page,
	}) => {
		await page.goto("/#pricing");

		await expect(page.getByTestId("pricing-section")).toBeVisible({
			timeout: 15000,
		});

		// Authenticated user should see plan-specific CTAs
		// Can be: "Current Plan", "Go to Dashboard", "Upgrade to X", or "Change Plan"
		const allCTAs = [
			page.getByTestId("pricing-cta-free"),
			page.getByTestId("pricing-cta-starter"),
			page.getByTestId("pricing-cta-pro"),
		];

		let foundPlanAwareCTA = false;
		for (const cta of allCTAs) {
			const text = await cta.textContent();
			if (
				text?.includes("Current Plan") ||
				text?.includes("Go to Dashboard") ||
				text?.includes("Upgrade") ||
				text?.includes("Change Plan")
			) {
				foundPlanAwareCTA = true;
				break;
			}
		}
		expect(foundPlanAwareCTA).toBe(true);
	});
});

test.describe("Pricing Page - Unauthenticated", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("unauthenticated user sees sign-up CTAs", async ({ page }) => {
		await page.goto("/#pricing");

		const pricingSection = page.getByTestId("pricing-section");
		await expect(pricingSection).toBeVisible({ timeout: 15000 });

		// Unauthenticated users should see "Start Free Trial" or "Get" CTAs
		await expect(pricingSection).toContainText("Start Free Trial");
	});
});

// =========================================================================
// Upgrade Prompts (AI Pages)
// =========================================================================

test.describe("Upgrade Prompt Components", () => {
	test("AI page renders content or upgrade prompt", async ({ page }) => {
		await page.goto("/ai");

		const aiPage = page.getByTestId("ai-page");
		await expect(aiPage).toBeVisible({ timeout: 15000 });

		// For a user with access: chat interface is visible
		// For a user without access: upgrade prompt is visible
		const chatInterface = page.getByTestId("ai-chat-interface");
		const upgradePrompt = page.getByTestId("upgrade-prompt");

		const chatCount = await chatInterface.count();
		const upgradeCount = await upgradePrompt.count();

		// One of the two must be visible
		expect(chatCount + upgradeCount).toBeGreaterThanOrEqual(1);

		if (upgradeCount > 0) {
			// Upgrade prompt should contain upgrade CTA
			await expect(upgradePrompt).toContainText("Upgrade to");
		}
	});
});

// =========================================================================
// Usage Limit Banners
// =========================================================================

test.describe("Usage Limit Banner", () => {
	test("AI chat page does not show banner when under limit", async ({
		page,
	}) => {
		await page.goto("/ai");

		const aiPage = page.getByTestId("ai-page");
		await expect(aiPage).toBeVisible({ timeout: 15000 });

		// If user has access, check that banner is not visible when under limit
		const chatInterface = page.getByTestId("ai-chat-interface");
		const chatCount = await chatInterface.count();

		if (chatCount > 0) {
			// Banner should NOT be visible when usage is under limit
			const banner = page.getByTestId("usage-limit-banner-chat");
			await expect(banner).not.toBeVisible();
		}
	});

	test("AI report page does not show banner when under limit", async ({
		page,
	}) => {
		await page.goto("/ai");

		const aiPage = page.getByTestId("ai-page");
		await expect(aiPage).toBeVisible({ timeout: 15000 });

		// Switch to report mode
		const reportOption = page.getByTestId("ai-mode-option-report");
		const reportCount = await reportOption.count();

		if (reportCount > 0) {
			await reportOption.click();
			await expect(page.getByTestId("ai-report-interface")).toBeVisible();

			// Banner should NOT be visible when under limit
			const banner = page.getByTestId("usage-limit-banner-reports");
			await expect(banner).not.toBeVisible();
		}
	});
});
