import type { WebhookEvent } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

export async function POST(req: Request) {
	const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

	if (!WEBHOOK_SECRET) {
		throw new Error(
			"Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local",
		);
	}

	// Get the headers
	const headerPayload = await headers();
	const svix_id = headerPayload.get("svix-id");
	const svix_timestamp = headerPayload.get("svix-timestamp");
	const svix_signature = headerPayload.get("svix-signature");

	// If there are no headers, error out
	if (!svix_id || !svix_timestamp || !svix_signature) {
		return new Response("Error occurred -- no svix headers", {
			status: 400,
		});
	}

	// Get the body
	const payload = await req.json();
	const body = JSON.stringify(payload);

	// Create a new Svix instance with your secret.
	const wh = new Webhook(WEBHOOK_SECRET);

	let evt: WebhookEvent;

	// Verify the payload with the headers
	try {
		evt = wh.verify(body, {
			"svix-id": svix_id,
			"svix-timestamp": svix_timestamp,
			"svix-signature": svix_signature,
		}) as WebhookEvent;
	} catch (err) {
		console.error("Error verifying webhook:", err);
		return new Response("Error occurred", {
			status: 400,
		});
	}

	// Handle the webhook
	const eventType = evt.type;

	if (eventType === "user.created") {
		const { id, email_addresses, first_name, last_name, image_url } = evt.data;
		const email = email_addresses[0]?.email_address ?? "";
		const name = [first_name, last_name].filter(Boolean).join(" ") || null;

		await db.insert(users).values({
			clerkId: id,
			email,
			name,
			imageUrl: image_url,
			role: "user",
		});
	}

	if (eventType === "user.updated") {
		const { id, email_addresses, first_name, last_name, image_url } = evt.data;
		const email = email_addresses[0]?.email_address ?? "";
		const name = [first_name, last_name].filter(Boolean).join(" ") || null;

		await db
			.update(users)
			.set({
				email,
				name,
				imageUrl: image_url,
				updatedAt: new Date(),
			})
			.where(eq(users.clerkId, id));
	}

	if (eventType === "user.deleted") {
		const { id } = evt.data;

		if (id) {
			await db.delete(users).where(eq(users.clerkId, id));
		}
	}

	return new Response("", { status: 200 });
}
