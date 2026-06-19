/**
 * Pure utility functions for S3 key manipulation.
 * These functions don't require the Bun runtime and can be used in both
 * client and server environments.
 */

/**
 * Decode a percent-encoded S3 key back to its canonical (literal) form.
 *
 * Keys are sliced out of presigned URLs whose path is already percent-encoded,
 * so a key with a space arrives here as "...%20...". If it is re-signed without
 * decoding, the "%" gets encoded again ("%2520") and the URL points at a
 * non-existent object. Always store/sign keys in decoded form. Malformed input
 * (a stray "%") is returned untouched rather than throwing.
 */
export function safeDecodeKey(key: string): string {
	try {
		return decodeURIComponent(key);
	} catch {
		return key;
	}
}

/**
 * Sanitize an uploaded filename so the resulting S3 key never contains
 * characters that get percent-encoded in a presigned URL (spaces, parens,
 * unicode, etc.). Without this, keys round-trip through encoded presigned URLs
 * and end up double-encoded on the next read, producing broken images.
 *
 * Keeps the extension readable: "Screenshot 2026 (1).png" -> "Screenshot_2026_1_.png".
 */
export function sanitizeFilenameForKey(filename: string): string {
	const cleaned = filename
		.replace(/[^a-zA-Z0-9._-]+/g, "_")
		.replace(/_{2,}/g, "_")
		.replace(/^[._]+/, "")
		.slice(0, 128);
	return cleaned.length > 0 ? cleaned : "image";
}

/**
 * Extract S3 keys from HTML content for orphan tracking.
 * Finds all img src attributes that contain S3 object keys.
 *
 * @param html - HTML string potentially containing S3 keys in img src
 * @returns Array of S3 keys found in the HTML
 */
export function extractS3KeysFromHtml(html: string | null): string[] {
	if (!html) return [];

	const keys: string[] = [];
	// Match img src with S3 keys (paths starting with "images/", "attachments/", "journals/", or "trades/")
	const regex =
		/<img[^>]*\ssrc="((?:images|attachments|journals|trades)\/[^"]+)"[^>]*>/gi;

	for (const match of html.matchAll(regex)) {
		if (match[1]) {
			keys.push(match[1]);
		}
	}

	return keys;
}

/**
 * Transform HTML content by replacing presigned S3 URLs with their S3 keys.
 * This is the inverse of transformHtmlWithPresignedUrls - used before saving.
 *
 * Detects presigned URLs by looking for URLs containing our S3 key patterns
 * (images/, attachments/, journals/, trades/) and extracts just the key portion.
 *
 * @param html - HTML string potentially containing presigned URLs in img src
 * @returns HTML with presigned URLs replaced by S3 keys
 */
export function transformHtmlToS3Keys(html: string | null): string | null {
	if (!html) return html;

	// Match img src attributes
	return html.replace(
		/<img([^>]*)\ssrc="([^"]+)"([^>]*)>/gi,
		(match, before: string, src: string, after: string) => {
			// Check if this is a presigned URL containing one of our S3 key patterns
			const keyMatch = src.match(
				/((?:images|attachments|journals|trades)\/[^?]+)/,
			);
			if (keyMatch?.[1]) {
				// Extract the S3 key (path without query params) and decode it —
				// the presigned URL path is percent-encoded, and storing the
				// encoded form would double-encode it on the next read.
				return `<img${before} src="${safeDecodeKey(keyMatch[1])}"${after}>`;
			}
			// Not a presigned URL with our patterns, leave unchanged
			return match;
		},
	);
}
