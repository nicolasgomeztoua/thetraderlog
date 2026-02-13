"use client";

import { FileText, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

export function DownloadPdfButton({ title }: { title: string }) {
	const [isGenerating, setIsGenerating] = useState(false);

	const handleDownload = useCallback(async () => {
		const contentEl = document.querySelector(
			'[data-testid="report-viewer-content"]',
		);
		if (!contentEl || !(contentEl instanceof HTMLElement)) return;

		setIsGenerating(true);
		try {
			const { exportReportToPdf } = await import("@/lib/export/pdf-export");
			await exportReportToPdf(contentEl, title);
		} catch {
			// Silently fail — html2canvas may not support all rendering features
		} finally {
			setIsGenerating(false);
		}
	}, [title]);

	return (
		<button
			className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
			data-testid="report-viewer-download-pdf"
			disabled={isGenerating}
			onClick={() => void handleDownload()}
			type="button"
		>
			{isGenerating ? (
				<>
					<Loader2 className="size-3 animate-spin" />
					Generating...
				</>
			) : (
				<>
					<FileText className="size-3" />
					Download PDF
				</>
			)}
		</button>
	);
}
