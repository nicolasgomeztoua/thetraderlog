"use client";

import { Share2 } from "lucide-react";
import { ShareLinkPopover } from "@/components/sharing/share-link-popover";

export function ShareButton({ reportId }: { reportId: string }) {
	return (
		<ShareLinkPopover
			description="Anyone with the link can view this report"
			emptyHint="Create a shareable link for this report. Anyone with the link can view it without signing in."
			resourceId={reportId}
			resourceType="report"
			title="Share Report"
		>
			<button
				className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground"
				data-testid="report-viewer-share"
				type="button"
			>
				<Share2 className="size-3" />
				Share
			</button>
		</ShareLinkPopover>
	);
}
