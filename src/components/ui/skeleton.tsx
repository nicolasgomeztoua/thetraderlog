import { cn } from "@/lib/shared";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("animate-pulse rounded bg-muted", className)}
			data-slot="skeleton"
			{...props}
		/>
	);
}

export { Skeleton };
