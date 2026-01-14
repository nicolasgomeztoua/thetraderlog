"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
	addDaysToDate,
	cn,
	formatDateInTimezone,
	isSameCalendarDay,
	toUserTimezone,
} from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";

interface DateNavigationProps {
	date: Date;
	onDateChange: (date: Date) => void;
	className?: string;
}

export function DateNavigation({
	date,
	onDateChange,
	className,
}: DateNavigationProps) {
	const { timezone } = useSettingsStore();
	const todayInTz = toUserTimezone(new Date(), timezone);
	const isTodaySelected = isSameCalendarDay(date, todayInTz);

	const handlePreviousDay = () => {
		onDateChange(addDaysToDate(date, -1));
	};

	const handleNextDay = () => {
		if (isTodaySelected) return;
		onDateChange(addDaysToDate(date, 1));
	};

	const handleToday = () => {
		onDateChange(todayInTz);
	};

	return (
		<div className={cn("flex items-center gap-1 sm:gap-2", className)}>
			{/* Previous Day Button */}
			<Button
				aria-label="Previous day"
				className="font-mono"
				onClick={handlePreviousDay}
				size="icon-sm"
				variant="outline"
			>
				<ChevronLeftIcon className="size-4" />
			</Button>

			{/* Date Display */}
			<span className="flex min-w-[120px] items-center justify-start rounded-md border border-input bg-background px-2 py-1.5 font-mono text-xs uppercase tracking-wider sm:min-w-[160px] sm:px-3">
				<CalendarIcon className="mr-1.5 size-4 sm:mr-2" />
				{formatDateInTimezone(date, timezone, { format: "MMM d, yyyy" })}
			</span>

			{/* Next Day Button */}
			<Button
				aria-label="Next day"
				className="font-mono"
				disabled={isTodaySelected}
				onClick={handleNextDay}
				size="icon-sm"
				variant="outline"
			>
				<ChevronRightIcon className="size-4" />
			</Button>

			{/* Today Button */}
			<Button
				className="font-mono text-xs uppercase tracking-wider"
				disabled={isTodaySelected}
				onClick={handleToday}
				size="sm"
				variant={isTodaySelected ? "secondary" : "outline"}
			>
				Today
			</Button>
		</div>
	);
}
