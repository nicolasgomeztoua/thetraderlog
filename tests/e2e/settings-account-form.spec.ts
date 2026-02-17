import { expect, test } from "@playwright/test";

/**
 * Settings Account Form E2E Tests
 *
 * Tests the account creation/edit dialog with prop firm template selector.
 * Auth state is pre-loaded from global.setup.ts via storageState config.
 */
test.describe("Settings Account Form - Template Selector", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to settings, accounts tab
		await page.goto("/settings?tab=accounts");
		await page.waitForTimeout(2000);
	});

	test("opens account creation dialog", async ({ page }) => {
		// Click the "Add Account" button
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();

		// Verify dialog opens with correct title
		const dialogTitle = page.getByRole("heading", { name: /create account/i });
		await expect(dialogTitle).toBeVisible({ timeout: 5000 });
	});

	test("shows prop firm fields when account type is prop_challenge", async ({
		page,
	}) => {
		// Open the dialog
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Select "Prop Challenge" account type
		const accountTypeSelect = page
			.locator('[data-slot="select-trigger"]')
			.first();
		// The account type is the first select in the grid
		const accountTypeContainer = page.locator(".space-y-2").filter({
			has: page.getByText("Account Type"),
		});
		const accountTypeTrigger = accountTypeContainer.locator(
			'[data-slot="select-trigger"]',
		);
		await accountTypeTrigger.click();
		await page.getByRole("option", { name: /prop challenge/i }).click();

		// Verify prop firm rules section appears
		await expect(page.getByText("Prop Firm Rules")).toBeVisible({
			timeout: 5000,
		});

		// Verify prop firm template selector is visible
		await expect(
			page.getByTestId("account-form-select-prop-firm"),
		).toBeVisible();
	});

	test("shows prop firm fields when account type is prop_funded", async ({
		page,
	}) => {
		// Open the dialog
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Select "Prop Funded" account type
		const accountTypeContainer = page.locator(".space-y-2").filter({
			has: page.getByText("Account Type"),
		});
		const accountTypeTrigger = accountTypeContainer.locator(
			'[data-slot="select-trigger"]',
		);
		await accountTypeTrigger.click();
		await page.getByRole("option", { name: /prop funded/i }).click();

		// Verify prop firm rules section appears
		await expect(page.getByText("Prop Firm Rules")).toBeVisible({
			timeout: 5000,
		});
	});

	test("does not show prop firm fields for live accounts", async ({ page }) => {
		// Open the dialog
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Default should be "Live" - verify prop firm section is NOT visible
		await expect(page.getByText("Prop Firm Rules")).not.toBeVisible();
		await expect(
			page.getByTestId("account-form-select-prop-firm"),
		).not.toBeVisible();
	});

	test("selecting a prop firm shows account size dropdown", async ({
		page,
	}) => {
		// Open dialog and set account type to prop_challenge
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Select Prop Challenge
		const accountTypeContainer = page.locator(".space-y-2").filter({
			has: page.getByText("Account Type"),
		});
		const accountTypeTrigger = accountTypeContainer.locator(
			'[data-slot="select-trigger"]',
		);
		await accountTypeTrigger.click();
		await page.getByRole("option", { name: /prop challenge/i }).click();

		// Select Topstep as the prop firm
		await page.getByTestId("account-form-select-prop-firm").click();
		await page.getByRole("option", { name: /topstep/i }).click();

		// Verify account size dropdown appears
		await expect(
			page.getByTestId("account-form-select-account-size"),
		).toBeVisible({ timeout: 5000 });
	});

	test("selecting Topstep $50K auto-fills rule fields", async ({ page }) => {
		// Open dialog and set account type to prop_challenge
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Select Prop Challenge
		const accountTypeContainer = page.locator(".space-y-2").filter({
			has: page.getByText("Account Type"),
		});
		const accountTypeTrigger = accountTypeContainer.locator(
			'[data-slot="select-trigger"]',
		);
		await accountTypeTrigger.click();
		await page.getByRole("option", { name: /prop challenge/i }).click();

		// Select Topstep
		await page.getByTestId("account-form-select-prop-firm").click();
		await page.getByRole("option", { name: /topstep/i }).click();

		// Select $50K size
		await page.getByTestId("account-form-select-account-size").click();
		await page.getByRole("option", { name: /50K/i }).click();

		// Verify fields auto-filled with Topstep $50K values
		await expect(
			page.getByTestId("account-form-input-max-drawdown"),
		).toHaveValue("2000");
		await expect(page.getByTestId("account-form-input-daily-loss")).toHaveValue(
			"1000",
		);
		await expect(
			page.getByTestId("account-form-input-max-position"),
		).toHaveValue("5");
		await expect(
			page.getByTestId("account-form-input-consistency"),
		).toHaveValue("50");
	});

	test("auto-filled fields remain editable", async ({ page }) => {
		// Open dialog and set account type to prop_challenge
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Select Prop Challenge
		const accountTypeContainer = page.locator(".space-y-2").filter({
			has: page.getByText("Account Type"),
		});
		const accountTypeTrigger = accountTypeContainer.locator(
			'[data-slot="select-trigger"]',
		);
		await accountTypeTrigger.click();
		await page.getByRole("option", { name: /prop challenge/i }).click();

		// Select Topstep $50K
		await page.getByTestId("account-form-select-prop-firm").click();
		await page.getByRole("option", { name: /topstep/i }).click();
		await page.getByTestId("account-form-select-account-size").click();
		await page.getByRole("option", { name: /50K/i }).click();

		// Modify auto-filled max drawdown
		const maxDrawdownInput = page.getByTestId(
			"account-form-input-max-drawdown",
		);
		await maxDrawdownInput.fill("1500");
		await expect(maxDrawdownInput).toHaveValue("1500");

		// Modify auto-filled daily loss
		const dailyLossInput = page.getByTestId("account-form-input-daily-loss");
		await dailyLossInput.fill("800");
		await expect(dailyLossInput).toHaveValue("800");
	});

	test("Reset to Default button restores template values", async ({ page }) => {
		// Open dialog and set account type to prop_challenge
		const addButton = page.getByRole("button", { name: /add account/i });
		await expect(addButton).toBeVisible({ timeout: 15000 });
		await addButton.click();
		await expect(
			page.getByRole("heading", { name: /create account/i }),
		).toBeVisible();

		// Select Prop Challenge
		const accountTypeContainer = page.locator(".space-y-2").filter({
			has: page.getByText("Account Type"),
		});
		const accountTypeTrigger = accountTypeContainer.locator(
			'[data-slot="select-trigger"]',
		);
		await accountTypeTrigger.click();
		await page.getByRole("option", { name: /prop challenge/i }).click();

		// Select Topstep $50K
		await page.getByTestId("account-form-select-prop-firm").click();
		await page.getByRole("option", { name: /topstep/i }).click();
		await page.getByTestId("account-form-select-account-size").click();
		await page.getByRole("option", { name: /50K/i }).click();

		// Modify max drawdown to a custom value
		const maxDrawdownInput = page.getByTestId(
			"account-form-input-max-drawdown",
		);
		await maxDrawdownInput.fill("999");
		await expect(maxDrawdownInput).toHaveValue("999");

		// Click Reset to Default
		await page.getByTestId("account-form-button-reset-template").click();

		// Verify values are restored to template defaults
		await expect(maxDrawdownInput).toHaveValue("2000");
	});
});
