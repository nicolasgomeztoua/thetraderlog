"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Copy,
	Loader2,
	MoreHorizontal,
	PencilIcon,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { StrategyFormData as FormData } from "@/components/strategy";
import {
	ConflictDialog,
	CoverImageUpload,
	SaveStatusIndicator,
	StrategyForm,
	StrategyHero,
	StrategyStatsSummary,
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { StrategyFormData } from "@/hooks/use-strategy-autosave";
import { useStrategyAutosave } from "@/hooks/use-strategy-autosave";
import { useUnsavedChangesWarning } from "@/hooks/use-unsaved-changes-warning";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

export default function StrategyDetailPage() {
	const params = useParams();
	const router = useRouter();
	const strategyId = params.id as string;

	// UI state
	const [isEditing, setIsEditing] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
	const [coverImageModalOpen, setCoverImageModalOpen] = useState(false);

	const utils = api.useUtils();

	// Fetch strategy data
	const { data: strategy, isLoading } = api.strategies.getById.useQuery(
		{ id: strategyId },
		{ enabled: !!strategyId },
	);

	// Fetch strategy stats
	const { data: stats, isLoading: isStatsLoading } =
		api.strategies.getStats.useQuery(
			{ id: strategyId },
			{ enabled: !!strategyId && !!strategy },
		);

	// Transform strategy to form data for auto-save
	const getInitialFormData = ():
		| (StrategyFormData & {
				updatedAt?: string | Date | null;
		  })
		| null => {
		if (!strategy) return null;

		return {
			name: strategy.name,
			description: strategy.description ?? null,
			color: strategy.color ?? "#d4ff00",
			entryCriteria: strategy.entryCriteria ?? null,
			exitRules: strategy.exitRules ?? null,
			riskParameters: strategy.riskParameters,
			scalingRules: strategy.scalingRules,
			trailingRules: strategy.trailingRules,
			rules: strategy.rules.map((rule) => ({
				id: rule.id,
				text: rule.text,
				category: rule.category,
				order: rule.order,
			})),
			updatedAt: strategy.updatedAt,
		};
	};

	// Auto-save hook - only active when editing
	const autosave = useStrategyAutosave({
		strategyId,
		initialData: getInitialFormData() ?? {
			name: "",
			description: null,
			color: "#d4ff00",
			entryCriteria: null,
			exitRules: null,
			riskParameters: null,
			scalingRules: null,
			trailingRules: null,
			rules: [],
		},
		onConflict: () => {
			setConflictDialogOpen(true);
		},
		debounceDelay: 1500,
	});

	// Navigation blocking when dirty (only in edit mode)
	useUnsavedChangesWarning({
		isDirty: isEditing && autosave.isDirty,
	});

	// Delete mutation
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

	// Duplicate mutation
	const duplicateMutation = api.strategies.duplicate.useMutation({
		onSuccess: (newStrategy) => {
			toast.success("Strategy duplicated");
			utils.strategies.getAll.invalidate();
			router.push(`/strategies/${newStrategy.id}`);
		},
		onError: (error) => {
			toast.error(error.message || "Failed to duplicate strategy");
		},
	});

	// Handle form submit (for manual save, not typically used with autosave)
	const handleFormSubmit = (data: FormData) => {
		// Update all fields via autosave
		autosave.updateFields({
			name: data.name,
			description: data.description || null,
			color: data.color,
			entryCriteria: data.entryCriteria || null,
			exitRules: data.exitRules || null,
			riskParameters: data.riskParameters,
			scalingRules: data.scalingRules,
			trailingRules: data.trailingRules,
			rules: data.rules,
		});
		// Force save immediately
		autosave.forceSave();
	};

	// Handle edit toggle
	const handleEditToggle = () => {
		if (isEditing && autosave.isDirty) {
			// Force save before exiting edit mode
			autosave.forceSave();
		}
		setIsEditing(!isEditing);
	};

	// Handle cover image change
	const handleCoverImageChange = (_url: string | null) => {
		// Refresh strategy data to get updated cover image
		utils.strategies.getById.invalidate({ id: strategyId });
		setCoverImageModalOpen(false);
	};

	// Loading state
	if (isLoading) {
		return (
			<div className="space-y-4" data-testid="strategy-detail-loading">
				{/* Hero skeleton */}
				<Skeleton className="h-32 w-full rounded-lg sm:h-40 md:h-48 lg:h-52" />

				{/* Action bar skeleton */}
				<div className="flex items-center justify-between px-4 sm:px-6">
					<Skeleton className="h-8 w-24" />
					<div className="flex gap-2">
						<Skeleton className="h-8 w-20" />
						<Skeleton className="h-8 w-8" />
					</div>
				</div>

				{/* Stats skeleton */}
				<div className="px-4 sm:px-6">
					<Skeleton className="h-24 w-full" />
				</div>

				{/* Form skeleton */}
				<div className="px-4 sm:px-6">
					<Skeleton className="h-96 w-full" />
				</div>
			</div>
		);
	}

	// Not found
	if (!strategy) {
		return (
			<div
				className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
				data-testid="strategy-detail-not-found"
			>
				<AlertTriangle className="mb-4 h-10 w-10 text-muted-foreground sm:h-12 sm:w-12" />
				<h2 className="font-semibold text-lg sm:text-xl">Strategy not found</h2>
				<p className="mb-4 text-center text-muted-foreground text-sm sm:text-base">
					This strategy doesn&apos;t exist or you don&apos;t have access.
				</p>
				<Button asChild className="min-h-[44px]">
					<Link href="/strategies">Back to Strategies</Link>
				</Button>
			</div>
		);
	}

	// Transform rules for the form
	const formRules = strategy.rules.map((rule) => ({
		id: rule.id,
		text: rule.text,
		category: rule.category,
		order: rule.order,
	}));

	// Current form data (use autosave data when editing, original data when not)
	const currentFormData = isEditing
		? autosave.formData
		: {
				name: strategy.name,
				description: strategy.description ?? "",
				color: strategy.color ?? "#d4ff00",
				entryCriteria: strategy.entryCriteria ?? "",
				exitRules: strategy.exitRules ?? "",
				riskParameters: strategy.riskParameters,
				scalingRules: strategy.scalingRules,
				trailingRules: strategy.trailingRules,
				rules: formRules,
			};

	return (
		<div className="space-y-4 pb-8" data-testid="strategy-detail-page">
			{/* Hero Banner */}
			<StrategyHero
				isEditing={isEditing}
				onEditCoverImage={() => setCoverImageModalOpen(true)}
				strategy={{
					name: strategy.name,
					color: strategy.color,
					coverImageUrl: strategy.coverImageUrl,
					categoryTags: strategy.categoryTags,
				}}
			/>

			{/* Action Bar */}
			<div
				className="flex items-center justify-between px-4 sm:px-6"
				data-testid="strategy-action-bar"
			>
				{/* Left side: Back button and color indicator */}
				<div className="flex items-center gap-2 sm:gap-3">
					<Button
						asChild
						className="h-8 w-8 shrink-0"
						data-testid="strategy-back-button"
						size="icon"
						variant="ghost"
					>
						<Link href="/strategies">
							<ArrowLeft className="h-4 w-4" />
							<span className="sr-only">Back to Strategies</span>
						</Link>
					</Button>

					{/* Strategy color indicator */}
					<div className="flex items-center gap-2">
						<div
							className="h-3 w-3 shrink-0 rounded"
							style={{ backgroundColor: strategy.color ?? "#d4ff00" }}
						/>
						<span className="font-mono text-muted-foreground text-xs">
							{strategy.name}
						</span>
					</div>

					{/* Save status indicator (only when editing) */}
					{isEditing && (
						<SaveStatusIndicator
							onRetry={autosave.forceSave}
							onViewConflict={() => setConflictDialogOpen(true)}
							status={autosave.saveStatus}
						/>
					)}
				</div>

				{/* Right side: Actions */}
				<div className="flex items-center gap-2">
					{/* Edit toggle button */}
					<Button
						className={cn(
							"h-8 font-mono text-xs",
							isEditing && "bg-primary text-primary-foreground",
						)}
						data-testid="strategy-edit-toggle"
						onClick={handleEditToggle}
						size="sm"
						variant={isEditing ? "default" : "outline"}
					>
						<PencilIcon className="mr-1.5 h-3 w-3" />
						{isEditing ? "Editing" : "Edit"}
					</Button>

					{/* TODO: Publish button will be added in US-046 */}

					{/* More menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								className="h-8 w-8"
								data-testid="strategy-more-menu"
								size="icon"
								variant="ghost"
							>
								<MoreHorizontal className="h-4 w-4" />
								<span className="sr-only">More actions</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-48">
							<DropdownMenuItem
								className="cursor-pointer font-mono text-xs"
								data-testid="strategy-duplicate-button"
								disabled={duplicateMutation.isPending}
								onClick={() => duplicateMutation.mutate({ id: strategyId })}
							>
								<Copy className="mr-2 h-3.5 w-3.5" />
								{duplicateMutation.isPending ? "Duplicating..." : "Duplicate"}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="cursor-pointer font-mono text-loss text-xs focus:text-loss"
								data-testid="strategy-delete-button"
								onClick={() => setDeleteOpen(true)}
							>
								<Trash2 className="mr-2 h-3.5 w-3.5" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Stats Summary */}
			<div className="px-4 sm:px-6">
				<StrategyStatsSummary
					isLoading={isStatsLoading}
					stats={stats ?? null}
					strategyId={strategyId}
				/>
			</div>

			{/* Main Content - Form (full width, no bordered container) */}
			<div className="px-4 sm:px-6">
				{isEditing ? (
					<StrategyForm
						coverImageUrl={strategy.coverImageUrl}
						initialData={{
							name: currentFormData.name ?? "",
							description:
								typeof currentFormData.description === "string"
									? currentFormData.description
									: "",
							color: currentFormData.color ?? "#d4ff00",
							entryCriteria:
								typeof currentFormData.entryCriteria === "string"
									? currentFormData.entryCriteria
									: "",
							exitRules:
								typeof currentFormData.exitRules === "string"
									? currentFormData.exitRules
									: "",
							riskParameters: currentFormData.riskParameters,
							scalingRules: currentFormData.scalingRules,
							trailingRules: currentFormData.trailingRules,
							isActive: true,
							rules: currentFormData.rules ?? [],
						}}
						isPublic={strategy.isPublic ?? undefined}
						isSubmitting={autosave.saveStatus === "saving"}
						onCoverImageChange={handleCoverImageChange}
						onSubmit={handleFormSubmit}
						publishedAt={strategy.publishedAt}
						sourceStrategyId={strategy.sourceStrategyId}
						sourceStrategyName={strategy.sourceStrategy?.name ?? null}
						strategyId={strategyId}
						submitLabel="Save Changes"
					/>
				) : (
					// Read-only view when not editing
					<div className="space-y-6" data-testid="strategy-readonly-view">
						{/* Basic Info */}
						<section className="space-y-3">
							<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
								Strategy Info
							</h2>
							<div className="rounded border border-border bg-card p-4">
								<h3 className="font-bold font-mono text-lg">{strategy.name}</h3>
								{strategy.description && (
									<p className="mt-2 font-mono text-muted-foreground text-sm">
										{strategy.description}
									</p>
								)}
							</div>
						</section>

						{/* Entry Criteria */}
						{strategy.entryCriteria && (
							<section className="space-y-3">
								<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
									Entry Criteria
								</h2>
								<div className="rounded border border-border bg-card p-4">
									<p className="whitespace-pre-wrap font-mono text-sm">
										{strategy.entryCriteria}
									</p>
								</div>
							</section>
						)}

						{/* Exit Rules */}
						{strategy.exitRules && (
							<section className="space-y-3">
								<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
									Exit Rules
								</h2>
								<div className="rounded border border-border bg-card p-4">
									<p className="whitespace-pre-wrap font-mono text-sm">
										{strategy.exitRules}
									</p>
								</div>
							</section>
						)}

						{/* Rules Checklist */}
						{strategy.rules.length > 0 && (
							<section className="space-y-3">
								<h2 className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
									Rules Checklist ({strategy.rules.length} rules)
								</h2>
								<div className="space-y-2">
									{strategy.rules.map((rule) => (
										<div
											className="flex items-start gap-3 rounded border border-border bg-card p-3"
											key={rule.id}
										>
											<span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground uppercase">
												{rule.category}
											</span>
											<span className="font-mono text-sm">{rule.text}</span>
										</div>
									))}
								</div>
							</section>
						)}

						{/* Empty state for read-only view */}
						{!strategy.entryCriteria &&
							!strategy.exitRules &&
							strategy.rules.length === 0 && (
								<div className="flex flex-col items-center justify-center rounded border border-border border-dashed bg-card/50 py-12">
									<p className="font-mono text-muted-foreground text-sm">
										No strategy details yet
									</p>
									<Button
										className="mt-4 font-mono text-xs"
										onClick={() => setIsEditing(true)}
										variant="outline"
									>
										<PencilIcon className="mr-1.5 h-3 w-3" />
										Add Details
									</Button>
								</div>
							)}
					</div>
				)}
			</div>

			{/* Delete Confirmation Dialog */}
			<AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
				<AlertDialogContent
					className="mx-4 border-border bg-background sm:mx-0"
					data-testid="strategy-delete-dialog"
				>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider sm:text-base">
							Delete Strategy
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							Are you sure you want to delete &quot;{strategy.name}&quot;? This
							action cannot be undone. The strategy will be removed from all
							associated trades.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
						<AlertDialogCancel className="min-h-[44px] font-mono text-xs sm:min-h-0">
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							className="min-h-[44px] bg-loss font-mono text-xs hover:bg-loss/90 sm:min-h-0"
							data-testid="strategy-delete-confirm"
							disabled={deleteMutation.isPending}
							onClick={(e) => {
								e.preventDefault();
								deleteMutation.mutate({ id: strategyId });
							}}
						>
							{deleteMutation.isPending && (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Cover Image Upload Modal */}
			<AlertDialog
				onOpenChange={setCoverImageModalOpen}
				open={coverImageModalOpen}
			>
				<AlertDialogContent
					className="max-w-lg border-border bg-background"
					data-testid="cover-image-modal"
				>
					<AlertDialogHeader>
						<AlertDialogTitle className="font-mono text-sm uppercase tracking-wider">
							Edit Cover Image
						</AlertDialogTitle>
						<AlertDialogDescription className="font-mono text-xs">
							Upload a 16:9 image for your strategy cover. Max 5MB.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="py-4">
						<CoverImageUpload
							currentImageUrl={strategy.coverImageUrl}
							onImageChange={handleCoverImageChange}
							strategyId={strategyId}
						/>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel className="font-mono text-xs">
							Done
						</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Conflict Resolution Dialog */}
			<ConflictDialog
				conflictData={autosave.conflictData}
				localData={autosave.formData}
				onAcceptServer={autosave.resolveConflictAcceptServer}
				onKeepLocal={autosave.resolveConflictKeepLocal}
				onOpenChange={setConflictDialogOpen}
				open={conflictDialogOpen}
			/>
		</div>
	);
}
