"use client";

import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import {
	formatDateInTimezone,
	formatTimeInTimezone,
	getTimezoneAbbreviation,
	getTimezoneOffset,
} from "@/lib/shared";

/**
 * Live timezone debug readout (timezone, UTC offset, current time, today's date).
 *
 * Owns its own 1-second clock so the per-second re-render is isolated to this
 * small component instead of re-rendering the entire (2k-line) settings page.
 */
export function TimezoneDebugInfo({ timezone }: { timezone: string }) {
	const [currentTime, setCurrentTime] = useState(new Date());
	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(new Date());
		}, 1000);
		return () => clearInterval(interval);
	}, []);

	const offset = getTimezoneOffset(timezone, currentTime);
	const offsetSign = offset >= 0 ? "+" : "";

	return (
		<div className="space-y-3 rounded border border-border bg-secondary/50 p-4">
			{/* Current Timezone */}
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Timezone
				</span>
				<span className="font-mono text-sm">
					{timezone}{" "}
					<span className="text-muted-foreground">
						({getTimezoneAbbreviation(timezone, currentTime)})
					</span>
				</span>
			</div>

			{/* UTC Offset */}
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					UTC Offset
				</span>
				<span className="font-mono text-sm">{`UTC${offsetSign}${offset}`}</span>
			</div>

			<Separator className="my-2" />

			{/* Current Time */}
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Current Time
				</span>
				<span className="font-mono text-primary text-sm tabular-nums">
					{formatTimeInTimezone(currentTime, timezone, {
						includeSeconds: true,
					})}
				</span>
			</div>

			{/* Today's Date */}
			<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
				<span className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
					Today's Date
				</span>
				<span className="font-mono text-sm">
					{formatDateInTimezone(currentTime, timezone, {
						format: "EEEE, MMMM d, yyyy",
					})}
				</span>
			</div>
		</div>
	);
}
