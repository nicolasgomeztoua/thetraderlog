/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "f6d1d15e6f0b37b4b8fcad3c41a7922d.r2.cloudflarestorage.com",
				pathname: "/edgejournal-assets-98io7/**",
			},
		],
	},
};

export default config;
