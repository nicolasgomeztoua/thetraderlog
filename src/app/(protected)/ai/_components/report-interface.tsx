"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useReportLimitReached } from "@/components/billing/usage-limit-banner";
import { useAccount } from "@/contexts/account-context";
import { type AiModelId, DEFAULT_REPORT_MODEL } from "@/lib/constants/ai";
import { api } from "@/trpc/react";
import { ModelSelector } from "./model-selector";
import { ReportOmnibox } from "./report-omnibox";

interface ReportInterfaceProps {
	mode: "chat" | "report";
	onModeChange: (mode: "chat" | "report") => void;
}

const REPORTS_PAGE_SIZE = 20;
const LIST_INPUT = { limit: REPORTS_PAGE_SIZE };

export function ReportInterface({ mode, onModeChange }: ReportInterfaceProps) {
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedModel, setSelectedModel] =
		useState<AiModelId>(DEFAULT_REPORT_MODEL);
	const { selectedAccountId } = useAccount();
	const reportLimitReached = useReportLimitReached();

	const utils = api.useUtils();

	// Sticky per-user default report model.
	const { data: userSettings } = api.settings.get.useQuery();
	useEffect(() => {
		if (userSettings?.reportModel) {
			setSelectedModel(userSettings.reportModel as AiModelId);
		}
	}, [userSettings?.reportModel]);

	const updateSettings = api.settings.update.useMutation();
	const handleModelChange = useCallback(
		(model: string) => {
			const next = model as AiModelId;
			setSelectedModel(next);
			updateSettings.mutate({ reportModel: next });
		},
		[updateSettings],
	);

	// Paginated history; polls every 5s while anything is in flight.
	const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
		api.ai.listReports.useInfiniteQuery(LIST_INPUT, {
			getNextPageParam: (lastPage) => lastPage.nextCursor,
			refetchOnWindowFocus: true,
			refetchInterval: (query) => {
				const pages = query.state.data?.pages;
				if (!pages) return false;
				const hasActive = pages.some((page) =>
					page.items.some(
						(r) => r.status === "queued" || r.status === "generating",
					),
				);
				return hasActive ? 5000 : false;
			},
		});

	const reports = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data],
	);

	const startReport = api.ai.startReport.useMutation({
		onSuccess: () => {
			void utils.billing.getUsage.invalidate();
			void utils.ai.listReports.invalidate();
		},
		onError: (err) => {
			if (err.data?.code === "FORBIDDEN") {
				void utils.billing.getUsage.invalidate();
			} else {
				toast.error(err.message || "Could not start report");
			}
		},
	});

	const retryReport = api.ai.retryReport.useMutation({
		onSuccess: () => void utils.ai.listReports.invalidate(),
		onError: (e) => toast.error(e.message || "Could not retry report"),
	});

	const deleteReport = api.ai.deleteReport.useMutation({
		onMutate: async ({ reportId }) => {
			await utils.ai.listReports.cancel(LIST_INPUT);
			const prev = utils.ai.listReports.getInfiniteData(LIST_INPUT);
			utils.ai.listReports.setInfiniteData(LIST_INPUT, (old) =>
				old
					? {
							...old,
							pages: old.pages.map((p) => ({
								...p,
								items: p.items.filter((r) => r.id !== reportId),
							})),
						}
					: old,
			);
			return { prev };
		},
		onError: (_e, _v, ctx) => {
			if (ctx?.prev) utils.ai.listReports.setInfiniteData(LIST_INPUT, ctx.prev);
			toast.error("Could not delete report");
		},
		onSettled: () => void utils.ai.listReports.invalidate(),
	});

	const handleGenerate = useCallback(
		(input: {
			prompt: string;
			dateRangeStart?: string;
			dateRangeEnd?: string;
		}) => {
			startReport.mutate({
				prompt: input.prompt,
				model: selectedModel,
				...(input.dateRangeStart && {
					dateRangeStart: new Date(input.dateRangeStart).toISOString(),
				}),
				...(input.dateRangeEnd && {
					dateRangeEnd: new Date(input.dateRangeEnd).toISOString(),
				}),
				...(selectedAccountId && { accountId: selectedAccountId }),
			});
		},
		[startReport, selectedModel, selectedAccountId],
	);

	const handleRetry = useCallback(
		(reportId: string) => retryReport.mutate({ reportId }),
		[retryReport],
	);

	const handleDelete = useCallback(
		(reportId: string) => deleteReport.mutate({ reportId }),
		[deleteReport],
	);

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true);
		void utils.ai.listReports.invalidate().then(() => {
			setTimeout(() => setIsRefreshing(false), 500);
		});
	}, [utils.ai.listReports]);

	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded border border-border bg-card"
			data-testid="ai-report-interface"
		>
			<ModelSelector
				hideModelPicker
				mode={mode}
				modelDisabled={startReport.isPending}
				onModeChange={onModeChange}
				onModelChange={handleModelChange}
				selectedModel={selectedModel}
			/>

			<ReportOmnibox
				fetchNextPage={() => void fetchNextPage()}
				hasNextPage={!!hasNextPage}
				isFetchingNextPage={isFetchingNextPage}
				isLoading={isLoading}
				isPending={startReport.isPending}
				isRefreshing={isRefreshing}
				isRetrying={retryReport.isPending}
				limitReached={reportLimitReached}
				onDelete={handleDelete}
				onGenerate={handleGenerate}
				onModelChange={handleModelChange}
				onRefresh={handleRefresh}
				onRetry={handleRetry}
				reports={reports}
				selectedModel={selectedModel}
			/>
		</div>
	);
}
