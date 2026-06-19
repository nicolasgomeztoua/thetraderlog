"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Extracts image URLs from HTML content
 */
function extractImageUrls(html: string): string[] {
	const urls: string[] = [];
	const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
	let match: RegExpExecArray | null = null;

	// biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop pattern
	while ((match = imgRegex.exec(html)) !== null) {
		const url = match[1];
		// Skip blob URLs (still uploading) and data URLs
		if (url && !url.startsWith("blob:") && !url.startsWith("data:")) {
			urls.push(url);
		}
	}

	return urls;
}

interface UseImagePreloaderResult {
	/** Whether images are currently loading */
	isLoading: boolean;
	/** Number of images that have loaded */
	loadedCount: number;
	/** Total number of images to load */
	totalCount: number;
	/** Manually trigger preload for new content */
	preload: (html: string) => void;
}

/**
 * Hook that preloads images from HTML content and tracks loading state.
 * Useful for showing loading states while images load in editors.
 *
 * @param html - HTML content containing images to preload
 * @returns Loading state and counts
 *
 * @example
 * ```tsx
 * const { isLoading, loadedCount, totalCount } = useImagePreloader(content);
 *
 * if (isLoading) {
 *   return <div>Loading images ({loadedCount}/{totalCount})...</div>;
 * }
 * ```
 */
export function useImagePreloader(
	html: string | null,
): UseImagePreloaderResult {
	const [loadedCount, setLoadedCount] = useState(0);
	const [totalCount, setTotalCount] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const preloadedUrlsRef = useRef<Set<string>>(new Set());
	const currentUrlsRef = useRef<string[]>([]);

	const preload = useCallback((content: string) => {
		const urls = extractImageUrls(content);

		// Filter out already preloaded URLs
		const newUrls = urls.filter((url) => !preloadedUrlsRef.current.has(url));

		if (newUrls.length === 0) {
			// All images already preloaded
			setIsLoading(false);
			setLoadedCount(urls.length);
			setTotalCount(urls.length);
			return;
		}

		currentUrlsRef.current = newUrls;
		setTotalCount(urls.length);
		setLoadedCount(urls.length - newUrls.length);
		setIsLoading(true);

		let loaded = urls.length - newUrls.length;

		for (const url of newUrls) {
			const img = new window.Image();

			const handleComplete = () => {
				preloadedUrlsRef.current.add(url);
				loaded++;
				setLoadedCount(loaded);

				if (loaded >= urls.length) {
					setIsLoading(false);
				}
			};

			img.onload = handleComplete;
			img.onerror = handleComplete; // Count errors as "loaded" to not block indefinitely
			img.src = url;
		}
	}, []);

	useEffect(() => {
		if (!html) {
			setIsLoading(false);
			setLoadedCount(0);
			setTotalCount(0);
			return;
		}

		preload(html);
	}, [html, preload]);

	return {
		isLoading,
		loadedCount,
		totalCount,
		preload,
	};
}
