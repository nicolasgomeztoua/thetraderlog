import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/mdx/markdown-components";
import { ReportRenderer } from "@/components/report/report-renderer";
import { parseStructuredReport } from "@/lib/ai/report-pipeline/report-schema";
import { verifyPdfToken } from "@/lib/auth/pdf-token";
import { db } from "@/server/db";
import { aiReports, userSettings } from "@/server/db/schema";
import { PdfReadySignal } from "./_components/pdf-ready-signal";

// =============================================================================
// PRINT PAGE — /print/reports/[id]?token=...
// =============================================================================

interface PrintReportPageProps {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ token?: string }>;
}

export default async function PrintReportPage({
	params,
	searchParams,
}: PrintReportPageProps) {
	const { id: reportId } = await params;
	const { token } = await searchParams;

	if (!token) notFound();

	const verified = verifyPdfToken(token);
	if (!verified || verified.reportId !== reportId) notFound();

	// Fetch report directly from DB (no Clerk session needed)
	const report = await db.query.aiReports.findFirst({
		where: and(
			eq(aiReports.id, reportId),
			eq(aiReports.userId, verified.userId),
		),
		columns: {
			id: true,
			title: true,
			content: true,
			dataArtifacts: true,
			status: true,
			createdAt: true,
			prompt: true,
		},
	});

	if (!report || report.status !== "complete" || !report.content) notFound();

	// Fetch user's theme preference
	const settings = await db.query.userSettings.findFirst({
		where: eq(userSettings.userId, verified.userId),
		columns: { theme: true },
	});
	const themeClass = `theme-${settings?.theme ?? "edgejournal"}`;

	const dataArtifacts =
		(report.dataArtifacts as Record<string, unknown> | null) ?? {};
	const rawContent = report.content;

	// Parse content as structured JSON report, fall back to markdown for legacy
	const parsedReport = parseStructuredReport(rawContent);

	const displayTitle = report.prompt ?? report.title;
	const formattedDate = new Date(report.createdAt).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});

	return (
		<div className={`${themeClass} bg-background text-foreground`}>
			<div className="mx-auto max-w-4xl px-8 py-6">
				{/* Branded header */}
				<div className="mb-6 border-white/10 border-b pb-4">
					<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
						<span className="font-bold text-primary">EDGEJOURNAL</span>
						<span className="text-muted-foreground">{"// "}</span>
						<span className="text-muted-foreground">AI ANALYSIS REPORT</span>
					</div>
					<h1 className="mt-2 font-mono text-base text-foreground leading-relaxed">
						{displayTitle}
					</h1>
					<p className="mt-1 font-mono text-[10px] text-muted-foreground">
						{formattedDate}
					</p>
				</div>

				{/* Report content */}
				<article className="pdf-content">
					{parsedReport ? (
						<ReportRenderer
							dataArtifacts={dataArtifacts}
							report={parsedReport}
						/>
					) : (
						<ReactMarkdown
							components={markdownComponents as never}
							remarkPlugins={[remarkGfm]}
						>
							{rawContent}
						</ReactMarkdown>
					)}
				</article>
			</div>

			{/* Signal to Puppeteer that the page is ready */}
			<PdfReadySignal />

			{/* Print-specific CSS */}
			<style
				// biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS string
				dangerouslySetInnerHTML={{
					__html: `
						.pdf-content > * {
							page-break-inside: avoid;
						}
						@media print {
							body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
						}
					`,
				}}
			/>
		</div>
	);
}
