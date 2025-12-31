import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processImport } from "@/inngest/functions";

// Serve the Inngest API
// This creates POST /api/inngest endpoint that Inngest calls
export const { GET, POST, PUT } = serve({
	client: inngest,
	functions: [processImport],
});
