import { OUTCOME_OPTIONS, REVIEW_OPTIONS } from "@/lib/constants";
import type { OutcomeFilter, ReviewedFilter } from "@/types/analytics-filters";
import { FilterField, FilterSection, FilterToggle } from "./filter-section";

// =============================================================================
// TYPES
// =============================================================================

interface ResultFiltersProps {
	/** Current outcome filter */
	outcome: OutcomeFilter;
	/** Outcome change handler */
	onOutcomeChange: (outcome: OutcomeFilter) => void;
	/** Current review status */
	reviewed: ReviewedFilter;
	/** Review status change handler */
	onReviewedChange: (reviewed: ReviewedFilter) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ResultFilters({
	outcome,
	onOutcomeChange,
	reviewed,
	onReviewedChange,
}: ResultFiltersProps) {
	return (
		<FilterSection title="RESULT">
			<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
				{/* Outcome */}
				<FilterField label="OUTCOME">
					<div className="flex flex-wrap gap-2">
						{OUTCOME_OPTIONS.map((option) => (
							<FilterToggle
								active={outcome === option.value}
								key={option.value}
								label={option.label}
								onClick={() => onOutcomeChange(option.value)}
								variant={option.variant}
							/>
						))}
					</div>
				</FilterField>

				{/* Review Status */}
				<FilterField label="REVIEW STATUS">
					<div className="flex flex-wrap gap-2">
						{REVIEW_OPTIONS.map((option) => (
							<FilterToggle
								active={reviewed === option.value}
								key={option.value}
								label={option.label}
								onClick={() => onReviewedChange(option.value)}
							/>
						))}
					</div>
				</FilterField>
			</div>
		</FilterSection>
	);
}
