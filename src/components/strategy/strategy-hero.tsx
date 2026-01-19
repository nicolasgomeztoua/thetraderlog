"use client";

import { PencilIcon } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/shared";
import { DefaultCover } from "./default-cover";

/**
 * Strategy data needed for the hero banner
 */
interface StrategyData {
	name: string;
	color: string | null;
	coverImageUrl: string | null;
	categoryTags?: string | null;
}

interface StrategyHeroProps {
	/** Strategy data for display */
	strategy: StrategyData;
	/** Whether the strategy is in edit mode */
	isEditing?: boolean;
	/** Callback when edit cover image is clicked */
	onEditCoverImage?: () => void;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Hero banner component for strategy detail page.
 *
 * Features:
 * - Full-width container, max height ~200px
 * - Display cover image or default gradient
 * - Strategy name overlaid on bottom-left with text shadow
 * - Semi-transparent gradient overlay from bottom
 * - Edit indicator (pencil icon) on hover when in edit mode
 * - Responsive: scales height on mobile
 *
 * Terminal design: monospace font, dark theme.
 */
export function StrategyHero({
	strategy,
	isEditing = false,
	onEditCoverImage,
	className,
}: StrategyHeroProps) {
	const { name, color, coverImageUrl, categoryTags } = strategy;
	const strategyColor = color ?? "#d4ff00";

	// Parse category tags for default cover
	const firstCategory =
		categoryTags && typeof categoryTags === "string"
			? (JSON.parse(categoryTags) as string[])[0]
			: undefined;

	const handleClick = () => {
		if (isEditing && onEditCoverImage) {
			onEditCoverImage();
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (isEditing && onEditCoverImage && (e.key === "Enter" || e.key === " ")) {
			e.preventDefault();
			onEditCoverImage();
		}
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Needs to act as button when editing, div needed for layout
		<div
			className={cn(
				"group relative w-full overflow-hidden rounded-lg",
				// Height: ~200px max, scales on mobile
				"h-32 sm:h-40 md:h-48 lg:h-52",
				isEditing && onEditCoverImage && "cursor-pointer",
				className,
			)}
			data-testid="strategy-hero"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			role={isEditing && onEditCoverImage ? "button" : undefined}
			tabIndex={isEditing && onEditCoverImage ? 0 : undefined}
		>
			{/* Cover image or default gradient */}
			{coverImageUrl ? (
				<Image
					alt={`${name} cover`}
					className="h-full w-full object-cover"
					data-testid="strategy-hero-image"
					fill
					priority
					sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
					src={coverImageUrl}
				/>
			) : (
				<DefaultCover
					categoryTag={firstCategory}
					className="h-full"
					strategyColor={strategyColor}
					strategyName={name}
				/>
			)}

			{/* Gradient overlay from bottom (only for cover images to improve text legibility) */}
			{coverImageUrl && (
				<div
					className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"
					data-testid="strategy-hero-gradient"
				/>
			)}

			{/* Strategy name - bottom-left */}
			{coverImageUrl && (
				<div className="absolute bottom-0 left-0 p-4 sm:p-5 md:p-6">
					<h1
						className="font-bold font-mono text-white text-xl drop-shadow-lg sm:text-2xl md:text-3xl lg:text-4xl"
						data-testid="strategy-hero-name"
						style={{
							textShadow: "0 2px 4px rgba(0,0,0,0.5)",
						}}
					>
						{name}
					</h1>
				</div>
			)}

			{/* Edit indicator - shown on hover in edit mode */}
			{isEditing && onEditCoverImage && (
				<div
					className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
					data-testid="strategy-hero-edit-overlay"
				>
					<div className="flex flex-col items-center gap-2">
						<div className="rounded-full bg-primary/20 p-3">
							<PencilIcon className="size-6 text-primary" />
						</div>
						<span className="font-medium font-mono text-sm text-white">
							Edit Cover Image
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
