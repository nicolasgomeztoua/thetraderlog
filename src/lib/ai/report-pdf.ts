import { randomUUID } from "node:crypto";
import {
	Document,
	Image,
	Page,
	renderToBuffer,
	StyleSheet,
	Text,
	View,
} from "@react-pdf/renderer";
import React from "react";
import {
	getPresignedDownloadUrl,
	getS3Client,
	isS3Configured,
} from "@/lib/storage/s3";

// =============================================================================
// TYPES
// =============================================================================

interface ReportPdfParams {
	title: string;
	content: string;
	charts: string[];
	codeArtifacts: string[];
	dateRange?: { start?: string; end?: string };
}

interface PdfUploadResult {
	pdfUrl: string;
	pdfKey: string;
}

// =============================================================================
// TERMINAL DESIGN THEME
// =============================================================================

const THEME = {
	bg: "#050505",
	surface: "#0a0a0a",
	border: "#1a1a1a",
	text: "#e0e0e0",
	textMuted: "#888888",
	accent: "#d4ff00",
	accentAi: "#00d4ff",
	profit: "#00ff88",
	loss: "#ff3b3b",
	codeBg: "#111111",
	white: "#ffffff",
} as const;

const FONTS = {
	mono: "Courier",
	monoOblique: "Courier-Oblique",
	monoBold: "Courier-Bold",
} as const;

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
	page: {
		backgroundColor: THEME.bg,
		padding: 40,
		fontFamily: FONTS.mono,
		fontSize: 9,
		color: THEME.text,
	},
	header: {
		marginBottom: 24,
		borderBottomWidth: 1,
		borderBottomColor: THEME.accent,
		paddingBottom: 16,
	},
	headerTitle: {
		fontSize: 18,
		fontFamily: FONTS.monoBold,
		color: THEME.accent,
		marginBottom: 8,
	},
	headerSubtitle: {
		fontSize: 8,
		color: THEME.textMuted,
		letterSpacing: 1,
	},
	headerMeta: {
		fontSize: 8,
		color: THEME.textMuted,
		marginTop: 4,
	},
	h1: {
		fontSize: 16,
		fontFamily: FONTS.monoBold,
		color: THEME.accent,
		marginTop: 20,
		marginBottom: 8,
	},
	h2: {
		fontSize: 13,
		fontFamily: FONTS.monoBold,
		color: THEME.accentAi,
		marginTop: 16,
		marginBottom: 6,
	},
	h3: {
		fontSize: 11,
		fontFamily: FONTS.monoBold,
		color: THEME.white,
		marginTop: 12,
		marginBottom: 4,
	},
	paragraph: {
		fontSize: 9,
		lineHeight: 1.6,
		marginBottom: 8,
		color: THEME.text,
	},
	bold: {
		fontFamily: FONTS.monoBold,
	},
	italic: {
		fontFamily: FONTS.monoOblique,
	},
	listItem: {
		fontSize: 9,
		lineHeight: 1.6,
		marginBottom: 4,
		marginLeft: 12,
		color: THEME.text,
	},
	codeBlock: {
		backgroundColor: THEME.codeBg,
		borderWidth: 1,
		borderColor: THEME.border,
		padding: 10,
		marginVertical: 8,
		fontSize: 8,
		lineHeight: 1.5,
		color: THEME.accentAi,
	},
	inlineCode: {
		backgroundColor: THEME.codeBg,
		color: THEME.accentAi,
		fontSize: 8,
		padding: 2,
	},
	hr: {
		borderBottomWidth: 1,
		borderBottomColor: THEME.border,
		marginVertical: 12,
	},
	chartImage: {
		marginVertical: 12,
		maxWidth: "100%",
		objectFit: "contain" as const,
	},
	chartCaption: {
		fontSize: 7,
		color: THEME.textMuted,
		textAlign: "center" as const,
		marginBottom: 8,
	},
	codeAppendixTitle: {
		fontSize: 11,
		fontFamily: FONTS.monoBold,
		color: THEME.accentAi,
		marginTop: 20,
		marginBottom: 8,
		borderTopWidth: 1,
		borderTopColor: THEME.border,
		paddingTop: 12,
	},
	footer: {
		position: "absolute" as const,
		bottom: 20,
		left: 40,
		right: 40,
		flexDirection: "row" as const,
		justifyContent: "space-between" as const,
		fontSize: 7,
		color: THEME.textMuted,
		borderTopWidth: 1,
		borderTopColor: THEME.border,
		paddingTop: 8,
	},
	// Table styles
	table: {
		marginVertical: 8,
		borderWidth: 1,
		borderColor: THEME.border,
	},
	tableRow: {
		flexDirection: "row" as const,
		borderBottomWidth: 1,
		borderBottomColor: THEME.border,
	},
	tableHeaderRow: {
		flexDirection: "row" as const,
		borderBottomWidth: 1,
		borderBottomColor: THEME.accent,
		backgroundColor: THEME.surface,
	},
	tableCell: {
		flex: 1,
		padding: 4,
		fontSize: 8,
		color: THEME.text,
	},
	tableHeaderCell: {
		flex: 1,
		padding: 4,
		fontSize: 8,
		fontFamily: FONTS.monoBold,
		color: THEME.accent,
	},
});

