import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Deep comparison utility for checking if data has changed.
 * Uses JSON serialization for object comparison.
 */
function deepEqual<T>(a: T, b: T): boolean {
	if (a === b) return true;
	if (a === null || b === null) return false;
	if (typeof a !== "object" || typeof b !== "object") return false;

	try {
		return JSON.stringify(a) === JSON.stringify(b);
	} catch {
		// If JSON.stringify fails, assume not equal
		return false;
	}
}

interface UseAutoSaveOptions<T> {
	/** The data to auto-save */
	data: T;
	/** Function to save the data */
	onSave: (data: T) => Promise<void>;
	/** Debounce delay in milliseconds (default: 800) */
	debounceMs?: number;
	/** Whether auto-save is enabled (default: true) */
	enabled?: boolean;
}

interface UseAutoSaveReturn {
	/** Whether a save is currently in progress */
	isSaving: boolean;
	/** When the last successful save occurred */
	lastSavedAt: Date | null;
	/** Error message from the last failed save */
	error: string | null;
	/** Trigger an immediate save (bypassing debounce) */
	saveNow: () => Promise<void>;
	/** Reset error state */
	clearError: () => void;
}

/**
 * Hook for auto-saving form data with debouncing and status tracking.
 *
 * Features:
 * - Debounces save calls (default 800ms)
 * - Skips save if data unchanged (deep comparison)
 * - Tracks save status (isSaving, lastSavedAt, error)
 * - Provides immediate save function for urgent saves
 * - Handles errors gracefully
 *
 * @example
 * ```tsx
 * const { isSaving, lastSavedAt, error, saveNow } = useAutoSave({
 *   data: formData,
 *   onSave: async (data) => {
 *     await updateMutation.mutateAsync(data);
 *   },
 *   debounceMs: 800,
 * });
 *
 * // Show save status indicator
 * {isSaving && <span>Saving...</span>}
 * {lastSavedAt && <span>Saved at {format(lastSavedAt, "HH:mm")}</span>}
 * {error && <span className="text-destructive">{error}</span>}
 * ```
 */
export function useAutoSave<T>({
	data,
	onSave,
	debounceMs = 800,
	enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
	const [isSaving, setIsSaving] = useState(false);
	const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Track last saved data to prevent redundant saves
	const lastSavedDataRef = useRef<T | null>(null);
	// Track the debounce timer
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Track if initial load has happened (don't save on mount)
	const isInitializedRef = useRef(false);
	// Track the latest onSave function to avoid stale closures
	const onSaveRef = useRef(onSave);
	onSaveRef.current = onSave;

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const performSave = useCallback(async (dataToSave: T) => {
		// Skip if data hasn't changed
		if (deepEqual(dataToSave, lastSavedDataRef.current)) {
			return;
		}

		setIsSaving(true);
		setError(null);

		try {
			await onSaveRef.current(dataToSave);
			lastSavedDataRef.current = dataToSave;
			setLastSavedAt(new Date());
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save changes";
			setError(message);
		} finally {
			setIsSaving(false);
		}
	}, []);

	const saveNow = useCallback(async () => {
		// Cancel any pending debounced save
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}

		await performSave(data);
	}, [data, performSave]);

	// Debounced auto-save when data changes
	useEffect(() => {
		// Skip if disabled
		if (!enabled) return;

		// Skip initial render (don't save on mount)
		if (!isInitializedRef.current) {
			isInitializedRef.current = true;
			lastSavedDataRef.current = data;
			return;
		}

		// Skip if data hasn't changed
		if (deepEqual(data, lastSavedDataRef.current)) {
			return;
		}

		// Clear existing debounce timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		// Set new debounce timer
		debounceTimerRef.current = setTimeout(() => {
			performSave(data);
		}, debounceMs);

		// Cleanup on unmount or when data changes
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [data, debounceMs, enabled, performSave]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, []);

	return {
		isSaving,
		lastSavedAt,
		error,
		saveNow,
		clearError,
	};
}
