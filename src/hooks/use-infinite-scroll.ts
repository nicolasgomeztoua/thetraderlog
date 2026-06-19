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
	const sentinelNodeRef = useRef<HTMLDivElement | null>(null);

	// Store latest values in refs so the observer callback always reads current state
	const onLoadMoreRef = useRef(onLoadMore);
	const hasMoreRef = useRef(hasMore);
	const isLoadingRef = useRef(isLoading);

	useEffect(() => {
		onLoadMoreRef.current = onLoadMore;
	}, [onLoadMore]);

	useEffect(() => {
		hasMoreRef.current = hasMore;
	}, [hasMore]);

	useEffect(() => {
		isLoadingRef.current = isLoading;
	}, [isLoading]);

	// Stable callback ref — only recreated if threshold/rootMargin change (effectively never)
	const setSentinelRef = useCallback(
		(node: HTMLDivElement | null) => {
			// Cleanup previous observer
			if (observerRef.current) {
				observerRef.current.disconnect();
			}

			if (!node) {
				sentinelNodeRef.current = null;
				return;
			}

			sentinelNodeRef.current = node;

			// Create new observer — reads latest state from refs
			observerRef.current = new IntersectionObserver(
				(entries) => {
					const [entry] = entries;
					if (
						entry?.isIntersecting &&
						hasMoreRef.current &&
						!isLoadingRef.current
					) {
						onLoadMoreRef.current();
					}
				},
				{ threshold, rootMargin },
			);

			observerRef.current.observe(node);
		},
		[threshold, rootMargin],
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
