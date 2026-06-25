"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useReportLimitReached } from "@/components/billing/usage-limit-banner";
import { useAccount } from "@/contexts/account-context";
import {
	AI_MODEL_OPTIONS,
	type AiModelId,
	DEFAULT_REPORT_MODEL,
} from "@/lib/constants/ai";
import { ERR_VALIDATION_DATE_RANGE } from "@/lib/constants/errors";
import { api } from "@/trpc/react";
import { ModelSelector } from "./model-selector";
import { ReportArchive } from "./report-archive";
import { ReportComposer } from "./report-composer";

interface ReportInterfaceProps {
	mode: "chat" | "report";
	onModeChange: (mode: "chat" | "report") => void;
}

const REPORTS_PAGE_SIZE = 20;

export function ReportInterface({ mode, onModeChange }: ReportInterfaceProps) {
	const [prompt, setPrompt] = useState("");
	const [dateRangeStart, setDateRangeStart] = useState("");
	const [dateRangeEnd, setDateRangeEnd] = useState("");
	const [dateError, setDateError] = useState("");
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

	// Paginated report history (infinite). Polls every 5s while any report is
	// queued/generating, then stops.
	const {
		data,
		isLoading: isReportsLoading,
		hasNextPage,
		isFetchingNextPage,
		fetchNextPage,
	} = api.ai.listReports.useInfiniteQuery(
		{ limit: REPORTS_PAGE_SIZE },
		{
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
		},
	);

	const items = useMemo(
		() => data?.pages.flatMap((page) => page.items) ?? [],
		[data],
	);

	const startReport = api.ai.startReport.useMutation({
		onSuccess: () => {
			setPrompt("");
			void utils.billing.getUsage.invalidate();
			void utils.ai.listReports.invalidate();
		},
		onError: (err) => {
			if (err.data?.code === "FORBIDDEN") {
				void utils.billing.getUsage.invalidate();
			}
		},
	});

	const retryReport = api.ai.retryReport.useMutation({
		onSuccess: () => {
			void utils.ai.listReports.invalidate();
		},
	});

	const handleGenerate = useCallback(() => {
		const content = prompt.trim();
		if (!content) return;

		if (dateRangeStart && dateRangeEnd && dateRangeEnd < dateRangeStart) {
			setDateError(ERR_VALIDATION_DATE_RANGE);
			return;
		}
		setDateError("");

		startReport.mutate({
			prompt: content,
			model: selectedModel,
			...(dateRangeStart && {
				dateRangeStart: new Date(dateRangeStart).toISOString(),
			}),
			...(dateRangeEnd && {
				dateRangeEnd: new Date(dateRangeEnd).toISOString(),
			}),
			...(selectedAccountId && { accountId: selectedAccountId }),
		});
	}, [
		prompt,
		dateRangeStart,
		dateRangeEnd,
		selectedModel,
		selectedAccountId,
		startReport,
	]);

	const handleRefresh = useCallback(() => {
		setIsRefreshing(true);
		void utils.ai.listReports.invalidate().then(() => {
			setTimeout(() => setIsRefreshing(false), 500);
		});
	}, [utils.ai.listReports]);

	const handleRetry = useCallback(
		(reportId: string) => {
			retryReport.mutate({ reportId });
		},
		[retryReport],
	);

	const modelLabel = useMemo(
		() =>
			AI_MODEL_OPTIONS.find((m) => m.id === selectedModel)?.label ??
			selectedModel,
		[selectedModel],
	);

	return (
		<div
			className="flex h-full flex-col overflow-hidden rounded border border-border bg-card"
			data-testid="ai-report-interface"
		>
			<ModelSelector
				mode={mode}
				modelDisabled={startReport.isPending}
				onModeChange={onModeChange}
				onModelChange={handleModelChange}
				selectedModel={selectedModel}
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:p-4">
				<ReportComposer
					dateError={dateError}
					dateRangeEnd={dateRangeEnd}
					dateRangeStart={dateRangeStart}
					isPending={startReport.isPending}
					limitReached={reportLimitReached}
					modelLabel={modelLabel}
					onDateRangeEndChange={(v) => {
						setDateRangeEnd(v);
						setDateError("");
					}}
					onDateRangeStartChange={(v) => {
						setDateRangeStart(v);
						setDateError("");
					}}
					onGenerate={handleGenerate}
					onPromptChange={setPrompt}
					prompt={prompt}
				/>

				<ReportArchive
					fetchNextPage={() => void fetchNextPage()}
					hasNextPage={!!hasNextPage}
					isFetchingNextPage={isFetchingNextPage}
					isLoading={isReportsLoading}
					isRefreshing={isRefreshing}
					isRetrying={retryReport.isPending}
					items={items}
					onRefresh={handleRefresh}
					onRetry={handleRetry}
				/>
			</div>
		</div>
	);
}
