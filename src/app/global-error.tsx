"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
		<html lang="en">
			<body
				style={{
					backgroundColor: "#050505",
					color: "#a3a3a3",
					fontFamily:
						"'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					minHeight: "100vh",
					margin: 0,
					padding: "1.5rem",
				}}
			>
				<div style={{ textAlign: "center", maxWidth: "480px" }}>
					<div
						style={{
							fontSize: "3rem",
							fontWeight: 700,
							color: "#ff3b3b",
							marginBottom: "0.5rem",
							letterSpacing: "-0.02em",
						}}
					>
						SYSTEM ERROR
					</div>
					<div
						style={{
							fontSize: "0.875rem",
							color: "#525252",
							marginBottom: "2rem",
							lineHeight: 1.6,
						}}
					>
						Something went wrong. This error has been automatically reported.
						{error.digest && (
							<span style={{ display: "block", marginTop: "0.5rem" }}>
								Error ID: {error.digest}
							</span>
						)}
					</div>
					<button
						onClick={reset}
						style={{
							backgroundColor: "transparent",
							color: "#d4ff00",
							border: "1px solid #d4ff00",
							padding: "0.625rem 1.5rem",
							fontFamily: "inherit",
							fontSize: "0.8125rem",
							fontWeight: 500,
							cursor: "pointer",
							letterSpacing: "0.05em",
							textTransform: "uppercase",
						}}
						type="button"
					>
						Try Again
					</button>
				</div>
			</body>
		</html>
	);
}
