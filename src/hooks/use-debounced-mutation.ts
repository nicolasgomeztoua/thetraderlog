import { useCallback, useEffect, useRef } from "react";

/**
 * Creates a debounced mutation handler with optimistic updates.
 * Prevents race conditions when users make rapid changes (e.g., clicking stars quickly).
 *
 * @example
 * ```tsx
 * const { trigger, isPending } = useDebouncedMutation({
 *   mutationFn: (data) => updateRatingMutation.mutate(data),
 *   onOptimisticUpdate: (data) => applyOptimisticUpdate(data.id, { rating: data.rating }),
 *   delay: 300,
 * });
 *
 * // In component:
 * <StarRating onChange={(rating) => trigger({ id: tradeId, rating })} />
 * ```
 */

interface UseDebouncedMutationOptions<TData> {
	/** The mutation function to call after debounce */
	mutationFn: (data: TData) => void;
	/** Optional callback for immediate optimistic UI updates */
	onOptimisticUpdate?: (data: TData) => void;
	/** Debounce delay in milliseconds (default: 300) */
	delay?: number;
	/** Optional key extractor for per-item debouncing (e.g., trade ID) */
	getKey?: (data: TData) => string | number;
}

interface UseDebouncedMutationReturn<TData> {
	/** Trigger the debounced mutation */
	trigger: (data: TData) => void;
	/** Cancel any pending mutations */
	cancel: () => void;
	/** Whether there are pending mutations */
	isPending: boolean;
}

export function useDebouncedMutation<TData>({
	mutationFn,
	onOptimisticUpdate,
	delay = 300,
	getKey,
}: UseDebouncedMutationOptions<TData>): UseDebouncedMutationReturn<TData> {
	// For single-item debouncing
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	// For multi-item debouncing (when getKey is provided)
	const timeoutsMapRef = useRef<Map<string | number, NodeJS.Timeout>>(
		new Map(),
	);
	const pendingCountRef = useRef(0);

	const cancel = useCallback(() => {
		if (getKey) {
			timeoutsMapRef.current.forEach((timeout) => {
				clearTimeout(timeout);
			});
			timeoutsMapRef.current.clear();
		} else if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		pendingCountRef.current = 0;
	}, [getKey]);

	const trigger = useCallback(
		(data: TData) => {
			// Apply optimistic update immediately
			onOptimisticUpdate?.(data);

			if (getKey) {
				// Per-item debouncing
				const key = getKey(data);
				const existingTimeout = timeoutsMapRef.current.get(key);
				if (existingTimeout) {
					clearTimeout(existingTimeout);
				}

				pendingCountRef.current++;
				const timeout = setTimeout(() => {
					mutationFn(data);
					timeoutsMapRef.current.delete(key);
					pendingCountRef.current--;
				}, delay);
				timeoutsMapRef.current.set(key, timeout);
			} else {
				// Single debounce
				if (timeoutRef.current) {
					clearTimeout(timeoutRef.current);
				}

				pendingCountRef.current = 1;
				timeoutRef.current = setTimeout(() => {
					mutationFn(data);
					timeoutRef.current = null;
					pendingCountRef.current = 0;
				}, delay);
			}
		},
		[mutationFn, onOptimisticUpdate, delay, getKey],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			cancel();
		};
	}, [cancel]);

	return {
		trigger,
		cancel,
		get isPending() {
			return pendingCountRef.current > 0;
		},
	};
}

/**
 * Hook for managing optimistic updates with local state.
 * Useful for list views where you need to track pending changes across multiple items.
 *
 * @example
 * ```tsx
 * const { optimisticData, applyUpdate, clearUpdates } = useOptimisticState<Trade>();
 *
 * // Merge with server data
 * const trades = serverTrades.map(trade => ({
 *   ...trade,
 *   ...optimisticData.get(trade.id),
 * }));
 * ```
 */

import { useState } from "react";

interface UseOptimisticStateReturn<TData extends Record<string, unknown>> {
	/** Map of pending optimistic updates by ID */
	updates: Map<number | string, Partial<TData>>;
	/** Apply an optimistic update for an item */
	applyUpdate: (id: number | string, update: Partial<TData>) => void;
	/** Clear all optimistic updates */
	clearUpdates: () => void;
	/** Clear optimistic update for a specific item */
	clearUpdate: (id: number | string) => void;
	/** Merge optimistic updates with server data */
	mergeWithData: <T extends { id: number | string }>(data: T[]) => T[];
}

export function useOptimisticState<
	TData extends Record<string, unknown>,
>(): UseOptimisticStateReturn<TData> {
	const [updates, setUpdates] = useState<Map<number | string, Partial<TData>>>(
		new Map(),
	);

	const applyUpdate = useCallback(
		(id: number | string, update: Partial<TData>) => {
			setUpdates((prev) => {
				const next = new Map(prev);
				const existing = next.get(id) ?? {};
				next.set(id, { ...existing, ...update });
				return next;
			});
		},
		[],
	);

	const clearUpdates = useCallback(() => {
		setUpdates(new Map());
	}, []);

	const clearUpdate = useCallback((id: number | string) => {
		setUpdates((prev) => {
			const next = new Map(prev);
			next.delete(id);
			return next;
		});
	}, []);

	const mergeWithData = useCallback(
		<T extends { id: number | string }>(data: T[]): T[] => {
			if (updates.size === 0) return data;
			return data.map((item) => {
				const update = updates.get(item.id);
				return update ? { ...item, ...update } : item;
			});
		},
		[updates],
	);

	return {
		updates,
		applyUpdate,
		clearUpdates,
		clearUpdate,
		mergeWithData,
	};
}
