import { expect, test } from "@playwright/test";

/**
 * AI Chat Mode E2E Tests
 *
 * Smoke tests for the redesigned AI chat interface.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("AI Chat Mode", () => {
	test("loads AI page with mode selector visible", async ({ page }) => {
		await page.goto("/ai");

		// Verify page loads
		const aiPage = page.getByTestId("ai-page");
		await expect(aiPage).toBeVisible({ timeout: 15000 });

		// Verify mode selector is visible with Chat and Report options
		const modeSelector = page.getByTestId("ai-mode-selector");
		await expect(modeSelector).toBeVisible();
		await expect(page.getByTestId("ai-mode-option-chat")).toBeVisible();
		await expect(page.getByTestId("ai-mode-option-report")).toBeVisible();
	});

	test("defaults to Chat mode with chat interface", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
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

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Start in chat mode
		await expect(page.getByTestId("ai-chat-interface")).toBeVisible();

		// Click Report button in segmented control
		await page.getByTestId("ai-mode-option-report").click();

		// Report interface should now be visible
		await expect(page.getByTestId("ai-report-interface")).toBeVisible();
		await expect(page.getByTestId("ai-chat-interface")).not.toBeVisible();

		// Switch back to Chat
		await page.getByTestId("ai-mode-option-chat").click();

		// Chat interface should be visible again
		await expect(page.getByTestId("ai-chat-interface")).toBeVisible();
		await expect(page.getByTestId("ai-report-interface")).not.toBeVisible();
	});

	// =========================================================================
	// Empty State
	// =========================================================================

	test("displays empty state with greeting, pills, and suggested queries", async ({
		page,
	}) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Empty state should be visible (no active conversation)
		const emptyState = page.getByTestId("chat-empty-state");
		await expect(emptyState).toBeVisible();

		// Time-aware greeting should be visible
		const greeting = page.getByTestId("chat-empty-greeting");
		await expect(greeting).toBeVisible();
		await expect(greeting).toContainText(/Good (morning|afternoon|evening)/);

		// Capability pills should be visible
		const pills = page.getByTestId("chat-capability-pills");
		await expect(pills).toBeVisible();

		// Suggested queries should be visible with exactly 4 cards
		const suggestedQueries = page.getByTestId("chat-suggested-queries");
		await expect(suggestedQueries).toBeVisible();

		const queryButtons = page.getByTestId("chat-suggested-query");
		const count = await queryButtons.count();
		expect(count).toBe(4);
	});

	test("suggested queries send immediately on click", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Wait for empty state
		await expect(page.getByTestId("chat-empty-state")).toBeVisible();

		// Click the first suggested query - should send immediately (empty state disappears)
		const firstQuery = page.getByTestId("chat-suggested-query").first();
		await firstQuery.click();

		// Empty state should disappear since the message was sent
		await expect(page.getByTestId("chat-empty-state")).not.toBeVisible({
			timeout: 5000,
		});
	});

	// =========================================================================
	// Chat Input
	// =========================================================================

	test("displays chat input form with send button", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
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

		await expect(page.getByTestId("ai-page")).toBeVisible({
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

	test("keyboard shortcut / focuses input", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Click somewhere else first to ensure input isn't focused
		await page.getByTestId("chat-empty-state").click();

		// Press / key
		await page.keyboard.press("/");

		// Input should be focused
		const input = page.getByTestId("chat-input");
		await expect(input).toBeFocused();
	});

	// =========================================================================
	// Sidebar
	// =========================================================================

	test("displays conversation sidebar with new button", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Sidebar should be visible (on desktop)
		const sidebar = page.getByTestId("chat-sidebar");
		await expect(sidebar).toBeVisible();

		// New conversation button should be visible
		const newButton = page.getByTestId("chat-new-conversation-button");
		await expect(newButton).toBeVisible();
	});

	test("sidebar shows empty state when no conversations", async ({ page }) => {
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		const sidebar = page.getByTestId("chat-sidebar");
		await expect(sidebar).toBeVisible();

		// Either shows conversations or empty state
		const emptyState = page.getByTestId("chat-sidebar-empty");
		const count = await emptyState.count();
		if (count > 0) {
			await expect(emptyState).toContainText("No conversations yet");
		}
		// If conversations exist, test passes — we just verify sidebar renders
	});

	// =========================================================================
	// Mobile
	// =========================================================================

	test("mobile hamburger button opens sidebar drawer", async ({ page }) => {
		// Set mobile viewport
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/ai");

		await expect(page.getByTestId("ai-page")).toBeVisible({
			timeout: 15000,
		});

		// Mobile menu button should be visible
		const menuButton = page.getByTestId("chat-mobile-menu-button");
		await expect(menuButton).toBeVisible();

		// Click to open drawer
		await menuButton.click();

		// Sidebar should appear inside the Sheet/drawer
		const mobileSidebar = page.getByTestId("chat-sidebar").nth(1);
		await expect(mobileSidebar).toBeVisible({ timeout: 5000 });
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
