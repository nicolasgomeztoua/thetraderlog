import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
	"/",
	"/sign-in(.*)",
	"/sign-up(.*)",
	"/api/webhooks(.*)",
	"/api/queue(.*)", // QStash callback endpoint
]);

// E2E test mode bypass - only works in development
const isE2ETestMode =
	process.env.E2E_TEST_MODE === "true" && process.env.NODE_ENV !== "production";

export default clerkMiddleware(async (auth, request) => {
	// In E2E test mode, bypass auth entirely (development only)
	if (isE2ETestMode) {
		return NextResponse.next();
	}

	if (!isPublicRoute(request)) {
		await auth.protect();
	}
});

export const config = {
	matcher: [
		// Skip Next.js internals and all static files, unless found in search params
		"/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
		// Always run for API routes
		"/(api|trpc)(.*)",
	],
};
