import { nanoid } from "nanoid";
import { z } from "zod";
import {
	ERR_ACCESS_DENIED,
	ERR_S3_DOWNLOADS_NOT_CONFIGURED,
	ERR_S3_NOT_CONFIGURED,
} from "@/lib/constants/errors";
import {
	getPresignedDownloadUrl,
	getPresignedUploadUrl,
	isS3Configured,
} from "@/lib/storage/s3";
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
				throw new Error(ERR_S3_NOT_CONFIGURED);
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

	/**
	 * Get a presigned URL for downloading/viewing an image.
	 * Used after upload to get a URL that can be displayed in the browser.
	 */
	getDownloadUrl: protectedProcedure
		.input(
			z.object({
				key: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(ERR_S3_DOWNLOADS_NOT_CONFIGURED);
			}

			// Verify the key belongs to this user (starts with images/{userId}/)
			const expectedPrefix = `images/${ctx.user.id}/`;
			if (!input.key.startsWith(expectedPrefix)) {
				throw new Error(ERR_ACCESS_DENIED);
			}

			// Generate presigned GET URL (valid for 1 hour)
			const url = getPresignedDownloadUrl(input.key, 3600);

			return { url };
		}),
});
