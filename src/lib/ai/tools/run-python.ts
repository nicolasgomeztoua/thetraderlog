import { randomUUID } from "node:crypto";
import { Daytona, Image } from "@daytonaio/sdk";
import { env } from "@/env";
import {
	getPresignedDownloadUrl,
	getS3Client,
	isS3Configured,
} from "@/lib/storage/s3";

// =============================================================================
// CONSTANTS
// =============================================================================

const EXECUTION_TIMEOUT_SECONDS = 60;
const SANDBOX_AUTO_STOP_MINUTES = 5;
const PYTHON_PACKAGES = [
	"scipy",
	"seaborn",
	"statsmodels",
	"plotly",
	"kaleido",
];

// =============================================================================
// DAYTONA CLIENT (LAZY SINGLETON)
// =============================================================================

let daytonaClient: Daytona | null = null;

function getDaytonaClient(): Daytona {
	if (!daytonaClient) {
		if (!env.DAYTONA_API_KEY) {
			throw new Error(
				"DAYTONA_API_KEY is not configured. Python sandbox execution is unavailable.",
			);
		}
		daytonaClient = new Daytona({
			apiKey: env.DAYTONA_API_KEY,
			_experimental: {},
		});
	}
	return daytonaClient;
}

// =============================================================================
// IMAGE (CACHED)
// =============================================================================

let sandboxImage: Image | null = null;

function getSandboxImage(): Image {
	if (!sandboxImage) {
		sandboxImage = Image.debianSlim("3.12").pipInstall(PYTHON_PACKAGES);
	}
	return sandboxImage;
}

// =============================================================================
// EXECUTOR
// =============================================================================

export async function executeRunPython(
	code: string,
	dataContext?: string,
): Promise<{
	success: boolean;
	data?: {
		stdout: string;
		stderr: string;
		images: string[];
		artifacts: string[];
	};
	error?: string;
}> {
	if (!code.trim()) {
		return { success: false, error: "Code cannot be empty" };
	}

	const daytona = getDaytonaClient();
	let sandbox: Awaited<ReturnType<Daytona["create"]>> | null = null;

	try {
		// Create sandbox with Python and pre-installed packages
		sandbox = await daytona.create(
			{
				image: getSandboxImage(),
				language: "python",
				autoStopInterval: SANDBOX_AUTO_STOP_MINUTES,
				ephemeral: true,
			},
			{ timeout: 120 },
		);

		// Upload data context if provided
		if (dataContext) {
			await sandbox.fs.uploadFile(
				Buffer.from(dataContext, "utf-8"),
				"/tmp/data.json",
			);
		}

		// Execute the Python code
		const response = await sandbox.process.codeRun(
			code,
			undefined,
			EXECUTION_TIMEOUT_SECONDS,
		);

		const stdout = response.result ?? "";
		const stderr =
			response.exitCode !== 0 ? `Exit code: ${response.exitCode}` : "";

		// Collect images from matplotlib chart artifacts
		const images: string[] = [];
		const artifactDescriptions: string[] = [];

		if (response.artifacts?.charts && response.artifacts.charts.length > 0) {
			for (const chart of response.artifacts.charts) {
				// Add chart metadata as artifact description
				artifactDescriptions.push(
					`Chart: ${chart.title || "Untitled"} (type: ${chart.type})`,
				);

				// Upload base64 PNG to S3 if available
				if (chart.png) {
					const imageUrl = await uploadBase64Image(chart.png);
					if (imageUrl) {
						images.push(imageUrl);
					}
				}
			}
		}

		// Also check for plotly images saved to /tmp/
		try {
			const tmpFiles = await sandbox.fs.listFiles("/tmp");
			for (const file of tmpFiles) {
				const name = file.name ?? "";
				if (
					name.endsWith(".png") ||
					name.endsWith(".jpg") ||
					name.endsWith(".svg")
				) {
					// Download and upload to S3
					const fileBuffer = await sandbox.fs.downloadFile(`/tmp/${name}`);
					const imageUrl = await uploadBufferImage(
						fileBuffer,
						name.endsWith(".svg") ? "image/svg+xml" : "image/png",
						name,
					);
					if (imageUrl) {
						images.push(imageUrl);
					}
				}
			}
		} catch {
			// Ignore errors listing /tmp — may not have any plotly files
		}

		if (response.exitCode !== 0) {
			return {
				success: false,
				error: `Python execution failed (exit code ${response.exitCode}):\n${stdout}`,
				data: { stdout, stderr, images, artifacts: artifactDescriptions },
			};
		}

		return {
			success: true,
			data: { stdout, stderr, images, artifacts: artifactDescriptions },
		};
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Unknown error running Python code";
		return {
			success: false,
			error: `Sandbox error: ${message}`,
		};
	} finally {
		// Always clean up the sandbox
		if (sandbox) {
			try {
				await daytona.delete(sandbox);
			} catch {
				// Best-effort cleanup
			}
		}
	}
}

// =============================================================================
// S3 IMAGE UPLOAD HELPERS
// =============================================================================

async function uploadBase64Image(base64Png: string): Promise<string | null> {
	const buffer = Buffer.from(base64Png, "base64");
	return uploadBufferImage(buffer, "image/png", `chart-${randomUUID()}.png`);
}

async function uploadBufferImage(
	buffer: Buffer,
	mimeType: string,
	filename: string,
): Promise<string | null> {
	if (!isS3Configured()) {
		// Without S3, return base64 data URI for PNG images
		if (mimeType === "image/png") {
			return `data:image/png;base64,${buffer.toString("base64")}`;
		}
		return null;
	}

	try {
		const key = `ai-charts/${randomUUID()}-${filename}`;
		const client = getS3Client();

		// Use presigned PUT URL to upload
		const uploadUrl = client.presign(key, { method: "PUT", expiresIn: 300 });
		await fetch(uploadUrl, {
			method: "PUT",
			body: new Uint8Array(buffer),
			headers: { "Content-Type": mimeType },
		});

		// Return a presigned download URL (7 days expiry for reports)
		return getPresignedDownloadUrl(key, 604800);
	} catch {
		// Fallback to data URI if S3 upload fails
		if (mimeType === "image/png") {
			return `data:image/png;base64,${buffer.toString("base64")}`;
		}
		return null;
	}
}
