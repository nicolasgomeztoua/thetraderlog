/**
 * Queue Processing Endpoint
 *
 * This endpoint is called by Upstash QStash to process background jobs.
 * It handles MAE/MFE calculation for imported trades.
 */

import { Receiver } from "@upstash/qstash";
import { z } from "zod";
import { calculateAndStoreMAEMFE } from "@/lib/maemfe-service";
import { env } from "@/env";

const LOG_TAG = "[Queue:ProcessImport]";

// Schema for the message body
const messageSchema = z.object({
	tradeIds: z.array(z.number()),
	userId: z.number(),
});

// Create receiver for signature verification
const receiver = new Receiver({
	currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
	nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
});

export async function POST(req: Request) {
	try {
		// Get the raw body and signature
		const body = await req.text();
		const signature = req.headers.get("upstash-signature");

		if (!signature) {
			console.error(`${LOG_TAG} Missing signature`);
			return new Response("Missing signature", { status: 401 });
		}

		// Verify the signature
		const isValid = await receiver.verify({
			signature,
			body,
		});

		if (!isValid) {
			console.error(`${LOG_TAG} Invalid signature`);
			return new Response("Invalid signature", { status: 401 });
		}

		// Parse and validate the message
		const parsed = messageSchema.safeParse(JSON.parse(body));
		if (!parsed.success) {
			console.error(`${LOG_TAG} Invalid message format:`, parsed.error);
			return new Response("Invalid message format", { status: 400 });
		}

		const { tradeIds, userId } = parsed.data;

		console.log(
			`${LOG_TAG} Starting import processing for user ${userId} with ${tradeIds.length} trades`,
		);

		let successCount = 0;
		let failedCount = 0;

		// Process each trade
		for (const tradeId of tradeIds) {
			const result = await calculateAndStoreMAEMFE(tradeId, {
				skipAlreadyProcessed: true,
				logTag: LOG_TAG,
			});

			if (result.success) {
				successCount++;
			} else {
				failedCount++;
			}
		}

		console.log(
			`${LOG_TAG} Completed: ${successCount} success, ${failedCount} failed`,
		);

		return Response.json({
			processed: tradeIds.length,
			success: successCount,
			failed: failedCount,
		});
	} catch (error) {
		console.error(`${LOG_TAG} Error processing queue message:`, error);
		return new Response(
			error instanceof Error ? error.message : "Internal server error",
			{ status: 500 },
		);
	}
}

