import { env } from "@/env";

// Declare Bun global for TypeScript - only available in Bun runtime
declare const Bun: unknown | undefined;

/**
 * S3-compatible storage client for file uploads.
 * Uses Bun's built-in S3Client for native performance.
 *
 * Supports any S3-compatible provider:
 * - AWS S3
 * - Cloudflare R2
 * - MinIO
 * - DigitalOcean Spaces
 * - etc.
 *
 * Note: This module only works in a Bun runtime. In test environments (vitest/Node.js),
 * S3 functions will throw an error if called.
 */

// Type for Bun's S3Client (not importing directly to avoid issues in non-Bun environments)
interface BunS3Client {
	presign(key: string, options: { method: string; expiresIn: number }): string;
	delete(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
}

// Check if running in Bun
function isBunRuntime(): boolean {
	return typeof Bun !== "undefined";
}

// Check if S3 is configured
export function isS3Configured(): boolean {
	// In non-Bun environments (tests), S3 is never configured
	if (!isBunRuntime()) {
		return false;
	}
	return !!(
		env.S3_ENDPOINT &&
		env.S3_ACCESS_KEY_ID &&
		env.S3_SECRET_ACCESS_KEY &&
		env.S3_BUCKET
	);
}

// Get the configured bucket name
export function getS3Bucket(): string {
	if (!env.S3_BUCKET) {
		throw new Error("S3_BUCKET is not configured");
	}
	return env.S3_BUCKET;
}

// Create S3 client (lazy initialization)
let s3Client: BunS3Client | null = null;

export function getS3Client(): BunS3Client {
	if (!isBunRuntime()) {
		throw new Error("S3 operations are only supported in Bun runtime");
	}

	if (!isS3Configured()) {
		throw new Error(
			"S3 is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET environment variables.",
		);
	}

	if (!s3Client) {
		// Dynamic import from Bun - we know we're in Bun runtime at this point
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { S3Client } = require("bun");
		s3Client = new S3Client({
			endpoint: env.S3_ENDPOINT,
			region: env.S3_REGION ?? "auto",
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			bucket: env.S3_BUCKET,
		}) as BunS3Client;
	}

	return s3Client as BunS3Client;
}

/**
 * Generate a presigned URL for uploading a file.
 *
 * @param key - The object key (path) for the file
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Presigned PUT URL
 */
export function getPresignedUploadUrl(
	key: string,
	expiresIn: number = 3600,
): string {
	const client = getS3Client();
	return client.presign(key, {
		method: "PUT",
		expiresIn,
	});
}

/**
 * Generate a presigned URL for downloading/viewing a file.
 *
 * @param key - The object key (path) for the file
 * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
 * @returns Presigned GET URL
 */
export function getPresignedDownloadUrl(
	key: string,
	expiresIn: number = 3600,
): string {
	const client = getS3Client();
	return client.presign(key, {
		method: "GET",
		expiresIn,
	});
}

/**
 * Delete an object from S3.
 *
 * @param key - The object key (path) to delete
 */
export async function deleteObject(key: string): Promise<void> {
	const client = getS3Client();
	await client.delete(key);
}

/**
 * Check if an object exists in S3.
 *
 * @param key - The object key (path) to check
 * @returns True if the object exists
 */
export async function objectExists(key: string): Promise<boolean> {
	const client = getS3Client();
	return client.exists(key);
}

/**
 * Transform HTML content by replacing S3 keys in img src with presigned URLs.
 * S3 keys are stored in the format: images/{userId}/{context}/{uuid}-{filename}
 * or attachments/{userId}/{entityType}/{entityId}/{uuid}-{filename}
 *
 * @param html - HTML string potentially containing S3 keys in img src
 * @returns HTML with S3 keys replaced by presigned URLs, or null if input is null
 */
export function transformHtmlWithPresignedUrls(
	html: string | null,
): string | null {
	if (!html || !isS3Configured()) return html;

	// Match img src with S3 keys (paths starting with "images/" or "attachments/")
	// Captures: <img ... src="images/user_xxx/context/file.png" ...>
	// Or: <img ... src="attachments/user_xxx/trade/tr-xxx/file.png" ...>
	return html.replace(
		/(<img[^>]*\ssrc=")((?:images|attachments)\/[^"]+)("[^>]*>)/gi,
		(_, before: string, key: string, after: string) => {
			const url = getPresignedDownloadUrl(key, 3600);
			return `${before}${url}${after}`;
		},
	);
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
	// Match img src with S3 keys (paths starting with "images/" or "attachments/")
	const regex = /<img[^>]*\ssrc="((?:images|attachments)\/[^"]+)"[^>]*>/gi;

	for (const match of html.matchAll(regex)) {
		if (match[1]) {
			keys.push(match[1]);
		}
	}

	return keys;
}
