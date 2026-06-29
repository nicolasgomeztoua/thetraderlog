"use client";

import { Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/shared/utils";

interface ReportDeleteButtonProps {
	reportId: string;
	/** True for queued/generating reports — delete also cancels the run. */
	active?: boolean;
	onConfirm: (reportId: string) => void;
	className?: string;
}

export function ReportDeleteButton({
	reportId,
	active = false,
	onConfirm,
	className,
}: ReportDeleteButtonProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<button
					aria-label={active ? "Cancel and delete report" : "Delete report"}
					className={cn(
						"rounded p-1 text-muted-foreground/50 transition-colors hover:bg-loss/10 hover:text-loss",
						className,
					)}
					data-testid={`report-delete-${reportId}`}
					type="button"
				>
					<Trash2 className="size-3.5" />
				</button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{active ? "Cancel and delete this report?" : "Delete this report?"}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{active
							? "This stops the in-progress generation and permanently removes the report. This can't be undone."
							: "This permanently removes the report. This can't be undone."}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep</AlertDialogCancel>
					<AlertDialogAction
						className="bg-loss text-white hover:bg-loss/90"
						onClick={() => onConfirm(reportId)}
					>
						{active ? "Cancel & delete" : "Delete"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
