import { expect, test } from "@playwright/test";

/**
 * E2E Tests for Marketplace Detail Page and Publishing Flow
 *
 * Tests the marketplace strategy detail page functionality including:
 * - Page loading and structure
 * - Cover image and hero banner
 * - Strategy info display
 * - Voting functionality
 * - Download button behavior
 * - Tab navigation
 *
 * Also tests the publishing flow from the strategy detail page:
 * - Publish dialog opening and validation
 * - Successful publishing updates UI
 * - Unpublish flow
 *
 * Prerequisites:
 * - Authenticated user (via global.setup.ts)
 *
 * Data-testid attributes used:
 * - marketplace-detail-page: Main page container
 * - marketplace-detail-hero: Cover image/gradient hero
 * - marketplace-detail-title: Strategy name heading
 * - marketplace-detail-author: Author name display
 * - marketplace-detail-back: Back to marketplace link
 * - marketplace-detail-vote-buttons: Voting controls
 * - marketplace-detail-download-button: Download/Add button
 * - marketplace-detail-stats: Stats row container
 * - marketplace-detail-tags: Instrument/category tags
 * - marketplace-detail-tabs: Tab navigation
 * - marketplace-detail-content: Tab content area
 * - marketplace-detail-not-found: 404 state
 * - marketplace-detail-loading: Loading state
 *
 * Strategy detail page testids:
 * - strategy-publish-button: Publish to marketplace button
 * - strategy-published-badge: Published indicator
 * - strategy-unpublish-button: Unpublish menu item
 * - strategy-unpublish-dialog: Unpublish confirmation dialog
 * - strategy-unpublish-confirm: Confirm unpublish button
 *
 * Publish dialog testids:
 * - publish-dialog: Main publish dialog
 * - publish-dialog-cancel: Cancel button
 * - publish-dialog-submit: Publish button
 * - publish-anonymous-toggle: Anonymous checkbox
 */

