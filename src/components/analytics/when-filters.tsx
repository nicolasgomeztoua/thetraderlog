import { format, startOfYear, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { DAY_LABELS, HOURS, QUICK_DATE_PRESETS } from "@/lib/constants";
import { cn } from "@/lib/shared";
import { FilterField, FilterPill, FilterSection } from "./filter-section";

// =============================================================================
// TYPES
// =============================================================================

interface FilterOption {
	id: string;
	name: string;
}

interface DateRange {
	start: Date | null;
	end: Date | null;
}

interface WhenFiltersProps {
	/** Date range */
	dateRange: DateRange;
	/** Date range change handler */
	onDateRangeChange: (range: DateRange) => void;
	/** Available sessions */
	sessions: FilterOption[];
	/** Selected session IDs */
	selectedSessions: string[];
	/** Sessions change handler */
	onSessionsChange: (sessions: string[]) => void;
	/** Selected days of week (0-6, Sunday-Saturday) */
	selectedDays: number[];
	/** Days of week change handler */
	onDaysChange: (days: number[]) => void;
	/** Selected hours (0-23) */
	selectedHours: number[];
	/** Hours change handler */
	onHoursChange: (hours: number[]) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function WhenFilters({
	dateRange,
	onDateRangeChange,
	sessions,
	selectedSessions,
	onSessionsChange,
	selectedDays,
	onDaysChange,
	selectedHours,
	onHoursChange,
}: WhenFiltersProps) {
	// Format date for input
	const formatForInput = (date: Date | null) => {
		if (!date) return "";
		return format(date, "yyyy-MM-dd");
	};

	// Handle quick date preset
	const handleQuickDate = useCallback(
		(preset: (typeof QUICK_DATE_PRESETS)[number]) => {
			const today = new Date();
			today.setHours(23, 59, 59, 999);

			if (preset.days === 0) {
				// ALL - clear dates
				onDateRangeChange({ start: null, end: null });
			} else if (preset.days === -1) {
				// YTD
				onDateRangeChange({ start: startOfYear(today), end: today });
			} else {
				const startDate = subDays(today, preset.days);
				startDate.setHours(0, 0, 0, 0);
				onDateRangeChange({ start: startDate, end: today });
			}
		},
		[onDateRangeChange],
	);

	// Check if a preset is active
	const activePreset = useMemo(() => {
		if (!dateRange.start && !dateRange.end) return "ALL";

		const today = new Date();
		const daysDiff = dateRange.start
			? Math.round(
					(today.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24),
				)
			: null;

		if (daysDiff === 7) return "7D";
		if (daysDiff === 30) return "30D";
		if (daysDiff === 90) return "90D";

		// Check YTD
		if (dateRange.start) {
			const yearStart = startOfYear(today);
			if (
				format(dateRange.start, "yyyy-MM-dd") ===
				format(yearStart, "yyyy-MM-dd")
			) {
				return "YTD";
			}
		}

		return null;
	}, [dateRange]);

	// Toggle session
	const toggleSession = useCallback(
		(sessionId: string) => {
			if (selectedSessions.includes(sessionId)) {
				onSessionsChange(selectedSessions.filter((s) => s !== sessionId));
			} else {
				onSessionsChange([...selectedSessions, sessionId]);
			}
		},
		[selectedSessions, onSessionsChange],
	);

	// Toggle day
	const toggleDay = useCallback(
		(day: number) => {
			if (selectedDays.includes(day)) {
				onDaysChange(selectedDays.filter((d) => d !== day));
			} else {
				onDaysChange([...selectedDays, day]);
			}
		},
		[selectedDays, onDaysChange],
	);

	// Toggle hour
	const toggleHour = useCallback(
		(hour: number) => {
			if (selectedHours.includes(hour)) {
				onHoursChange(selectedHours.filter((h) => h !== hour));
			} else {
				onHoursChange([...selectedHours, hour]);
			}
		},
		[selectedHours, onHoursChange],
	);

	return (
		<FilterSection title="WHEN">
			<div className="space-y-6">
				{/* Row 1: Date Range, Sessions, Day of Week */}
				<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
					{/* Date Range */}
					<FilterField label="DATE RANGE">
						<div className="space-y-3">
							{/* Quick presets */}
							<div className="flex flex-wrap gap-1.5">
								{QUICK_DATE_PRESETS.map((preset) => (
									<button
										className={cn(
											"rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-all",
											activePreset === preset.label
												? "border-primary/40 bg-primary/10 text-primary"
												: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground",
										)}
										key={preset.label}
										onClick={() => handleQuickDate(preset)}
										type="button"
									>
										{preset.label}
									</button>
								))}
							</div>

							{/* Date inputs */}
							<div className="flex items-center gap-2">
								<div className="relative flex-1">
									<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2 size-3 text-muted-foreground" />
									<Input
										className="h-8 pl-7 font-mono text-xs"
										onChange={(e) =>
											onDateRangeChange({
												...dateRange,
												start: e.target.value ? new Date(e.target.value) : null,
											})
										}
										type="date"
										value={formatForInput(dateRange.start)}
									/>
								</div>
								<span className="font-mono text-muted-foreground text-xs">
									→
								</span>
								<div className="relative flex-1">
									<CalendarIcon className="-translate-y-1/2 absolute top-1/2 left-2 size-3 text-muted-foreground" />
									<Input
										className="h-8 pl-7 font-mono text-xs"
										onChange={(e) =>
											onDateRangeChange({
												...dateRange,
												end: e.target.value ? new Date(e.target.value) : null,
											})
										}
										type="date"
										value={formatForInput(dateRange.end)}
									/>
								</div>
							</div>
						</div>
					</FilterField>

					{/* Sessions */}
					<FilterField label="SESSION">
						{sessions.length === 0 ? (
							<p className="font-mono text-muted-foreground text-xs">
								No sessions configured
							</p>
						) : (
							<div className="flex flex-wrap gap-2">
								{sessions.map((session) => (
									<FilterPill
										key={session.id}
										label={session.name.toUpperCase()}
										onClick={() => toggleSession(session.id)}
										selected={selectedSessions.includes(session.id)}
									/>
								))}
							</div>
						)}
					</FilterField>

					{/* Day of Week */}
					<FilterField label="DAY OF WEEK">
						<div className="flex gap-1">
							{DAY_LABELS.map((day) => (
								<button
									className={cn(
										"flex size-8 items-center justify-center rounded border font-mono text-xs transition-all",
										selectedDays.includes(day.value)
											? "border-primary/40 bg-primary/10 text-primary"
											: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground",
									)}
									key={day.value}
									onClick={() => toggleDay(day.value)}
									title={day.full}
									type="button"
								>
									{day.short}
								</button>
							))}
						</div>
					</FilterField>
				</div>

				{/* Row 2: Hour Grid */}
				<FilterField label="ENTRY HOUR">
					<div className="grid grid-cols-12 gap-1 md:grid-cols-24">
						{HOURS.map((hour) => (
							<button
								className={cn(
									"flex h-7 items-center justify-center rounded-sm border font-mono text-[10px] transition-all",
									selectedHours.includes(hour)
										? "border-primary/40 bg-primary/10 text-primary"
										: "border-white/10 bg-white/2 text-muted-foreground hover:border-white/20 hover:text-foreground",
								)}
								key={`hour-${hour}`}
								onClick={() => toggleHour(hour)}
								title={`${hour.toString().padStart(2, "0")}:00`}
								type="button"
							>
								{hour.toString().padStart(2, "0")}
							</button>
						))}
					</div>
					<p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
						{selectedHours.length === 0
							? "All hours"
							: `${selectedHours.length} hour${selectedHours.length !== 1 ? "s" : ""} selected`}
					</p>
				</FilterField>
			</div>
		</FilterSection>
	);
}
