import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	globalSetup: "./tests/e2e/global-setup.ts",
	fullyParallel: false, // Run tests serially to avoid dev server overload
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1, // 1 retry locally for flaky network
	workers: 1, // Single worker for stability with dev server
	reporter: "html",
	timeout: 60_000, // Increase test timeout
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	webServer: {
		command: "E2E_TEST_MODE=true bun run dev",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			E2E_TEST_MODE: "true",
		},
	},
});
