"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type * as React from "react";
import { DayPicker } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/shared";

function Calendar({
	className,
	classNames,
	showOutsideDays = true,
	...props
}: React.ComponentProps<typeof DayPicker>) {
	return (
		<DayPicker
			className={cn("p-3", className)}
			classNames={{
				months: "flex flex-col sm:flex-row gap-2",
				month: "flex flex-col gap-4",
				month_caption: "flex justify-center pt-1 relative items-center w-full",
				caption_label: "font-mono text-sm uppercase tracking-wider",
				nav: "flex items-center gap-1",
				button_previous: cn(
					buttonVariants({ variant: "outline" }),
					"absolute left-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
				),
				button_next: cn(
					buttonVariants({ variant: "outline" }),
					"absolute right-1 size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
				),
				month_grid: "w-full border-collapse",
				weekdays: "flex",
				weekday:
					"text-muted-foreground rounded w-8 font-mono text-[0.65rem] uppercase tracking-wider",
				week: "flex w-full mt-2",
				day: cn(
					"relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r",
				),
				day_button: cn(
					buttonVariants({ variant: "ghost" }),
					"size-8 p-0 font-mono text-xs hover:bg-white/[0.05] aria-selected:opacity-100",
				),
				range_start: "day-range-start rounded-l",
				range_end: "day-range-end rounded-r",
				selected:
					"bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
				today: "bg-white/[0.05] text-foreground",
				outside:
					"day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
				disabled: "text-muted-foreground opacity-50",
				range_middle:
					"aria-selected:bg-accent aria-selected:text-accent-foreground",
				hidden: "invisible",
				...classNames,
			}}
			components={{
				Chevron: ({ orientation }) => {
					const Icon =
						orientation === "left" ? ChevronLeftIcon : ChevronRightIcon;
					return <Icon className="size-4" />;
				},
			}}
			showOutsideDays={showOutsideDays}
			{...props}
		/>
	);
}

export { Calendar };
