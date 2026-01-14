"use client";

import { useEffect, useState } from "react";

/**
 * Custom hook to detect if a media query matches.
 * Returns false during SSR and initial hydration to prevent mismatch.
 *
 * @param query - CSS media query string (e.g., "(max-width: 767px)")
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false);

	useEffect(() => {
		const mediaQuery = window.matchMedia(query);

		// Set initial value
		setMatches(mediaQuery.matches);

		// Create listener for changes
		const handleChange = (event: MediaQueryListEvent) => {
			setMatches(event.matches);
		};

		// Add listener
		mediaQuery.addEventListener("change", handleChange);

		// Cleanup
		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	}, [query]);

	return matches;
}
