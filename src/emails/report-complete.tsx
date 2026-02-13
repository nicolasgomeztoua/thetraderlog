import { Button, Link, render, Section, Text } from "@react-email/components";
import type * as React from "react";
import { BaseLayout } from "./components/base-layout";

// =============================================================================
// TYPES
// =============================================================================

interface ReportCompleteEmailProps {
	reportTitle: string;
	reportUrl: string;
	metadata?: {
		generationTime?: string;
		chartsGenerated?: number;
	};
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReportCompleteEmail({
	reportTitle,
	reportUrl,
	metadata,
}: ReportCompleteEmailProps) {
	return (
		<BaseLayout preview="Your AI analysis report is ready — view it now">
			<Text style={intro}>
				Your AI analysis report has been generated and is ready to view.
			</Text>

			{/* Report title card */}
			<Section style={titleCard}>
				<Text style={titleLabel}>REPORT TITLE</Text>
				<Text style={titleValue}>{reportTitle}</Text>
			</Section>

			{/* View Report button */}
			<Section style={buttonSection}>
				<Button href={reportUrl} style={viewButton}>
					VIEW REPORT
				</Button>
			</Section>

			<Text style={subtitle}>
				Your report is permanently available in EdgeJournal.
			</Text>

			{/* Optional metadata */}
			{metadata && (metadata.generationTime || metadata.chartsGenerated) ? (
				<Section style={metadataSection}>
					{metadata.generationTime ? (
						<Text style={metaItem}>
							Generation time: {metadata.generationTime}
						</Text>
					) : null}
					{metadata.chartsGenerated != null ? (
						<Text style={metaItem}>
							Charts generated: {metadata.chartsGenerated}
						</Text>
					) : null}
				</Section>
			) : null}

			<Text style={viewLink}>
				Or copy this link:{" "}
				<Link href={reportUrl} style={linkStyle}>
					{reportUrl}
				</Link>
			</Text>
		</BaseLayout>
	);
}

// =============================================================================
// RENDER FUNCTION
// =============================================================================

export async function renderReportCompleteEmail(
	props: ReportCompleteEmailProps,
): Promise<string> {
	return render(<ReportCompleteEmail {...props} />);
}

// =============================================================================
// STYLES
// =============================================================================

const intro: React.CSSProperties = {
	margin: "0 0 24px",
	fontSize: "14px",
	lineHeight: "1.6",
	color: "#e0e0e0",
};

const titleCard: React.CSSProperties = {
	margin: "0 0 24px",
	padding: "16px",
	backgroundColor: "#0a0a0a",
	border: "1px solid #1a1a1a",
};

const titleLabel: React.CSSProperties = {
	margin: "0 0 4px",
	fontSize: "10px",
	color: "#888888",
	letterSpacing: "1px",
};

const titleValue: React.CSSProperties = {
	margin: 0,
	fontSize: "14px",
	color: "#00d4ff",
	fontFamily: "'Courier New', Courier, monospace",
};

const buttonSection: React.CSSProperties = {
	margin: "0 0 24px",
};

const viewButton: React.CSSProperties = {
	backgroundColor: "#d4ff00",
	color: "#050505",
	fontSize: "13px",
	fontFamily: "'Courier New', Courier, monospace",
	fontWeight: "bold",
	letterSpacing: "1px",
	padding: "12px 32px",
	textDecoration: "none",
};

const subtitle: React.CSSProperties = {
	margin: "0 0 16px",
	fontSize: "12px",
	color: "#888888",
	lineHeight: "1.5",
};

const metadataSection: React.CSSProperties = {
	margin: "0 0 16px",
	padding: "12px 16px",
	backgroundColor: "#0a0a0a",
	border: "1px solid #1a1a1a",
};

const metaItem: React.CSSProperties = {
	margin: "0 0 4px",
	fontSize: "11px",
	color: "#888888",
	fontFamily: "'Courier New', Courier, monospace",
};

const viewLink: React.CSSProperties = {
	margin: 0,
	fontSize: "11px",
	color: "#888888",
	lineHeight: "1.5",
};

const linkStyle: React.CSSProperties = {
	color: "#00d4ff",
	textDecoration: "underline",
};
