import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// No globalSetup - unit tests don't need database containers
		include: ["tests/unit/**/*.test.ts"],
		exclude: ["tests/e2e/**/*"],
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
