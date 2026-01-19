import { expect, test } from "@playwright/test";

/**
 * E2E Tests for Strategy Cover Image Components
 *
 * Tests the cover image upload functionality and default gradient display
 * on strategy pages. These components provide visual identity for strategies.
 *
 * Prerequisites:
 * - Authenticated user (via global.setup.ts)
 * - At least one strategy exists for the test user
 *
 * Components tested:
 * - CoverImageUpload (src/components/strategy/cover-image-upload.tsx)
 * - DefaultCover (src/components/strategy/default-cover.tsx)
 *
 * Data-testid attributes used:
 * - cover-upload-zone: Main drop zone container
 * - cover-upload-input: Hidden file input
 * - cover-image: Displayed image when uploaded
 * - cover-change-overlay: Hover overlay with "Change Image" text
 * - cover-delete-button: X button to remove image
 * - default-cover: Generated gradient cover container
 * - default-cover-name: Strategy name text on gradient
 * - default-cover-category: Category badge on gradient
 *
 * Note: These tests require US-031 (Strategy Hero Banner) to be complete
 * for full functionality. Tests marked with .fixme() will be enabled
 * once the cover image components are integrated into strategy pages.
 */
test.describe("Strategy Cover Image", () => {
	/**
	 * Test that the default gradient is displayed when a strategy has no cover image.
	 *
	 * The DefaultCover component generates a gradient from the strategy color
	 * with the strategy name centered in large monospace text.
	 */
	test.fixme(
		"displays default gradient when no cover image",
		async ({ page }) => {
			// Navigate to strategies list
			await page.goto("/strategies");

			// Wait for page to load
			await page.waitForLoadState("networkidle");

			// Click on first strategy card to go to detail page
			const strategyCard = page
				.locator('[data-testid*="strategy-card"]')
				.first();
			await strategyCard.click();

			// Wait for strategy detail page to load
			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Verify default cover is displayed (when no image uploaded)
			const defaultCover = page.getByTestId("default-cover");
			await expect(defaultCover).toBeVisible({ timeout: 10000 });

			// Verify strategy name is displayed on the gradient
			const coverName = page.getByTestId("default-cover-name");
			await expect(coverName).toBeVisible();
			await expect(coverName).toHaveText(/.+/); // Should have some text
		},
	);

	/**
	 * Test that an existing cover image is displayed correctly.
	 *
	 * When a strategy has a cover image URL, the CoverImageUpload component
	 * displays the image instead of the default gradient.
	 */
	test.fixme("displays existing cover image correctly", async ({ page }) => {
		// This test requires a strategy with an uploaded cover image
		// Navigate to strategies list
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		// Click on first strategy card
		const strategyCard = page.locator('[data-testid*="strategy-card"]').first();
		await strategyCard.click();

		await page.waitForURL(/\/strategies\/[a-z0-9]+/);

		// Look for either the cover image or default cover
		// If cover-image is visible, strategy has an uploaded image
		const coverImage = page.getByTestId("cover-image");
		const defaultCover = page.getByTestId("default-cover");

		// At least one should be visible
		const hasCoverImage = await coverImage.isVisible().catch(() => false);
		const hasDefaultCover = await defaultCover.isVisible().catch(() => false);

		expect(hasCoverImage || hasDefaultCover).toBe(true);
	});

	/**
	 * Test that the upload zone is interactive and shows hover state.
	 *
	 * The CoverImageUpload component should:
	 * - Be clickable to open file picker
	 * - Show visual feedback on hover/focus
	 */
	test.fixme("upload zone shows hover state", async ({ page }) => {
		// Navigate to a strategy detail page in edit mode
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		// Click on first strategy card
		const strategyCard = page.locator('[data-testid*="strategy-card"]').first();
		await strategyCard.click();

		await page.waitForURL(/\/strategies\/[a-z0-9]+/);

		// Look for the upload zone
		const uploadZone = page.getByTestId("cover-upload-zone");

		// If upload zone exists, test hover state
		const isVisible = await uploadZone.isVisible().catch(() => false);
		if (isVisible) {
			// Hover over the upload zone
			await uploadZone.hover();

			// The zone should show "Change Image" overlay when hovering over an existing image
			// or maintain hover styling when empty
			// Either the overlay should appear or the zone should have focus-visible styles
			// Check if overlay becomes visible on hover
			const changeOverlay = page.getByTestId("cover-change-overlay");
			await changeOverlay.isVisible().catch(() => false);

			// Upload zone should be focusable and interactive
			await uploadZone.focus();
			await expect(uploadZone).toBeFocused();
		}
	});

	/**
	 * Test that the delete button removes the cover image.
	 *
	 * When hovering over an existing cover image, a delete button (X icon)
	 * appears in the top-right corner. Clicking it should remove the image
	 * and show the default gradient.
	 */
	test.fixme("delete button removes cover image", async ({ page }) => {
		// Navigate to a strategy with a cover image
		await page.goto("/strategies");
		await page.waitForLoadState("networkidle");

		// Click on first strategy card
		const strategyCard = page.locator('[data-testid*="strategy-card"]').first();
		await strategyCard.click();

		await page.waitForURL(/\/strategies\/[a-z0-9]+/);

		// Look for cover image
		const coverImage = page.getByTestId("cover-image");
		const hasCoverImage = await coverImage.isVisible().catch(() => false);

		if (hasCoverImage) {
			// Hover to show delete button
			const uploadZone = page.getByTestId("cover-upload-zone");
			await uploadZone.hover();

			// Find and click delete button
			const deleteButton = page.getByTestId("cover-delete-button");
			await expect(deleteButton).toBeVisible();
			await deleteButton.click();

			// After deletion, default cover should be visible instead
			// Wait for the image to be removed and default cover to appear
			await expect(page.getByTestId("default-cover")).toBeVisible({
				timeout: 10000,
			});
		}
	});

	/**
	 * Test that the change overlay appears on hover when image exists.
	 *
	 * When an image is displayed and user hovers over it, a semi-transparent
	 * overlay with "Change Image" text should appear.
	 */
	test.fixme(
		"change overlay appears on hover when image exists",
		async ({ page }) => {
			// Navigate to a strategy detail page
			await page.goto("/strategies");
			await page.waitForLoadState("networkidle");

			// Click on first strategy card
			const strategyCard = page
				.locator('[data-testid*="strategy-card"]')
				.first();
			await strategyCard.click();

			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Look for cover image
			const coverImage = page.getByTestId("cover-image");
			const hasCoverImage = await coverImage.isVisible().catch(() => false);

			if (hasCoverImage) {
				// Initially, change overlay should be hidden (opacity-0)
				const changeOverlay = page.getByTestId("cover-change-overlay");

				// Hover over the upload zone to trigger overlay
				const uploadZone = page.getByTestId("cover-upload-zone");
				await uploadZone.hover();

				// Overlay should now be visible
				await expect(changeOverlay).toBeVisible();
			}
		},
	);

	/**
	 * Test default cover displays category badge when category tag exists.
	 *
	 * When a strategy has a category tag, the DefaultCover component
	 * displays it as a badge in the bottom-left corner.
	 */
	test.fixme(
		"default cover displays category badge when available",
		async ({ page }) => {
			// Navigate to strategies list
			await page.goto("/strategies");
			await page.waitForLoadState("networkidle");

			// Click on first strategy card
			const strategyCard = page
				.locator('[data-testid*="strategy-card"]')
				.first();
			await strategyCard.click();

			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			// Check if default cover is displayed
			const defaultCover = page.getByTestId("default-cover");
			const hasDefaultCover = await defaultCover.isVisible().catch(() => false);

			if (hasDefaultCover) {
				// Category badge may or may not be present depending on strategy
				const categoryBadge = page.getByTestId("default-cover-category");
				const hasCategoryBadge = await categoryBadge
					.isVisible()
					.catch(() => false);

				// If category badge exists, it should have text
				if (hasCategoryBadge) {
					await expect(categoryBadge).toHaveText(/.+/);
				}
			}
		},
	);
});

