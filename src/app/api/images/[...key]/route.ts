import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { getPresignedDownloadUrl, isS3Configured } from "@/lib/storage/s3";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

/**
 * Image proxy API route.
 *
 * Serves images from private R2 storage without exposing presigned URLs.
 * URLs are permanent (no expiry) since the proxy generates fresh presigned URLs.
 *
 * Security:
 * - Path traversal: Only allows keys starting with allowed prefixes
 * - Authorization:
 *   - journals/screenshots: Requires auth, user ID in path must match logged-in user
 *   - strategies: Public (marketplace images are public)
 * - Content spoofing: Sets X-Content-Type-Options: nosniff
 * - Caching: 1 hour browser cache to reduce R2 requests
 *
 * Usage: /api/images/strategies/us-xxx/sy-xxx/cover.png
 */

// Allowed key prefixes - prevents path traversal attacks
const ALLOWED_PREFIXES = ["strategies/", "journals/", "screenshots/"];

// Prefixes that require auth and user ID verification
const PRIVATE_PREFIXES = ["journals/", "screenshots/"];

// Content types for common image extensions
const CONTENT_TYPES: Record<string, string> = {
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	png: "image/png",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
};

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ key: string[] }> },
) {
	const { key: keyParts } = await params;

	// Reconstruct the S3 key from path segments
	const key = keyParts.join("/");

	// Security: Validate key starts with allowed prefix
	const isAllowedPrefix = ALLOWED_PREFIXES.some((prefix) =>
		key.startsWith(prefix),
	);
	if (!isAllowedPrefix) {
		return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
	}

	// Security: Block path traversal attempts
	if (key.includes("..") || key.includes("//")) {
		return NextResponse.json({ error: "Invalid image path" }, { status: 400 });
	}

	// Security: Auth check for private paths (journals, screenshots)
	const isPrivatePath = PRIVATE_PREFIXES.some((prefix) =>
		key.startsWith(prefix),
	);

	if (isPrivatePath) {
		const { userId: clerkId } = await auth();

		if (!clerkId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Get the user's internal ID from the database
		const user = await db.query.users.findFirst({
			where: eq(users.clerkId, clerkId),
			columns: { id: true },
		});

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Extract user ID from the path (format: journals/us-xxx/... or screenshots/us-xxx/...)
		const pathParts = key.split("/");
		const userIdInPath = pathParts[1]; // Second segment is user ID

		// Verify the user ID in the path matches the logged-in user
		if (userIdInPath !== user.id) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
	}

	// Check S3 is configured
	if (!isS3Configured()) {
		return NextResponse.json(
			{ error: "Storage not configured" },
			{ status: 503 },
		);
	}

	try {
		// Generate a presigned URL to fetch from R2
		const presignedUrl = getPresignedDownloadUrl(key, 300); // 5 min expiry (internal only)

		// Fetch the image from R2
		const response = await fetch(presignedUrl);

		if (!response.ok) {
			if (response.status === 404) {
				return NextResponse.json({ error: "Image not found" }, { status: 404 });
			}
			return NextResponse.json(
				{ error: "Failed to fetch image" },
				{ status: 502 },
			);
		}

		// Get content type from R2 response or infer from extension
		let contentType = response.headers.get("content-type");
		if (!contentType || contentType === "application/octet-stream") {
			const ext = key.split(".").pop()?.toLowerCase() ?? "";
			contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
		}

		// Stream the image back to client
		const imageData = await response.arrayBuffer();

		return new NextResponse(imageData, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Content-Length": imageData.byteLength.toString(),
				// Cache for 1 hour in browser, 1 day on CDN
				"Cache-Control": "public, max-age=3600, s-maxage=86400",
				// Security headers
				"X-Content-Type-Options": "nosniff",
			},
		});
	} catch (error) {
		console.error("Image proxy error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch image" },
			{ status: 500 },
		);
	}
}
