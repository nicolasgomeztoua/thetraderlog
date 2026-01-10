/**
 * E2E Test Fixture with Auth Bypass
 *
 * In E2E test mode (E2E_TEST_MODE=true), authentication is bypassed:
 * - Middleware allows all requests through
 * - tRPC uses a fixed test user ID (e2e-test-user)
 * - Test user is auto-created in the database on first request
 *
 * This provides a simpler alternative to Clerk testing tokens.
 */

import { test as base } from "@playwright/test";

export const test = base.extend({
	// No special setup needed - auth bypass is handled by environment variable
	page: async ({ page }, use) => {
		await use(page);
	},
});

export { expect } from "@playwright/test";
