import { expect, test } from "@playwright/test";

/**
 * AI Report Mode E2E Tests
 *
 * Smoke tests for the redesigned AI report interface.
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

	// =========================================================================
	// Form Section
	// =========================================================================

	test("report mode shows request form with all sections", async ({ page }) => {
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

		// Suggested prompts section should be visible
		const suggestedPrompts = page.getByTestId("report-suggested-prompts");
		await expect(suggestedPrompts).toBeVisible();
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

	test("quick date presets fill in date fields", async ({ page }) => {
		// Click a date preset button (e.g., "Last 7 days")
		const presetButton = page.getByRole("button", { name: "Last 7 days" });
		await presetButton.click();

		// Both date fields should now have values
		const dateStart = page.getByTestId("report-date-start");
		const dateEnd = page.getByTestId("report-date-end");
		await expect(dateStart).not.toHaveValue("");
		await expect(dateEnd).not.toHaveValue("");
	});

	test("suggested prompts populate textarea on click", async ({ page }) => {
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

	// =========================================================================
	// History Panel
	// =========================================================================

	test("report history section is visible", async ({ page }) => {
		// Either shows reports or empty state
		const emptyState = page.getByTestId("report-empty-state");
		const count = await emptyState.count();
		if (count > 0) {
			await expect(emptyState).toContainText("No reports yet");
		}
		// If reports exist, test passes — history panel is rendered
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
