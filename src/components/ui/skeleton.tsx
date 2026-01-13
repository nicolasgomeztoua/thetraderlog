import { cn } from "@/lib/shared";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("animate-pulse rounded bg-white/5", className)}
			data-slot="skeleton"
			{...props}
		/>
	);
}

export { Skeleton };
