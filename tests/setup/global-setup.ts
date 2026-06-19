import { execSync } from "node:child_process";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

let container: StartedPostgreSqlContainer;

export async function setup() {
	console.log("\n🐳 Starting PostgreSQL container...");

	// Start PostgreSQL container
	container = await new PostgreSqlContainer("postgres:15-alpine")
		.withDatabase("testdb")
		.withUsername("testuser")
		.withPassword("testpassword")
		.start();

	const connectionUrl = container.getConnectionUri();
	console.log(`✅ PostgreSQL container started at: ${connectionUrl}`);

	// Store connection URL for tests to use
	process.env.TEST_DATABASE_URL = connectionUrl;

	// Use drizzle-kit push to sync schema directly from schema.ts
	// This ensures we always use the same schema definition
	console.log("📦 Pushing schema to test database...");

	try {
		execSync(
			`npx drizzle-kit push --dialect postgresql --schema ./src/server/db/schema.ts --url "${connectionUrl}"`,
			{
				cwd: process.cwd(),
				stdio: "pipe",
				env: {
					...process.env,
					SKIP_ENV_VALIDATION: "true",
				},
			},
		);
		console.log("✅ Schema pushed successfully!\n");
	} catch (error) {
		console.error("Failed to push schema:", error);
		throw error;
	}

	// Return teardown function
	return async () => {
		console.log("\n🧹 Stopping PostgreSQL container...");
		await container.stop();
		console.log("✅ Container stopped.\n");
	};
}

export default setup;
