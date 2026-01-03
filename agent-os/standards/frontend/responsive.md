## Responsive Design (Desktop-First for Trading)

EdgeJournal is optimized for desktop trading setups with secondary mobile support. The design prioritizes data density and multi-monitor workflows.

### Desktop-First Philosophy

**Primary Use Case**: Traders using 1-3 monitors at desk
**Design Priority**: Data density, chart visibility, quick access to all features
**Mobile Support**: Simplified views for monitoring positions on the go

### Breakpoints (Tailwind)

```css
sm:  640px   /* Large phone, small tablet */
md:  768px   /* Tablet */
lg:  1024px  /* Small desktop, laptop */
xl:  1280px  /* Desktop */
2xl: 1536px  /* Large desktop, multi-monitor */
```

**Usage Pattern** (desktop-first):
```tsx
// Start with desktop, adapt down
<div className="grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1">
  {/* 4 columns on desktop, scales down to 1 on mobile */}
</div>
```

### Layout Patterns

**Dashboard Grid** (responsive metric cards):
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <MetricCard title="Win Rate" value="67.5%" />
  <MetricCard title="Total P&L" value="+$1,245" />
  <MetricCard title="Trade Count" value="48" />
  <MetricCard title="Avg Win" value="$87.50" />
</div>
```

**Sidebar + Main Content**:
```tsx
<SidebarProvider>
  <AppSidebar />  {/* Collapsible on mobile */}
  <SidebarInset>
    <main>{/* Content adapts to available space */}</main>
  </SidebarInset>
</SidebarProvider>
```

**Table Responsiveness**:
```tsx
// Desktop: Full table
// Mobile: Simplified card layout or horizontal scroll
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Full data on desktop, scrollable on mobile */}
  </table>
</div>
```

### Typography Scaling

Monospace fonts maintain readability across all sizes:

```tsx
// Labels scale down on small screens
<Label className="text-[10px] md:text-xs font-mono">

// Data values maintain prominence
<span className="text-xl md:text-2xl font-mono font-bold">
```

### Mobile Adaptations

**Navigation**: Hamburger menu collapses sidebar
**Filters**: Collapsible filter panel instead of always visible
**Charts**: Single chart view instead of multi-chart layout
**Tables**: Horizontal scroll or card layout for trade lists

**Mobile-Specific Utilities**:
```tsx
// Hide on mobile, show on desktop
<div className="hidden lg:block">

// Show on mobile only
<div className="block lg:hidden">

// Adjust padding/spacing
<div className="p-2 md:p-4 lg:p-6">
```

### Touch Targets

Maintain minimum 44x44px for mobile:

```tsx
// Buttons have appropriate touch size
<Button className="h-10 px-4">  {/* Meets 44px minimum */}

// Icon buttons
<Button size="icon" className="h-10 w-10">  {/* 40x40, close enough for icon */}
```

### Content Priority

**Desktop**: Show all data, filters, and controls
**Mobile**: Prioritize critical data (P&L, open positions), hide advanced filters

```tsx
{/* Advanced filters - desktop only */}
<div className="hidden lg:block">
  <AdvancedFilters />
</div>

{/* Quick filters - always visible */}
<div className="flex gap-2">
  <Select>{/* Status */}</Select>
  <Select>{/* Account */}</Select>
</div>
```

### Testing Approach

**Primary Testing**: Desktop Chrome (1920x1080, 2560x1440)
**Secondary Testing**: Mobile Chrome (375x667, 414x896)
**Tablet**: iPad dimensions (1024x768)

**Tools**:
- Chrome DevTools responsive mode
- Actual device testing for mobile
- Multi-monitor testing for 2xl breakpoint

### Best Practices

- **Desktop First**: Design for data density, then simplify for mobile
- **Grid System**: Use Tailwind's grid for responsive layouts
- **Sidebar Collapsible**: Provide more space on smaller screens
- **Horizontal Scroll OK**: For tables with many columns on mobile
- **Monospace Scales Well**: Terminal font remains readable at all sizes
- **Touch Targets**: Buttons meet 44px minimum height
- **Hide Non-Essential**: Advanced features can be desktop-only
- **Content Over Chrome**: Maximize data visibility on small screens
