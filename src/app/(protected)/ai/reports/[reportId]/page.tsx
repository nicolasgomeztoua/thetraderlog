import { ArrowLeft, Clock, Cpu, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { Suspense } from "react";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx/components";
import { markdownComponents } from "@/components/mdx/markdown-components";
import { sanitizeMdxProse } from "@/lib/mdx/sanitize";
import { api, HydrateClient } from "@/trpc/server";
import { DownloadPdfButton } from "./_components/download-pdf-button";
import { ReportViewerContent } from "./_components/report-viewer-content";
import { ShareButton } from "./_components/share-button";

// =============================================================================
// REPORT VIEWER PAGE — /ai/reports/[reportId]
// =============================================================================

interface ReportViewerPageProps {
	params: Promise<{ reportId: string }>;
}

export default async function ReportViewerPage({
	params,
}: ReportViewerPageProps) {
	const { reportId } = await params;

	let report: Awaited<ReturnType<typeof api.ai.getReportContent>>;
	try {
		report = await api.ai.getReportContent({ reportId });
	} catch {
		notFound();
	}

	// Report is still generating — show progress indicator
	if (report.status !== "complete" && report.status !== "failed") {
		return (
			<div className="flex h-[calc(100vh-4.5rem)] flex-col">
				<ReportHeader
					reportId={reportId}
					status={report.status}
					title={report.title}
				/>
				<div
					className="flex flex-1 flex-col items-center justify-center gap-4"
					data-testid="report-viewer-generating"
				>
					<Loader2 className="size-8 animate-spin text-accent" />
					<div className="text-center">
						<p className="font-mono text-foreground text-sm">
							Report is being generated...
						</p>
						<p className="mt-1 font-mono text-[10px] text-muted-foreground">
							This usually takes 1-3 minutes
						</p>
					</div>
				</div>
			</div>
		);
	}

	// Report failed
	if (report.status === "failed") {
		return (
			<div className="flex h-[calc(100vh-4.5rem)] flex-col">
				<ReportHeader
					reportId={reportId}
					status={report.status}
					title={report.title}
				/>
				<div
					className="flex flex-1 flex-col items-center justify-center gap-4"
					data-testid="report-viewer-failed"
				>
					<FileText className="size-8 text-loss/50" />
					<div className="text-center">
						<p className="font-mono text-foreground text-sm">
							Report generation failed
						</p>
						<p className="mt-1 font-mono text-[10px] text-muted-foreground">
							Please try generating a new report
						</p>
					</div>
					<Link
						className="mt-2 rounded border border-white/10 bg-white/[0.02] px-4 py-2 font-mono text-foreground text-xs transition-colors hover:border-accent/30 hover:text-accent"
						data-testid="report-viewer-back-link"
						href="/ai"
					>
						Back to Reports
					</Link>
				</div>
			</div>
		);
	}

	const dataArtifacts =
		(report.dataArtifacts as Record<string, unknown> | null) ?? {};

	// Compile MDX on the server using next-mdx-remote/rsc
	const rawContent = report.content ?? "";
	const sanitizedContent = sanitizeMdxProse(rawContent);
	const allComponents = { ...markdownComponents, ...mdxComponents };

	let mdxContent: React.ReactNode = null;
	let mdxFailed = false;
	try {
		const { content: compiled } = await compileMDX({
			source: sanitizedContent,
			components: allComponents as never,
			options: {
				mdxOptions: {
					remarkPlugins: [remarkGfm],
					format: "mdx",
				},
			},
		});
		mdxContent = compiled;
	} catch (e) {
		console.error("[MDX] Compilation failed, falling back to markdown:", e);
		mdxFailed = true;
	}

	return (
		<HydrateClient>
			<div
				className="flex h-[calc(100vh-4.5rem)] min-w-0 flex-col"
				data-testid="report-viewer-page"
			>
				<ReportHeader
					completedAt={report.completedAt}
					model={report.model}
					reportId={reportId}
					showPdfDownload
					status={report.status}
					title={report.prompt ?? report.title}
				/>
				<div className="flex min-h-0 min-w-0 flex-1">
					<Suspense
						fallback={
							<div className="flex flex-1 items-center justify-center">
								<Loader2 className="size-6 animate-spin text-accent" />
							</div>
						}
					>
						<ReportViewerContent
							content={rawContent}
							dataArtifacts={dataArtifacts}
							mdxFailed={mdxFailed}
						>
							{mdxContent}
						</ReportViewerContent>
					</Suspense>
				</div>
			</div>
		</HydrateClient>
	);
}

// =============================================================================
// REPORT HEADER
// =============================================================================

function ReportHeader({
	title,
	model,
	completedAt,
	reportId,
	status,
	showPdfDownload,
}: {
	title: string;
	model?: string | null;
	completedAt?: Date | null;
	reportId: string;
	status: string;
	showPdfDownload?: boolean;
}) {
	return (
		<div
			className="shrink-0 border-white/5 border-b bg-white/[0.01]"
			data-testid="report-viewer-header"
		>
			{/* Nav row: back link + actions */}
			<div className="flex items-center justify-between px-6 pt-4 pb-3">
				<Link
					className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground uppercase tracking-wider transition-colors hover:text-accent"
					data-testid="report-viewer-back"
					href="/ai"
				>
					<ArrowLeft className="size-3" />
					Reports
				</Link>
				<div
					className="flex items-center gap-2 print:hidden"
					data-testid="report-viewer-actions"
				>
					{showPdfDownload && <DownloadPdfButton reportId={reportId} />}
					<ShareButton reportId={reportId} />
				</div>
			</div>
			{/* Title block */}
			<div className="px-6 pb-4">
				<h1
					className="font-mono text-base text-foreground leading-relaxed"
					data-testid="report-viewer-title"
				>
					{title}
				</h1>
				<div className="mt-2 flex items-center gap-3">
					{model && (
						<span
							className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
							data-testid="report-viewer-model"
						>
							<Cpu className="size-2.5" />
							{model}
						</span>
					)}
					{completedAt && (
						<span
							className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
							data-testid="report-viewer-date"
						>
							<Clock className="size-2.5" />
							{new Date(completedAt).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
					)}
					{status !== "complete" && (
						<span className="font-mono text-[10px] text-accent uppercase tracking-wider">
							{status}
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

