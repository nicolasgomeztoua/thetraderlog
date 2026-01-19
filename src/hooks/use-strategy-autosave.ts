"use client";

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/trpc/react";

// Infer the autosave input type from the router
type RouterInput = inferRouterInputs<AppRouter>;
type AutosaveInput = RouterInput["strategies"]["autosave"];

// Strategy form data is autosave input without id and clientUpdatedAt
export type StrategyFormData = Omit<AutosaveInput, "id" | "clientUpdatedAt">;

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

// Infer the server version type from autosave output
type RouterOutput = inferRouterOutputs<AppRouter>;
type AutosaveOutput = RouterOutput["strategies"]["autosave"];

// Server version from conflict response
type ServerVersionType = AutosaveOutput extends { serverVersion?: infer S }
	? S
	: never;

export interface ConflictData {
	serverVersion: NonNullable<ServerVersionType>;
	localChanges: Partial<StrategyFormData>;
}

interface UseStrategyAutosaveOptions {
	/** Strategy ID to auto-save */
	strategyId: string;
	/** Initial data from the server */
	initialData: StrategyFormData & { updatedAt?: string | Date | null };
	/** Callback when conflict is detected */
	onConflict?: (conflictData: ConflictData) => void;
	/** Debounce delay in ms (default: 1500ms) */
	debounceDelay?: number;
}

interface UseStrategyAutosaveReturn {
	/** Current form data */
	formData: StrategyFormData;
	/** Update a single field */
	updateField: <K extends keyof StrategyFormData>(
		field: K,
		value: StrategyFormData[K],
	) => void;
	/** Update multiple fields at once */
	updateFields: (updates: Partial<StrategyFormData>) => void;
	/** Current save status */
	saveStatus: SaveStatus;
	/** Whether there are unsaved changes */
	isDirty: boolean;
	/** Last successful save timestamp */
	lastSavedAt: string | null;
	/** Conflict data if status is 'conflict' */
	conflictData: ConflictData | null;
	/** Resolve conflict by keeping local changes (force save) */
	resolveConflictKeepLocal: () => void;
	/** Resolve conflict by accepting server version */
	resolveConflictAcceptServer: () => void;
	/** Force an immediate save (bypasses debounce) */
	forceSave: () => void;
	/** Reset to initial data */
	reset: (
		newData?: StrategyFormData & { updatedAt?: string | Date | null },
	) => void;
}

/**
 * Hook for auto-saving strategy changes with conflict detection.
 *
 * Features:
 * - Debounced auto-save (1500ms default)
 * - Optimistic concurrency control via clientUpdatedAt
 * - Conflict resolution callbacks
 * - Dirty state tracking
 * - Cancel pending saves on new changes
 *
 * Based on journal-editor.tsx pattern with additions for conflict handling.
 */