test.describe("Marketplace Detail Page", () => {
	/**
	 * Note: These tests require a published strategy to exist.
	 * In a real environment, you would either:
	 * 1. Seed the database with test data
	 * 2. Create a strategy and publish it in a beforeAll hook
	 * 3. Mock the API responses
	 *
	 * For now, these tests check the page structure and behavior
	 * assuming a valid strategy exists or proper 404 handling.
	 */

	/**
	 * Test that accessing a non-existent marketplace strategy shows 404.
	 */
	test("shows not found for invalid strategy ID", async ({ page }) => {
		await page.goto("/marketplace/invalid-strategy-id-12345");

		// Should show not found state
		const notFound = page.getByTestId("marketplace-detail-not-found");
		await expect(notFound).toBeVisible({ timeout: 15000 });

		// Should have back to marketplace link
		await expect(page.getByText(/Back to Marketplace/i)).toBeVisible();
	});

	/**
	 * Test that the marketplace detail page has proper structure.
	 * Note: Marked as fixme because it requires a published strategy.
	 */
	test.fixme("displays strategy detail page structure", async ({ page }) => {
		// This test requires a published strategy ID
		await page.goto("/marketplace/[valid-strategy-id]");

		// Wait for page to load
		const detailPage = page.getByTestId("marketplace-detail-page");
		await expect(detailPage).toBeVisible({ timeout: 15000 });

		// Hero should be visible
		const hero = page.getByTestId("marketplace-detail-hero");
		await expect(hero).toBeVisible();

		// Title should be visible
		const title = page.getByTestId("marketplace-detail-title");
		await expect(title).toBeVisible();

		// Author should be visible
		const author = page.getByTestId("marketplace-detail-author");
		await expect(author).toBeVisible();

		// Back link should be visible
		const backLink = page.getByTestId("marketplace-detail-back");
		await expect(backLink).toBeVisible();
	});

	/**
	 * Test that vote buttons are visible on detail page.
	 * Note: Marked as fixme because it requires a published strategy.
	 */
	test.fixme("displays voting controls", async ({ page }) => {
		await page.goto("/marketplace/[valid-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible();

		// Vote buttons should be visible
		const voteButtons = page.getByTestId("marketplace-detail-vote-buttons");
		await expect(voteButtons).toBeVisible();

		// Should have upvote and downvote buttons
		await expect(
			voteButtons.locator('[data-testid="vote-upvote"]'),
		).toBeVisible();
		await expect(
			voteButtons.locator('[data-testid="vote-downvote"]'),
		).toBeVisible();
	});

	/**
	 * Test that download button is visible for non-owner.
	 * Note: Marked as fixme because it requires a published strategy from another user.
	 */
	test.fixme("displays download button for non-owner", async ({ page }) => {
		await page.goto("/marketplace/[valid-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible();

		// Download button should be visible
		const downloadButton = page.getByTestId("download-button");
		await expect(downloadButton).toBeVisible();
		await expect(downloadButton).toContainText(/Add to My Strategies/i);
	});

	/**
	 * Test that stats are displayed.
	 * Note: Marked as fixme because it requires a published strategy.
	 */
	test.fixme("displays strategy stats", async ({ page }) => {
		await page.goto("/marketplace/[valid-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible();

		// Stats row should be visible
		const stats = page.getByTestId("marketplace-detail-stats");
		await expect(stats).toBeVisible();

		// Should show download count and votes
		await expect(stats).toContainText(/download/i);
	});

	/**
	 * Test that tabs are visible and navigable.
	 * Note: Marked as fixme because it requires a published strategy.
	 */
	test.fixme("tabs are visible and navigable", async ({ page }) => {
		await page.goto("/marketplace/[valid-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible();

		// Tabs should be visible
		const tabs = page.getByTestId("marketplace-detail-tabs");
		await expect(tabs).toBeVisible();

		// Should have Overview tab
		await expect(tabs.getByRole("tab", { name: /Overview/i })).toBeVisible();

		// Click on a different tab
		const entryExitTab = tabs.getByRole("tab", { name: /Entry/i });
		if (await entryExitTab.isVisible()) {
			await entryExitTab.click();
			// Content should change
			const content = page.getByTestId("marketplace-detail-content");
			await expect(content).toBeVisible();
		}
	});

	/**
	 * Test back link navigation.
	 */
	test("back link navigates to marketplace", async ({ page }) => {
		await page.goto("/marketplace/some-strategy-id");

		// Wait for page or not found
		const pageOrNotFound = page
			.getByTestId("marketplace-detail-page")
			.or(page.getByTestId("marketplace-detail-not-found"));
		await expect(pageOrNotFound).toBeVisible({ timeout: 15000 });

		// Click back link if visible
		const backLink = page.getByText(/Back to Marketplace/i);
		if (await backLink.isVisible()) {
			await backLink.click();
			await expect(page).toHaveURL(/\/marketplace$/);
		}
	});
});

test.describe("Strategy Publishing Flow", () => {
	/**
	 * Test that unpublished strategy shows publish button.
	 * Note: Requires navigating to an unpublished strategy the user owns.
	 */
	test.fixme(
		"shows publish button for unpublished strategy",
		async ({ page }) => {
			// Navigate to user's own unpublished strategy
			await page.goto("/strategies/[user-strategy-id]");

			// Wait for page to load
			await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

			// Publish button should be visible
			const publishButton = page.getByTestId("strategy-publish-button");
			await expect(publishButton).toBeVisible();
			await expect(publishButton).toContainText(/Publish/i);
		},
	);

	/**
	 * Test that clicking publish opens the dialog.
	 * Note: Requires an unpublished strategy.
	 */
	test.fixme("publish button opens publish dialog", async ({ page }) => {
		await page.goto("/strategies/[user-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Click publish button
		const publishButton = page.getByTestId("strategy-publish-button");
		await publishButton.click();

		// Dialog should open
		const dialog = page.getByTestId("publish-dialog");
		await expect(dialog).toBeVisible();

		// Should have title
		await expect(dialog).toContainText(/Publish to Marketplace/i);

		// Should have submit and cancel buttons
		await expect(page.getByTestId("publish-dialog-cancel")).toBeVisible();
		await expect(page.getByTestId("publish-dialog-submit")).toBeVisible();
	});

	/**
	 * Test publish dialog validation.
	 * Note: Requires an unpublished strategy.
	 */
	test.fixme("publish dialog validates required fields", async ({ page }) => {
		await page.goto("/strategies/[user-strategy-id]");

		// Wait and open dialog
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();
		await page.getByTestId("strategy-publish-button").click();
		await expect(page.getByTestId("publish-dialog")).toBeVisible();

		// Submit without selecting instruments/categories
		await page.getByTestId("publish-dialog-submit").click();

		// Should show error toast (requires instruments and categories)
		// Note: Toast may appear briefly, so we check for the dialog still being open
		await expect(page.getByTestId("publish-dialog")).toBeVisible();
	});

	/**
	 * Test that cancel closes the dialog.
	 * Note: Requires an unpublished strategy.
	 */
	test.fixme("cancel closes publish dialog", async ({ page }) => {
		await page.goto("/strategies/[user-strategy-id]");

		// Wait and open dialog
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();
		await page.getByTestId("strategy-publish-button").click();
		await expect(page.getByTestId("publish-dialog")).toBeVisible();

		// Click cancel
		await page.getByTestId("publish-dialog-cancel").click();

		// Dialog should close
		await expect(page.getByTestId("publish-dialog")).not.toBeVisible();
	});

	/**
	 * Test that published strategy shows badge.
	 * Note: Requires a published strategy owned by the user.
	 */
	test.fixme(
		"shows published badge for published strategy",
		async ({ page }) => {
			await page.goto("/strategies/[published-strategy-id]");

			// Wait for page to load
			await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

			// Published badge should be visible
			const badge = page.getByTestId("strategy-published-badge");
			await expect(badge).toBeVisible();
			await expect(badge).toContainText(/Published/i);
		},
	);

	/**
	 * Test that published badge links to marketplace.
	 * Note: Requires a published strategy owned by the user.
	 */
	test.fixme("published badge links to marketplace page", async ({ page }) => {
		await page.goto("/strategies/[published-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Published badge should have link
		const badge = page.getByTestId("strategy-published-badge");
		await expect(badge).toBeVisible();

		// Should have href pointing to marketplace
		const link = badge.locator("a");
		await expect(link).toHaveAttribute("href", /\/marketplace\//);
	});

	/**
	 * Test unpublish option appears in more menu.
	 * Note: Requires a published strategy owned by the user.
	 */
	test.fixme(
		"shows unpublish in more menu for published strategy",
		async ({ page }) => {
			await page.goto("/strategies/[published-strategy-id]");

			// Wait for page to load
			await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

			// Open more menu
			await page.getByTestId("strategy-more-menu").click();

			// Unpublish option should be visible
			const unpublishItem = page.getByTestId("strategy-unpublish-button");
			await expect(unpublishItem).toBeVisible();
			await expect(unpublishItem).toContainText(/Unpublish/i);
		},
	);

	/**
	 * Test clicking unpublish opens confirmation dialog.
	 * Note: Requires a published strategy owned by the user.
	 */
	test.fixme("unpublish opens confirmation dialog", async ({ page }) => {
		await page.goto("/strategies/[published-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("strategy-detail-page")).toBeVisible();

		// Open more menu and click unpublish
		await page.getByTestId("strategy-more-menu").click();
		await page.getByTestId("strategy-unpublish-button").click();

		// Confirmation dialog should open
		const dialog = page.getByTestId("strategy-unpublish-dialog");
		await expect(dialog).toBeVisible();

		// Should have warning text
		await expect(dialog).toContainText(/Remove.*from the marketplace/i);

		// Should have confirm and cancel buttons
		await expect(page.getByTestId("strategy-unpublish-confirm")).toBeVisible();
	});
});

test.describe("Download Flow", () => {
	/**
	 * Test download button states.
	 * Note: Requires a published strategy from another user.
	 */
	test.fixme("download button shows correct states", async ({ page }) => {
		await page.goto("/marketplace/[valid-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible();

		// Download button should show initial state
		const downloadButton = page.getByTestId("download-button");
		await expect(downloadButton).toBeVisible();

		// Initial state should be "Add to My Strategies"
		await expect(downloadButton).toContainText(/Add to My Strategies/i);
	});

	/**
	 * Test that download button is disabled for own strategy.
	 * Note: Requires navigating to marketplace view of user's own published strategy.
	 */
	test.fixme("download button disabled for own strategy", async ({ page }) => {
		await page.goto("/marketplace/[user-own-published-strategy-id]");

		// Wait for page to load
		await expect(page.getByTestId("marketplace-detail-page")).toBeVisible();

		// Download button should be disabled
		const downloadButton = page.getByTestId("download-button");
		await expect(downloadButton).toBeDisabled();
	});
});
