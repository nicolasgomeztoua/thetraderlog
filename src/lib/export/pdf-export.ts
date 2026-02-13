import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

// =============================================================================
// PDF EXPORT — Client-side report capture via html2canvas + jsPDF
// =============================================================================

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - 2 * MARGIN_MM;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - 2 * MARGIN_MM;
const HEADER_HEIGHT_MM = 12;
const FOOTER_HEIGHT_MM = 8;

/**
 * Captures the rendered report DOM element and generates a multi-page PDF.
 * Adds a branded header on the first page and page numbers on each page.
 */
export async function exportReportToPdf(
	element: HTMLElement,
	title: string,
): Promise<void> {
	const canvas = await html2canvas(element, {
		scale: 2,
		useCORS: true,
		backgroundColor: "#050505",
		logging: false,
	});

	const pdf = new jsPDF("p", "mm", "a4");
	const imgWidth = CONTENT_WIDTH_MM;
	const imgHeight = (canvas.height * imgWidth) / canvas.width;

	// Available content height per page (first page has header)
	const firstPageContentHeight =
		CONTENT_HEIGHT_MM - HEADER_HEIGHT_MM - FOOTER_HEIGHT_MM;
	const subsequentPageContentHeight = CONTENT_HEIGHT_MM - FOOTER_HEIGHT_MM;

	// Calculate total pages needed
	let remainingHeight = imgHeight;
	let totalPages = 0;

	if (remainingHeight <= firstPageContentHeight) {
		totalPages = 1;
	} else {
		totalPages = 1;
		remainingHeight -= firstPageContentHeight;
		totalPages += Math.ceil(remainingHeight / subsequentPageContentHeight);
	}

	// Source dimensions tracking
	const sourcePixelsPerMM = canvas.width / imgWidth;
	let sourceYOffset = 0;

	for (let page = 0; page < totalPages; page++) {
		if (page > 0) pdf.addPage();

		const isFirstPage = page === 0;
		const contentHeight = isFirstPage
			? firstPageContentHeight
			: subsequentPageContentHeight;
		const contentStartY = isFirstPage
			? MARGIN_MM + HEADER_HEIGHT_MM
			: MARGIN_MM;

		// Header on first page
		if (isFirstPage) {
			pdf.setFillColor(5, 5, 5);
			pdf.rect(0, 0, A4_WIDTH_MM, MARGIN_MM + HEADER_HEIGHT_MM, "F");

			// Branding
			pdf.setFont("courier", "bold");
			pdf.setFontSize(8);
			pdf.setTextColor(212, 255, 0); // chartreuse #d4ff00
			pdf.text("EDGEJOURNAL", MARGIN_MM, MARGIN_MM + 4);

			pdf.setFont("courier", "normal");
			pdf.setFontSize(6);
			pdf.setTextColor(100, 100, 100);
			pdf.text("//", MARGIN_MM + 28, MARGIN_MM + 4);

			pdf.setTextColor(180, 180, 180);
			pdf.text("AI ANALYSIS REPORT", MARGIN_MM + 32, MARGIN_MM + 4);

			// Report title
			pdf.setFont("courier", "normal");
			pdf.setFontSize(7);
			pdf.setTextColor(200, 200, 200);
			const truncatedTitle =
				title.length > 80 ? `${title.substring(0, 77)}...` : title;
			pdf.text(truncatedTitle, MARGIN_MM, MARGIN_MM + 9);
		}

		// Calculate source slice for this page
		const sliceHeightMM = Math.min(
			contentHeight,
			imgHeight - sourceYOffset / sourcePixelsPerMM,
		);
		const sliceHeightPx = sliceHeightMM * sourcePixelsPerMM;

		// Create a temporary canvas for just this page's slice
		const pageCanvas = document.createElement("canvas");
		pageCanvas.width = canvas.width;
		pageCanvas.height = Math.ceil(sliceHeightPx);
		const ctx = pageCanvas.getContext("2d");

		if (ctx) {
			// Fill with background color
			ctx.fillStyle = "#050505";
			ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

			// Draw the slice from the source canvas
			ctx.drawImage(
				canvas,
				0,
				sourceYOffset,
				canvas.width,
				Math.min(sliceHeightPx, canvas.height - sourceYOffset),
				0,
				0,
				canvas.width,
				Math.min(sliceHeightPx, canvas.height - sourceYOffset),
			);
		}

		const pageImgData = pageCanvas.toDataURL("image/png");
		pdf.addImage(
			pageImgData,
			"PNG",
			MARGIN_MM,
			contentStartY,
			imgWidth,
			sliceHeightMM,
		);

		sourceYOffset += sliceHeightPx;

		// Page background fill (dark)
		// Note: jsPDF renders images on top, so we set background before content
		pdf.setFillColor(5, 5, 5);

		// Footer with page number
		pdf.setFont("courier", "normal");
		pdf.setFontSize(6);
		pdf.setTextColor(100, 100, 100);
		pdf.text(
			`${page + 1} / ${totalPages}`,
			A4_WIDTH_MM / 2,
			A4_HEIGHT_MM - MARGIN_MM + 4,
			{ align: "center" },
		);
	}

	// Generate filename from title
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-|-$)/g, "")
		.substring(0, 50);
	pdf.save(`${slug}-report.pdf`);
}
