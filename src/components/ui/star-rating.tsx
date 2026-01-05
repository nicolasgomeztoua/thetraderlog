"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/shared";

interface StarRatingProps {
	value: number | null;
	onChange?: (value: number | null) => void;
	readonly?: boolean;
	size?: "sm" | "md" | "lg";
	showEmpty?: boolean;
}

export function StarRating({
	value,
	onChange,
	readonly = false,
	size = "md",
	showEmpty = true,
}: StarRatingProps) {
	const sizeClasses = {
		sm: "h-3 w-3",
		md: "h-4 w-4",
		lg: "h-5 w-5",
	};

	const handleClick = (rating: number) => {
		if (readonly || !onChange) return;
		// If clicking the same rating, clear it
		if (value === rating) {
			onChange(null);
		} else {
			onChange(rating);
		}
	};

	if (!showEmpty && !value) {
		return null;
	}

	return (
		<div className="flex items-center gap-0.5">
			{[1, 2, 3, 4, 5].map((rating) => (
				<button
					className={cn(
						"transition-colors",
						!readonly && "cursor-pointer hover:scale-110",
						readonly && "cursor-default",
					)}
					disabled={readonly}
					key={rating}
					onClick={(e) => {
						e.stopPropagation();
						handleClick(rating);
					}}
					type="button"
				>
					<Star
						className={cn(
							sizeClasses[size],
							"transition-colors",
							value && rating <= value
								? "fill-primary text-primary"
								: "text-muted-foreground/30",
							!readonly && "hover:fill-primary/30 hover:text-primary/70",
						)}
					/>
				</button>
			))}
		</div>
	);
}
