import { expect, test } from "@playwright/test";

/**
 * AI Report Mode E2E Tests
 *
 * Tests the AI report interface functionality including the request form,
 * suggested prompts, date range inputs, and report history.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("AI Report Mode", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/ai");

		// Wait for page to load
		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Switch to Report mode via segmented control button
		await page.getByTestId("ai-mode-option-report").click();

		// Verify report interface is visible
		await expect(page.getByTestId("ai-report-interface")).toBeVisible();
	});

	test("report mode shows request form", async ({ page }) => {
		// Prompt input should be visible
		const promptInput = page.getByTestId("report-prompt-input");
		await expect(promptInput).toBeVisible();

		// Date range inputs should be visible
		const dateStart = page.getByTestId("report-date-start");
		await expect(dateStart).toBeVisible();

		const dateEnd = page.getByTestId("report-date-end");
		await expect(dateEnd).toBeVisible();

		// Generate button should be visible
		const generateButton = page.getByTestId("report-generate-button");
		await expect(generateButton).toBeVisible();
	});

	test("can fill in prompt and date range", async ({ page }) => {
		// Fill in the prompt
		const promptInput = page.getByTestId("report-prompt-input");
		await promptInput.fill("Analyze my weekly performance trends");
		await expect(promptInput).toHaveValue(
			"Analyze my weekly performance trends",
		);

		// Fill in date range
		const dateStart = page.getByTestId("report-date-start");
		await dateStart.fill("2026-01-01");
		await expect(dateStart).toHaveValue("2026-01-01");

		const dateEnd = page.getByTestId("report-date-end");
		await dateEnd.fill("2026-01-31");
		await expect(dateEnd).toHaveValue("2026-01-31");
	});

	test("suggested prompts are clickable and populate input", async ({
		page,
	}) => {
		// Suggested prompts section should be visible
		const suggestedPrompts = page.getByTestId("report-suggested-prompts");
		await expect(suggestedPrompts).toBeVisible();

		// There should be multiple suggested prompt buttons
		const promptButtons = page.getByTestId("report-suggested-prompt");
		const count = await promptButtons.count();
		expect(count).toBeGreaterThanOrEqual(3);

		// Click the first suggested prompt
		const firstPrompt = promptButtons.first();
		const promptText = await firstPrompt.textContent();
		await firstPrompt.click();

		// Prompt input should now contain the suggested prompt text
		const promptInput = page.getByTestId("report-prompt-input");
		await expect(promptInput).toHaveValue(promptText ?? "");
	});

	test("generate button is disabled without prompt", async ({ page }) => {
		const generateButton = page.getByTestId("report-generate-button");

		// Should be disabled when prompt is empty
		await expect(generateButton).toBeDisabled();

		// Fill in prompt
		const promptInput = page.getByTestId("report-prompt-input");
		await promptInput.fill("Analyze my trades");

		// Now should be enabled
		await expect(generateButton).toBeEnabled();

		// Clear prompt
		await promptInput.fill("");

		// Should be disabled again
		await expect(generateButton).toBeDisabled();
	});

	test("report history section is visible with empty state", async ({
		page,
	}) => {
		// Report history area should be visible (empty state for new user)
		const emptyState = page.getByTestId("report-empty-state");
		await expect(emptyState).toBeVisible();
	});

	test("refresh button is visible in report history", async ({ page }) => {
		const refreshButton = page.getByTestId("report-refresh-button");
		await expect(refreshButton).toBeVisible();
	});
});

test.describe("AI Report Mode - Unauthenticated", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user from /ai to sign-in", async ({
		page,
	}) => {
		await page.goto("/ai");

		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		expect(page.url()).toContain("/sign-in");
	});
});
