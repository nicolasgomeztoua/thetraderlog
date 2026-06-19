"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UpgradeButtonCompact } from "@/components/billing/upgrade-prompt";
import { isBetaFromMetadata } from "@/lib/billing/utils";
import { FEATURE_PDF_EXPORT } from "@/lib/constants/billing";
import { ERR_PDF_GENERATE_FAILED } from "@/lib/constants/errors";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

export function DownloadPdfButton({ reportId }: { reportId: string }) {
	const { has, isLoaded } = useAuth();
	const { user } = useUser();
	const [runId, setRunId] = useState<string | null>(null);

	const generatePdf = api.ai.generatePdf.useMutation({
		onSuccess: (data) => {
			setRunId(data.runId);
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_PDF_GENERATE_FAILED));
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

	const isBeta = isBetaFromMetadata(
		user?.publicMetadata as Record<string, unknown> | undefined,
	);
	const hasPdfAccess = isBeta || has?.({ feature: FEATURE_PDF_EXPORT });

	if (!isLoaded) {
		return (
			<div className="flex items-center gap-1.5 px-3 py-1.5">
				<div className="size-3 animate-pulse rounded bg-muted" />
				<div className="h-3 w-20 animate-pulse rounded bg-muted" />
			</div>
		);
	}

	if (!hasPdfAccess) {
		return (
			<UpgradeButtonCompact
				feature={FEATURE_PDF_EXPORT}
				testId="report-viewer-download-pdf-locked"
			/>
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
