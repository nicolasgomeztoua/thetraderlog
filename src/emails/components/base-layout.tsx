import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type * as React from "react";

interface BaseLayoutProps {
	preview: string;
	children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
	const timestamp = new Date().toISOString();

	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={body}>
				<Container style={container}>
					{/* Header */}
					<Section style={header}>
						<Text style={headerLabel}>EDGEJOURNAL</Text>
					</Section>

					{/* Content */}
					<Section style={content}>{children}</Section>

					{/* Footer */}
					<Hr style={divider} />
					<Section style={footer}>
						<Text style={footerText}>Generated: {timestamp}</Text>
						<Text style={footerText}>
							EdgeJournal — Professional Trading Journal
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

// =============================================================================
// STYLES
// =============================================================================

const body: React.CSSProperties = {
	margin: 0,
	padding: 0,
	backgroundColor: "#050505",
	fontFamily: "'Courier New', Courier, monospace",
	color: "#e0e0e0",
};

const container: React.CSSProperties = {
	maxWidth: "600px",
	margin: "0 auto",
	padding: "40px 16px",
};

const header: React.CSSProperties = {
	padding: "24px 32px 16px",
	borderBottom: "1px solid #d4ff00",
};

const headerLabel: React.CSSProperties = {
	margin: 0,
	fontSize: "11px",
	color: "#888888",
	letterSpacing: "2px",
};

const content: React.CSSProperties = {
	padding: "32px",
};

const divider: React.CSSProperties = {
	borderColor: "#1a1a1a",
	margin: 0,
};

const footer: React.CSSProperties = {
	padding: "16px 32px",
};

const footerText: React.CSSProperties = {
	margin: "0 0 4px",
	fontSize: "10px",
	color: "#888888",
};
