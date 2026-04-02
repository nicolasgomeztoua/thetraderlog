import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		DATABASE_URL: z.url(),
		DATABASE_READ_URL: z.url().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		CLERK_SECRET_KEY: z.string().min(1),
		CLERK_WEBHOOK_SECRET: z.string().min(1),
		DATABENTO_API_KEY: z.string().min(1),
		// Trigger.dev for background jobs
		TRIGGER_SECRET_KEY: z.string().min(1),
		// S3-compatible storage (optional - for file uploads)
		S3_ENDPOINT: z.string().url(),
		S3_REGION: z.string(),
		S3_ACCESS_KEY_ID: z.string(),
		S3_SECRET_ACCESS_KEY: z.string(),
		S3_BUCKET: z.string(),
		// Public URL for S3 objects (optional - for embedding images in HTML)
		S3_PUBLIC_URL: z.string().url().optional(),
		// OpenRouter API key for AI chat/reports
		OPENROUTER_API_KEY: z.string().min(1),
		// Daytona API key for Python sandbox execution (optional — only needed for run_python tool)
		DAYTONA_API_KEY: z.string().min(1).optional(),
		// Resend API key for transactional emails (optional — only needed for report email delivery)
		RESEND_API_KEY: z.string().min(1).optional(),
	},

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
		NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
		NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
		NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/dashboard"),
		NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/dashboard"),
		NEXT_PUBLIC_APP_URL: z.string().url().optional(),
		NEXT_PUBLIC_CLERK_PLAN_ID_STARTER: z.string().optional(),
		NEXT_PUBLIC_CLERK_PLAN_ID_PRO: z.string().optional(),
	},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		DATABASE_URL: process.env.DATABASE_URL,
		DATABASE_READ_URL: process.env.DATABASE_READ_URL,
		NODE_ENV: process.env.NODE_ENV,
		CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY,
		CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
		NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
		NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
		NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
		NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL:
			process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
		NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL:
			process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_CLERK_PLAN_ID_STARTER:
			process.env.NEXT_PUBLIC_CLERK_PLAN_ID_STARTER,
		NEXT_PUBLIC_CLERK_PLAN_ID_PRO: process.env.NEXT_PUBLIC_CLERK_PLAN_ID_PRO,
		DATABENTO_API_KEY: process.env.DATABENTO_API_KEY,
		TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY,
		S3_ENDPOINT: process.env.S3_ENDPOINT,
		S3_REGION: process.env.S3_REGION,
		S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
		S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
		S3_BUCKET: process.env.S3_BUCKET,
		S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
		OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
		DAYTONA_API_KEY: process.env.DAYTONA_API_KEY,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
});
