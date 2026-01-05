"use client";

import { Pencil, Settings2, Star, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/trpc/react";

// =============================================================================
// TYPES
// =============================================================================

interface ManagePresetsDialogProps {
	/** Whether the dialog is open */
	open: boolean;
	/** Callback when dialog should close */
	onOpenChange: (open: boolean) => void;
	/** ID of the currently active preset */
	activePresetId: string | null;
	/** Callback when preset is deleted (if it was active) */
	onPresetDeleted?: (presetId: string) => void;
}

interface EditingState {
	id: string;
	name: string;
	description: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ManagePresetsDialog({
	open,
	onOpenChange,
	activePresetId,
	onPresetDeleted,
}: ManagePresetsDialogProps) {
	const utils = api.useUtils();

	// Fetch presets
	const { data: presets, isLoading } = api.analytics.getFilterPresets.useQuery(
		undefined,
		{ enabled: open },
	);

	// Editing state
	const [editing, setEditing] = useState<EditingState | null>(null);

	// Mutations
	const updatePreset = api.analytics.updateFilterPreset.useMutation({
		onSuccess: () => {
			utils.analytics.getFilterPresets.invalidate();
			setEditing(null);
		},
	});

	const deletePreset = api.analytics.deleteFilterPreset.useMutation({
		onSuccess: (_, variables) => {
			utils.analytics.getFilterPresets.invalidate();
			utils.analytics.getDefaultPreset.invalidate();
			// Notify parent if active preset was deleted
			if (variables.id === activePresetId) {
				onPresetDeleted?.(variables.id);
			}
		},
	});

	const setDefaultPreset = api.analytics.setDefaultPreset.useMutation({
		onSuccess: () => {
			utils.analytics.getFilterPresets.invalidate();
			utils.analytics.getDefaultPreset.invalidate();
		},
	});

	// Handle edit start
	const handleEditStart = useCallback(
		(preset: { id: string; name: string; description: string | null }) => {
			setEditing({
				id: preset.id,
				name: preset.name,
				description: preset.description ?? "",
			});
		},
		[],
	);

	// Handle edit save
	const handleEditSave = useCallback(() => {
		if (!editing) return;

		updatePreset.mutate({
			id: editing.id,
			name: editing.name.trim(),
			description: editing.description.trim() || null,
		});
	}, [editing, updatePreset]);

	// Handle edit cancel
	const handleEditCancel = useCallback(() => {
		setEditing(null);
	}, []);

	// Handle delete
	const handleDelete = useCallback(
		(presetId: string) => {
			if (
				confirm(
					"Are you sure you want to delete this preset? This action cannot be undone.",
				)
			) {
				deletePreset.mutate({ id: presetId });
			}
		},
		[deletePreset],
	);

	// Handle set default
	const handleSetDefault = useCallback(
		(presetId: string, isCurrentlyDefault: boolean | null) => {
			setDefaultPreset.mutate({
				id: isCurrentlyDefault ? null : presetId,
			});
		},
		[setDefaultPreset],
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10">
							<Settings2 className="size-5 text-primary" />
						</div>
						<div>
							<DialogTitle className="font-mono text-lg">
								Manage Presets
							</DialogTitle>
							<DialogDescription className="font-mono text-xs">
								Edit, delete, or set default presets
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<div className="py-4">
					{isLoading ? (
						<div className="flex h-32 items-center justify-center">
							<span className="font-mono text-muted-foreground text-sm">
								Loading presets...
							</span>
						</div>
					) : !presets || presets.length === 0 ? (
						<div className="flex h-32 items-center justify-center">
							<span className="font-mono text-muted-foreground text-sm">
								No presets saved yet
							</span>
						</div>
					) : (
						<ScrollArea className="max-h-[400px]">
							<div className="space-y-3 pr-4">
								{presets.map((preset) => (
									<div
										className={`rounded border p-3 ${
											activePresetId === preset.id
												? "border-primary bg-primary/5"
												: "border-border bg-secondary/30"
										}`}
										key={preset.id}
									>
										{editing?.id === preset.id ? (
											// Edit mode
											<div className="space-y-3">
												<div className="space-y-1.5">
													<Label
														className="font-mono text-xs"
														htmlFor={`edit-name-${preset.id}`}
													>
														Name
													</Label>
													<Input
														className="h-8 font-mono text-sm"
														id={`edit-name-${preset.id}`}
														maxLength={100}
														onChange={(e) =>
															setEditing({
																...editing,
																name: e.target.value,
															})
														}
														value={editing.name}
													/>
												</div>
												<div className="space-y-1.5">
													<Label
														className="font-mono text-xs"
														htmlFor={`edit-desc-${preset.id}`}
													>
														Description
													</Label>
													<Textarea
														className="min-h-[60px] resize-none font-mono text-sm"
														id={`edit-desc-${preset.id}`}
														maxLength={500}
														onChange={(e) =>
															setEditing({
																...editing,
																description: e.target.value,
															})
														}
														value={editing.description}
													/>
												</div>
												<div className="flex justify-end gap-2">
													<Button
														className="h-7 px-2 font-mono text-xs"
														disabled={updatePreset.isPending}
														onClick={handleEditCancel}
														size="sm"
														variant="outline"
													>
														Cancel
													</Button>
													<Button
														className="h-7 px-2 font-mono text-xs"
														disabled={
															!editing.name.trim() || updatePreset.isPending
														}
														onClick={handleEditSave}
														size="sm"
													>
														{updatePreset.isPending ? "Saving..." : "Save"}
													</Button>
												</div>
											</div>
										) : (
											// View mode
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0 flex-1">
													<div className="flex items-center gap-2">
														<span className="truncate font-medium font-mono text-sm">
															{preset.name}
														</span>
														{preset.isDefault && (
															<Star className="size-3 shrink-0 fill-primary text-primary" />
														)}
														{activePresetId === preset.id && (
															<span className="shrink-0 rounded bg-primary/20 px-1.5 py-0.5 font-mono text-primary text-xs">
																Active
															</span>
														)}
													</div>
													{preset.description && (
														<p className="mt-1 line-clamp-2 font-mono text-muted-foreground text-xs">
															{preset.description}
														</p>
													)}
												</div>
												<div className="flex shrink-0 items-center gap-1">
													<Button
														className="h-7 w-7 p-0"
														onClick={() =>
															handleSetDefault(preset.id, preset.isDefault)
														}
														size="sm"
														title={
															preset.isDefault
																? "Remove default"
																: "Set as default"
														}
														variant="ghost"
													>
														<Star
															className={`size-3.5 ${
																preset.isDefault
																	? "fill-primary text-primary"
																	: "text-muted-foreground"
															}`}
														/>
													</Button>
													<Button
														className="h-7 w-7 p-0"
														onClick={() => handleEditStart(preset)}
														size="sm"
														title="Edit preset"
														variant="ghost"
													>
														<Pencil className="size-3.5 text-muted-foreground" />
													</Button>
													<Button
														className="h-7 w-7 p-0 hover:bg-loss/10 hover:text-loss"
														disabled={deletePreset.isPending}
														onClick={() => handleDelete(preset.id)}
														size="sm"
														title="Delete preset"
														variant="ghost"
													>
														<Trash2 className="size-3.5" />
													</Button>
												</div>
											</div>
										)}
									</div>
								))}
							</div>
						</ScrollArea>
					)}
				</div>

				<DialogFooter>
					<Button
						className="font-mono"
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						Close
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
