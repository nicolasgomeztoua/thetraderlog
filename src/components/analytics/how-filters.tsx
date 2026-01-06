import { Input } from "@/components/ui/input";
import { FilterField, FilterSection } from "./filter-section";

// =============================================================================
// TYPES
// =============================================================================

interface RangeValue {
	min: number | null;
	max: number | null;
}

interface HowFiltersProps {
	/** R-Multiple range */
	rMultipleRange: RangeValue;
	/** R-Multiple change handler */
	onRMultipleChange: (range: RangeValue) => void;
	/** Position size range */
	positionSizeRange: RangeValue;
	/** Position size change handler */
	onPositionSizeChange: (range: RangeValue) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function HowFilters({
	rMultipleRange,
	onRMultipleChange,
	positionSizeRange,
	onPositionSizeChange,
}: HowFiltersProps) {
	return (
		<FilterSection title="HOW">
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* R-Multiple Range */}
				<FilterField label="R-MULTIPLE">
					<div className="flex items-center gap-2">
						<Input
							className="h-8 w-20 font-mono text-xs"
							onChange={(e) =>
								onRMultipleChange({
									...rMultipleRange,
									min: e.target.value ? Number(e.target.value) : null,
								})
							}
							placeholder="Min"
							step={0.5}
							type="number"
							value={rMultipleRange.min ?? ""}
						/>
						<span className="font-mono text-muted-foreground text-xs">→</span>
						<Input
							className="h-8 w-20 font-mono text-xs"
							onChange={(e) =>
								onRMultipleChange({
									...rMultipleRange,
									max: e.target.value ? Number(e.target.value) : null,
								})
							}
							placeholder="Max"
							step={0.5}
							type="number"
							value={rMultipleRange.max ?? ""}
						/>
						<span className="font-mono text-[10px] text-muted-foreground">
							R
						</span>
					</div>
				</FilterField>

				{/* Position Size Range */}
				<FilterField label="POSITION SIZE">
					<div className="flex items-center gap-2">
						<Input
							className="h-8 w-20 font-mono text-xs"
							onChange={(e) =>
								onPositionSizeChange({
									...positionSizeRange,
									min: e.target.value ? Number(e.target.value) : null,
								})
							}
							placeholder="Min"
							step={1}
							type="number"
							value={positionSizeRange.min ?? ""}
						/>
						<span className="font-mono text-muted-foreground text-xs">→</span>
						<Input
							className="h-8 w-20 font-mono text-xs"
							onChange={(e) =>
								onPositionSizeChange({
									...positionSizeRange,
									max: e.target.value ? Number(e.target.value) : null,
								})
							}
							placeholder="Max"
							step={1}
							type="number"
							value={positionSizeRange.max ?? ""}
						/>
						<span className="font-mono text-[10px] text-muted-foreground">
							contracts
						</span>
					</div>
				</FilterField>
			</div>
		</FilterSection>
	);
}
