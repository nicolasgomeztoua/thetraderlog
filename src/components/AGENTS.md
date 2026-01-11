# Components - Agent Knowledge

*Updated by Ralph with learnings from each iteration.*

**Reference:** `.claude/skills/frontend-engineer/SKILL.md`

## Patterns

### Resizable Panel Layout
**When:** Building pages with resizable split views (journal, trade detail, etc.)
**How:**
```tsx
const [panelSizes, setPanelSizes] = useState([30, 70]);
useEffect(() => { setPanelSizes(getStoredSizes()); }, []);
const handleLayoutChange = (sizes) => { setPanelSizes(sizes); saveSizes(sizes); };

<ResizablePanelGroup direction="horizontal" onLayout={handleLayoutChange}>
  <ResizablePanel defaultSize={panelSizes[0]} minSize={15} maxSize={50}>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={panelSizes[1]} minSize={30}>
</ResizablePanelGroup>
```

### Full Height Page Layout
**When:** Creating pages that fill the viewport minus navigation
**How:** Use `h-[calc(100vh-4rem)]` on the container, `flex-1 min-h-0` on scroll areas

### Date Navigation with Picker
**When:** Building date-based views with prev/next and date selection
**How:**
```tsx
import { addDays, format, isToday } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// State for popover
const [isCalendarOpen, setIsCalendarOpen] = useState(false);

// Navigation
onDateChange(addDays(date, -1)); // prev
onDateChange(addDays(date, 1));  // next
onDateChange(new Date());        // today

// Picker closes on selection
const handleCalendarSelect = (selectedDate: Date | undefined) => {
  if (selectedDate) {
    onDateChange(selectedDate);
    setIsCalendarOpen(false);
  }
};
```

### Month Grid Calendar with P&L
**When:** Building calendar views with day-by-day data (P&L, indicators, etc.)
**How:**
```tsx
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { getDateStringInTimezone } from "@/lib/shared";
import { useSettingsStore } from "@/stores/settings-store";

// Generate days with padding for week alignment
const calendarDays = useMemo(() => {
  const days = eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) });
  const padding: null[] = Array(getDay(startOfMonth(date))).fill(null);
  return [...padding, ...days];
}, [date]);

// Split into weeks with stable keys
const weeks = useMemo(() => {
  const result: { key: string; days: (Date | null)[] }[] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    const week = calendarDays.slice(i, i + 7);
    const firstDay = week.find((d) => d !== null);
    const key = firstDay ? format(firstDay, "yyyy-MM-dd") : `week-${result.length}`;
    result.push({ key, days: week });
  }
  return result;
}, [calendarDays]);

// Use timezone-aware date strings for API data matching
const timezone = useSettingsStore((state) => state.timezone);
const dateStr = getDateStringInTimezone(day, timezone);
```

### P&L Color Intensity
**When:** Coloring elements by P&L magnitude (calendars, heatmaps)
**How:**
```tsx
function getPnLColorClass(pnl: number, maxAbsPnl: number): string {
  if (pnl === 0 || maxAbsPnl === 0) return "";
  const intensity = Math.min(Math.abs(pnl) / maxAbsPnl, 1);
  if (pnl > 0) {
    if (intensity < 0.25) return "bg-profit/20";
    if (intensity < 0.5) return "bg-profit/40";
    if (intensity < 0.75) return "bg-profit/60";
    return "bg-profit/80";
  }
  // Loss: same pattern with bg-loss/
}
```

### Optimistic Updates for Toggles
**When:** Building toggle-based interactions (checkboxes, likes, favorites)
**How:**
```tsx
const mutation = api.entity.toggle.useMutation({
  onMutate: async (newData) => {
    await utils.entity.get.cancel();
    const previousData = utils.entity.get.getData();
    utils.entity.get.setData(queryKey, (old) => {
      if (!old) return old;
      // Toggle existing record or add new one
      // IMPORTANT: Ensure all required fields are non-undefined
      const relatedData = templates?.find((t) => t.id === newData.id);
      if (!relatedData) return old; // Skip update if related data not found
      return { ...old, updated: true };
    });
    return { previousData };
  },
  onError: (_err, _data, context) => {
    if (context?.previousData) {
      utils.entity.get.setData(queryKey, context.previousData);
    }
  },
  onSettled: () => utils.entity.get.invalidate(),
});
```

### Settings Modal with CRUD
**When:** Building modals for managing lists (templates, tags, etc.)
**How:**
```tsx
// Track multiple states: editing, deleting, new item input
const [newItemText, setNewItemText] = useState("");
const [editingId, setEditingId] = useState<string | null>(null);
const [editingText, setEditingText] = useState("");
const [deletingId, setDeletingId] = useState<string | null>(null);

// Inline editing: show input when editingId matches, handle Enter/Escape
const handleEditKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") handleSaveEdit();
  else if (e.key === "Escape") setEditingId(null);
};

// Inline delete confirmation: show confirm/cancel buttons when deletingId matches
{deletingId === item.id ? (
  <div className="flex items-center justify-between">
    <span className="text-destructive">Delete this item?</span>
    <div className="flex gap-1">
      <Button onClick={() => handleDelete(item.id)} variant="destructive">Delete</Button>
      <Button onClick={() => setDeletingId(null)} variant="ghost">Cancel</Button>
    </div>
  </div>
) : (
  <span onClick={() => handleStartEdit(item.id, item.text)}>{item.text}</span>
)}

// Reveal buttons on hover with group pattern
<div className="group flex items-center">
  <button className="opacity-0 group-hover:opacity-100 transition-all">Delete</button>
</div>
```

### Up/Down Reorder Buttons
**When:** Reordering lists without drag-and-drop complexity
**How:**
```tsx
const handleMoveUp = (index: number) => {
  if (index === 0) return;
  const items = data.map((item, i) => ({
    id: item.id,
    order: i === index ? index - 1 : i === index - 1 ? index : i,
  }));
  reorderMutation.mutate({ items });
};

const handleMoveDown = (index: number) => {
  if (index === data.length - 1) return;
  const items = data.map((item, i) => ({
    id: item.id,
    order: i === index ? index + 1 : i === index + 1 ? index : i,
  }));
  reorderMutation.mutate({ items });
};
```

## Gotchas

### Unused Variables in Placeholder Components
**Problem:** State setters marked as unused when component structure is set up before child components exist
**Solution:** Use `void setter;` comment to mark as used, or extract to separate hook

### Label Accessibility (noLabelWithoutControl)
**Problem:** Biome linter rejects labels wrapping Radix checkboxes without htmlFor
**Solution:** Use id on Checkbox + htmlFor on label, instead of wrapping label:
```tsx
<div className="flex items-center gap-2">
  <Checkbox id={checkboxId} />
  <label htmlFor={checkboxId}>Label text</label>
</div>
```

## Decisions

<!-- Architectural decisions and rationale -->
