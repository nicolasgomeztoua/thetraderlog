import { Badge } from "@/components/ui/badge";
import { getCategoryLabel } from "@/lib/constants";
import { cn } from "@/lib/shared";

interface DefaultCoverProps {
	/** Strategy name to display */
	strategyName: string;
	/** Strategy color (hex format, e.g., "#d4ff00") */
	strategyColor: string;
	/** Optional category tag to show as badge */
	categoryTag?: string;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Darken a hex color by a given percentage.
 *
 * @param hex - Hex color string (e.g., "#d4ff00" or "d4ff00")
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color string
 */
function darkenColor(hex: string, percent: number): string {
	// Remove # if present
	const cleanHex = hex.replace(/^#/, "");

	// Parse RGB values
	const r = Number.parseInt(cleanHex.substring(0, 2), 16);
	const g = Number.parseInt(cleanHex.substring(2, 4), 16);
	const b = Number.parseInt(cleanHex.substring(4, 6), 16);

	// Darken by reducing each channel towards 0
	const factor = 1 - percent / 100;
	const newR = Math.round(r * factor);
	const newG = Math.round(g * factor);
	const newB = Math.round(b * factor);

	// Convert back to hex
	const toHex = (n: number) => n.toString(16).padStart(2, "0");
	return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
}

/**
 * Default cover gradient component for strategy visual identity.
 *
 * Used when no custom cover image is uploaded. Generates a gradient
 * from the strategy color to a darker shade with the strategy name
 * centered in large monospace text.
 *
 * Features:
 * - 16:9 aspect ratio
 * - Diagonal linear gradient (top-left to bottom-right)
 * - Strategy name centered in large monospace text
 * - Long names truncated with ellipsis
 * - Optional category badge in bottom-left
 * - Pure component (no side effects, no state)
 *
 * Terminal design: monospace font, dark theme.
 */
export function DefaultCover({
	strategyName,
	strategyColor,
	categoryTag,
	className,
}: DefaultCoverProps) {
	// Generate gradient colors: from strategyColor to 30% darker
	const darkerColor = darkenColor(strategyColor, 30);

	// Determine text color based on color brightness
	// Use a simple luminance check to decide if text should be light or dark
	const cleanHex = strategyColor.replace(/^#/, "");
	const r = Number.parseInt(cleanHex.substring(0, 2), 16);
	const g = Number.parseInt(cleanHex.substring(2, 4), 16);
	const b = Number.parseInt(cleanHex.substring(4, 6), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	const textColorClass = luminance > 0.5 ? "text-black" : "text-white";

	return (
		<div
			className={cn("relative aspect-video w-full overflow-hidden", className)}
			data-testid="default-cover"
			style={{
				background: `linear-gradient(135deg, ${strategyColor} 0%, ${darkerColor} 100%)`,
			}}
		>
			{/* Strategy name - centered with ellipsis for long names */}
			<div className="absolute inset-0 flex items-center justify-center p-4">
				<h2
					className={cn(
						"max-w-full truncate text-center font-bold font-mono text-2xl sm:text-3xl md:text-4xl",
						textColorClass,
					)}
					data-testid="default-cover-name"
					title={strategyName}
				>
					{strategyName}
				</h2>
			</div>

			{/* Category badge - bottom-left */}
			{categoryTag && (
				<div className="absolute bottom-3 left-3">
					<Badge
						className={cn(
							"font-mono text-xs",
							luminance > 0.5
								? "bg-black/20 text-black hover:bg-black/30"
								: "bg-white/20 text-white hover:bg-white/30",
						)}
						data-testid="default-cover-category"
						variant="secondary"
					>
						{getCategoryLabel(categoryTag)}
					</Badge>
				</div>
			)}
		</div>
	);
}
