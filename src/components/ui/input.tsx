import type * as React from "react";

import { cn } from "@/lib/shared";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			className={cn(
				"h-9 w-full min-w-0 rounded border border-white/10 bg-white/2 px-3 py-1 text-base outline-none transition-all selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20",
				"aria-invalid:border-destructive aria-invalid:ring-destructive/20",
				// Hide number input spinners
				"[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
				className,
			)}
			data-slot="input"
			type={type}
			{...props}
		/>
	);
}

export { Input };
