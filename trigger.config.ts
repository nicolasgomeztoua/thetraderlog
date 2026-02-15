import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
	project: "proj_marsyipkncnbpuycshht",
	runtime: "bun",
	logLevel: "log",
	// Maximum compute time for tasks (5 minutes should be plenty for MAE/MFE)
	maxDuration: 300, 
	build: {
		extensions: [puppeteer()],
	},
	retries: {
		enabledInDev: true,
		default: {
			maxAttempts: 3,
			minTimeoutInMs: 1000,
			maxTimeoutInMs: 10000,
			factor: 2,
			randomize: true,
		},
	},
	dirs: ["./src/trigger"],
});
