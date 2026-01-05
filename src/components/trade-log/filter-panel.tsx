import {
	BookMarked,
	Bookmark,
	CalendarDays,
	ChevronDown,
	Filter,
	Save,
	Star,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/shared";
import { api } from "@/trpc/react";

export interface FilterState {
	status: "all" | "open" | "closed";
	direction: "all" | "long" | "short";
	symbol: string;
	search: string;
	result: "all" | "win" | "loss" | "breakeven";
	minPnl: string;
	maxPnl: string;
	minRating: string;
	maxRating: string;
	isReviewed: "all" | "reviewed" | "unreviewed";
	setupType: string;
	dayOfWeek: number[];
	startDate: string;
	endDate: string;
	tagIds: string[];
	exitReason: string;
	strategyId: string;
}

export const DEFAULT_FILTERS: FilterState = {
	status: "all",
	direction: "all",
	symbol: "",
	search: "",
	result: "all",
	minPnl: "",
	maxPnl: "",
	minRating: "",
	maxRating: "",
	isReviewed: "all",
	setupType: "",
	dayOfWeek: [],
	startDate: "",
	endDate: "",
	tagIds: [] as string[],
	exitReason: "",
	strategyId: "",
};

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sun" },
	{ value: 1, label: "Mon" },
	{ value: 2, label: "Tue" },
	{ value: 3, label: "Wed" },
	{ value: 4, label: "Thu" },
	{ value: 5, label: "Fri" },
	{ value: 6, label: "Sat" },
];

interface FilterPanelProps {
	filters: FilterState;
	onChange: (filters: FilterState) => void;
	onClear: () => void;
}

