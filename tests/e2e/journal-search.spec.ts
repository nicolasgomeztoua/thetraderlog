import { expect, test } from "@playwright/test";

/**
 * Journal Search E2E Tests
 *
 * Smoke tests for the journal search UI:
 * - Journal page search bar renders and accepts input
 * - Global search opens with Cmd+K
 * - Search results appear after typing
 *
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Journal Search", () => {
	test("journal page search bar renders and accepts input", async ({
		page,
	}) => {
		await page.goto("/daily-journal");

		// Wait for page to load
		await page.waitForTimeout(3000);

		// Verify search component is visible
		const search = page.getByTestId("journal-search");
		await expect(search).toBeVisible({ timeout: 15000 });

		// Verify input is available
		const input = page.getByTestId("journal-search-input");
		await expect(input).toBeVisible();

		// Type a query
		await input.fill("test");
		await expect(input).toHaveValue("test");
	});

	test("search results appear after typing in journal search", async ({
		page,
	}, testInfo) => {
		testInfo.setTimeout(30000);
		await page.goto("/daily-journal");

		// Wait for page to load
		await page.waitForTimeout(3000);

		const input = page.getByTestId("journal-search-input");
		await expect(input).toBeVisible({ timeout: 15000 });

		// Type a search query
		await input.fill("journal");

		// Wait for debounce + API call
		await page.waitForTimeout(1000);

		// Results dropdown should appear (even if empty)
		const results = page.getByTestId("journal-search-results");
		await expect(results).toBeVisible({ timeout: 10000 });
	});

	test("clear button resets journal search", async ({ page }) => {
		await page.goto("/daily-journal");

		// Wait for page to load
		await page.waitForTimeout(3000);

		const input = page.getByTestId("journal-search-input");
		await expect(input).toBeVisible({ timeout: 15000 });

		// Type a query
		await input.fill("test query");
		await expect(input).toHaveValue("test query");

		// Click clear button
		const clearButton = page.getByTestId("journal-search-button-clear");
		await expect(clearButton).toBeVisible();
		await clearButton.click();

		// Input should be cleared
		await expect(input).toHaveValue("");
	});

	test("global search opens with Cmd+K", async ({ page }) => {
		await page.goto("/daily-journal");

		// Wait for page to load
		await page.waitForTimeout(3000);

		// Verify trigger button exists
		const trigger = page.getByTestId("global-search-trigger");
		await expect(trigger).toBeVisible({ timeout: 15000 });

		// Open with keyboard shortcut
		await page.keyboard.press("Meta+k");

		// Dialog should appear
		const dialog = page.getByTestId("global-search-dialog");
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Input should be focused
		const input = page.getByTestId("global-search-input");
		await expect(input).toBeVisible();
	});

	test("global search opens via trigger button", async ({ page }) => {
		await page.goto("/daily-journal");

		// Wait for page to load
		await page.waitForTimeout(3000);

		// Click the trigger button
		const trigger = page.getByTestId("global-search-trigger");
		await expect(trigger).toBeVisible({ timeout: 15000 });
		await trigger.click();

		// Dialog should appear
		const dialog = page.getByTestId("global-search-dialog");
		await expect(dialog).toBeVisible({ timeout: 5000 });
	});

	test("global search closes on Escape", async ({ page }) => {
		await page.goto("/daily-journal");

		// Wait for page to load
		await page.waitForTimeout(3000);

		// Open global search
		await page.keyboard.press("Meta+k");

		const dialog = page.getByTestId("global-search-dialog");
		await expect(dialog).toBeVisible({ timeout: 5000 });

		// Close with Escape
		await page.keyboard.press("Escape");

		// Dialog should be gone
		await expect(dialog).not.toBeVisible({ timeout: 5000 });
	});
});
