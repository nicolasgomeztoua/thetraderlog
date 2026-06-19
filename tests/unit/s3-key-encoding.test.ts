import { describe, expect, it } from "vitest";

import {
	safeDecodeKey,
	sanitizeFilenameForKey,
	transformHtmlToS3Keys,
} from "@/lib/storage/s3-utils";

/**
 * Regression coverage for the "paste image -> broken image" bug.
 *
 * Root cause: S3 keys built from raw filenames with spaces/special chars get
 * percent-encoded in the presigned URL. The encoded form was then sliced back
 * out and stored, so the next read re-signed it and double-encoded ("%20" ->
 * "%2520"), pointing at a non-existent object. The fixes are (1) sanitize the
 * filename at key creation so keys never contain encodable chars, and (2) decode
 * keys when extracting/signing so legacy encoded keys still resolve.
 */

describe("sanitizeFilenameForKey", () => {
	it("replaces spaces and special chars so the key needs no URL-encoding", () => {
		const result = sanitizeFilenameForKey(
			"Screenshot 2026-06-15 at 9.41 AM.png",
		);
		expect(result).toBe("Screenshot_2026-06-15_at_9.41_AM.png");
		// The whole point: a sanitized name survives encodeURIComponent untouched.
		expect(encodeURIComponent(result)).toBe(result);
	});

	it("strips parentheses, unicode, and collapses repeats", () => {
		const result = sanitizeFilenameForKey("café (final) (1).png");
		expect(result).not.toMatch(/[^a-zA-Z0-9._-]/);
		expect(result).not.toContain("__");
		expect(encodeURIComponent(result)).toBe(result);
	});

	it("keeps the file extension intact", () => {
		expect(sanitizeFilenameForKey("my photo.jpeg")).toBe("my_photo.jpeg");
	});

	it("falls back to a default when nothing usable remains", () => {
		expect(sanitizeFilenameForKey("   ")).toBe("image");
		expect(sanitizeFilenameForKey("")).toBe("image");
	});
});

describe("safeDecodeKey", () => {
	it("decodes a percent-encoded key back to its literal form", () => {
		expect(
			safeDecodeKey("images/user_1/trade-notes/abc-Screenshot%202026%20AM.png"),
		).toBe("images/user_1/trade-notes/abc-Screenshot 2026 AM.png");
	});

	it("is a no-op for already-clean keys", () => {
		const key = "images/user_1/trade-notes/abc-Screenshot_2026_AM.png";
		expect(safeDecodeKey(key)).toBe(key);
	});

	it("returns malformed input untouched instead of throwing", () => {
		const malformed = "images/user_1/trade-notes/abc-100%-done.png";
		expect(() => safeDecodeKey(malformed)).not.toThrow();
		expect(safeDecodeKey(malformed)).toBe(malformed);
	});
});

describe("transformHtmlToS3Keys", () => {
	it("stores a DECODED key when extracting from an encoded presigned URL", () => {
		// This is the exact regression: previously this returned a "%20"-laden key
		// which double-encoded on the next read and 404'd.
		const html =
			'<p><img class="max-w-full" src="https://acc.r2.cloudflarestorage.com/bucket/images/user_1/trade-notes/abc-Screenshot%202026-06-15%20at%209.41.23%20AM.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef"></p>';

		const result = transformHtmlToS3Keys(html);

		expect(result).toBe(
			'<p><img class="max-w-full" src="images/user_1/trade-notes/abc-Screenshot 2026-06-15 at 9.41.23 AM.png"></p>',
		);
		// No percent-escapes survive into the stored key.
		expect(result).not.toContain("%");
	});

	it("round-trips a sanitized-filename URL to a stable key with no re-encoding", () => {
		const key = `images/user_1/trade-notes/abc-${sanitizeFilenameForKey(
			"Screenshot 2026-06-15 at 9.41.23 AM.png",
		)}`;
		const html = `<img src="https://acc.r2.cloudflarestorage.com/bucket/${key}?X-Amz-Signature=abc">`;

		const stored = transformHtmlToS3Keys(html) ?? "";

		expect(stored).toContain(`src="${key}"`);
		expect(stored).not.toContain("%");
	});

	it("leaves non-S3 image URLs unchanged", () => {
		const html = '<img src="https://example.com/cat.png">';
		expect(transformHtmlToS3Keys(html)).toBe(html);
	});

	it("passes null through", () => {
		expect(transformHtmlToS3Keys(null)).toBeNull();
	});
});
