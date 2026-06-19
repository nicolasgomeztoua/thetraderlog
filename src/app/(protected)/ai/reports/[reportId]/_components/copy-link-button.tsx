"use client";

import { Check, Link2 } from "lucide-react";
import { useCallback, useState } from "react";

export function CopyLinkButtonClient({ url }: { url: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		const fullUrl = `${window.location.origin}${url}`;
		await navigator.clipboard.writeText(fullUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [url]);

	return (
		<button
			className="flex items-center gap-1.5 rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-accent/30 hover:text-foreground"
			data-testid="report-viewer-copy-link"
			onClick={() => void handleCopy()}
			type="button"
		>
			{copied ? (
				<>
					<Check className="size-3 text-profit" />
					Copied
				</>
			) : (
				<>
					<Link2 className="size-3" />
					Copy Link
				</>
			)}
		</button>
	);
}
