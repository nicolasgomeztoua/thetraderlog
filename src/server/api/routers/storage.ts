import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "@/env";
import {
	getPresignedUploadUrl,
	getS3Bucket,
	isS3Configured,
} from "@/lib/storage/s3";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Construct the public URL for an S3 object.
 * Uses the custom domain if configured, otherwise falls back to the S3 endpoint.
 */
function getPublicUrl(key: string): string {
	// Use custom domain if configured (e.g., for CDN)
	if (env.S3_PUBLIC_URL) {
		return `${env.S3_PUBLIC_URL}/${key}`;
	}

	// Fall back to S3 endpoint + bucket
	const bucket = getS3Bucket();
	const endpoint = env.S3_ENDPOINT ?? "";

	// Remove trailing slash from endpoint if present
	const cleanEndpoint = endpoint.replace(/\/$/, "");

	return `${cleanEndpoint}/${bucket}/${key}`;
}

export const storageRouter = createTRPCRouter({
	/**
	 * Get a presigned URL for uploading an image.
	 * This is a generic endpoint for any context (trade-notes, journal-preview, etc.)
	 * without creating database attachment records.
	 */
	getImageUploadUrl: protectedProcedure
		.input(
			z.object({
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive(),
				context: z.string().min(1), // e.g., "trade-notes", "journal-preview"
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(
					"File uploads are not configured. S3 settings are missing.",
				);
			}

			// Generate a unique key for the file
			// Format: images/{userId}/{context}/{uuid}-{filename}
			const uuid = nanoid();
			const key = `images/${ctx.user.id}/${input.context}/${uuid}-${input.filename}`;

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			// Generate public URL for embedding in HTML
			const publicUrl = getPublicUrl(key);

			return {
				presignedUrl,
				publicUrl,
			};
		}),
});
