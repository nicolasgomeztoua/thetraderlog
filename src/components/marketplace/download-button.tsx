"use client";

import { CheckCircle, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

export interface DownloadButtonProps {
	/** Strategy ID to download */
	strategyId: string;
	/** Whether the current user has already downloaded this strategy */
	hasDownloaded: boolean;
	/** Callback after successful download */
	onDownloaded?: (newStrategyId: string) => void;
	/** Whether the button should be disabled (e.g., user's own strategy) */
	disabled?: boolean;
	/** Additional class names */
	className?: string;
}

// =============================================================================
// DOWNLOAD BUTTON COMPONENT
// =============================================================================

/**
 * Download button component for marketplace strategies.
 *
 * Features:
 * - Default state: 'Add to My Strategies' with download icon (chartreuse)
 * - Loading state: 'Adding...' with spinner
 * - Downloaded state: 'Downloaded' with checkmark (green, navigates to strategies)
 * - Toast notification on success with 'View Strategy' action
 * - Disabled state for own strategies
 *
 * Props:
 * - strategyId: Strategy to download
 * - hasDownloaded: Initial download state
 * - onDownloaded: Callback after download
 * - disabled: Disable the button
 * - className: Additional CSS classes
 */
export function DownloadButton({
	strategyId,
	hasDownloaded,
	onDownloaded,
	disabled = false,
	className,
}: DownloadButtonProps) {
	const router = useRouter();
	const [isDownloading, setIsDownloading] = useState(false);
	const [localHasDownloaded, setLocalHasDownloaded] = useState(hasDownloaded);

	// Download mutation
	const downloadMutation = api.strategies.download.useMutation({
		onSuccess: (data) => {
			setIsDownloading(false);
			setLocalHasDownloaded(true);
			toast.success("Strategy added to your collection", {
				action: {
					label: "View Strategy",
					onClick: () => router.push(`/strategies/${data.id}`),
				},
			});
			onDownloaded?.(data.id);
		},
		onError: (error) => {
			setIsDownloading(false);
			toast.error(error.message || "Failed to download strategy");
		},
	});

	const handleClick = () => {
		if (localHasDownloaded) {
			// Navigate to strategies list if already downloaded
			router.push("/strategies");
			return;
		}

		setIsDownloading(true);
		downloadMutation.mutate({ strategyId });
	};

	// Determine button state
	const isLoading = isDownloading || downloadMutation.isPending;
	const showDownloaded = localHasDownloaded && !isLoading;

	return (
		<Button
			className={cn(
				"gap-2 font-mono",
				showDownloaded &&
					"border-profit/50 bg-profit/10 text-profit hover:bg-profit/20",
				className,
			)}
			data-testid="download-button"
			disabled={disabled || isLoading}
			onClick={handleClick}
			variant={showDownloaded ? "outline" : "default"}
		>
			{isLoading ? (
				<>
					<Loader2 className="size-4 animate-spin" />
					Adding...
				</>
			) : showDownloaded ? (
				<>
					<CheckCircle className="size-4" />
					Downloaded
				</>
			) : (
				<>
					<Download className="size-4" />
					Add to My Strategies
				</>
			)}
		</Button>
	);
}
