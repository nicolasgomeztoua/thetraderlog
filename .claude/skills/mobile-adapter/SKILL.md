# Mobile Adapter Skill

Convert desktop-first layouts to mobile-responsive designs using a systematic approach.

## Workflow

### Phase 1: Audit the Current Layout

Identify these common mobile-breaking patterns:

| Pattern | Example | Fix |
|---------|---------|-----|
| **Horizontal panels** | `ResizablePanelGroup direction="horizontal"` | Conditional render or hide on mobile |
| **Fixed grid columns** | `grid-cols-7` (calendar) | Keep if fits, or use responsive `grid-cols-2 sm:grid-cols-4` |
| **Fixed min-widths** | `min-w-[160px]` | Use responsive `min-w-[120px] sm:min-w-[160px]` |
| **Side-by-side flex** | `flex items-center` header | Add `flex-wrap gap-3` |
| **Panel min sizes** | `minSize={30}` | Won't work below ~300px viewport |
| **Long button text** | "Start My Journal" | Show shorter text on mobile |

### Phase 2: Choose Sidebar Strategy

For pages with sidebars or multi-panel layouts:

| Strategy | Best For | Implementation |
|----------|----------|----------------|
| **Collapsible Drawer** | Sidebars, navigation panels | Sheet component, hamburger toggle |
| **Vertical Stacking** | Equal-priority content | Stack with scroll, no tabs |
| **Tabs** | 3+ distinct sections | Tab component to switch views |
| **Bottom Sheet** | Secondary content | Pull-up sheet pattern |

**Recommended default**: Collapsible drawer using Sheet component.

### Phase 3: Implementation

#### 1. Import useMediaQuery Hook

```tsx
import { useMediaQuery } from "@/lib/hooks/use-media-query";
```

> Hook location: `src/lib/hooks/use-media-query.ts`

#### 2. Add Mobile Detection

```tsx
const [sidebarOpen, setSidebarOpen] = useState(false);
const isMobile = useMediaQuery("(max-width: 767px)");
```

#### 3. Add Hamburger Menu Button (mobile only)

```tsx
<Button
  className="md:hidden"
  onClick={() => setSidebarOpen(true)}
  size="icon-sm"
  variant="outline"
>
  <MenuIcon className="size-4" />
</Button>
```

#### 4. Wrap Sidebar in Sheet

```tsx
import { Sheet, SheetContent } from "@/components/ui/sheet";

<Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
  <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
    <div className="px-4 pt-12 pb-4"> {/* pt-12 clears the X button */}
      {/* Sidebar content */}
    </div>
  </SheetContent>
</Sheet>
```

#### 5. Conditional Layout Rendering

```tsx
{isMobile ? (
  /* Mobile: Single column, full width */
  <div className="flex-1 overflow-y-auto p-4">
    {/* Main content only */}
  </div>
) : (
  /* Desktop: Original layout (resizable panels, etc.) */
  <ResizablePanelGroup direction="horizontal">
    {/* ... */}
  </ResizablePanelGroup>
)}
```

#### 6. Close Drawer on User Action

When user selects something in the sidebar (e.g., calendar date), close the drawer:

```tsx
onDateSelect={(date) => {
  setSelectedDate(date);
  setSidebarOpen(false); // Close drawer after selection
}}
```

## Responsive Class Patterns

### Breakpoints Reference
- `sm`: 640px
- `md`: 768px (primary mobile breakpoint)
- `lg`: 1024px
- `xl`: 1280px

### Common Responsive Patterns

```tsx
// Text sizing
className="text-lg sm:text-2xl"

// Spacing
className="gap-1 sm:gap-2"
className="px-2 sm:px-4"
className="p-3 sm:p-6"

// Min-width
className="min-w-[120px] sm:min-w-[160px]"

// Show/hide
className="hidden sm:inline"  // Hide on mobile
className="sm:hidden"          // Show only on mobile
className="md:hidden"          // Mobile menu button

// Flex direction
className="flex flex-col sm:flex-row"

// Grid columns
className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
```

### Header Responsive Pattern

```tsx
<div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
  <div className="flex items-center gap-3">
    {/* Mobile menu button */}
    <Button className="md:hidden" size="icon-sm" variant="outline">
      <MenuIcon className="size-4" />
    </Button>

    {/* Title - stacks on mobile */}
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:gap-4">
      <h1 className="text-lg sm:text-2xl">Title</h1>
      {/* Secondary content */}
    </div>
  </div>

  {/* Navigation - wraps to new line if needed */}
  <Navigation />
</div>
```

### Button Text Truncation

```tsx
<Button>
  <span className="hidden sm:inline">Start My Journal</span>
  <span className="sm:hidden">Start</span>
</Button>
```

## Checklist

Before marking mobile adaptation complete:

- [ ] Hamburger menu visible only on mobile (`md:hidden`)
- [ ] Sheet drawer has `pt-12` to clear close button
- [ ] Header wraps gracefully (`flex-wrap gap-3`)
- [ ] Long text has mobile variants or truncates
- [ ] Touch targets minimum 44px (use `size="icon-sm"` or larger)
- [ ] Drawer closes after user action (date select, navigation, etc.)
- [ ] Fixed widths have responsive variants
- [ ] Test at 375px, 390px, 768px viewports
- [ ] Desktop layout unchanged at 768px+

## Testing Viewports

| Device | Width | Notes |
|--------|-------|-------|
| iPhone SE | 375px | Smallest common mobile |
| iPhone 14 | 390px | Standard modern phone |
| iPhone 14 Pro Max | 430px | Large phone |
| iPad Mini | 768px | Breakpoint boundary |
| iPad | 1024px | Tablet landscape |

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/hooks/use-media-query.ts` | Mobile detection hook (already exists) |
| `src/components/ui/sheet.tsx` | Drawer component (shadcn, already exists) |
| Target page component | Add conditional rendering |

## Common Gotchas

1. **Sheet close button overlap**: Always use `pt-12` inside SheetContent
2. **Hydration mismatch**: useMediaQuery returns `false` on server, content may flash
3. **ResizablePanelGroup**: Cannot adapt to mobile, must conditionally render different layout
4. **Calendar grids**: 7-column grids fit in 300px drawer, don't need to change
5. **Modals from drawer**: Move modal state to parent component so it works from both layouts
