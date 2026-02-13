import { ArrowLeft, Clock, Cpu, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { api, HydrateClient } from "@/trpc/server";
import { DownloadPdfButton } from "./_components/download-pdf-button";
import { ReportViewerContent } from "./_components/report-viewer-content";

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

	return (
		<HydrateClient>
			<div
				className="flex h-[calc(100vh-4.5rem)] flex-col"
				data-testid="report-viewer-page"
			>
				<ReportHeader
					completedAt={report.completedAt}
					model={report.model}
					reportId={reportId}
					showPdfDownload
					status={report.status}
					title={report.title}
				/>
				<div className="flex min-h-0 flex-1">
					<Suspense
						fallback={
							<div className="flex flex-1 items-center justify-center">
								<Loader2 className="size-6 animate-spin text-accent" />
							</div>
						}
					>
						<ReportViewerContent
							content={report.content ?? ""}
							dataArtifacts={dataArtifacts}
						/>
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
			className="flex shrink-0 items-center justify-between border-white/5 border-b bg-white/[0.01] px-6 py-4"
			data-testid="report-viewer-header"
		>
			<div className="flex min-w-0 items-center gap-4">
				<Link
					className="flex shrink-0 items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent/30 hover:text-accent"
					data-testid="report-viewer-back"
					href="/ai"
				>
					<ArrowLeft className="size-3" />
					Reports
				</Link>
				<div className="min-w-0">
					<h1
						className="truncate font-mono text-foreground text-lg"
						data-testid="report-viewer-title"
					>
						{title}
					</h1>
					<div className="flex items-center gap-3">
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
							<span className="font-mono text-[10px] text-accent uppercase">
								{status}
							</span>
						)}
					</div>
				</div>
			</div>
			<div
				className="flex shrink-0 items-center gap-2 print:hidden"
				data-testid="report-viewer-actions"
			>
				{showPdfDownload && <DownloadPdfButton title={title} />}
				<CopyLinkButton reportId={reportId} />
			</div>
		</div>
	);
}

// =============================================================================
// COPY LINK BUTTON (client-interactivity needs "use client" wrapper)
// =============================================================================

function CopyLinkButton({ reportId }: { reportId: string }) {
	return <CopyLinkButtonClient url={`/ai/reports/${reportId}`} />;
}

// Imported as separate client component below
import { CopyLinkButtonClient } from "./_components/copy-link-button";
