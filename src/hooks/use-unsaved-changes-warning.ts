"use client";

import { useCallback, useEffect, useRef } from "react";

interface UseUnsavedChangesWarningOptions {
	/** Whether there are unsaved changes */
	isDirty: boolean;
	/** Custom message for the confirmation dialog (note: browsers may ignore this for security) */
	message?: string;
}

/**
 * Hook to warn users before leaving a page with unsaved changes.
 *
 * Handles:
 * 1. Hard navigation (refresh, close tab, external link) via beforeunload event
 * 2. Soft navigation (Next.js client-side routing) via click interception on links
 *
 * Usage:
 * ```tsx
 * const { isDirty } = useStrategyAutosave({ ... });
 * useUnsavedChangesWarning({ isDirty });
 * ```
 *
 * Note: In Next.js App Router, router events are not exposed like in Pages Router.
 * This hook intercepts link clicks to handle soft navigation.
 */
export function useUnsavedChangesWarning({
	isDirty,
	message = "You have unsaved changes. Are you sure you want to leave?",
}: UseUnsavedChangesWarningOptions): void {
	// Keep message in a ref to avoid stale closure issues
	const messageRef = useRef(message);
	messageRef.current = message;

	// Track isDirty in a ref for event handlers
	const isDirtyRef = useRef(isDirty);
	isDirtyRef.current = isDirty;

	// Handle hard navigation (refresh, close tab, external links)
	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (!isDirtyRef.current) return;

			// Modern browsers require both preventDefault() and returnValue
			event.preventDefault();
			// Note: Custom messages are ignored by most browsers for security
			// but we set returnValue for compatibility
			event.returnValue = messageRef.current;
			return messageRef.current;
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, []);

	// Handle soft navigation (Next.js client-side routing)
	// This works by intercepting clicks on anchor elements
	const handleLinkClick = useCallback((event: MouseEvent) => {
		if (!isDirtyRef.current) return;

		// Find the closest anchor element
		const target = event.target as HTMLElement;
		const anchor = target.closest("a");

		if (!anchor) return;

		// Skip if it's an external link (handled by beforeunload)
		const href = anchor.getAttribute("href");
		if (!href || href.startsWith("http") || href.startsWith("mailto:")) return;

		// Skip if modifier keys are pressed (user wants new tab/window)
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;

		// Skip if download attribute is present
		if (anchor.hasAttribute("download")) return;

		// Skip if target is not _self (e.g., _blank)
		const linkTarget = anchor.getAttribute("target");
		if (linkTarget && linkTarget !== "_self") return;

		// Show confirmation dialog
		const confirmed = window.confirm(messageRef.current);

		if (!confirmed) {
			// Prevent navigation
			event.preventDefault();
			event.stopPropagation();
		}
	}, []);

	// Set up link click interception
	useEffect(() => {
		// Use capture phase to intercept before the link handler
		document.addEventListener("click", handleLinkClick, true);

		return () => {
			document.removeEventListener("click", handleLinkClick, true);
		};
	}, [handleLinkClick]);

	// Handle browser back/forward buttons
	// Note: popstate fires AFTER navigation, so we use a different approach
	useEffect(() => {
		const handlePopState = () => {
			if (!isDirtyRef.current) return;

			// Show confirmation - if declined, push state back
			const confirmed = window.confirm(messageRef.current);

			if (!confirmed) {
				// Push current state back to prevent navigation
				// This creates a "bounce" effect where user stays on current page
				window.history.pushState(null, "", window.location.href);
			}
		};

		// Push initial state so we can intercept back button
		window.history.pushState(null, "", window.location.href);
		window.addEventListener("popstate", handlePopState);

		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, []);
}
