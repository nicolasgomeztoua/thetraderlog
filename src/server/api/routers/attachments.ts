import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
	deleteObject,
	extractS3KeysFromHtml,
	getPresignedDownloadUrl,
	getPresignedUploadUrl,
	isS3Configured,
} from "@/lib/storage/s3";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import {
	attachments,
	dailyJournals,
	strategies,
	trades,
} from "@/server/db/schema";

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed entity types
const entityTypeSchema = z.enum(["journal", "trade", "strategy"]);

/**
 * Verify that the user owns the entity they're trying to attach to.
 */
async function verifyEntityOwnership(
	db: typeof import("@/server/db").db,
	userId: string,
	entityType: "journal" | "trade" | "strategy",
	entityId: string,
): Promise<boolean> {
	switch (entityType) {
		case "journal": {
			const journal = await db.query.dailyJournals.findFirst({
				where: and(
					eq(dailyJournals.id, entityId),
					eq(dailyJournals.userId, userId),
				),
				columns: { id: true },
			});
			return !!journal;
		}
		case "trade": {
			const trade = await db.query.trades.findFirst({
				where: and(eq(trades.id, entityId), eq(trades.userId, userId)),
				columns: { id: true },
			});
			return !!trade;
		}
		case "strategy": {
			const strategy = await db.query.strategies.findFirst({
				where: and(eq(strategies.id, entityId), eq(strategies.userId, userId)),
				columns: { id: true },
			});
			return !!strategy;
		}
		default:
			return false;
	}
}

