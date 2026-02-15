"use client";

import { useEffect } from "react";

/**
 * Signals to Puppeteer that the page is fully rendered and ready for PDF capture.
 * Sets data-pdf-ready="true" on the <html> element after a short delay
 * to allow charts to finish rendering.
 */
export function PdfReadySignal() {
	useEffect(() => {
		const timer = setTimeout(() => {
			document.documentElement.dataset.pdfReady = "true";
		}, 2000);
		return () => clearTimeout(timer);
	}, []);

	return null;
}
