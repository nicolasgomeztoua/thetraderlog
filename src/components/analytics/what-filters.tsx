import { useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { FilterField, FilterPill, FilterSection } from "./filter-section";

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
	color?: string;
}

interface WhatFiltersProps {
	/** Available symbols */
	symbols: string[];
	/** Selected symbols */
	selectedSymbols: string[];
	/** Symbol change handler */
	onSymbolsChange: (symbols: string[]) => void;
	/** Available strategies */
	strategies: FilterOption[];
	/** Selected strategy IDs */
	selectedStrategies: string[];
	/** Strategy change handler */
	onStrategiesChange: (strategies: string[]) => void;
	/** Available tags */
	tags: FilterOption[];
	/** Selected tag IDs */
	selectedTags: string[];
	/** Tag change handler */
	onTagsChange: (tags: string[]) => void;
	/** Whether data is loading */
	isLoading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function WhatFilters({
	symbols,
	selectedSymbols,
	onSymbolsChange,
	strategies,
	selectedStrategies,
	onStrategiesChange,
	tags,
	selectedTags,
	onTagsChange,
	isLoading = false,
}: WhatFiltersProps) {
	// Toggle handlers
	const toggleSymbol = useCallback(
		(symbol: string) => {
			if (selectedSymbols.includes(symbol)) {
				onSymbolsChange(selectedSymbols.filter((s) => s !== symbol));
			} else {
				onSymbolsChange([...selectedSymbols, symbol]);
			}
		},
		[selectedSymbols, onSymbolsChange],
	);

	const toggleStrategy = useCallback(
		(strategyId: string) => {
			if (selectedStrategies.includes(strategyId)) {
				onStrategiesChange(selectedStrategies.filter((s) => s !== strategyId));
			} else {
				onStrategiesChange([...selectedStrategies, strategyId]);
			}
		},
		[selectedStrategies, onStrategiesChange],
	);

	const toggleTag = useCallback(
		(tagId: string) => {
			if (selectedTags.includes(tagId)) {
				onTagsChange(selectedTags.filter((t) => t !== tagId));
			} else {
				onTagsChange([...selectedTags, tagId]);
			}
		},
		[selectedTags, onTagsChange],
	);

	return (
		<FilterSection title="WHAT">
			<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
				{/* Symbols */}
				<FilterField label="SYMBOLS">
					{isLoading ? (
						<p className="font-mono text-muted-foreground text-xs">
							Loading...
						</p>
					) : symbols.length === 0 ? (
						<p className="font-mono text-muted-foreground text-xs">
							No symbols found
						</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{symbols.map((symbol) => (
								<FilterPill
									key={symbol}
									label={symbol}
									onClick={() => toggleSymbol(symbol)}
									selected={selectedSymbols.includes(symbol)}
								/>
							))}
						</div>
					)}
				</FilterField>

				{/* Strategies */}
				<FilterField label="STRATEGIES">
					{isLoading ? (
						<p className="font-mono text-muted-foreground text-xs">
							Loading...
						</p>
					) : strategies.length === 0 ? (
						<p className="font-mono text-muted-foreground text-xs">
							No strategies
						</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{strategies.map((strategy) => (
								<FilterPill
									color={strategy.color}
									key={strategy.id}
									label={strategy.name}
									onClick={() => toggleStrategy(strategy.id)}
									selected={selectedStrategies.includes(strategy.id)}
								/>
							))}
						</div>
					)}
				</FilterField>

				{/* Tags */}
				<FilterField label="TAGS">
					{isLoading ? (
						<p className="font-mono text-muted-foreground text-xs">
							Loading...
						</p>
					) : tags.length === 0 ? (
						<p className="font-mono text-muted-foreground text-xs">No tags</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{tags.map((tag) => (
								<button
									className={`rounded border px-2.5 py-1 font-mono text-xs transition-all ${
										selectedTags.includes(tag.id)
											? "border-primary/40 bg-primary/10"
											: "border-white/10 bg-white/2 hover:border-white/20"
									}`}
									key={tag.id}
									onClick={() => toggleTag(tag.id)}
									type="button"
								>
									<Badge
										className="border-0 bg-transparent p-0"
										style={{ color: tag.color }}
										variant="outline"
									>
										#{tag.name}
									</Badge>
								</button>
							))}
						</div>
					)}
				</FilterField>
			</div>
		</FilterSection>
	);
}