// =============================================================================
// MARKDOWN → PDF ELEMENT PARSER
// =============================================================================

interface PdfElement {
	type:
		| "h1"
		| "h2"
		| "h3"
		| "paragraph"
		| "list-item"
		| "code-block"
		| "hr"
		| "table";
	content: string;
	rows?: string[][];
}

function parseMarkdownToElements(markdown: string): PdfElement[] {
	const elements: PdfElement[] = [];
	const lines = markdown.split("\n");
	let inCodeBlock = false;
	let codeBlockContent: string[] = [];
	let inTable = false;
	let tableRows: string[][] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";

		// Code block toggle
		if (line.startsWith("```")) {
			if (inCodeBlock) {
				elements.push({
					type: "code-block",
					content: codeBlockContent.join("\n"),
				});
				codeBlockContent = [];
				inCodeBlock = false;
			} else {
				// Flush any table state
				if (inTable && tableRows.length > 0) {
					elements.push({ type: "table", content: "", rows: tableRows });
					tableRows = [];
					inTable = false;
				}
				inCodeBlock = true;
			}
			continue;
		}

		if (inCodeBlock) {
			codeBlockContent.push(line);
			continue;
		}

		// Table detection (lines with | separators)
		if (line.includes("|") && line.trim().startsWith("|")) {
			const cells = line
				.split("|")
				.filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
				.map((c) => c.trim());

			// Skip separator rows (---|----|---)
			if (cells.every((c) => /^[-:]+$/.test(c))) {
				continue;
			}

			tableRows.push(cells);
			inTable = true;
			continue;
		}

		// If we were in a table and hit a non-table line, flush the table
		if (inTable && tableRows.length > 0) {
			elements.push({ type: "table", content: "", rows: tableRows });
			tableRows = [];
			inTable = false;
		}

		// Horizontal rule
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
			elements.push({ type: "hr", content: "" });
			continue;
		}

		// Headings
		if (line.startsWith("### ")) {
			elements.push({ type: "h3", content: line.slice(4) });
			continue;
		}
		if (line.startsWith("## ")) {
			elements.push({ type: "h2", content: line.slice(3) });
			continue;
		}
		if (line.startsWith("# ")) {
			elements.push({ type: "h1", content: line.slice(2) });
			continue;
		}

		// List items
		if (/^\s*[-*+]\s/.test(line)) {
			const content = line.replace(/^\s*[-*+]\s+/, "");
			elements.push({ type: "list-item", content: `• ${content}` });
			continue;
		}

		// Numbered list items
		if (/^\s*\d+\.\s/.test(line)) {
			const match = line.match(/^\s*(\d+)\.\s+(.*)/);
			if (match) {
				elements.push({
					type: "list-item",
					content: `${match[1]}. ${match[2]}`,
				});
			}
			continue;
		}

		// Empty lines
		if (line.trim() === "") {
			continue;
		}

		// Regular paragraph
		elements.push({ type: "paragraph", content: line });
	}

	// Flush remaining code block or table
	if (inCodeBlock && codeBlockContent.length > 0) {
		elements.push({
			type: "code-block",
			content: codeBlockContent.join("\n"),
		});
	}
	if (inTable && tableRows.length > 0) {
		elements.push({ type: "table", content: "", rows: tableRows });
	}

	return elements;
}