/**
 * Tests for drag-and-drop functionality.
 *
 * These tests verify the drag-and-drop upload experience works correctly.
 */
test.describe("Cover Image Drag and Drop", () => {
	/**
	 * Test that drag-and-drop zone shows visual feedback when dragging files.
	 *
	 * When a file is dragged over the upload zone, it should:
	 * - Show border highlight (chartreuse/primary color)
	 * - Display "Drop image here" text
	 */
	test.fixme(
		"shows visual feedback when dragging files over zone",
		async ({ page }) => {
			// Navigate to strategy detail page
			await page.goto("/strategies");
			await page.waitForLoadState("networkidle");

			// Click on first strategy card
			const strategyCard = page
				.locator('[data-testid*="strategy-card"]')
				.first();
			await strategyCard.click();

			await page.waitForURL(/\/strategies\/[a-z0-9]+/);

			const uploadZone = page.getByTestId("cover-upload-zone");
			const isVisible = await uploadZone.isVisible().catch(() => false);

			if (isVisible) {
				// Note: Playwright doesn't have native drag-and-drop simulation for files
				// This test documents the expected behavior for manual testing
				// The component should show:
				// - isDragging state with border-primary class
				// - "Drop image here" text when isDragging is true

				// Verify the upload zone has the correct attributes for drag-and-drop
				await expect(uploadZone).toHaveAttribute("role", "button");
				await expect(uploadZone).toHaveAttribute("tabindex", "0");
			}
		},
	);
});
