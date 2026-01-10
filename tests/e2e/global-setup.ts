import path from "node:path";
import dotenv from "dotenv";

/**
 * Playwright global setup for E2E tests.
 *
 * Loads environment variables before tests run.
 * Auth bypass is handled via E2E_TEST_MODE environment variable.
 */
export default async function globalSetup() {
	// Load environment variables from .env file
	dotenv.config({ path: path.resolve(process.cwd(), ".env") });

	// Log that E2E test mode will be used
	console.log("E2E Test Mode: Auth bypass enabled via E2E_TEST_MODE=true");
}