/**
 * Parse inline markdown formatting into Text elements with styles.
 * Handles **bold**, *italic*, and `code`.
 */
function renderInlineText(text: string): React.ReactElement[] {
	const parts: React.ReactElement[] = [];
	// Match bold (**text**), italic (*text*), and inline code (`text`)
	const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
	let lastIndex = 0;
	let key = 0;

	for (const match of text.matchAll(regex)) {
		const matchIndex = match.index ?? 0;

		// Add preceding plain text
		if (matchIndex > lastIndex) {
			parts.push(
				React.createElement(
					Text,
					{ key: key++ },
					text.slice(lastIndex, matchIndex),
				),
			);
		}

		if (match[2]) {
			// Bold
			parts.push(
				React.createElement(Text, { key: key++, style: styles.bold }, match[2]),
			);
		} else if (match[3]) {
			// Italic
			parts.push(
				React.createElement(
					Text,
					{ key: key++, style: styles.italic },
					match[3],
				),
			);
		} else if (match[4]) {
			// Inline code
			parts.push(
				React.createElement(
					Text,
					{ key: key++, style: styles.inlineCode },
					match[4],
				),
			);
		}

		lastIndex = matchIndex + (match[0]?.length ?? 0);
	}

	// Add remaining text
	if (lastIndex < text.length) {
		parts.push(
			React.createElement(Text, { key: key++ }, text.slice(lastIndex)),
		);
	}

	if (parts.length === 0) {
		parts.push(React.createElement(Text, { key: 0 }, text));
	}

	return parts;
}

// =============================================================================
// PDF DOCUMENT COMPONENT
// =============================================================================