export const attachmentsRouter = createTRPCRouter({
	/**
	 * Get a presigned URL for uploading a file.
	 * Creates a pending attachment record in the database.
	 */
	getUploadUrl: protectedProcedure
		.input(
			z.object({
				entityType: entityTypeSchema,
				entityId: z.string().min(1),
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				size: z.number().int().positive().max(MAX_FILE_SIZE),
				embeddedContext: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(
					"File uploads are not configured. S3 settings are missing.",
				);
			}

			// Verify user owns the entity
			const isOwner = await verifyEntityOwnership(
				ctx.db,
				ctx.user.id,
				input.entityType,
				input.entityId,
			);

			if (!isOwner) {
				throw new Error("Entity not found or access denied");
			}

			// Generate a unique key for the file
			// Format: attachments/{userId}/{entityType}/{entityId}/{uuid}-{filename}
			const uuid = nanoid();
			const key = `attachments/${ctx.user.id}/${input.entityType}/${input.entityId}/${uuid}-${input.filename}`;

			// Create pending attachment record (isOrphaned=true until confirmed)
			const [attachment] = await ctx.db
				.insert(attachments)
				.values({
					userId: ctx.user.id,
					entityType: input.entityType,
					entityId: input.entityId,
					key,
					filename: input.filename,
					mimeType: input.mimeType,
					size: input.size,
					embeddedContext: input.embeddedContext ?? null,
					isOrphaned: true, // Pending until confirmed
					orphanedAt: new Date(),
				})
				.returning();

			if (!attachment) {
				throw new Error("Failed to create attachment record");
			}

			// Generate presigned PUT URL (valid for 1 hour)
			const presignedUrl = getPresignedUploadUrl(key, 3600);

			return {
				presignedUrl,
				key,
				attachmentId: attachment.id,
			};
		}),

	/**
	 * Confirm that an upload completed successfully.
	 * Marks the attachment as non-orphaned.
	 */
	confirmUpload: protectedProcedure
		.input(
			z.object({
				attachmentId: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!isS3Configured()) {
				throw new Error(
					"File uploads are not configured. S3 settings are missing.",
				);
			}

			// Find and verify ownership
			const attachment = await ctx.db.query.attachments.findFirst({
				where: and(
					eq(attachments.id, input.attachmentId),
					eq(attachments.userId, ctx.user.id),
				),
			});

			if (!attachment) {
				throw new Error("Attachment not found");
			}

			// Mark as confirmed (not orphaned)
			const [updated] = await ctx.db
				.update(attachments)
				.set({
					isOrphaned: false,
					orphanedAt: null,
				})
				.where(eq(attachments.id, input.attachmentId))
				.returning();

			if (!updated) {
				throw new Error("Failed to confirm attachment");
			}

			// Generate presigned download URL for immediate use
			const url = getPresignedDownloadUrl(updated.key, 3600);

			return {
				...updated,
				url,
			};
		}),

	/**
	 * List attachments for an entity.
	 * Optionally filter by embeddedContext.
	 */
	list: protectedProcedure
		.input(
			z.object({
				entityType: entityTypeSchema,
				entityId: z.string().min(1),
				embeddedContext: z.string().nullish(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify user owns the entity
			const isOwner = await verifyEntityOwnership(
				ctx.db,
				ctx.user.id,
				input.entityType,
				input.entityId,
			);

			if (!isOwner) {
				throw new Error("Entity not found or access denied");
			}

			// Build conditions
			const conditions = [
				eq(attachments.userId, ctx.user.id),
				eq(attachments.entityType, input.entityType),
				eq(attachments.entityId, input.entityId),
				eq(attachments.isOrphaned, false), // Exclude orphaned attachments
			];

			// Filter by embedded context if provided
			if (input.embeddedContext !== undefined) {
				if (input.embeddedContext === null) {
					// Gallery attachments only (not embedded)
					conditions.push(
						eq(attachments.embeddedContext, null as unknown as string),
					);
				} else {
					conditions.push(
						eq(attachments.embeddedContext, input.embeddedContext),
					);
				}
			}

			const results = await ctx.db.query.attachments.findMany({
				where: and(...conditions),
				orderBy: (attachments, { desc }) => [desc(attachments.createdAt)],
			});

			// Generate presigned URLs for each attachment
			if (isS3Configured()) {
				return results.map((attachment) => ({
					...attachment,
					url: getPresignedDownloadUrl(attachment.key, 3600),
				}));
			}

			return results.map((attachment) => ({
				...attachment,
				url: attachment.key, // Fallback if S3 not configured
			}));
		}),

	/**
	 * Delete an attachment from S3 and the database.
	 */
	delete: protectedProcedure
		.input(
			z.object({
				id: z.string().min(1),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Find and verify ownership
			const attachment = await ctx.db.query.attachments.findFirst({
				where: and(
					eq(attachments.id, input.id),
					eq(attachments.userId, ctx.user.id),
				),
			});

			if (!attachment) {
				throw new Error("Attachment not found");
			}

			// Delete from S3 if configured
			if (isS3Configured()) {
				try {
					await deleteObject(attachment.key);
				} catch (error) {
					// Log but continue - file may already be deleted
					console.error(`Failed to delete S3 object: ${attachment.key}`, error);
				}
			}

			// Delete from database
			await ctx.db.delete(attachments).where(eq(attachments.id, input.id));

			return { success: true };
		}),

	/**
	 * Sync embedded images in HTML content.
	 * Marks attachments as orphaned if they're no longer in the content.
	 * This should be called when saving HTML content that may contain embedded images.
	 */
	syncEmbedded: protectedProcedure
		.input(
			z.object({
				entityType: entityTypeSchema,
				entityId: z.string().min(1),
				embeddedContext: z.string().min(1),
				currentKeys: z.array(z.string()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify user owns the entity
			const isOwner = await verifyEntityOwnership(
				ctx.db,
				ctx.user.id,
				input.entityType,
				input.entityId,
			);

			if (!isOwner) {
				throw new Error("Entity not found or access denied");
			}

			// Get all non-orphaned attachments for this entity+context
			const existingAttachments = await ctx.db.query.attachments.findMany({
				where: and(
					eq(attachments.userId, ctx.user.id),
					eq(attachments.entityType, input.entityType),
					eq(attachments.entityId, input.entityId),
					eq(attachments.embeddedContext, input.embeddedContext),
					eq(attachments.isOrphaned, false),
				),
			});

			// Find attachments that are no longer in the content
			const currentKeysSet = new Set(input.currentKeys);
			const orphanedAttachmentIds = existingAttachments
				.filter((a) => !currentKeysSet.has(a.key))
				.map((a) => a.id);

			// Mark removed attachments as orphaned
			if (orphanedAttachmentIds.length > 0) {
				await ctx.db
					.update(attachments)
					.set({
						isOrphaned: true,
						orphanedAt: new Date(),
					})
					.where(inArray(attachments.id, orphanedAttachmentIds));
			}

			return {
				orphanedCount: orphanedAttachmentIds.length,
				preservedCount:
					existingAttachments.length - orphanedAttachmentIds.length,
			};
		}),

	/**
	 * Extract S3 keys from HTML content.
	 * Utility endpoint for clients to determine which keys are currently embedded.
	 */
	extractKeys: protectedProcedure
		.input(
			z.object({
				html: z.string().nullable(),
			}),
		)
		.query(({ input }) => {
			return {
				keys: extractS3KeysFromHtml(input.html),
			};
		}),
});
