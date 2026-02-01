import { nanoid } from "nanoid";
import { z } from "zod";
import { getPresignedUploadUrl, isS3Configured } from "@/lib/storage/s3";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

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

			return {
				presignedUrl,
				key,
			};
		}),
});
