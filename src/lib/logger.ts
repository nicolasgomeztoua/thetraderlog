/**
 * Structured logger — wide events over scattered log lines.
 *
 * Philosophy (loggingsucks.com):
 *   - Optimized for QUERYING, not writing
 *   - Structured key-value context, not string interpolation
 *   - High cardinality (userId, tradeId, reportId) for filtering
 *   - Business context alongside technical context
 *   - Errors always reported to Sentry Issues with full context
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *
 *   logger.info("Trade imported", { userId, tradeId, symbol, broker: "NinjaTrader" });
 *   logger.warn("Prefetch retry", { symbol, interval, attempt: 2, maxRetries: 3 });
 *   logger.error("S3 delete failed", error, { key: attachment.key, tradeId });
 *
 * Levels:
 *   debug  → dev only, never hits Sentry
 *   info   → notable events (import, report generated, prefetch complete)
 *   warn   → degraded but recovered (retry, fallback, missing data)
 *   error  → operation failed → Sentry.captureException()
 *   fatal  → system-level failure → Sentry.captureException({ level: "fatal" })
 */
import * as Sentry from "@sentry/nextjs";

type LogContext = Record<string, unknown>;

/** Format context as structured key=value pairs for readable console output */
function formatPairs(ctx: LogContext): string {
	return Object.entries(ctx)
		.map(([k, v]) => {
			if (v === undefined || v === null) return null;
			if (typeof v === "string") return `${k}=${v}`;
			return `${k}=${JSON.stringify(v)}`;
		})
		.filter(Boolean)
		.join(" ");
}

/** Build a structured log line: [LEVEL] message key=val key=val */
function toLogLine(level: string, message: string, ctx?: LogContext): string {
	const pairs = ctx ? formatPairs(ctx) : "";
	return pairs ? `[${level}] ${message} ${pairs}` : `[${level}] ${message}`;
}

/** Send structured log to Sentry Logs product */
function toSentry(
	level: "debug" | "info" | "warn" | "error" | "fatal",
	message: string,
	ctx?: LogContext,
) {
	// Sentry.logger accepts the message and optional key-value params
	Sentry.logger[level](ctx ? `${message} ${formatPairs(ctx)}` : message);
}

export const logger = {
	/** Dev-only noise — never leaves the machine */
	debug(message: string, context?: LogContext) {
		if (process.env.NODE_ENV !== "development") return;
		console.debug(toLogLine("DEBUG", message, context));
	},

	/** Notable event — trade imported, report generated, prefetch done */
	info(message: string, context?: LogContext) {
		console.info(toLogLine("INFO", message, context));
		toSentry("info", message, context);
	},

	/** Degraded but recovered — retry, fallback, missing spec */
	warn(message: string, context?: LogContext) {
		console.warn(toLogLine("WARN", message, context));
		toSentry("warn", message, context);
	},

	/** Operation failed — also creates a Sentry Issue with full context */
	error(message: string, error?: unknown, context?: LogContext) {
		console.error(toLogLine("ERROR", message, context), error ?? "");
		toSentry("error", message, context);

		// Report to Sentry Issues so it shows up in the dashboard
		if (error instanceof Error) {
			Sentry.captureException(error, { extra: { ...context, message } });
		} else if (error !== undefined && error !== null) {
			Sentry.captureException(new Error(message), {
				extra: { ...context, originalError: String(error) },
			});
		} else {
			// No error object — still capture the message as an exception
			Sentry.captureException(new Error(message), { extra: context });
		}
	},

	/** Unrecoverable — system-level, highest severity */
	fatal(message: string, error?: unknown, context?: LogContext) {
		console.error(toLogLine("FATAL", message, context), error ?? "");
		toSentry("fatal", message, context);

		if (error instanceof Error) {
			Sentry.captureException(error, {
				level: "fatal",
				extra: { ...context, message },
			});
		} else {
			Sentry.captureException(new Error(message), {
				level: "fatal",
				extra: { ...context, originalError: error ? String(error) : undefined },
			});
		}
	},
};
