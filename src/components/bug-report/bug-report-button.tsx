"use client";

import { Bug } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { BugReportDialog } from "./bug-report-dialog";

export function BugReportButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip>
				<TooltipTrigger asChild>
					<Button
						className="relative size-8"
						onClick={() => setOpen(true)}
						size="icon"
						variant="ghost"
					>
						<Bug className="size-4 text-muted-foreground" />
						<span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
						<span className="sr-only">Report a bug</span>
					</Button>
				</TooltipTrigger>
				<TooltipContent className="font-mono text-xs" side="bottom">
					Report a Bug
				</TooltipContent>
			</Tooltip>
			<BugReportDialog onOpenChange={setOpen} open={open} />
		</>
	);
}
