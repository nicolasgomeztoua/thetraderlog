import { Resend } from "resend";
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
// EMAIL TEMPLATE
// =============================================================================

/**
 * Terminal-styled HTML email template for completed reports.
 */
function buildReportEmailHtml(params: {
	reportTitle: string;
	downloadUrl: string;
}): string {
	const { reportTitle, downloadUrl } = params;
	const timestamp = new Date().toISOString();

	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Report is Ready — EdgeJournal</title>
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:'Courier New',Courier,monospace;color:#e0e0e0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050505;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:24px 32px 16px;border-bottom:1px solid #d4ff00;">
              <p style="margin:0;font-size:11px;color:#888888;letter-spacing:2px;">EDGEJOURNAL // AI REPORT</p>
              <h1 style="margin:8px 0 0;font-size:20px;font-family:'Courier New',Courier,monospace;color:#d4ff00;">Report Ready</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#e0e0e0;">
                Your AI analysis report has been generated and is ready for download.
              </p>

              <!-- Report title -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:#0a0a0a;border:1px solid #1a1a1a;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 4px;font-size:10px;color:#888888;letter-spacing:1px;">REPORT TITLE</p>
                    <p style="margin:0;font-size:14px;color:#00d4ff;font-family:'Courier New',Courier,monospace;">${escapeHtml(reportTitle)}</p>
                  </td>
                </tr>
              </table>

              <!-- Download button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#d4ff00;padding:12px 32px;">
                    <a href="${escapeHtml(downloadUrl)}" style="color:#050505;font-size:13px;font-family:'Courier New',Courier,monospace;font-weight:bold;text-decoration:none;letter-spacing:1px;">DOWNLOAD PDF</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:11px;color:#888888;line-height:1.5;">
                This download link expires in 7 days. You can also view your reports from the AI section of EdgeJournal.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1a1a1a;">
              <p style="margin:0;font-size:10px;color:#888888;">
                Generated: ${timestamp}
              </p>
              <p style="margin:4px 0 0;font-size:10px;color:#888888;">
                EdgeJournal — Professional Trading Journal
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Escape HTML entities to prevent XSS in email template.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Send a report completion email with a download link.
 *
 * @param params.to - Recipient email address
 * @param params.reportTitle - Title of the completed report
 * @param params.downloadUrl - Presigned S3 URL for PDF download (7-day expiry)
 */
export async function sendReportEmail(params: {
	to: string;
	reportTitle: string;
	downloadUrl: string;
}): Promise<void> {
	const { to, reportTitle, downloadUrl } = params;

	const resend = getResendClient();

	await resend.emails.send({
		from: "EdgeJournal <reports@edgejournal.com>",
		to,
		subject: `Report Ready: ${reportTitle}`,
		html: buildReportEmailHtml({ reportTitle, downloadUrl }),
	});
}
