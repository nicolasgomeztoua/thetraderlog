import { randomUUID } from "node:crypto";
import { Daytona, Image } from "@daytonaio/sdk";
import { env } from "@/env";
import type { ToolDefinition } from "@/lib/ai/client";
import {
	getPresignedDownloadUrl,
	getS3Client,
	isS3Configured,
} from "@/lib/storage/s3";

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const runPythonToolDefinition: ToolDefinition = {
	type: "function",
	function: {
		name: "run_python",
		description:
			"Execute Python code in a secure sandboxed environment (Daytona). " +
			"Pre-installed packages: pandas, numpy, scipy, matplotlib, plotly, seaborn, statsmodels. " +
			"Use for statistical analysis, custom calculations, and chart generation. " +
			"For charts, use matplotlib with plt.show() — chart data and PNG images are automatically captured. " +
			"For plotly, use fig.write_image() to save to /tmp/ and the image will be uploaded. " +
			"Print results to stdout for the AI to read. " +
			"Execution timeout: 60 seconds. " +
			"You can pass data as a JSON string in the dataContext parameter — " +
			"it will be available in the sandbox as a file at /tmp/data.json. " +
			"CHART STYLING: Use dark theme — figure/axes facecolor '#0a0a0a', text '#e0e0e0', grid '#1a1a1a', " +
			"profit '#00ff88', loss '#ff3b3b', accent '#d4ff00', ai accent '#00d4ff'. " +
			"Always call plt.tight_layout() before plt.show().",
		parameters: {
			type: "object",
			properties: {
				code: {
					type: "string",
					description:
						"Python code to execute. Use print() for output. " +
						"Use matplotlib plt.show() for charts. " +
						"If dataContext was provided, read it with: " +
						'import json; data = json.load(open("/tmp/data.json"))',
				},
				dataContext: {
					type: "string",
					description:
						"Optional JSON string of data to make available in the sandbox as /tmp/data.json. " +
						"Use this to pass trading data, query results, or other data for analysis.",
				},
			},
			required: ["code"],
		},
	},
};

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
