"use client";

import {
	AlertTriangle,
	Globe,
	Image as ImageIcon,
	Loader2,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { DefaultCover } from "@/components/strategy/default-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { STRATEGY_CATEGORIES, TRADEABLE_INSTRUMENTS } from "@/lib/constants";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

export interface PublishDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback to close the dialog */
	onOpenChange: (open: boolean) => void;
	/** Strategy data needed for publishing */
	strategy: {
		id: string;
		name: string;
		description: string | null;
		color: string | null;
		coverImageUrl: string | null;
		categoryTags: string | null;
		instruments: string | null;
		isPublic: boolean;
	};
	/** Callback after successful publish */
	onPublished?: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function getCategoryLabel(value: string): string {
	const category = STRATEGY_CATEGORIES.find((c) => c.value === value);
	return category?.label ?? value;
}

// =============================================================================
// PUBLISH DIALOG COMPONENT
// =============================================================================

/**
 * Publish dialog for publishing strategies to the marketplace.
 *
 * Features:
 * - Instruments multi-select (grouped by asset class)
 * - Categories multi-select
 * - Anonymous toggle
 * - Cover image preview with warning if none
 * - Preview of how strategy will appear
 * - Form validation (require at least one instrument and category)
 * - Publish mutation with loading state
 *
 * Props:
 * - open: Dialog visibility
 * - onOpenChange: Callback for open state changes
 * - strategy: Strategy data
 * - onPublished: Callback after publish
 */
export function PublishDialog({
	open,
	onOpenChange,
	strategy,
	onPublished,
}: PublishDialogProps) {
	// Parse existing values if republishing
	const existingInstruments: string[] = strategy.instruments
		? JSON.parse(strategy.instruments)
		: [];
	const existingCategories: string[] = strategy.categoryTags
		? JSON.parse(strategy.categoryTags)
		: [];

	// Form state
	const [selectedInstruments, setSelectedInstruments] =
		useState<string[]>(existingInstruments);
	const [selectedCategories, setSelectedCategories] =
		useState<string[]>(existingCategories);
	const [isAnonymous, setIsAnonymous] = useState(false);

	// Publish mutation
	const publishMutation = api.strategies.publish.useMutation({
		onSuccess: () => {
			toast.success("Strategy published to marketplace!");
			onOpenChange(false);
			onPublished?.();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to publish strategy");
		},
	});

	const handleInstrumentToggle = (value: string) => {
		setSelectedInstruments((prev) =>
			prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
		);
	};

	const handleCategoryToggle = (value: string) => {
		setSelectedCategories((prev) =>
			prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
		);
	};

	const handlePublish = () => {
		// Validate
		if (selectedInstruments.length === 0) {
			toast.error("Please select at least one instrument");
			return;
		}
		if (selectedCategories.length === 0) {
			toast.error("Please select at least one category");
			return;
		}

		publishMutation.mutate({
			strategyId: strategy.id,
			instruments: selectedInstruments,
			categoryTags: selectedCategories,
			isAnonymous,
		});
	};

	const strategyColor = strategy.color ?? "#d4ff00";
	const hasCoverImage = !!strategy.coverImageUrl;
	const isValid =
		selectedInstruments.length > 0 && selectedCategories.length > 0;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent
				className="max-h-[90vh] max-w-2xl overflow-hidden"
				data-testid="publish-dialog"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 font-mono">
						<Globe className="size-5 text-primary" />
						Publish to Marketplace
					</DialogTitle>
					<DialogDescription className="font-mono text-sm">
						Share your strategy with the EdgeJournal community
					</DialogDescription>
				</DialogHeader>

				<ScrollArea className="max-h-[60vh] pr-4">
					<div className="space-y-6 py-4">
						{/* Warning */}
						<div className="flex items-start gap-3 rounded-lg border border-breakeven/30 bg-breakeven/10 p-3">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-breakeven" />
							<div className="font-mono text-sm">
								<p className="font-medium text-breakeven">
									Your strategy will be publicly visible
								</p>
								<p className="mt-1 text-muted-foreground">
									Other traders will be able to view and download your strategy.
									Your name will be shown unless you publish anonymously.
								</p>
							</div>
						</div>

						{/* Cover image preview */}
						<div className="space-y-2">
							<Label className="font-mono text-sm">Cover Image Preview</Label>
							<div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border">
								{hasCoverImage ? (
									<Image
										alt={`${strategy.name} cover`}
										className="h-full w-full object-cover"
										fill
										sizes="(max-width: 768px) 100vw, 50vw"
										src={strategy.coverImageUrl ?? ""}
									/>
								) : (
									<DefaultCover
										categoryTag={selectedCategories[0]}
										className="h-full"
										strategyColor={strategyColor}
										strategyName={strategy.name}
									/>
								)}
							</div>
							{!hasCoverImage && (
								<p className="flex items-center gap-1 font-mono text-muted-foreground text-xs">
									<ImageIcon className="size-3" />
									No cover image set - a gradient will be used
								</p>
							)}
						</div>

						{/* Instruments selection */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="font-mono text-sm">
									Instruments <span className="text-loss">*</span>
								</Label>
								{selectedInstruments.length > 0 && (
									<Badge className="font-mono text-xs" variant="secondary">
										{selectedInstruments.length} selected
									</Badge>
								)}
							</div>

							<div className="space-y-4 rounded-lg border border-border p-3">
								{/* Futures */}
								<div className="space-y-2">
									<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
										Futures
									</p>
									<div className="flex flex-wrap gap-2">
										{TRADEABLE_INSTRUMENTS.futures.map((instrument) => (
											<label
												className={cn(
													"flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors",
													selectedInstruments.includes(instrument.value)
														? "border-primary bg-primary/10 text-foreground"
														: "border-border hover:border-muted-foreground",
												)}
												htmlFor={`instrument-${instrument.value}`}
												key={instrument.value}
											>
												<Checkbox
													checked={selectedInstruments.includes(
														instrument.value,
													)}
													className="size-3"
													id={`instrument-${instrument.value}`}
													onCheckedChange={() =>
														handleInstrumentToggle(instrument.value)
													}
												/>
												{instrument.symbol}
											</label>
										))}
									</div>
								</div>

								{/* Forex */}
								<div className="space-y-2">
									<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
										Forex
									</p>
									<div className="flex flex-wrap gap-2">
										{TRADEABLE_INSTRUMENTS.forex.map((instrument) => (
											<label
												className={cn(
													"flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors",
													selectedInstruments.includes(instrument.value)
														? "border-primary bg-primary/10 text-foreground"
														: "border-border hover:border-muted-foreground",
												)}
												htmlFor={`instrument-${instrument.value}`}
												key={instrument.value}
											>
												<Checkbox
													checked={selectedInstruments.includes(
														instrument.value,
													)}
													className="size-3"
													id={`instrument-${instrument.value}`}
													onCheckedChange={() =>
														handleInstrumentToggle(instrument.value)
													}
												/>
												{instrument.symbol}
											</label>
										))}
									</div>
								</div>

								{/* Crypto */}
								<div className="space-y-2">
									<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
										Crypto
									</p>
									<div className="flex flex-wrap gap-2">
										{TRADEABLE_INSTRUMENTS.crypto.map((instrument) => (
											<label
												className={cn(
													"flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors",
													selectedInstruments.includes(instrument.value)
														? "border-primary bg-primary/10 text-foreground"
														: "border-border hover:border-muted-foreground",
												)}
												htmlFor={`instrument-${instrument.value}`}
												key={instrument.value}
											>
												<Checkbox
													checked={selectedInstruments.includes(
														instrument.value,
													)}
													className="size-3"
													id={`instrument-${instrument.value}`}
													onCheckedChange={() =>
														handleInstrumentToggle(instrument.value)
													}
												/>
												{instrument.symbol}
											</label>
										))}
									</div>
								</div>
							</div>
						</div>

						{/* Categories selection */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<Label className="font-mono text-sm">
									Categories <span className="text-loss">*</span>
								</Label>
								{selectedCategories.length > 0 && (
									<Badge className="font-mono text-xs" variant="secondary">
										{selectedCategories.length} selected
									</Badge>
								)}
							</div>

							<div className="flex flex-wrap gap-2 rounded-lg border border-border p-3">
								{STRATEGY_CATEGORIES.map((category) => (
									<label
										className={cn(
											"flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 font-mono text-xs transition-colors",
											selectedCategories.includes(category.value)
												? "border-primary bg-primary/10 text-foreground"
												: "border-border hover:border-muted-foreground",
										)}
										htmlFor={`category-${category.value}`}
										key={category.value}
									>
										<Checkbox
											checked={selectedCategories.includes(category.value)}
											className="size-3"
											id={`category-${category.value}`}
											onCheckedChange={() =>
												handleCategoryToggle(category.value)
											}
										/>
										{category.label}
									</label>
								))}
							</div>
						</div>

						{/* Anonymous toggle */}
						<label
							className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3"
							htmlFor="anonymous-toggle"
						>
							<div className="space-y-0.5">
								<span className="font-mono text-sm">Publish Anonymously</span>
								<p className="font-mono text-muted-foreground text-xs">
									Hide your name from the strategy listing
								</p>
							</div>
							<Checkbox
								checked={isAnonymous}
								className="size-5"
								data-testid="publish-anonymous-toggle"
								id="anonymous-toggle"
								onCheckedChange={(checked) => setIsAnonymous(checked === true)}
							/>
						</label>

						{/* Preview */}
						<div className="space-y-2">
							<Label className="font-mono text-sm">Preview</Label>
							<div className="rounded-lg border border-border bg-card p-3">
								<div className="flex items-start gap-3">
									{/* Mini cover */}
									<div className="relative h-12 w-20 shrink-0 overflow-hidden rounded">
										{hasCoverImage ? (
											<Image
												alt={strategy.name}
												className="h-full w-full object-cover"
												fill
												sizes="80px"
												src={strategy.coverImageUrl ?? ""}
											/>
										) : (
											<div
												className="h-full w-full"
												style={{
													background: `linear-gradient(135deg, ${strategyColor} 0%, ${strategyColor}88 100%)`,
												}}
											/>
										)}
									</div>
									{/* Info */}
									<div className="flex-1 space-y-1">
										<p className="font-mono font-semibold text-sm">
											{strategy.name}
										</p>
										<p className="font-mono text-muted-foreground text-xs">
											by {isAnonymous ? "Anonymous" : "You"}
										</p>
										<div className="flex flex-wrap gap-1">
											{selectedCategories.slice(0, 2).map((cat) => (
												<Badge
													className="font-mono text-[10px]"
													key={cat}
													variant="secondary"
												>
													{getCategoryLabel(cat)}
												</Badge>
											))}
											{selectedCategories.length > 2 && (
												<Badge
													className="font-mono text-[10px]"
													variant="outline"
												>
													+{selectedCategories.length - 2}
												</Badge>
											)}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</ScrollArea>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						className="font-mono"
						data-testid="publish-dialog-cancel"
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						className="font-mono"
						data-testid="publish-dialog-submit"
						disabled={!isValid || publishMutation.isPending}
						onClick={handlePublish}
						type="button"
					>
						{publishMutation.isPending ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Publishing...
							</>
						) : (
							<>
								<Globe className="mr-2 size-4" />
								Publish Strategy
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
