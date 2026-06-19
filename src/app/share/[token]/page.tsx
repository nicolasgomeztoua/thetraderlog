import { eq, sql } from "drizzle-orm";
import { Clock, Cpu, Lock, TimerOff } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import { cache } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { mdxComponents } from "@/components/mdx/components";
import { markdownComponents } from "@/components/mdx/markdown-components";
import { ReportDataProvider } from "@/components/mdx/provider";
import { sanitizeMdxProse } from "@/lib/mdx/sanitize";
import { formatCurrency } from "@/lib/shared";
import { getSharedAnalyticsPayload } from "@/server/api/helpers/analytics-share";
import { getSharedTradePayload } from "@/server/api/helpers/trade-share";
import { db } from "@/server/db";
import { accounts, aiReports, shareLinks, users } from "@/server/db/schema";
import { SharedAnalyticsView } from "./_components/shared-analytics-view";
import { SharedTradeView } from "./_components/shared-trade-view";

// Dedupe the trade lookup between generateMetadata and the page render
const getCachedTradePayload = cache(getSharedTradePayload);

// =============================================================================
// METADATA
// =============================================================================

interface SharePageProps {
	params: Promise<{ token: string }>;
}

export async function generateMetadata({
	params,
}: SharePageProps): Promise<Metadata> {
	const { token } = await params;

	const link = await db.query.shareLinks.findFirst({
		where: eq(shareLinks.token, token),
	});

	if (
		!link ||
		!link.isActive ||
		(link.expiresAt && link.expiresAt < new Date())
	) {
		return { title: "Shared Report — TheTraderLog" };
	}

	if (link.resourceType === "report") {
		const report = await db.query.aiReports.findFirst({
			where: eq(aiReports.id, link.resourceId),
			columns: { title: true, prompt: true },
		});

		const title = report?.prompt ?? report?.title ?? "Shared Report";
		return {
			title: `${title} — TheTraderLog`,
			description:
				"AI-powered trading analysis report shared via TheTraderLog.",
			openGraph: {
				title: `${title} — TheTraderLog`,
				description:
					"AI-powered trading analysis report shared via TheTraderLog.",
				type: "article",
			},
		};
	}

	if (link.resourceType === "trade") {
		const payload = await getCachedTradePayload(db, link.resourceId);
		if (!payload) {
			return { title: "Shared Trade — TheTraderLog" };
		}

		const { trade, trader } = payload;
		const pnl = trade.netPnl ? parseFloat(trade.netPnl) : null;
		const pnlText =
			pnl !== null ? `${pnl >= 0 ? "+" : ""}${formatCurrency(pnl)}` : null;
		const title = [
			trade.symbol,
			trade.direction.toUpperCase(),
			pnlText,
			trader.name ? `· Shared by ${trader.name}` : null,
		]
			.filter(Boolean)
			.join(" ");
		const description = `${trader.name ?? "A trader"} shared a ${trade.symbol} ${trade.direction} trade from their TheTraderLog journal. View the chart, executions, and stats.`;

		return {
			title,
			description,
			openGraph: {
				title: `${title} | TheTraderLog`,
				description,
				type: "article",
			},
		};
	}

	if (link.resourceType === "account_analytics") {
		const [account, owner] = await Promise.all([
			db.query.accounts.findFirst({
				where: eq(accounts.id, link.resourceId),
				columns: { name: true },
			}),
			db.query.users.findFirst({
				where: eq(users.id, link.userId),
				columns: { name: true },
			}),
		]);

		const accountName = account?.name ?? "Account";
		const sharedBy = owner?.name ? ` · Shared by ${owner.name}` : "";
		const title = `${accountName} Analytics${sharedBy}`;
		const description = `${owner?.name ?? "A trader"} shared their ${accountName} analytics from TheTraderLog — performance, risk, and behavior metrics.`;

		return {
			title: `${title} — TheTraderLog`,
			description,
			openGraph: {
				title: `${title} | TheTraderLog`,
				description,
				type: "article",
			},
		};
	}

	return { title: "Shared Report — TheTraderLog" };
}

// =============================================================================
// SHARE PAGE — /share/[token]
// =============================================================================

