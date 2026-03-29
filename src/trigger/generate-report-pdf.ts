import { logger, task } from "@trigger.dev/sdk/v3";
import puppeteer from "puppeteer";
import { z } from "zod";

// =============================================================================
// GENERATE REPORT PDF — Puppeteer-based server-side PDF rendering
// =============================================================================

// Bun S3Client type — uses the global declaration from src/lib/storage/s3.ts
interface BunS3Client {
	write(
		key: string,
		data: Uint8Array | Buffer,
		options?: Record<string, unknown>,
	): Promise<number>;
}

const inputSchema = z.object({
	reportId: z.string(),
	userId: z.string(),
	token: z.string(),
});

export const generateReportPdf = task({
	id: "generate-report-pdf",
	maxDuration: 60,
	retry: {
		maxAttempts: 1,
	},
	run: async (payload: z.infer<typeof inputSchema>) => {
		const { reportId, userId, token } = payload;
		const appUrl =
			process.env.NEXT_PUBLIC_APP_URL ?? "https://thetraderlog.com";
		const printUrl = `${appUrl}/print/reports/${reportId}?token=${encodeURIComponent(token)}`;

		logger.info("Starting PDF generation", { reportId, printUrl });

		// 1. Launch Puppeteer
		let browser: Awaited<ReturnType<typeof puppeteer.launch>>;
		try {
			browser = await puppeteer.launch({
				headless: true,
				pipe: true, // Use stdio pipes instead of WebSockets (Bun compat)
				args: [
					"--no-sandbox",
					"--disable-setuid-sandbox",
					"--disable-gpu",
					"--disable-dev-shm-usage",
				],
			});
			logger.info("Browser launched successfully");
		} catch (err: unknown) {
			const e = err as Record<string, unknown>;
			const msg =
				e?.message ?? e?.cause ?? e?.stack ?? String(err) ?? "unknown";
			logger.error("Browser launch failed", {
				type: typeof err,
				constructor: (err as object)?.constructor?.name,
				message: String(msg),
				keys: Object.getOwnPropertyNames(err ?? {}),
			});
			throw new Error(`Failed to launch browser: ${msg}`);
		}

		try {
			const page = await browser.newPage();
			await page.setViewport({ width: 1280, height: 900 });

			// 2. Navigate to print page
			logger.info("Navigating to print page");
			const response = await page.goto(printUrl, {
				waitUntil: "networkidle0",
				timeout: 30000,
			});
			logger.info("Page loaded", { status: response?.status() });

			// 3. Wait for the ready signal from PdfReadySignal component
			await page.waitForSelector("[data-pdf-ready='true']", {
				timeout: 30000,
			});
			logger.info("PDF ready signal received");

			// 4. Generate PDF
			const pdfBuffer = await page.pdf({
				format: "A4",
				printBackground: true,
				margin: {
					top: "20mm",
					bottom: "15mm",
					left: "10mm",
					right: "10mm",
				},
			});
			logger.info("PDF generated", { bytes: pdfBuffer.length });

			// 5. Upload to S3 via Bun's native S3Client
			const s3Key = `reports/${userId}/${reportId}/report.pdf`;

			const BunGlobal = globalThis.Bun as
				| {
						S3Client: new (config: Record<string, unknown>) => BunS3Client;
				  }
				| undefined;

			if (!BunGlobal?.S3Client) {
				throw new Error(
					"Bun.S3Client not available. Ensure trigger runtime is bun.",
				);
			}

			const s3 = new BunGlobal.S3Client({
				endpoint: process.env.S3_ENDPOINT,
				region: process.env.S3_REGION ?? "auto",
				accessKeyId: process.env.S3_ACCESS_KEY_ID,
				secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
				bucket: process.env.S3_BUCKET,
			});

			await s3.write(s3Key, Buffer.from(pdfBuffer), {
				type: "application/pdf",
			});
			logger.info("PDF uploaded to S3", { s3Key });

			return { s3Key };
		} catch (err: unknown) {
			const e = err as Record<string, unknown>;
			const msg =
				e?.message ?? e?.cause ?? e?.stack ?? String(err) ?? "unknown";
			logger.error("PDF generation failed", {
				type: typeof err,
				constructor: (err as object)?.constructor?.name,
				message: String(msg),
				keys: Object.getOwnPropertyNames(err ?? {}),
			});
			throw new Error(`PDF generation failed (url: ${printUrl}): ${msg}`);
		} finally {
			await browser.close();
		}
	},
});
