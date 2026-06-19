// This file runs before each test file
// It ensures the test environment variables are set up correctly

import { afterAll, beforeAll, vi } from "vitest";
import { triggerMock } from "../mocks/trigger";

// Mock Trigger.dev tasks BEFORE any imports resolve
// This prevents tests from trying to connect to Trigger.dev
vi.mock("@/trigger/process-import-maemfe", () => ({
	processImportMAEMFE: {
		trigger: async (payload: { tradeIds: string[]; userId: string }) => {
			triggerMock.triggerCalls.push(payload);
			return {
				id: `mock-run-${Date.now()}`,
				taskIdentifier: "process-import-maemfe",
			};
		},
	},
}));

// Skip t3-env validation during tests
process.env.SKIP_ENV_VALIDATION = "true";

// NODE_ENV is already set by Vitest, no need to override it

// Mock Clerk keys (not used in tests since we bypass auth)
process.env.CLERK_SECRET_KEY = "sk_test_mock_key_for_testing";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_mock_key_for_testing";

beforeAll(() => {
	// Verify test database URL is available from global setup
	if (!process.env.TEST_DATABASE_URL) {
		throw new Error(
			"TEST_DATABASE_URL not set. Make sure global-setup.ts ran successfully.",
		);
	}
});

afterAll(() => {
	// Cleanup after each test file if needed
});
