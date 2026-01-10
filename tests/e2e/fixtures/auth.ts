import { expect, test as base } from "@playwright/test";

/**
 * Authentication Fixture for E2E Tests
 *
 * This fixture extends Playwright's base test with pre-authenticated state.
 * Tests using this fixture will automatically be logged in as the test user,
 * without needing to go through the sign-in flow each time.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/auth';
 *
 *   test('should access protected route', async ({ page }) => {
 *     await page.goto('/dashboard');
 *     await expect(page).toHaveURL('/dashboard');
 *   });
 *
 * How it works:
 * - The auth.setup.ts project runs first and saves session state to .auth/user.json
 * - This fixture loads that stored state, so tests start already authenticated
 * - This makes tests faster and more reliable (no login UI interactions)
 *
 * For unauthenticated tests, import directly from '@playwright/test' instead.
 */

const AUTH_STATE_PATH = ".auth/user.json";

/**
 * Authenticated test fixture.
 * Extends base test with stored authentication state from .auth/user.json.
 */
export const test = base.extend({
	// Automatically use stored auth state for all tests using this fixture
	storageState: AUTH_STATE_PATH,
});

/**
 * Re-export expect for convenience.
 * Tests can import both test and expect from the same module.
 */
export { expect };
