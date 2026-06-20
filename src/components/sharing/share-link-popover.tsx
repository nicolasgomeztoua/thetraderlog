"use client";

import { Check, Copy, Eye, Link2, Loader2, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SHARE_EXPIRY_OPTIONS } from "@/lib/constants";
import {
	ERR_SHARE_LINK_CREATE_FAILED,
	ERR_SHARE_LINK_REVOKE_FAILED,
} from "@/lib/constants/errors";
import { getErrorMessage } from "@/lib/shared/utils";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface ShareLinkPopoverProps {
	resourceType: "report" | "trade" | "account_analytics" | "conversation";
	resourceId: string;
	/** Popover heading, e.g. "Share Trade" */
	title: string;
	/** Subheading shown under the title */
	description: string;
	/** Hint shown when no links exist yet */
	emptyHint: string;
	/** Trigger element (rendered via PopoverTrigger asChild) */
	children: React.ReactNode;
}

// =============================================================================
// SHARE LINK POPOVER
// Generic create/copy/revoke UI for public share links (reports, trades).
// =============================================================================

export function ShareLinkPopover({
	resourceType,
	resourceId,
	title,
	description,
	emptyHint,
	children,
}: ShareLinkPopoverProps) {
	const [open, setOpen] = useState(false);
	const [expiryDays, setExpiryDays] = useState<string>("never");
	const [copied, setCopied] = useState(false);

	const utils = api.useUtils();

	const { data: links, isLoading } = api.sharing.getLinksForResource.useQuery(
		{ resourceType, resourceId },
		{ enabled: open },
	);

	const createLink = api.sharing.createLink.useMutation({
		onSuccess: () => {
			void utils.sharing.getLinksForResource.invalidate({
				resourceType,
				resourceId,
			});
			toast.success("Share link created");
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_SHARE_LINK_CREATE_FAILED));
		},
	});

	const revokeLink = api.sharing.revokeLink.useMutation({
		onSuccess: () => {
			void utils.sharing.getLinksForResource.invalidate({
				resourceType,
				resourceId,
			});
			toast.success("Share link revoked");
		},
		onError: (error) => {
			toast.error(getErrorMessage(error, ERR_SHARE_LINK_REVOKE_FAILED));
		},
	});

	const activeLinks = links?.filter((l) => l.isActive) ?? [];

	const handleCreate = useCallback(() => {
		const days =
			expiryDays === "never" ? null : Number.parseInt(expiryDays, 10);
		createLink.mutate({
			resourceType,
			resourceId,
			expiryDays: days,
		});
	}, [createLink, expiryDays, resourceType, resourceId]);

	const handleCopy = useCallback(async (token: string) => {
		const url = `${window.location.origin}/share/${token}`;
		await navigator.clipboard.writeText(url);
		setCopied(true);
		toast.success("Link copied to clipboard");
		setTimeout(() => setCopied(false), 2000);
	}, []);

	const handleRevoke = useCallback(
		(linkId: string) => {
			revokeLink.mutate({ linkId });
		},
		[revokeLink],
	);

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>{children}</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 border-white/10 bg-[#0a0a0a] p-0"
			>
				<div className="border-white/5 border-b px-4 py-3">
					<h3 className="font-mono text-foreground text-xs">{title}</h3>
					<p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
						{description}
					</p>
				</div>

				<div className="px-4 py-3">
					{isLoading ? (
						<div className="flex items-center justify-center py-4">
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						</div>
					) : activeLinks.length > 0 ? (
						<div className="space-y-3">
							{activeLinks.map((link) => (
								<div
									className="rounded border border-white/5 bg-white/[0.02] p-3"
									key={link.id}
								>
									<div className="flex items-center gap-2">
										<input
											className="flex-1 rounded border border-white/10 bg-transparent px-2 py-1 font-mono text-[10px] text-foreground outline-none"
											onClick={(e) => e.currentTarget.select()}
											readOnly
											type="text"
											value={`${typeof window !== "undefined" ? window.location.origin : ""}/share/${link.token}`}
										/>
										<button
											className="shrink-0 rounded border border-white/10 p-1.5 text-muted-foreground transition-colors hover:border-accent/30 hover:text-accent"
											onClick={() => void handleCopy(link.token)}
											title="Copy link"
											type="button"
										>
											{copied ? (
												<Check className="size-3 text-profit" />
											) : (
												<Copy className="size-3" />
											)}
										</button>
										<button
											className="shrink-0 rounded border border-white/10 p-1.5 text-muted-foreground transition-colors hover:border-loss/30 hover:text-loss"
											onClick={() => handleRevoke(link.id)}
											title="Revoke link"
											type="button"
										>
											<Trash2 className="size-3" />
										</button>
									</div>
									<div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
										<span className="flex items-center gap-1">
											<Eye className="size-2.5" />
											{link.viewCount} {link.viewCount === 1 ? "view" : "views"}
										</span>
										{link.expiresAt && (
											<span>
												Expires{" "}
												{new Date(link.expiresAt).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
												})}
											</span>
										)}
										{!link.expiresAt && <span>Never expires</span>}
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="space-y-3">
							<p className="font-mono text-[10px] text-muted-foreground">
								{emptyHint}
							</p>
							<div className="flex items-center gap-2">
								<span className="font-mono text-[10px] text-muted-foreground">
									Expires:
								</span>
								<Select onValueChange={setExpiryDays} value={expiryDays}>
									<SelectTrigger className="h-7 flex-1 border-white/10 bg-transparent font-mono text-[10px]">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{SHARE_EXPIRY_OPTIONS.map((opt) => (
											<SelectItem
												key={opt.label}
												value={opt.value?.toString() ?? "never"}
											>
												{opt.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<button
								className="flex w-full items-center justify-center gap-1.5 rounded border border-accent/30 bg-accent/5 px-3 py-2 font-mono text-[10px] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
								disabled={createLink.isPending}
								onClick={handleCreate}
								type="button"
							>
								{createLink.isPending ? (
									<Loader2 className="size-3 animate-spin" />
								) : (
									<Link2 className="size-3" />
								)}
								Create Share Link
							</button>
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
