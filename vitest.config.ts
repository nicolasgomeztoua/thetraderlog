import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		globalSetup: ["./tests/setup/global-setup.ts"],
		setupFiles: ["./tests/setup/test-env.ts"],
		include: ["tests/integration/**/*.test.ts", "tests/unit/**/*.test.ts"],
		exclude: ["tests/e2e/**/*"],
		testTimeout: 30000, // Container startup can be slow
		hookTimeout: 60000,
		// Run test files sequentially to avoid port conflicts
		fileParallelism: false,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
