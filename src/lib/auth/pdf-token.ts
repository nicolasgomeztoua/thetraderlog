import { createHmac, timingSafeEqual } from "node:crypto";

// =============================================================================
// PDF AUTH TOKENS — HMAC-SHA256 signed tokens for Puppeteer print pages
// =============================================================================

const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

function getSecret(): string {
	const secret = process.env.CLERK_SECRET_KEY;
	if (!secret) {
		throw new Error("CLERK_SECRET_KEY is required for PDF token signing");
	}
	return secret;
}

/**
 * Create a signed token for PDF generation.
 * Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 */
export function createPdfToken(reportId: string, userId: string): string {
	const payload = JSON.stringify({
		reportId,
		userId,
		exp: Date.now() + TOKEN_EXPIRY_MS,
	});

	const payloadB64 = Buffer.from(payload).toString("base64url");
	const signature = createHmac("sha256", getSecret())
		.update(payloadB64)
		.digest("base64url");

	return `${payloadB64}.${signature}`;
}

/**
 * Verify a PDF token and return the payload if valid.
 * Returns null if the token is invalid or expired.
 */
export function verifyPdfToken(
	token: string,
): { reportId: string; userId: string } | null {
	const parts = token.split(".");
	if (parts.length !== 2) return null;

	const [payloadB64, signature] = parts as [string, string];

	// Verify HMAC signature
	const expectedSignature = createHmac("sha256", getSecret())
		.update(payloadB64)
		.digest("base64url");

	const sigBuffer = Buffer.from(signature, "base64url");
	const expectedBuffer = Buffer.from(expectedSignature, "base64url");

	if (sigBuffer.length !== expectedBuffer.length) return null;
	if (!timingSafeEqual(sigBuffer, expectedBuffer)) return null;

	// Decode and validate payload
	try {
		const payload = JSON.parse(
			Buffer.from(payloadB64, "base64url").toString("utf-8"),
		) as { reportId: string; userId: string; exp: number };

		if (Date.now() > payload.exp) return null;

		return { reportId: payload.reportId, userId: payload.userId };
	} catch {
		return null;
	}
}
