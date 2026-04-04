/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import("next").NextConfig} */
const config = {
	experimental: {
		optimizePackageImports: ["lucide-react"],
	},
};

export default withSentryConfig(config, {
	// Sentry organization and project (set via env or hardcode after creating project)
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,

	// Source map upload auth token
	authToken: process.env.SENTRY_AUTH_TOKEN,

	// Upload wider set of client source files for better stack traces
	widenClientFileUpload: true,

	// Proxy route to bypass ad-blockers
	tunnelRoute: "/monitoring",

	// Suppress build output except in CI
	silent: !process.env.CI,
});
