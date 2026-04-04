import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.SENTRY_DSN,

	// Include user IP + request headers for debugging
	sendDefaultPii: true,

	// Tracing: 100% in dev, 10% in production
	tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

	// Structured logging via Sentry.logger.*
	enableLogs: true,
});