export function FilterPanel({ filters, onChange, onClear }: FilterPanelProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [presetName, setPresetName] = useState("");
	const [showSaveDialog, setShowSaveDialog] = useState(false);

	const { data: strategies } = api.strategies.getAll.useQuery();
	const { data: presets, refetch: refetchPresets } =
		api.filterPresets.getAll.useQuery();
	const createPreset = api.filterPresets.create.useMutation({
		onSuccess: () => {
			toast.success("Filter preset saved");
			setShowSaveDialog(false);
			setPresetName("");
			refetchPresets();
		},
	});
	const deletePreset = api.filterPresets.delete.useMutation({
		onSuccess: () => {
			toast.success("Preset deleted");
			refetchPresets();
		},
	});

	const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
		if (
			key === "status" ||
			key === "direction" ||
			key === "result" ||
			key === "isReviewed"
		) {
			return value !== "all";
		}
		if (Array.isArray(value)) return value.length > 0;
		return value !== "";
	}).length;

	const toggleDay = (day: number) => {
		const newDays = filters.dayOfWeek.includes(day)
			? filters.dayOfWeek.filter((d) => d !== day)
			: [...filters.dayOfWeek, day];
		onChange({ ...filters, dayOfWeek: newDays });
	};

	const handleSavePreset = () => {
		if (!presetName.trim()) return;
		createPreset.mutate({
			name: presetName.trim(),
			filters: JSON.stringify(filters),
		});
	};

	const loadPreset = (presetFilters: string) => {
		try {
			const parsed = JSON.parse(presetFilters) as FilterState;
			onChange(parsed);
			toast.success("Preset loaded");
		} catch {
			toast.error("Failed to load preset");
		}
	};

	return (
		<div className="space-y-3">
			{/* Quick Filters Row */}
			<div className="flex flex-wrap items-center gap-3">
				{/* Status Filter */}
				<Select
					onValueChange={(v) =>
						onChange({ ...filters, status: v as FilterState["status"] })
					}
					value={filters.status}
				>
					<SelectTrigger className="w-[120px] font-mono text-xs">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem className="font-mono text-xs" value="all">
							All Status
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="open">
							Open
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="closed">
							Closed
						</SelectItem>
					</SelectContent>
				</Select>

				{/* Direction Filter */}
				<Select
					onValueChange={(v) =>
						onChange({ ...filters, direction: v as FilterState["direction"] })
					}
					value={filters.direction}
				>
					<SelectTrigger className="w-[120px] font-mono text-xs">
						<SelectValue placeholder="Direction" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem className="font-mono text-xs" value="all">
							All
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="long">
							Long
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="short">
							Short
						</SelectItem>
					</SelectContent>
				</Select>

				{/* Result Filter */}
				<Select
					onValueChange={(v) =>
						onChange({ ...filters, result: v as FilterState["result"] })
					}
					value={filters.result}
				>
					<SelectTrigger className="w-[130px] font-mono text-xs">
						<SelectValue placeholder="Result" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem className="font-mono text-xs" value="all">
							All Results
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="win">
							Winners
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="loss">
							Losers
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="breakeven">
							Breakeven
						</SelectItem>
					</SelectContent>
				</Select>

				{/* Review Status */}
				<Select
					onValueChange={(v) =>
						onChange({ ...filters, isReviewed: v as FilterState["isReviewed"] })
					}
					value={filters.isReviewed}
				>
					<SelectTrigger className="w-[140px] font-mono text-xs">
						<SelectValue placeholder="Review Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem className="font-mono text-xs" value="all">
							All Trades
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="reviewed">
							Reviewed
						</SelectItem>
						<SelectItem className="font-mono text-xs" value="unreviewed">
							Unreviewed
						</SelectItem>
					</SelectContent>
				</Select>

				{/* Strategy Filter */}
				<Select
					onValueChange={(v) =>
						onChange({ ...filters, strategyId: v === "all" ? "" : v })
					}
					value={filters.strategyId || "all"}
				>
					<SelectTrigger className="w-[160px] font-mono text-xs">
						<SelectValue placeholder="Strategy">
							{filters.strategyId ? (
								<div className="flex items-center gap-1.5">
									<BookMarked className="h-3 w-3" />
									{strategies?.find(
										(s) => s.id.toString() === filters.strategyId,
									)?.name ?? "Strategy"}
								</div>
							) : (
								"All Strategies"
							)}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem className="font-mono text-xs" value="all">
							All Strategies
						</SelectItem>
						{strategies?.map((s) => (
							<SelectItem
								className="font-mono text-xs"
								key={s.id}
								value={s.id.toString()}
							>
								<div className="flex items-center gap-2">
									<div
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: s.color ?? "#d4ff00" }}
									/>
									{s.name}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Advanced Filters Toggle */}
				<Button
					className={cn(
						"font-mono text-xs uppercase tracking-wider",
						isExpanded && "bg-white/5",
					)}
					onClick={() => setIsExpanded(!isExpanded)}
					size="sm"
					variant="outline"
				>
					<Filter className="mr-2 h-3.5 w-3.5" />
					Advanced
					{activeFilterCount > 0 && (
						<Badge
							className="ml-2 h-4 px-1 font-mono text-[10px]"
							variant="secondary"
						>
							{activeFilterCount}
						</Badge>
					)}
					<ChevronDown
						className={cn(
							"ml-2 h-3.5 w-3.5 transition-transform",
							isExpanded && "rotate-180",
						)}
					/>
				</Button>

				{/* Presets Dropdown */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="font-mono text-xs uppercase tracking-wider"
							size="sm"
							variant="outline"
						>
							<Bookmark className="mr-2 h-3.5 w-3.5" />
							Presets
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-56">
						<DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Saved Filters
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{presets && presets.length > 0 ? (
							presets.map((preset) => (
								<DropdownMenuItem
									className="flex items-center justify-between font-mono text-xs"
									key={preset.id}
								>
									<button
										className="flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
										onClick={() => loadPreset(preset.filters)}
										type="button"
									>
										{preset.name}
									</button>
									<Button
										className="h-6 w-6 text-muted-foreground hover:text-destructive"
										onClick={(e) => {
											e.stopPropagation();
											deletePreset.mutate({ id: preset.id });
										}}
										size="icon"
										variant="ghost"
									>
										<X className="h-3 w-3" />
									</Button>
								</DropdownMenuItem>
							))
						) : (
							<DropdownMenuItem
								className="font-mono text-muted-foreground text-xs"
								disabled
							>
								No saved presets
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						{showSaveDialog ? (
							<div className="space-y-2 p-2">
								<Input
									className="h-8 font-mono text-xs"
									onChange={(e) => setPresetName(e.target.value)}
									placeholder="Preset name..."
									value={presetName}
								/>
								<div className="flex gap-2">
									<Button
										className="h-7 flex-1 font-mono text-xs"
										disabled={!presetName.trim()}
										onClick={handleSavePreset}
										size="sm"
									>
										<Save className="mr-1 h-3 w-3" />
										Save
									</Button>
									<Button
										className="h-7 font-mono text-xs"
										onClick={() => {
											setShowSaveDialog(false);
											setPresetName("");
										}}
										size="sm"
										variant="ghost"
									>
										Cancel
									</Button>
								</div>
							</div>
						) : (
							<DropdownMenuItem
								className="font-mono text-xs"
								onSelect={(e) => {
									e.preventDefault();
									setShowSaveDialog(true);
								}}
							>
								<Save className="mr-2 h-3.5 w-3.5" />
								Save Current Filters
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>

				{/* Clear Filters */}
				{activeFilterCount > 0 && (
					<Button
						className="font-mono text-xs uppercase tracking-wider"
						onClick={onClear}
						size="sm"
						variant="ghost"
					>
						<X className="mr-1 h-3.5 w-3.5" />
						Clear ({activeFilterCount})
					</Button>
				)}
			</div>

			{/* Advanced Filters Panel */}
			{isExpanded && (
				<div className="space-y-4 rounded border border-white/5 bg-white/1 p-4">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{/* Date Range */}
						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								<CalendarDays className="mr-1 inline-block h-3 w-3" />
								Date Range
							</Label>
							<div className="flex gap-2">
								<Input
									className="h-8 font-mono text-xs"
									onChange={(e) =>
										onChange({ ...filters, startDate: e.target.value })
									}
									placeholder="From"
									type="date"
									value={filters.startDate}
								/>
								<Input
									className="h-8 font-mono text-xs"
									onChange={(e) =>
										onChange({ ...filters, endDate: e.target.value })
									}
									placeholder="To"
									type="date"
									value={filters.endDate}
								/>
							</div>
						</div>

						{/* P&L Range */}
						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								P&L Range
							</Label>
							<div className="flex gap-2">
								<Input
									className="h-8 font-mono text-xs"
									onChange={(e) =>
										onChange({ ...filters, minPnl: e.target.value })
									}
									placeholder="Min"
									type="number"
									value={filters.minPnl}
								/>
								<Input
									className="h-8 font-mono text-xs"
									onChange={(e) =>
										onChange({ ...filters, maxPnl: e.target.value })
									}
									placeholder="Max"
									type="number"
									value={filters.maxPnl}
								/>
							</div>
						</div>

						{/* Rating Range */}
						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								<Star className="mr-1 inline-block h-3 w-3" />
								Rating
							</Label>
							<div className="flex gap-2">
								<Select
									onValueChange={(v) => onChange({ ...filters, minRating: v })}
									value={filters.minRating}
								>
									<SelectTrigger className="h-8 font-mono text-xs">
										<SelectValue placeholder="Min" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Any</SelectItem>
										{[1, 2, 3, 4, 5].map((r) => (
											<SelectItem key={r} value={r.toString()}>
												{r}+ stars
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Select
									onValueChange={(v) => onChange({ ...filters, maxRating: v })}
									value={filters.maxRating}
								>
									<SelectTrigger className="h-8 font-mono text-xs">
										<SelectValue placeholder="Max" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="">Any</SelectItem>
										{[1, 2, 3, 4, 5].map((r) => (
											<SelectItem key={r} value={r.toString()}>
												{r} stars
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Setup Type */}
						<div className="space-y-2">
							<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
								Setup Type
							</Label>
							<Input
								className="h-8 font-mono text-xs"
								onChange={(e) =>
									onChange({ ...filters, setupType: e.target.value })
								}
								placeholder="e.g., breakout, reversal"
								value={filters.setupType}
							/>
						</div>
					</div>

					{/* Day of Week */}
					<div className="space-y-2">
						<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Day of Week
						</Label>
						<div className="flex flex-wrap gap-2">
							{DAYS_OF_WEEK.map((day) => (
								<Button
									className={cn(
										"h-8 w-12 font-mono text-xs",
										filters.dayOfWeek.includes(day.value) &&
											"bg-primary text-primary-foreground",
									)}
									key={day.value}
									onClick={() => toggleDay(day.value)}
									size="sm"
									variant={
										filters.dayOfWeek.includes(day.value)
											? "default"
											: "outline"
									}
								>
									{day.label}
								</Button>
							))}
						</div>
					</div>

					{/* Exit Reason */}
					<div className="space-y-2">
						<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
							Exit Reason
						</Label>
						<Select
							onValueChange={(v) => onChange({ ...filters, exitReason: v })}
							value={filters.exitReason}
						>
							<SelectTrigger className="h-8 w-[200px] font-mono text-xs">
								<SelectValue placeholder="Any" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="">Any</SelectItem>
								<SelectItem value="take_profit">Take Profit</SelectItem>
								<SelectItem value="stop_loss">Stop Loss</SelectItem>
								<SelectItem value="trailing_stop">Trailing Stop</SelectItem>
								<SelectItem value="breakeven">Breakeven</SelectItem>
								<SelectItem value="manual">Manual</SelectItem>
								<SelectItem value="time_based">Time Based</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			)}
		</div>
	);
}
