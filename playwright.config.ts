import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "html",
	globalSetup: "./tests/e2e/setup/global-setup.ts",
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		// Setup project runs first to authenticate and store state
		{
			name: "setup",
			testMatch: /.*\.setup\.ts/,
		},
		// Main tests run after setup completes
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				// Use stored auth state from setup
				storageState: ".auth/user.json",
			},
			dependencies: ["setup"],
		},
	],
	webServer: {
		command: "bun run build && bun run start",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120000,
	},
});
