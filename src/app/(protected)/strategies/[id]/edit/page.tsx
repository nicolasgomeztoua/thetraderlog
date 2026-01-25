"use client";

import { AlertTriangle, ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type {
	BasicInfoData,
	RiskData,
	RulesData,
	StrategyRule,
} from "@/components/strategy";
import {
	BasicInfoSection,
	RiskSection,
	RulesSection,
	SaveStatusIndicator,
} from "@/components/strategy";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAutoSave } from "@/hooks/use-auto-save";
import { api } from "@/trpc/react";

/**
 * Combined form data for all sections
 */
interface EditFormData extends BasicInfoData, RulesData, RiskData {}

export default function StrategyEditPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;

	const [deleteOpen, setDeleteOpen] = useState(false);

	const utils = api.useUtils();

	const { data: strategy, isLoading } = api.strategies.getById.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId },
	);

	const updateMutation = api.strategies.update.useMutation({
		onSuccess: () => {
			utils.strategies.getById.invalidate({ id: strategyId });
			utils.strategies.getAll.invalidate();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to save changes");
		},
	});

	const deleteMutation = api.strategies.delete.useMutation({
		onSuccess: () => {
			toast.success("Strategy deleted");
			utils.strategies.getAll.invalidate();
			router.push("/strategies");
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete strategy");
		},
	});

	// Initialize form data from strategy
	const initialFormData = useMemo<EditFormData | null>(() => {
		if (!strategy) return null;

		// Convert rules to expected format
		const formRules: StrategyRule[] = (strategy.rules ?? []).map(
			(rule, idx) => ({
				id: rule.id,
				text: rule.text,
				category: rule.category as StrategyRule["category"],
				order: rule.order ?? idx,
			}),
		);

		return {
			name: strategy.name,
			description: strategy.description,
			color: strategy.color ?? "#d4ff00",
			isActive: strategy.isActive ?? true,
			entryCriteria: strategy.entryCriteria,
			exitRules: strategy.exitRules,
			rules: formRules,
			riskParameters: strategy.riskParameters,
			trailingRules: strategy.trailingRules,
			scalingRules: strategy.scalingRules,
		};
	}, [strategy]);

	const [formData, setFormData] = useState<EditFormData | null>(null);

	// Sync form data when strategy loads
	useMemo(() => {
		if (initialFormData && !formData) {
			setFormData(initialFormData);
		}
	}, [initialFormData, formData]);

	// Update form data handler
	const updateFormData = useCallback((updates: Partial<EditFormData>) => {
		setFormData((prev) => (prev ? { ...prev, ...updates } : null));
	}, []);

	// Save function for auto-save hook
	const handleSave = useCallback(
		async (data: EditFormData) => {
			await updateMutation.mutateAsync({
				id: strategyId,
				name: data.name,
				description: data.description,
				color: data.color,
				entryCriteria: data.entryCriteria,
				exitRules: data.exitRules,
				riskParameters: data.riskParameters,
				scalingRules: data.scalingRules,
				trailingRules: data.trailingRules,
				isActive: data.isActive,
				rules: data.rules,
			});
		},
		[strategyId, updateMutation],
	);

	// Auto-save hook - uses empty placeholder when formData is null (hook is disabled in that case)
	const emptyFormData: EditFormData = {
		name: "",
		description: null,
		color: "#d4ff00",
		isActive: true,
		entryCriteria: null,
		exitRules: null,
		rules: [],
		riskParameters: null,
		trailingRules: null,
		scalingRules: null,
	};

	const { isSaving, lastSavedAt, error } = useAutoSave({
		data: formData ?? emptyFormData,
		onSave: handleSave,
		debounceMs: 800,
		enabled: !!formData,
	});

	// Handle delete
	const handleDelete = () => {
		deleteMutation.mutate({ id: strategyId });
	};

	// Loading state
	if (isLoading) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
				data-testid="strategy-edit-loading"
			>
				{/* Header skeleton */}
				<div className="flex items-center gap-3">
					<Skeleton className="h-10 w-10" />
					<Skeleton className="h-8 w-48" />
				</div>
				{/* Tabs skeleton */}
				<Skeleton className="h-10 w-64" />
				{/* Content skeleton */}
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
			</div>
		);
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-24"
				data-testid="strategy-edit-not-found"
			>
				<AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground" />
				<h2 className="font-semibold text-xl">Strategy not found</h2>
				<p className="mb-4 text-center text-muted-foreground text-sm">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="min-h-[44px]">
					<Link href="/strategies">Back to Strategies</Link>
				</Button>
			</div>
		);
	}

	// Wait for form data to be initialized
	if (!formData) {
		return (
			<div
				className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
				data-testid="strategy-edit-loading"
			>
				<Skeleton className="h-10 w-10" />
				<Skeleton className="h-64" />
			</div>
		);
	}

	return (
		<div
			className="mx-auto w-[95%] max-w-4xl space-y-6 py-6"
			data-testid="strategy-edit-page"
		>
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<Button
						asChild
						className="h-10 w-10"
						data-testid="strategy-edit-button-back"
						size="icon"
						variant="ghost"
					>
						<Link href={`/strategies/${strategyId}`}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div className="flex items-center gap-3">
						<div
							className="h-4 w-4 shrink-0 rounded"
							data-testid="strategy-edit-color"
							style={{ backgroundColor: formData.color }}
						/>
						<h1
							className="font-bold text-2xl tracking-tight"
							data-testid="strategy-edit-heading"
						>
							{formData.name || "Untitled Strategy"}
						</h1>
					</div>
				</div>

				<div className="flex items-center gap-4">
					{/* Save Status Indicator */}
					<SaveStatusIndicator
						error={error}
						isSaving={isSaving}
						lastSavedAt={lastSavedAt}
					/>

					{/* Delete Button */}
					<AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
						<AlertDialogTrigger asChild>
							<Button
								className="h-9 font-mono text-xs uppercase tracking-wider"
								data-testid="strategy-edit-button-delete"
								size="sm"
								variant="ghost"
							>
								<Trash2 className="mr-1.5 h-3.5 w-3.5" />
								Delete
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent className="mx-4 border-border bg-background sm:mx-0">
							<AlertDialogHeader>
								<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
									Delete Strategy
								</AlertDialogTitle>
								<AlertDialogDescription className="font-mono text-xs">
									Are you sure you want to delete &quot;{strategy.name}&quot;?
									This action cannot be undone. Any trades using this strategy
									will keep their data.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
								<AlertDialogCancel className="min-h-[44px] font-mono text-xs sm:min-h-0">
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									className="min-h-[44px] bg-loss font-mono text-xs hover:bg-loss/90 sm:min-h-0"
									data-testid="strategy-edit-button-delete-confirm"
									disabled={deleteMutation.isPending}
									onClick={handleDelete}
								>
									{deleteMutation.isPending ? "Deleting..." : "Delete Strategy"}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			{/* Tabs */}
			<Tabs
				className="space-y-6"
				data-testid="strategy-edit-tabs"
				defaultValue="overview"
			>
				<TabsList className="w-full justify-start gap-1 bg-transparent p-0 sm:w-auto">
					<TabsTrigger
						className="rounded border border-transparent bg-white/5 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-white/10 data-[state=active]:bg-white/10 sm:text-xs"
						data-testid="strategy-edit-tab-overview"
						value="overview"
					>
						Overview
					</TabsTrigger>
					<TabsTrigger
						className="rounded border border-transparent bg-white/5 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-white/10 data-[state=active]:bg-white/10 sm:text-xs"
						data-testid="strategy-edit-tab-rules"
						value="rules"
					>
						Rules
					</TabsTrigger>
					<TabsTrigger
						className="rounded border border-transparent bg-white/5 font-mono text-[10px] uppercase tracking-wider data-[state=active]:border-white/10 data-[state=active]:bg-white/10 sm:text-xs"
						data-testid="strategy-edit-tab-risk"
						value="risk"
					>
						Risk Management
					</TabsTrigger>
				</TabsList>

				{/* Overview Tab */}
				<TabsContent value="overview">
					<BasicInfoSection
						data={{
							name: formData.name,
							description: formData.description,
							color: formData.color,
							isActive: formData.isActive,
						}}
						onChange={updateFormData}
					/>
				</TabsContent>

				{/* Rules Tab */}
				<TabsContent value="rules">
					<RulesSection
						data={{
							entryCriteria: formData.entryCriteria,
							exitRules: formData.exitRules,
							rules: formData.rules,
						}}
						onChange={updateFormData}
					/>
				</TabsContent>

				{/* Risk Management Tab */}
				<TabsContent value="risk">
					<RiskSection
						data={{
							riskParameters: formData.riskParameters,
							trailingRules: formData.trailingRules,
							scalingRules: formData.scalingRules,
						}}
						onChange={updateFormData}
					/>
				</TabsContent>
			</Tabs>
		</div>
	);
}
