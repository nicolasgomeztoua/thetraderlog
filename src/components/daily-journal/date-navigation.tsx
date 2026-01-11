"use client";

import { addDays, format, isToday } from "date-fns";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/shared";

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
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	const handlePreviousDay = () => {
		onDateChange(addDays(date, -1));
	};

	const handleNextDay = () => {
		onDateChange(addDays(date, 1));
	};

	const handleToday = () => {
		onDateChange(new Date());
	};

	const handleCalendarSelect = (selectedDate: Date | undefined) => {
		if (selectedDate) {
			onDateChange(selectedDate);
			setIsCalendarOpen(false);
		}
	};

	const isTodaySelected = isToday(date);

	return (
		<div className={cn("flex items-center gap-2", className)}>
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

			{/* Date Picker Popover */}
			<Popover onOpenChange={setIsCalendarOpen} open={isCalendarOpen}>
				<PopoverTrigger asChild>
					<Button
						className="min-w-[160px] justify-start font-mono text-xs uppercase tracking-wider"
						variant="outline"
					>
						<CalendarIcon className="mr-2 size-4" />
						{format(date, "MMM d, yyyy")}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-auto p-0">
					<Calendar
						mode="single"
						onSelect={handleCalendarSelect}
						selected={date}
					/>
				</PopoverContent>
			</Popover>

			{/* Next Day Button */}
			<Button
				aria-label="Next day"
				className="font-mono"
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
