import { useCallback, useMemo } from "react";
import {
	formatDateInTimezone,
	formatDateTimeInTimezone,
	formatTimeInTimezone,
	getTimezoneAbbreviation,
} from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";

/**
 * Hook that provides the user's timezone and timezone-aware formatting functions.
 * Uses the Zustand settings store for timezone data.
 * Falls back to browser timezone if settings haven't been hydrated yet.
 */
export function useTimezone() {
	const storeTimezone = useSettingsStore((state) => state.timezone);
	const storeTimezoneAbbr = useSettingsStore((state) => state.timezoneAbbr);
	const isHydrated = useSettingsStore((state) => state.isHydrated);

	// Get user's timezone from store, falling back to browser timezone before hydration
	const timezone = useMemo(() => {
		if (isHydrated && storeTimezone) {
			return storeTimezone;
		}
		// Fallback to browser timezone before hydration
		return Intl.DateTimeFormat().resolvedOptions().timeZone;
	}, [storeTimezone, isHydrated]);

	// Get timezone abbreviation (e.g., "EST", "PST")
	const timezoneAbbr = useMemo(() => {
		if (isHydrated && storeTimezoneAbbr) {
			return storeTimezoneAbbr;
		}
		// Compute from fallback timezone
		return getTimezoneAbbreviation(timezone);
	}, [storeTimezoneAbbr, isHydrated, timezone]);

	// Memoized formatting functions
	const formatDate = useCallback(
		(
			date: Date | string | null | undefined,
			options?: { format?: string; includeYear?: boolean },
		) => {
			return formatDateInTimezone(date, timezone, options);
		},
		[timezone],
	);

	const formatTime = useCallback(
		(
			date: Date | string | null | undefined,
			options?: { format?: string; includeSeconds?: boolean },
		) => {
			return formatTimeInTimezone(date, timezone, options);
		},
		[timezone],
	);

	const formatDateTime = useCallback(
		(
			date: Date | string | null | undefined,
			options?: { dateFormat?: string; timeFormat?: string },
		) => {
			return formatDateTimeInTimezone(date, timezone, options);
		},
		[timezone],
	);

	return {
		timezone,
		timezoneAbbr,
		isLoading: !isHydrated,
		formatDate,
		formatTime,
		formatDateTime,
	};
}
