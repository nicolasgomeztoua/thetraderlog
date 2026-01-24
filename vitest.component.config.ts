import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./tests/setup/component-test-setup.ts"],
		include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
		testTimeout: 10000,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
