import { expect, test } from "@playwright/test";

/**
 * AI Chat Mode E2E Tests
 *
 * Tests the AI page layout, mode switching, and chat interface functionality.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("AI Chat Mode", () => {
	test("loads AI page with mode switcher visible", async ({ page }) => {
		await page.goto("/ai");

		// Verify page loads
		const heading = page.getByTestId("ai-heading");
		await expect(heading).toBeVisible({ timeout: 15000 });
		await expect(heading).toHaveText("AI Insights");

		// Verify mode selector is visible
		const modeSelector = page.getByTestId("ai-mode-selector");
		await expect(modeSelector).toBeVisible();

		// Verify model selector is visible
		const modelSelector = page.getByTestId("ai-model-selector");
		await expect(modelSelector).toBeVisible();
	});

	test("defaults to Chat mode with chat interface", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		// Chat interface should be visible by default
		const chatInterface = page.getByTestId("ai-chat-interface");
		await expect(chatInterface).toBeVisible();

		// Report interface should not be visible
		const reportInterface = page.getByTestId("ai-report-interface");
		await expect(reportInterface).not.toBeVisible();
	});

	test("can switch between Chat and Report modes", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		// Start in chat mode
		await expect(page.getByTestId("ai-chat-interface")).toBeVisible();

		// Click mode selector to switch to Report
		await page.getByTestId("ai-mode-selector").click();
		await page.getByTestId("ai-mode-option-report").click();

		// Report interface should now be visible
		await expect(page.getByTestId("ai-report-interface")).toBeVisible();
		await expect(page.getByTestId("ai-chat-interface")).not.toBeVisible();

		// Switch back to Chat
		await page.getByTestId("ai-mode-selector").click();
		await page.getByTestId("ai-mode-option-chat").click();

		// Chat interface should be visible again
		await expect(page.getByTestId("ai-chat-interface")).toBeVisible();
		await expect(page.getByTestId("ai-report-interface")).not.toBeVisible();
	});

	test("displays empty state with suggested queries", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		// Empty state should be visible (no active conversation)
		const emptyState = page.getByTestId("chat-empty-state");
		await expect(emptyState).toBeVisible();

		// Suggested queries should be visible
		const suggestedQueries = page.getByTestId("chat-suggested-queries");
		await expect(suggestedQueries).toBeVisible();

		// There should be multiple suggested query buttons
		const queryButtons = page.getByTestId("chat-suggested-query");
		const count = await queryButtons.count();
		expect(count).toBeGreaterThanOrEqual(4);
	});

	test("suggested queries populate the input field", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		// Wait for empty state
		await expect(page.getByTestId("chat-empty-state")).toBeVisible();

		// Click the first suggested query
		const firstQuery = page.getByTestId("chat-suggested-query").first();
		const queryText = await firstQuery.textContent();
		await firstQuery.click();

		// Input should now contain the query text
		const input = page.getByTestId("chat-input");
		await expect(input).toHaveValue(queryText ?? "");
	});

	test("displays chat input form with send button", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		// Input form should be visible
		const inputForm = page.getByTestId("chat-input-form");
		await expect(inputForm).toBeVisible();

		// Input field should be visible and empty
		const input = page.getByTestId("chat-input");
		await expect(input).toBeVisible();
		await expect(input).toHaveValue("");

		// Send button should be visible but disabled (empty input)
		const sendButton = page.getByTestId("chat-send-button");
		await expect(sendButton).toBeVisible();
		await expect(sendButton).toBeDisabled();
	});

	test("send button enables when input has text", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		const input = page.getByTestId("chat-input");
		const sendButton = page.getByTestId("chat-send-button");

		// Initially disabled
		await expect(sendButton).toBeDisabled();

		// Type something
		await input.fill("What is my win rate?");

		// Now enabled
		await expect(sendButton).toBeEnabled();

		// Clear input
		await input.fill("");

		// Disabled again
		await expect(sendButton).toBeDisabled();
	});

	test("displays conversation sidebar with new button", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-heading")).toBeVisible({
			timeout: 15000,
		});

		// Sidebar should be visible (on desktop)
		const sidebar = page.getByTestId("chat-sidebar");
		await expect(sidebar).toBeVisible();

		// New conversation button should be visible
		const newButton = page.getByTestId("chat-new-conversation-button");
		await expect(newButton).toBeVisible();
	});
});

test.describe("AI Page - Unauthenticated", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("redirects unauthenticated user from /ai to sign-in", async ({
		page,
	}) => {
		await page.goto("/ai");

		await page.waitForURL(/\/sign-in/, { timeout: 15000 });

		expect(page.url()).toContain("/sign-in");
	});
});
