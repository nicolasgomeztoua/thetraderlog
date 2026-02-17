import { expect, test } from "@playwright/test";

/**
 * Prop Firm Status Widget E2E Tests
 *
 * Tests the PropFirmStatusWidget component on the dashboard.
 * The widget shows prop firm rule status with color-coded progress bars.
 *
 * Note: The test user may not have prop firm accounts, so the widget
 * may show either the empty state or the full status view depending
 * on the test account setup. These tests verify both states.
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Prop Firm Status Widget", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/dashboard");
		await expect(page.getByTestId("dashboard-heading-overview")).toBeVisible({
			timeout: 15000,
		});
	});

	test("widget container renders on dashboard", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);

		// The prop firm widget should be visible on the dashboard
		const widget = page.getByTestId("widget-prop-firm-status");
		await expect(widget).toBeVisible({ timeout: 15000 });
	});

	test("shows empty state or status content", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);

		const widget = page.getByTestId("widget-prop-firm-status");
		await expect(widget).toBeVisible({ timeout: 15000 });

		// Wait for content to load (past skeleton)
		await page.waitForTimeout(5000);

		// Widget should show either:
		// 1. Empty state with settings link (no prop accounts)
		// 2. Status badge with rules (has prop accounts)
		const emptyState = page.getByTestId("prop-firm-empty-state");
		const statusBadge = page.getByTestId("prop-firm-status-badge");
		const lockedState = page.getByTestId("prop-firm-locked");

		const hasEmpty = await emptyState.isVisible().catch(() => false);
		const hasStatus = await statusBadge.isVisible().catch(() => false);
		const hasLocked = await lockedState.isVisible().catch(() => false);

		// At least one state should be visible
		expect(hasEmpty || hasStatus || hasLocked).toBe(true);
	});

	test("empty state shows settings link", async ({ page }, testInfo) => {
		testInfo.setTimeout(60000);

		const widget = page.getByTestId("widget-prop-firm-status");
		await expect(widget).toBeVisible({ timeout: 15000 });

		// Wait for content
		await page.waitForTimeout(5000);

		const emptyState = page.getByTestId("prop-firm-empty-state");
		const hasEmpty = await emptyState.isVisible().catch(() => false);

		if (hasEmpty) {
			// Empty state should have a link to settings
			const settingsLink = page.getByTestId("prop-firm-link-settings");
			await expect(settingsLink).toBeVisible();
			await expect(settingsLink).toHaveAttribute("href", "/settings");
		}
	});

	test("status view shows progress bars when prop accounts exist", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(60000);

		const widget = page.getByTestId("widget-prop-firm-status");
		await expect(widget).toBeVisible({ timeout: 15000 });

		// Wait for content
		await page.waitForTimeout(5000);

		const statusBadge = page.getByTestId("prop-firm-status-badge");
		const hasStatus = await statusBadge.isVisible().catch(() => false);

		if (hasStatus) {
			// Should show compact rules section
			const compactRules = page.getByTestId("prop-firm-compact-rules");
			await expect(compactRules).toBeVisible({ timeout: 5000 });

			// Should show expand toggle if additional rules exist
			const expandToggle = page.getByTestId("prop-firm-toggle-expand");
			const hasExpand = await expandToggle.isVisible().catch(() => false);

			if (hasExpand) {
				// Click expand to show all rules
				await expandToggle.click();

				const expandedRules = page.getByTestId("prop-firm-expanded-rules");
				await expect(expandedRules).toBeVisible({ timeout: 5000 });

				// Click again to collapse
				await expandToggle.click();
				await expect(expandedRules).not.toBeVisible({ timeout: 5000 });
			}
		}
	});
});