export function useStrategyAutosave({
	strategyId,
	initialData,
	onConflict,
	debounceDelay = 1500,
}: UseStrategyAutosaveOptions): UseStrategyAutosaveReturn {
	// Form state
	const [formData, setFormData] = useState<StrategyFormData>(() => initialData);
	const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
	const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
	const [conflictData, setConflictData] = useState<ConflictData | null>(null);

	// Track the client's known server timestamp for conflict detection
	const clientUpdatedAtRef = useRef<string>(
		initialData.updatedAt
			? new Date(initialData.updatedAt).toISOString()
			: new Date().toISOString(),
	);

	// Track last saved data to prevent unnecessary saves
	const lastSavedDataRef = useRef<StrategyFormData>(initialData);

	// Debounce timer
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Saved indicator auto-clear timer
	const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	// Track if component is mounted
	const isMountedRef = useRef(true);

	// Check if data has changed from last saved version
	const hasDataChanged = useCallback(
		(current: StrategyFormData, saved: StrategyFormData): boolean => {
			return JSON.stringify(current) !== JSON.stringify(saved);
		},
		[],
	);

	// Get fields that changed between two versions
	const getChangedFields = useCallback(
		(
			saved: StrategyFormData,
			current: StrategyFormData,
		): Partial<StrategyFormData> => {
			const changes: Partial<StrategyFormData> = {};
			const allKeys = [
				...Object.keys(saved),
				...Object.keys(current),
			] as (keyof StrategyFormData)[];
			const keys = [...new Set(allKeys)];

			for (const key of keys) {
				if (JSON.stringify(saved[key]) !== JSON.stringify(current[key])) {
					// Use Object.assign to avoid type issues with partial assignment
					Object.assign(changes, { [key]: current[key] });
				}
			}

			return changes;
		},
		[],
	);

	// Auto-save mutation
	const autosaveMutation = api.strategies.autosave.useMutation({
		onSuccess: (result) => {
			if (!isMountedRef.current) return;

			if (result.success && result.savedAt) {
				setSaveStatus("saved");
				setLastSavedAt(result.savedAt);
				// Update client timestamp to match server
				clientUpdatedAtRef.current = result.savedAt;
				// Update last saved data
				lastSavedDataRef.current = { ...formData };
				setConflictData(null);

				// Clear saved status after 2 seconds
				savedIndicatorTimeoutRef.current = setTimeout(() => {
					if (isMountedRef.current) {
						setSaveStatus("idle");
					}
				}, 2000);
			} else if (result.conflict && result.serverVersion) {
				// Conflict detected
				setSaveStatus("conflict");
				const conflict: ConflictData = {
					serverVersion: result.serverVersion,
					localChanges: getChangedFields(lastSavedDataRef.current, formData),
				};
				setConflictData(conflict);
				onConflict?.(conflict);
			}
		},
		onError: () => {
			if (!isMountedRef.current) return;
			setSaveStatus("error");
		},
	});

	// Perform the actual save
	const performSave = useCallback(
		(dataToSave: StrategyFormData) => {
			// Don't save if nothing changed
			if (!hasDataChanged(dataToSave, lastSavedDataRef.current)) {
				return;
			}

			setSaveStatus("saving");
			autosaveMutation.mutate({
				id: strategyId,
				clientUpdatedAt: clientUpdatedAtRef.current,
				...dataToSave,
			});
		},
		[strategyId, autosaveMutation, hasDataChanged],
	);

	// Schedule a debounced save
	const scheduleSave = useCallback(
		(dataToSave: StrategyFormData) => {
			// Cancel any pending save
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}

			// Clear any pending "saved" indicator timeout
			if (savedIndicatorTimeoutRef.current) {
				clearTimeout(savedIndicatorTimeoutRef.current);
			}

			debounceTimerRef.current = setTimeout(() => {
				performSave(dataToSave);
			}, debounceDelay);
		},
		[performSave, debounceDelay],
	);

	// Update a single field
	const updateField = useCallback(
		<K extends keyof StrategyFormData>(
			field: K,
			value: StrategyFormData[K],
		) => {
			setFormData((prev) => {
				const next = { ...prev, [field]: value };
				scheduleSave(next);
				return next;
			});
		},
		[scheduleSave],
	);

	// Update multiple fields at once
	const updateFields = useCallback(
		(updates: Partial<StrategyFormData>) => {
			setFormData((prev) => {
				const next = { ...prev, ...updates };
				scheduleSave(next);
				return next;
			});
		},
		[scheduleSave],
	);

	// Force an immediate save
	const forceSave = useCallback(() => {
		// Cancel pending debounced save
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
			debounceTimerRef.current = null;
		}
		performSave(formData);
	}, [performSave, formData]);

	// Resolve conflict by keeping local changes (force overwrite)
	const resolveConflictKeepLocal = useCallback(() => {
		if (!conflictData) return;

		// Update client timestamp to server's latest to allow overwrite
		const serverUpdatedAt = conflictData.serverVersion.updatedAt;
		const serverTimestamp = serverUpdatedAt
			? new Date(serverUpdatedAt).toISOString()
			: new Date().toISOString();
		clientUpdatedAtRef.current = serverTimestamp;

		// Clear conflict state
		setConflictData(null);
		setSaveStatus("idle");

		// Force save with local changes
		performSave(formData);
	}, [conflictData, formData, performSave]);

	// Resolve conflict by accepting server version
	const resolveConflictAcceptServer = useCallback(() => {
		if (!conflictData) return;

		// Extract form data fields from server version
		const { updatedAt, ...serverFormData } = conflictData.serverVersion;
		setFormData(serverFormData as StrategyFormData);
		lastSavedDataRef.current = serverFormData as StrategyFormData;

		// Update client timestamp
		clientUpdatedAtRef.current = updatedAt
			? new Date(updatedAt).toISOString()
			: new Date().toISOString();

		// Clear conflict state
		setConflictData(null);
		setSaveStatus("idle");
	}, [conflictData]);

	// Reset to initial or new data
	const reset = useCallback(
		(newData?: StrategyFormData & { updatedAt?: string | Date | null }) => {
			const data = newData ?? initialData;
			const { updatedAt, ...formFields } = data;
			setFormData(formFields as StrategyFormData);
			lastSavedDataRef.current = formFields as StrategyFormData;
			clientUpdatedAtRef.current = updatedAt
				? new Date(updatedAt).toISOString()
				: new Date().toISOString();
			setSaveStatus("idle");
			setConflictData(null);

			// Cancel any pending save
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = null;
			}
		},
		[initialData],
	);

	// Calculate isDirty
	const isDirty = hasDataChanged(formData, lastSavedDataRef.current);

	// Cleanup timers on unmount
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
			if (savedIndicatorTimeoutRef.current) {
				clearTimeout(savedIndicatorTimeoutRef.current);
			}
		};
	}, []);

	// Sync with external initial data changes (e.g., after refetch)
	useEffect(() => {
		// Only sync if we're not dirty and not in conflict
		if (!isDirty && saveStatus !== "conflict") {
			const { updatedAt, ...formFields } = initialData;
			setFormData(formFields as StrategyFormData);
			lastSavedDataRef.current = formFields as StrategyFormData;
			clientUpdatedAtRef.current = updatedAt
				? new Date(updatedAt).toISOString()
				: new Date().toISOString();
		}
	}, [initialData, isDirty, saveStatus]);

	return {
		formData,
		updateField,
		updateFields,
		saveStatus,
		isDirty,
		lastSavedAt,
		conflictData,
		resolveConflictKeepLocal,
		resolveConflictAcceptServer,
		forceSave,
		reset,
	};
}
