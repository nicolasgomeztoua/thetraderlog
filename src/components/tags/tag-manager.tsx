"use client";

import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import { PRESET_COLORS } from "@/lib/shared";
import { api } from "@/trpc/react";

export function TagManager() {
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [editingTag, setEditingTag] = useState<{
		id: string;
		name: string;
		color: string;
	} | null>(null);
	const [newTagName, setNewTagName] = useState("");
	const [newTagColor, setNewTagColor] = useState("#6366f1");

	const { data: tags, isLoading, refetch } = api.tags.getWithStats.useQuery();

	const createTag = api.tags.create.useMutation({
		onSuccess: () => {
			toast.success("Tag created");
			setIsCreateOpen(false);
			setNewTagName("");
			setNewTagColor("#6366f1");
			refetch();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to create tag");
		},
	});

	const updateTag = api.tags.update.useMutation({
		onSuccess: () => {
			toast.success("Tag updated");
			setIsEditOpen(false);
			setEditingTag(null);
			refetch();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to update tag");
		},
	});

	const deleteTag = api.tags.delete.useMutation({
		onSuccess: () => {
			toast.success("Tag deleted");
			refetch();
		},
		onError: (error) => {
			toast.error(error.message || "Failed to delete tag");
		},
	});

	const handleCreate = () => {
		if (!newTagName.trim()) return;
		createTag.mutate({
			name: newTagName.trim(),
			color: newTagColor,
		});
	};

	const handleUpdate = () => {
		if (!editingTag) return;
		updateTag.mutate({
			id: editingTag.id,
			name: editingTag.name,
			color: editingTag.color,
		});
	};

	const handleDelete = (id: string, name: string) => {
		if (confirm(`Delete tag "${name}"? This will remove it from all trades.`)) {
			deleteTag.mutate({ id });
		}
	};

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-mono text-sm uppercase tracking-wider">
						Trade Tags
					</h3>
					<p className="font-mono text-muted-foreground text-xs">
						Organize your trades with custom tags
					</p>
				</div>
				<Button
					className="font-mono text-xs uppercase tracking-wider"
					onClick={() => setIsCreateOpen(true)}
					size="sm"
				>
					<Plus className="mr-2 h-3.5 w-3.5" />
					New Tag
				</Button>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-8">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			) : !tags || tags.length === 0 ? (
				<div className="rounded border border-white/5 bg-white/1 py-8 text-center">
					<p className="font-mono text-muted-foreground text-xs">
						No tags yet. Create your first tag to organize trades.
					</p>
				</div>
			) : (
				<div className="space-y-2">
					{tags.map((tag) => (
						<div
							className="flex items-center justify-between rounded border border-white/5 bg-white/1 px-4 py-3"
							key={tag.id}
						>
							<div className="flex items-center gap-3">
								<div
									className="h-3 w-3 rounded-full"
									style={{ backgroundColor: tag.color ?? "#6366f1" }}
								/>
								<span className="font-mono text-sm">{tag.name}</span>
								<Badge className="font-mono text-[10px]" variant="secondary">
									{tag.usageCount} trades
								</Badge>
							</div>
							<div className="flex items-center gap-1">
								<Button
									className="h-8 w-8"
									onClick={() => {
										setEditingTag({
											id: tag.id,
											name: tag.name,
											color: tag.color ?? "#6366f1",
										});
										setIsEditOpen(true);
									}}
									size="icon"
									variant="ghost"
								>
									<Pencil className="h-3.5 w-3.5" />
								</Button>
								<Button
									className="h-8 w-8 text-destructive hover:text-destructive"
									onClick={() => handleDelete(tag.id, tag.name)}
									size="icon"
									variant="ghost"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Create Dialog */}
			<Dialog onOpenChange={setIsCreateOpen} open={isCreateOpen}>
				<DialogContent className="border-white/10 bg-background">
					<DialogHeader>
						<DialogTitle className="font-mono uppercase tracking-wider">
							Create Tag
						</DialogTitle>
						<DialogDescription className="font-mono text-xs">
							Add a new tag to organize your trades
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label className="font-mono text-xs uppercase tracking-wider">
								Name
							</Label>
							<Input
								className="font-mono text-sm"
								onChange={(e) => setNewTagName(e.target.value)}
								placeholder="e.g., Breakout, News Trade, A+ Setup"
								value={newTagName}
							/>
						</div>
						<div className="space-y-2">
							<Label className="font-mono text-xs uppercase tracking-wider">
								Color
							</Label>
							<div className="flex flex-wrap gap-2">
								{PRESET_COLORS.map((color) => (
									<button
										className={`h-8 w-8 rounded-full border-2 transition-transform ${
											newTagColor === color
												? "scale-110 border-white"
												: "border-transparent hover:scale-105"
										}`}
										key={color}
										onClick={() => setNewTagColor(color)}
										style={{ backgroundColor: color }}
										type="button"
									/>
								))}
							</div>
						</div>
						<div className="flex items-center gap-2">
							<div
								className="h-4 w-4 rounded-full"
								style={{ backgroundColor: newTagColor }}
							/>
							<span className="font-mono text-sm">
								{newTagName || "Preview"}
							</span>
						</div>
					</div>
					<DialogFooter>
						<Button
							className="font-mono text-xs uppercase tracking-wider"
							onClick={() => setIsCreateOpen(false)}
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							className="font-mono text-xs uppercase tracking-wider"
							disabled={!newTagName.trim() || createTag.isPending}
							onClick={handleCreate}
						>
							{createTag.isPending && (
								<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
							)}
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog onOpenChange={setIsEditOpen} open={isEditOpen}>
				<DialogContent className="border-white/10 bg-background">
					<DialogHeader>
						<DialogTitle className="font-mono uppercase tracking-wider">
							Edit Tag
						</DialogTitle>
						<DialogDescription className="font-mono text-xs">
							Update tag name or color
						</DialogDescription>
					</DialogHeader>
					{editingTag && (
						<div className="space-y-4 py-4">
							<div className="space-y-2">
								<Label className="font-mono text-xs uppercase tracking-wider">
									Name
								</Label>
								<Input
									className="font-mono text-sm"
									onChange={(e) =>
										setEditingTag({ ...editingTag, name: e.target.value })
									}
									value={editingTag.name}
								/>
							</div>
							<div className="space-y-2">
								<Label className="font-mono text-xs uppercase tracking-wider">
									Color
								</Label>
								<div className="flex flex-wrap gap-2">
									{PRESET_COLORS.map((color) => (
										<button
											className={`h-8 w-8 rounded-full border-2 transition-transform ${
												editingTag.color === color
													? "scale-110 border-white"
													: "border-transparent hover:scale-105"
											}`}
											key={color}
											onClick={() => setEditingTag({ ...editingTag, color })}
											style={{ backgroundColor: color }}
											type="button"
										/>
									))}
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div
									className="h-4 w-4 rounded-full"
									style={{ backgroundColor: editingTag.color }}
								/>
								<span className="font-mono text-sm">{editingTag.name}</span>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							className="font-mono text-xs uppercase tracking-wider"
							onClick={() => setIsEditOpen(false)}
							variant="ghost"
						>
							Cancel
						</Button>
						<Button
							className="font-mono text-xs uppercase tracking-wider"
							disabled={!editingTag?.name.trim() || updateTag.isPending}
							onClick={handleUpdate}
						>
							{updateTag.isPending && (
								<Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
							)}
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
