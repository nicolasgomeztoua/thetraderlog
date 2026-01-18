import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for E2E testing with Clerk authentication.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "setup",
			testMatch: /global\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "playwright/.clerk/user.json",
			},
			dependencies: ["setup"],
		},
		{
			name: "firefox",
			use: {
				...devices["Desktop Firefox"],
				storageState: "playwright/.clerk/user.json",
			},
			dependencies: ["setup"],
		},
		{
			name: "webkit",
			use: {
				...devices["Desktop Safari"],
				storageState: "playwright/.clerk/user.json",
			},
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: "bun run dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
	},
});
