import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

	// Only enable in production (no DSN in local .env = completely disabled)
	enabled: process.env.NODE_ENV === "production",

	// Include user IP + request headers for debugging
	sendDefaultPii: true,

	// Tracing: 10% of requests in production
	tracesSampleRate: 0.1,

	// Session Replay: 10% of all sessions, 100% of sessions with errors
	replaysSessionSampleRate: 0.1,
	replaysOnErrorSampleRate: 1.0,

	// Structured logging via Sentry.logger.*
	enableLogs: true,

	integrations: [Sentry.replayIntegration()],
});

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
