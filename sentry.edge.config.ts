import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.SENTRY_DSN,

	// Only enable in production
	enabled: process.env.NODE_ENV === "production",

	// Include user IP + request headers for debugging
	sendDefaultPii: true,

	// Tracing: 10% of requests in production
	tracesSampleRate: 0.1,

	// Structured logging via Sentry.logger.*
	enableLogs: true,
});
