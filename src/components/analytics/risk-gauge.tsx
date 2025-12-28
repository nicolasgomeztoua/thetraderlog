import { cn } from "@/lib/utils";

interface RiskGaugeProps {
	/** Risk of Ruin percentage (0-100) */
	riskOfRuin: number;
	/** Risk per trade as percentage (e.g., 1.5 for 1.5%) */
	riskPerTradePercent?: number;
	/** Source of risk per trade calculation */
	riskPerTradeSource?: "calculated" | "default" | "no_losses";
	/** Ruin threshold (drawdown %) used in calculation - as percentage (e.g., 6 for 6%) */
	ruinThresholdPercent?: number;
	/** Source of ruin threshold */
	ruinThresholdSource?: "account" | "default";
	className?: string;
}

/**
 * Get color based on RoR percentage
 */
function getRiskColor(ror: number): string {
	if (ror <= 1) return "#00ff88"; // Low - green
	if (ror <= 5) return "#00d4ff"; // Moderate - blue
	if (ror <= 20) return "#fbbf24"; // Elevated - yellow
	return "#ff3b3b"; // Critical - red
}

/**
 * Get risk label based on RoR percentage
 */
function getRiskLabel(ror: number): string {
	if (ror <= 1) return "Low Risk";
	if (ror <= 5) return "Moderate";
	if (ror <= 20) return "Elevated";
	return "Critical";
}

/**
 * Circular progress showing Risk of Ruin
 * Full-width responsive gauge visualization
 */
export function RiskGauge({
	riskOfRuin,
	riskPerTradePercent = 2,
	riskPerTradeSource = "default",
	ruinThresholdPercent = 50,
	ruinThresholdSource = "default",
	className,
}: RiskGaugeProps) {
	const cappedRor = Math.min(Math.max(riskOfRuin, 0), 100);
	const color = getRiskColor(riskOfRuin);
	const riskLabel = getRiskLabel(riskOfRuin);

	// Circle math - responsive sizing
	const size = 200;
	const strokeWidth = 14;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const progress = cappedRor / 100;
	const strokeDashoffset = circumference * (1 - progress);

	// Format display
	const displayValue =
		riskOfRuin < 0.01
			? "<0.01%"
			: riskOfRuin >= 100
				? "100%"
				: `${riskOfRuin.toFixed(2)}%`;

	// Build the basis text
	const riskBasis =
		riskPerTradeSource === "calculated"
			? `${riskPerTradePercent.toFixed(2)}% avg risk`
			: riskPerTradeSource === "no_losses"
				? "1% est. (no losses)"
				: `${riskPerTradePercent.toFixed(1)}% default`;

	const ruinBasis =
		ruinThresholdSource === "account"
			? `${ruinThresholdPercent.toFixed(0)}% max DD`
			: `${ruinThresholdPercent.toFixed(0)}% threshold`;

	return (
		<div
			className={cn(
				"flex min-h-[280px] w-full flex-col items-center justify-center py-6",
				className,
			)}
		>
			{/* Circular progress with glow effect */}
			<div
				className="relative"
				style={{
					width: size,
					height: size,
					filter: `drop-shadow(0 0 20px ${color}30)`,
				}}
			>
				<svg
					aria-label={`Risk of Ruin: ${displayValue}`}
					className="rotate-[-90deg]"
					height={size}
					role="img"
					width={size}
				>
					{/* Outer decorative ring */}
					<circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						r={radius + 8}
						stroke="rgba(255, 255, 255, 0.03)"
						strokeWidth={1}
					/>
					{/* Background circle */}
					<circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						r={radius}
						stroke="rgba(255, 255, 255, 0.08)"
						strokeWidth={strokeWidth}
					/>
					{/* Progress arc */}
					<circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						r={radius}
						stroke={color}
						strokeDasharray={circumference}
						strokeDashoffset={strokeDashoffset}
						strokeLinecap="round"
						strokeWidth={strokeWidth}
						style={{ transition: "stroke-dashoffset 0.5s ease-out" }}
					/>
					{/* Inner decorative ring */}
					<circle
						cx={size / 2}
						cy={size / 2}
						fill="none"
						r={radius - 20}
						stroke="rgba(255, 255, 255, 0.03)"
						strokeWidth={1}
					/>
				</svg>

				{/* Center content */}
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span
						className="font-bold font-mono text-4xl tracking-tight"
						style={{ color }}
					>
						{displayValue}
					</span>
					<span className="mt-1 font-mono text-muted-foreground text-xs">
						Risk of Ruin
					</span>
				</div>
			</div>

			{/* Risk level badge */}
			<div
				className="mt-4 rounded-full px-4 py-1.5 font-mono text-xs"
				style={{
					backgroundColor: `${color}15`,
					color: color,
					border: `1px solid ${color}30`,
				}}
			>
				{riskLabel}
			</div>

			{/* Basis info */}
			<div className="mt-3 text-center font-mono text-[10px] text-muted-foreground">
				Based on {riskBasis} · {ruinBasis}
			</div>
		</div>
	);
}
