/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	// Disable ESLint during builds - this project uses Biome for linting instead
	eslint: {
		ignoreDuringBuilds: true,
	},
};

export default config;