export default async function SharePage({ params }: SharePageProps) {
	const { token } = await params;

	const link = await db.query.shareLinks.findFirst({
		where: eq(shareLinks.token, token),
	});

	if (!link) notFound();

	// Revoked
	if (!link.isActive) {
		return <ShareError type="revoked" />;
	}

	// Expired
	if (link.expiresAt && link.expiresAt < new Date()) {
		return <ShareError type="expired" />;
	}

	// Increment view count (fire-and-forget)
	void db
		.update(shareLinks)
		.set({
			viewCount: sql`${shareLinks.viewCount} + 1`,
			lastViewedAt: new Date(),
		})
		.where(eq(shareLinks.id, link.id));

	// Fetch resource
	if (link.resourceType === "report") {
		const report = await db.query.aiReports.findFirst({
			where: eq(aiReports.id, link.resourceId),
			columns: {
				title: true,
				content: true,
				dataArtifacts: true,
				completedAt: true,
				prompt: true,
				model: true,
			},
		});

		if (!report || !report.content) notFound();

		return <SharedReport report={{ ...report, content: report.content }} />;
	}

	if (link.resourceType === "trade") {
		const payload = await getCachedTradePayload(db, link.resourceId);

		if (!payload) notFound();

		return (
			<SharedTradeView
				token={token}
				trade={payload.trade}
				trader={payload.trader}
			/>
		);
	}

	if (link.resourceType === "account_analytics") {
		const payload = await getSharedAnalyticsPayload(
			db,
			link.resourceId,
			link.userId,
		);

		if (!payload) notFound();

		return <SharedAnalyticsView payload={payload} />;
	}

	notFound();
}

// =============================================================================
// SHARED REPORT RENDERER
// =============================================================================

async function SharedReport({
	report,
}: {
	report: {
		title: string;
		content: string;
		dataArtifacts: Record<string, unknown> | null;
		completedAt: Date | null;
		prompt: string;
		model: string;
	};
}) {
	const dataArtifacts = (report.dataArtifacts as Record<string, unknown>) ?? {};
	const rawContent = report.content;
	const sanitizedContent = sanitizeMdxProse(rawContent);
	const allComponents = { ...markdownComponents, ...mdxComponents };

	let mdxContent: React.ReactNode = null;
	let mdxFailed = false;
	try {
		const { content: compiled } = await compileMDX({
			source: sanitizedContent,
			components: allComponents as never,
			options: {
				mdxOptions: {
					remarkPlugins: [remarkGfm],
					format: "mdx",
				},
			},
		});
		mdxContent = compiled;
	} catch (e) {
		console.error("[Share] MDX compilation failed, using markdown:", e);
		mdxFailed = true;
	}

	const displayTitle = report.prompt ?? report.title;
	const formattedDate = report.completedAt
		? new Date(report.completedAt).toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: null;

	return (
		<div className="min-h-screen bg-background text-foreground">
			<ReportDataProvider data={dataArtifacts}>
				<div className="mx-auto max-w-4xl px-6 py-8">
					{/* Branded header */}
					<div className="mb-6 border-white/10 border-b pb-4">
						<div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
							<span className="font-bold text-primary">TRADERLOG</span>
							<span className="text-muted-foreground">{"// "}</span>
							<span className="text-muted-foreground">SHARED REPORT</span>
						</div>
						<h1 className="mt-3 font-mono text-base text-foreground leading-relaxed">
							{displayTitle}
						</h1>
						<div className="mt-2 flex items-center gap-3">
							{report.model && (
								<span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
									<Cpu className="size-2.5" />
									{report.model}
								</span>
							)}
							{formattedDate && (
								<span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
									<Clock className="size-2.5" />
									{formattedDate}
								</span>
							)}
						</div>
					</div>

					{/* Report content */}
					<article>
						{!mdxFailed ? (
							mdxContent
						) : (
							<ReactMarkdown
								components={markdownComponents as never}
								remarkPlugins={[remarkGfm]}
							>
								{rawContent}
							</ReactMarkdown>
						)}
					</article>

					{/* Footer CTA */}
					<div className="mt-12 border-white/10 border-t pt-6 text-center">
						<p className="font-mono text-[10px] text-muted-foreground">
							Generated with{" "}
							<Link
								className="text-primary transition-colors hover:text-accent"
								href="/"
							>
								TheTraderLog
							</Link>{" "}
							— AI-powered trading analytics
						</p>
					</div>
				</div>
			</ReportDataProvider>
		</div>
	);
}

// =============================================================================
// ERROR STATES
// =============================================================================

function ShareError({ type }: { type: "revoked" | "expired" }) {
	const isRevoked = type === "revoked";

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
			<div className="text-center">
				{isRevoked ? (
					<Lock className="mx-auto mb-4 size-8 text-muted-foreground/50" />
				) : (
					<TimerOff className="mx-auto mb-4 size-8 text-muted-foreground/50" />
				)}
				<h1 className="font-mono text-foreground text-sm">
					{isRevoked
						? "This share link has been revoked"
						: "This share link has expired"}
				</h1>
				<p className="mt-2 font-mono text-[10px] text-muted-foreground">
					{isRevoked
						? "The owner has disabled access to this report."
						: "This link is no longer valid. Ask the owner for a new one."}
				</p>
				<Link
					className="mt-6 inline-block rounded border border-white/10 bg-white/[0.02] px-4 py-2 font-mono text-foreground text-xs transition-colors hover:border-accent/30 hover:text-accent"
					href="/"
				>
					Go to TheTraderLog
				</Link>
			</div>
		</div>
	);
}
