"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function ProtectedError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center px-6">
			<div className="text-center">
				<h1 className="font-bold font-mono text-3xl text-destructive tracking-tight">
					Something went wrong
				</h1>
				<p className="mt-2 max-w-md font-mono text-muted-foreground text-sm">
					An unexpected error occurred. This has been automatically reported to
					our team.
				</p>
				{error.digest && (
					<p className="mt-1 font-mono text-muted-foreground/50 text-xs">
						Error ID: {error.digest}
					</p>
				)}
				<button
					className="mt-6 border border-primary px-6 py-2.5 font-medium font-mono text-primary text-xs uppercase tracking-wider transition-colors hover:bg-primary hover:text-background"
					onClick={reset}
					type="button"
				>
					Try Again
				</button>
			</div>
		</div>
	);
}
