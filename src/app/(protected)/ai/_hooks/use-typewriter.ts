"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseTypewriterOptions {
	/** The full text to type out */
	text: string;
	/** Base speed in ms per character (default: 8) */
	speed?: number;
	/** Whether the typewriter effect is active (default: true) */
	enabled?: boolean;
}

interface UseTypewriterReturn {
	/** The currently displayed portion of text */
	displayedText: string;
	/** Whether the typewriter has finished typing */
	isComplete: boolean;
	/** Skip to full text immediately */
	skip: () => void;
}

/**
 * Typewriter effect hook for AI responses.
 *
 * - Adaptive speed: 4ms/char for first 50 chars, then base speed
 * - Pauses before markdown headings (50ms)
 * - Code blocks render instantly as whole blocks
 * - Skip by calling skip() or pressing Escape
 */
export function useTypewriter({
	text,
	speed = 8,
	enabled = true,
}: UseTypewriterOptions): UseTypewriterReturn {
	const [displayedText, setDisplayedText] = useState(enabled ? "" : text);
	const [isComplete, setIsComplete] = useState(!enabled);
	const indexRef = useRef(0);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const skippedRef = useRef(!enabled);
	// The text value we've already begun animating. `enabled` can toggle for the
	// same (immutable) message — e.g. the latest answer when a new message is sent
	// flips it from history-rendered to "live" — and we must NOT restart the
	// animation in that case. Only a genuinely new `text` re-types.
	const animatedTextRef = useRef<string | null>(enabled ? null : text);

	const skip = useCallback(() => {
		skippedRef.current = true;
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setDisplayedText(text);
		setIsComplete(true);
	}, [text]);

	useEffect(() => {
		if (!enabled || !text) {
			// Disabled (history) or empty — show the full text and remember it so a
			// later enabled:false→true flip for this same message doesn't re-type it.
			animatedTextRef.current = text;
			setDisplayedText(text);
			setIsComplete(true);
			return;
		}

		// Already typed (or mid-typing) this exact text — a re-render or an
		// enabled toggle must not restart it. Only new content re-types.
		if (animatedTextRef.current === text) return;

		// Reset on new text
		animatedTextRef.current = text;
		indexRef.current = 0;
		skippedRef.current = false;
		setDisplayedText("");
		setIsComplete(false);

		function tick() {
			if (skippedRef.current) return;

			const idx = indexRef.current;
			if (idx >= text.length) {
				setIsComplete(true);
				return;
			}

			// Check if we're at a code block — render it all at once
			if (text.startsWith("```", idx)) {
				const endIdx = text.indexOf("```", idx + 3);
				if (endIdx !== -1) {
					const blockEnd = endIdx + 3;
					indexRef.current = blockEnd;
					setDisplayedText(text.slice(0, blockEnd));
					timerRef.current = setTimeout(tick, speed);
					return;
				}
			}

			// Check for markdown heading — pause before it
			if ((idx === 0 || text[idx - 1] === "\n") && text[idx] === "#") {
				timerRef.current = setTimeout(() => {
					indexRef.current = idx + 1;
					setDisplayedText(text.slice(0, idx + 1));
					timerRef.current = setTimeout(tick, speed);
				}, 50);
				return;
			}

			// Adaptive speed: faster for first 50 chars
			const charSpeed = idx < 50 ? Math.max(speed / 2, 4) : speed;

			indexRef.current = idx + 1;
			setDisplayedText(text.slice(0, idx + 1));
			timerRef.current = setTimeout(tick, charSpeed);
		}

		timerRef.current = setTimeout(tick, 0);

		return () => {
			if (timerRef.current) {
				clearTimeout(timerRef.current);
				timerRef.current = null;
			}
		};
	}, [text, speed, enabled]);

	// Escape key to skip
	useEffect(() => {
		if (isComplete || !enabled) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				skip();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isComplete, enabled, skip]);

	return { displayedText, isComplete, skip };
}
