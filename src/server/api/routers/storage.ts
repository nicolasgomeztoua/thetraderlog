import { nanoid } from "nanoid";
import { z } from "zod";
import { env } from "@/env";
import { getPresignedUploadUrl, isS3Configured } from "@/lib/storage/s3";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

/**
 * Construct the proxy URL for viewing an S3 object.
 * Uses public URL if configured, otherwise returns proxy URL.
 */
function getImageUrl(key: string): string {
	// Use public URL if configured (CDN/public bucket)
	if (env.S3_PUBLIC_URL) {
		return `${env.S3_PUBLIC_URL}/${key}`;
	}

	// Use proxy URL (permanent, no expiry)
	return `/api/images/${key}`;
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
			// Format: journals/{userId}/{context}/{uuid}-{filename}
			// Using journals/ prefix for auth-protected private images
			const uuid = nanoid();
			const key = `journals/${ctx.user.id}/${input.context}/${uuid}-${input.filename}`;

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			// Generate proxy URL for embedding (permanent, no expiry)
			const publicUrl = getImageUrl(key);

			return {
				presignedUrl,
				publicUrl,
			};
		}),
});
