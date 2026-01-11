import { S3Client } from "bun";
import { env } from "@/env";

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
 */

// Check if S3 is configured
export function isS3Configured(): boolean {
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
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
	if (!isS3Configured()) {
		throw new Error(
			"S3 is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET environment variables.",
		);
	}

	if (!s3Client) {
		s3Client = new S3Client({
			endpoint: env.S3_ENDPOINT,
			region: env.S3_REGION ?? "auto",
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
			bucket: env.S3_BUCKET,
		});
	}

	return s3Client;
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
