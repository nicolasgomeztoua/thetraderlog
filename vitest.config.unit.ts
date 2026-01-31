import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		// No global setup needed for unit tests (no database)
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
