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

// Use toDateString() utility for API data matching
import { toDateString } from "@/lib/shared";
const dateStr = toDateString(day);
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

### Optimistic Updates Pattern (tRPC)
**When:** Any mutation where you want instant UI feedback before server confirmation
**Structure:**
```tsx
const mutation = api.entity.update.useMutation({
  // 1. onMutate: Runs BEFORE the mutation - update cache optimistically
  onMutate: async (input) => {
    // Cancel outgoing refetches to prevent overwriting optimistic update
    await utils.entity.getAll.cancel();

    // Snapshot current data for rollback
    const previousData = utils.entity.getAll.getData();

    // Optimistically update the cache
    utils.entity.getAll.setData(undefined, (old) => {
      if (!old) return old;
      // Transform data based on mutation type
      return transformedData;
    });

    // Return context for potential rollback
    return { previousData };
  },

  // 2. onError: Rollback on failure
  onError: (_err, _input, context) => {
    if (context?.previousData) {
      utils.entity.getAll.setData(undefined, context.previousData);
    }
  },

  // 3. onSettled: Always sync with server (success or failure)
  onSettled: () => utils.entity.getAll.invalidate(),
});
```

**Common Transformations:**
```tsx
// Toggle boolean
return old.map((item) =>
  item.id === input.id ? { ...item, isActive: !item.isActive } : item
);

// Update field
return old.map((item) =>
  item.id === input.id ? { ...item, ...input.updates } : item
);

// Reorder list
const orderMap = new Map(input.items.map((i) => [i.id, i.order]));
return [...old].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

// Add item (at end)
return [...old, { id: 'temp-id', ...input }];

// Remove item
return old.filter((item) => item.id !== input.id);
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

### Drag-and-Drop Reorder with Optimistic Updates
**When:** Reordering lists with smooth drag-and-drop UX
**Dependencies:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
**How:**
```tsx
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";

// Sortable item component
function SortableItem({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-10 shadow-lg")}>
      <button {...attributes} {...listeners} className="cursor-grab touch-none">
        <GripVerticalIcon className="size-4" />
      </button>
      {/* rest of item content */}
    </div>
  );
}

// In parent component
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
);

// Mutation with optimistic update
const reorderMutation = api.entity.reorder.useMutation({
  onMutate: async ({ items }) => {
    await utils.entity.getAll.cancel();
    const previousData = utils.entity.getAll.getData();
    utils.entity.getAll.setData(undefined, (old) => {
      if (!old) return old;
      const orderMap = new Map(items.map((item) => [item.id, item.order]));
      return [...old].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
    });
    return { previousData };
  },
  onError: (_err, _vars, context) => {
    if (context?.previousData) utils.entity.getAll.setData(undefined, context.previousData);
  },
  onSettled: () => utils.entity.getAll.invalidate(),
});

const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || !data || active.id === over.id) return;
  const oldIndex = data.findIndex((t) => t.id === active.id);
  const newIndex = data.findIndex((t) => t.id === over.id);
  const reordered = arrayMove(data, oldIndex, newIndex);
  reorderMutation.mutate({ items: reordered.map((t, i) => ({ id: t.id, order: i })) });
};

// JSX
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={data.map((t) => t.id)} strategy={verticalListSortingStrategy}>
    {data.map((item) => <SortableItem key={item.id} item={item} />)}
  </SortableContext>
</DndContext>
```

### Key Prop Remount Pattern for Date-Based Components
**When:** Components fetch data based on a date/ID prop and you need clean state on change
**Problem:** Multiple useEffects fighting each other, race conditions, manual ref tracking
**Solution:** Use `key={identifier}` on the component to force remount on change:
```tsx
// Parent component
<JournalEditor key={dateString} selectedDate={selectedDate} />

// Child component - MUST show loading until data arrives
if (isLoading || !data) {
  return <LoadingSpinner />;
}
```
**Why this works:**
- React unmounts old component (cleanup effects run, refs reset)
- React mounts fresh component with new props
- No date validation, no manual ref tracking, no race conditions

**Critical:** Always check `|| !data` in loading state, not just `isLoading`. The query may not be loading but data hasn't arrived yet after remount.

## Gotchas

### Calendar Date → API Date String (Frontend)
**Problem:** When user clicks a date in the calendar, the Date object is in browser's local timezone. If user's _preferred_ timezone differs from browser timezone, don't convert on frontend.
**Wrong approach:** `getDateStringInTimezone(selectedDate, userPreferredTimezone)` - this double-converts
**Correct approach:** Use the `toDateString()` utility:
```tsx
import { toDateString } from "@/lib/shared";

// Frontend: preserve the calendar date exactly as clicked
const dateString = toDateString(selectedDate);

// Backend handles timezone conversion when querying trades
const { start, end } = getDayBoundsInTimezone(dateString, userTimezone);
```
**Why:** The calendar shows dates in browser local time. If user clicks "Jan 6", they want "Jan 6" - regardless of their preferred timezone for trade grouping. The backend converts "Jan 6" to the correct UTC range based on their timezone preference.
**Key utilities:**
- `toDateString(date)` - Frontend: preserves calendar date for API calls
- `getDayBoundsInTimezone(dateString, tz)` - Backend: converts to UTC bounds

### Date String Formatting - NEVER Use toISOString()
**Problem:** `date.toISOString().split("T")[0]` gives UTC date, not user's local date
**Example:** At 10pm EST on Jan 13, `toISOString()` gives "2026-01-14" (UTC) instead of "2026-01-13"
**Solution:** Use `format(date, "yyyy-MM-dd")` from date-fns to preserve local date

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

### Tiptap Extension Commands TypeScript Errors
**Problem:** TypeScript errors like "Property 'toggleBold' does not exist on type 'ChainedCommands'"
**Solution:** Create custom interface with all extension commands and cast the chain:
```tsx
interface EditorCommands {
  run: () => boolean;
  toggleBold: () => EditorCommands;
  toggleItalic: () => EditorCommands;
  setLink: (attrs: { href: string }) => EditorCommands;
  // ... other extension commands
}

const cmd = () => editor.chain().focus() as unknown as EditorCommands;
cmd()?.toggleBold().run();
```

### Tiptap SSR Hydration Issues
**Problem:** Tiptap can cause hydration mismatches when rendered on server
**Solution:** Set `immediatelyRender: false` in useEditor options:
```tsx
const editor = useEditor({
  extensions: [...],
  immediatelyRender: false,
});
```

### Debounced Auto-Save Pattern
**When:** Building editors with automatic persistence
**How:**
```tsx
const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const lastSavedContentRef = useRef<string | null>(null);

// In onUpdate callback
if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
const content = editor.getHTML();
if (content === lastSavedContentRef.current) return; // Skip if unchanged

debounceTimerRef.current = setTimeout(() => {
  lastSavedContentRef.current = content;
  saveMutation.mutate({ content });
}, 500);
```

## Decisions

<!-- Architectural decisions and rationale -->
