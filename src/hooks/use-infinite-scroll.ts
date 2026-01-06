/**
 * Infinite scroll hook using IntersectionObserver
 * Triggers onLoadMore when sentinel element becomes visible
 */

import { useCallback, useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
	/** Callback to load more items */
	onLoadMore: () => void;
	/** Whether there are more items to load */
	hasMore: boolean;
	/** Whether currently loading */
	isLoading: boolean;
	/** Intersection threshold (0-1) */
	threshold?: number;
	/** Root margin for earlier triggering */
	rootMargin?: string;
}

export function useInfiniteScroll({
	onLoadMore,
	hasMore,
	isLoading,
	threshold = 0.1,
	rootMargin = "100px",
}: UseInfiniteScrollOptions) {
	const observerRef = useRef<IntersectionObserver | null>(null);
	const sentinelRef = useRef<HTMLDivElement | null>(null);

	const setSentinelRef = useCallback(
		(node: HTMLDivElement | null) => {
			// Cleanup previous observer
			if (observerRef.current) {
				observerRef.current.disconnect();
			}

			if (!node) {
				sentinelRef.current = null;
				return;
			}

			sentinelRef.current = node;

			// Create new observer
			observerRef.current = new IntersectionObserver(
				(entries) => {
					const [entry] = entries;
					if (entry?.isIntersecting && hasMore && !isLoading) {
						onLoadMore();
					}
				},
				{ threshold, rootMargin },
			);

			observerRef.current.observe(node);
		},
		[onLoadMore, hasMore, isLoading, threshold, rootMargin],
	);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (observerRef.current) {
				observerRef.current.disconnect();
			}
		};
	}, []);

	return { sentinelRef: setSentinelRef };
}
