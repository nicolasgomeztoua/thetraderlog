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
	className?: string;
}

/**
 * Get needle color based on RoR percentage
 */
function getNeedleColor(ror: number): string {
	if (ror <= 1) return "#00ff88"; // Low - green
	if (ror <= 5) return "#00d4ff"; // Moderate - blue
	if (ror <= 20) return "#fbbf24"; // Elevated - yellow
	return "#ff3b3b"; // Critical - red
}

/**
 * Semicircular gauge showing Risk of Ruin
 * Clean, professional visualization
 */
export function RiskGauge({
	riskOfRuin,
	riskPerTradePercent = 2,
	riskPerTradeSource = "default",
	ruinThresholdPercent = 50,
	className,
}: RiskGaugeProps) {
	// Cap at 100 for display
	const cappedRor = Math.min(Math.max(riskOfRuin, 0), 100);

	// Needle rotation: 0% = left (-180°), 100% = right (0°)
	const rotation = -(cappedRor / 100) * 180;

	// SVG dimensions - maximized for the container
	const radius = 90;
	const strokeWidth = 16;
	const centerX = 100;
	const centerY = 95;

	// Create arc path
	const createArc = (startAngle: number, endAngle: number) => {
		const startRad = (startAngle * Math.PI) / 180;
		const endRad = (endAngle * Math.PI) / 180;
		const startX = centerX + radius * Math.cos(startRad);
		const startY = centerY + radius * Math.sin(startRad);
		const endX = centerX + radius * Math.cos(endRad);
		const endY = centerY + radius * Math.sin(endRad);
		const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
		return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
	};

	const needleColor = getNeedleColor(riskOfRuin);

	// Format the percentage display
	const displayValue =
		riskOfRuin < 0.01
			? "<0.01%"
			: riskOfRuin >= 100
				? "100%"
				: `${riskOfRuin.toFixed(2)}%`;

	// Build the basis text
	const basisText = `${riskPerTradePercent.toFixed(riskPerTradeSource === "calculated" ? 2 : 1)}% risk · ${ruinThresholdPercent.toFixed(0)}% DD`;

	return (
		<div className={cn("flex h-full items-center justify-center", className)}>
			<svg
				aria-label={`Risk of Ruin: ${displayValue}`}
				className="h-full w-full"
				preserveAspectRatio="xMidYMid meet"
				role="img"
				viewBox="0 0 200 120"
			>
				{/* Background arc segments */}
				{/* Green zone (0-1%) */}
				<path
					d={createArc(-180, -180 + 1.8)}
					fill="none"
					opacity="0.5"
					stroke="#00ff88"
					strokeLinecap="round"
					strokeWidth={strokeWidth}
				/>
				{/* Blue zone (1-5%) */}
				<path
					d={createArc(-180 + 1.8, -180 + 9)}
					fill="none"
					opacity="0.5"
					stroke="#00d4ff"
					strokeLinecap="round"
					strokeWidth={strokeWidth}
				/>
				{/* Yellow zone (5-20%) */}
				<path
					d={createArc(-180 + 9, -180 + 36)}
					fill="none"
					opacity="0.5"
					stroke="#fbbf24"
					strokeLinecap="round"
					strokeWidth={strokeWidth}
				/>
				{/* Red zone (20-100%) */}
				<path
					d={createArc(-180 + 36, 0)}
					fill="none"
					opacity="0.5"
					stroke="#ff3b3b"
					strokeLinecap="round"
					strokeWidth={strokeWidth}
				/>

				{/* Needle */}
				<g
					style={{
						transformOrigin: `${centerX}px ${centerY}px`,
						transform: `rotate(${rotation}deg)`,
						transition: "transform 0.5s ease-out",
					}}
				>
					<line
						stroke={needleColor}
						strokeLinecap="round"
						strokeWidth="3"
						x1={centerX}
						x2={centerX - radius + strokeWidth / 2 + 2}
						y1={centerY}
						y2={centerY}
					/>
					<circle
						cx={centerX}
						cy={centerY}
						fill="#1e293b"
						r="8"
						stroke={needleColor}
						strokeWidth="2"
					/>
				</g>

				{/* Scale labels */}
				<text
					className="fill-muted-foreground font-mono"
					fontSize="9"
					textAnchor="middle"
					x={centerX - radius}
					y={centerY + 14}
				>
					0%
				</text>
				<text
					className="fill-muted-foreground font-mono"
					fontSize="9"
					textAnchor="middle"
					x={centerX}
					y={10}
				>
					50%
				</text>
				<text
					className="fill-muted-foreground font-mono"
					fontSize="9"
					textAnchor="middle"
					x={centerX + radius}
					y={centerY + 14}
				>
					100%
				</text>

				{/* Value display - centered under needle */}
				<text
					fill={needleColor}
					fontFamily="JetBrains Mono, monospace"
					fontSize="32"
					fontWeight="bold"
					textAnchor="middle"
					x={centerX}
					y={centerY - 12}
				>
					{displayValue}
				</text>
				<text
					className="fill-muted-foreground"
					fontFamily="JetBrains Mono, monospace"
					fontSize="10"
					textAnchor="middle"
					x={centerX}
					y={centerY + 2}
				>
					Risk of Ruin
				</text>

				{/* Basis info */}
				<text
					className="fill-muted-foreground"
					fontFamily="JetBrains Mono, monospace"
					fontSize="8"
					opacity="0.7"
					textAnchor="middle"
					x={centerX}
					y={118}
				>
					{basisText}
				</text>
			</svg>
		</div>
	);
}