function ReportDocument(props: ReportPdfParams): React.ReactElement {
	const { title, content, charts, codeArtifacts, dateRange } = props;
	const elements = parseMarkdownToElements(content);
	const generatedAt = new Date().toISOString();

	const dateRangeStr =
		dateRange?.start || dateRange?.end
			? [dateRange.start ?? "beginning", dateRange.end ?? "present"].join(" — ")
			: null;

	return React.createElement(
		Document,
		{
			title,
			author: "EdgeJournal AI",
			subject: "Trading Analysis Report",
		},
		React.createElement(
			Page,
			{ size: "A4", style: styles.page, wrap: true },

			// Header
			React.createElement(
				View,
				{ style: styles.header },
				React.createElement(
					Text,
					{ style: styles.headerSubtitle },
					"EDGEJOURNAL // AI ANALYSIS REPORT",
				),
				React.createElement(Text, { style: styles.headerTitle }, title),
				React.createElement(
					Text,
					{ style: styles.headerMeta },
					`Generated: ${generatedAt}${dateRangeStr ? ` | Period: ${dateRangeStr}` : ""}`,
				),
			),

			// Content elements
			...elements.map((el, idx) => {
				switch (el.type) {
					case "h1":
						return React.createElement(
							Text,
							{ key: `el-${idx}`, style: styles.h1 },
							el.content,
						);
					case "h2":
						return React.createElement(
							Text,
							{ key: `el-${idx}`, style: styles.h2 },
							el.content,
						);
					case "h3":
						return React.createElement(
							Text,
							{ key: `el-${idx}`, style: styles.h3 },
							el.content,
						);
					case "paragraph":
						return React.createElement(
							Text,
							{ key: `el-${idx}`, style: styles.paragraph },
							...renderInlineText(el.content),
						);
					case "list-item":
						return React.createElement(
							Text,
							{ key: `el-${idx}`, style: styles.listItem },
							...renderInlineText(el.content),
						);
					case "code-block":
						return React.createElement(
							View,
							{ key: `el-${idx}`, style: styles.codeBlock },
							React.createElement(Text, null, el.content),
						);
					case "hr":
						return React.createElement(View, {
							key: `el-${idx}`,
							style: styles.hr,
						});
					case "table":
						return renderTable(el.rows ?? [], idx);
					default:
						return null;
				}
			}),

			// Chart images
			...charts.map((chartUrl, idx) =>
				React.createElement(
					View,
					{ key: `chart-${idx}`, wrap: false },
					React.createElement(Image, {
						src: chartUrl,
						style: styles.chartImage,
					}),
					React.createElement(
						Text,
						{ style: styles.chartCaption },
						`Figure ${idx + 1}`,
					),
				),
			),

			// Code appendix
			...(codeArtifacts.length > 0
				? [
						React.createElement(
							Text,
							{ key: "code-title", style: styles.codeAppendixTitle },
							"// CODE APPENDIX",
						),
						...codeArtifacts.map((code, idx) =>
							React.createElement(
								View,
								{ key: `code-${idx}`, style: styles.codeBlock },
								React.createElement(Text, null, code),
							),
						),
					]
				: []),

			// Footer
			React.createElement(
				View,
				{ style: styles.footer, fixed: true },
				React.createElement(Text, null, "EdgeJournal AI Report"),
				React.createElement(Text, {
					render: ({
						pageNumber,
						totalPages,
					}: {
						pageNumber: number;
						totalPages: number;
					}) => `${pageNumber} / ${totalPages}`,
				}),
			),
		),
	);
}

function renderTable(
	rows: string[][],
	elementIndex: number,
): React.ReactElement {
	if (rows.length === 0) {
		return React.createElement(View, { key: `table-${elementIndex}` });
	}

	const headerRow = rows[0] ?? [];
	const bodyRows = rows.slice(1);

	return React.createElement(
		View,
		{ key: `table-${elementIndex}`, style: styles.table },
		// Header row
		React.createElement(
			View,
			{ style: styles.tableHeaderRow },
			...headerRow.map((cell, cellIdx) =>
				React.createElement(
					Text,
					{ key: `th-${cellIdx}`, style: styles.tableHeaderCell },
					cell,
				),
			),
		),
		// Body rows
		...bodyRows.map((row, rowIdx) =>
			React.createElement(
				View,
				{
					key: `tr-${rowIdx}`,
					style: styles.tableRow,
				},
				...row.map((cell, cellIdx) =>
					React.createElement(
						Text,
						{ key: `td-${cellIdx}`, style: styles.tableCell },
						cell,
					),
				),
			),
		),
	);
}

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Generate a PDF report from markdown content and upload to S3.
 *
 * @param params - Report title, markdown content, chart URLs, and code artifacts
 * @returns PDF URL and S3 key, or null if S3 is not configured
 */
export async function generateReportPdf(
	params: ReportPdfParams,
): Promise<PdfUploadResult | null> {
	// Render to buffer
	const document = React.createElement(ReportDocument, params);
	const pdfBuffer = await renderToBuffer(document);

	// Upload to S3
	if (!isS3Configured()) {
		return null;
	}

	const key = `reports/${randomUUID()}.pdf`;
	const client = getS3Client();

	const uploadUrl = client.presign(key, { method: "PUT", expiresIn: 300 });
	await fetch(uploadUrl, {
		method: "PUT",
		body: new Uint8Array(pdfBuffer),
		headers: { "Content-Type": "application/pdf" },
	});

	// 7-day presigned download URL
	const pdfUrl = getPresignedDownloadUrl(key, 604800);

	return { pdfUrl, pdfKey: key };
}
