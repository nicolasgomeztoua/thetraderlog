"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { FileText, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FEATURE_PDF_EXPORT } from "@/lib/constants/billing";
import { api } from "@/trpc/react";

export function DownloadPdfButton({ reportId }: { reportId: string }) {
	const { has } = useAuth();
	const { user } = useUser();
	const [runId, setRunId] = useState<string | null>(null);

	const generatePdf = api.ai.generatePdf.useMutation({
		onSuccess: (data) => {
			setRunId(data.runId);
		},
		onError: () => {
			toast.error("Failed to start PDF generation");
		},
	});

	// Poll for status using tRPC useQuery with refetchInterval
	const statusQuery = api.ai.getPdfStatus.useQuery(
		{ runId: runId ?? "" },
		{
			enabled: !!runId,
			refetchInterval: 2000,
			refetchIntervalInBackground: false,
		},
	);

	// Handle status changes
	useEffect(() => {
		if (!statusQuery.data || !runId) return;

		if (
			statusQuery.data.status === "complete" &&
			"downloadUrl" in statusQuery.data
		) {
			setRunId(null);
			window.open(statusQuery.data.downloadUrl, "_blank");
		} else if (statusQuery.data.status === "failed") {
			setRunId(null);
			toast.error("PDF generation failed");
		}
	}, [statusQuery.data, runId]);

	const isBeta = user?.publicMetadata?.beta === true;
	const hasPdfAccess = isBeta || has?.({ feature: FEATURE_PDF_EXPORT });

	if (!hasPdfAccess) {
		return (
			<Link
				className="flex items-center gap-1.5 rounded border border-[#00d4ff]/20 bg-[#00d4ff]/5 px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-[#00d4ff]/40 hover:text-foreground"
				data-testid="report-viewer-download-pdf-locked"
				href="/pricing"
			>
				<Lock className="size-3" />
				Upgrade to Export PDF
			</Link>
		);
	}

	const isGenerating = generatePdf.isPending || !!runId;

	const handleClick = () => {
		if (isGenerating) return;
		generatePdf.mutate({ reportId });
	};

	return (
		<button
			className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
			data-testid="report-viewer-download-pdf"
			disabled={isGenerating}
			onClick={handleClick}
			type="button"
		>
			{isGenerating ? (
				<>
					<Loader2 className="size-3 animate-spin" />
					Generating PDF...
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
