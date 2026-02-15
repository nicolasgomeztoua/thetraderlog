import { Resend } from "resend";
import { renderReportCompleteEmail } from "@/emails/report-complete";
import { env } from "@/env";

// =============================================================================
// CLIENT
// =============================================================================

let resendClient: Resend | null = null;

function getResendClient(): Resend {
	if (!resendClient) {
		if (!env.RESEND_API_KEY) {
			throw new Error(
				"RESEND_API_KEY is not configured. Email delivery is unavailable.",
			);
		}
		resendClient = new Resend(env.RESEND_API_KEY);
	}
	return resendClient;
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Send a report completion email with a link to the in-app report viewer.
 *
 * @param params.to - Recipient email address
 * @param params.reportTitle - Title of the completed report
 * @param params.reportUrl - URL to the in-app report viewer page
 * @param params.metadata - Optional report generation stats
 */
export async function sendReportEmail(params: {
	to: string;
	reportTitle: string;
	reportUrl: string;
	metadata?: {
		generationTime?: string;
		chartsGenerated?: number;
	};
}): Promise<void> {
	const { to, reportTitle, reportUrl, metadata } = params;

	const resend = getResendClient();

	// Sanitize subject to prevent email header injection via newlines
	const safeTitle = reportTitle.replace(/[\r\n]/g, " ").trim();

	const html = await renderReportCompleteEmail({
		reportTitle,
		reportUrl,
		metadata,
	});

	await resend.emails.send({
		from: "EdgeJournal <reports@edgejournal.com>",
		to,
		subject: `Report Ready: ${safeTitle}`,
		html,
	});
}
