## Accessibility

EdgeJournal leverages shadcn/ui (built on Radix UI) for accessible components by default.

### Built-in Accessibility

**From Radix UI**:
- Semantic HTML elements
- Keyboard navigation
- ARIA attributes
- Focus management in dialogs, dropdowns, tooltips
- Screen reader announcements

**From Terminal Design**:
- High contrast colors (Electric Chartreuse on dark background)
- Clear focus indicators (`focus-visible:ring-2 focus-visible:ring-primary/50`)
- Sufficient color contrast ratios
- Monospace fonts for clarity

### Focus Indicators

All interactive elements have visible focus states:

```tsx
<Button className="focus-visible:ring-2 focus-visible:ring-primary/50">

<Input className="focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20">

<SelectTrigger className="focus-visible:ring-2 focus-visible:ring-primary">
```

### Keyboard Navigation

**Built-in Support**:
- Tab/Shift+Tab: Navigate between elements
- Enter/Space: Activate buttons, toggle selects
- Escape: Close dialogs, dropdowns
- Arrow keys: Navigate menus, selects

**Custom Shortcuts** (optional):
```tsx
// Example: Cmd+K for command palette
useEffect(() => {
  const down = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setOpen((open) => !open);
    }
  };
  document.addEventListener("keydown", down);
  return () => document.removeEventListener("keydown", down);
}, []);
```

### Color Contrast

**Terminal Theme Contrast Ratios**:
- Primary (`#d4ff00`) on dark background: >7:1 (AAA)
- Foreground (`#e0e0e0`) on background (`#121212`): >12:1 (AAA)
- Profit green (`#00ff88`) on dark: >7:1 (AAA)
- Loss red (`#ff3b3b`) on dark: >4.5:1 (AA)

**Not Relying on Color Alone**:
- P&L uses +/- symbols in addition to green/red
- Trade direction shows "Long" / "Short" text, not just color
- Status indicators have text labels

### Form Labels

All form inputs have associated labels:

```tsx
<div className="space-y-2">
  <Label htmlFor="symbol" className="font-mono text-[10px] uppercase">
    Symbol
  </Label>
  <Input id="symbol" />
</div>
```

### ARIA Attributes

Radix UI handles most ARIA automatically. Custom usage when needed:

```tsx
// Loading state
<Button disabled aria-busy="true">
  <Loader2 className="animate-spin" />
  Processing...
</Button>

// Icon-only button
<Button size="icon" aria-label="Close dialog">
  <X />
</Button>

// Status indicator
<div role="status" aria-live="polite">
  {tradeCount} trades loaded
</div>
```

### Semantic HTML

Use appropriate elements:

```tsx
// Navigation
<nav>
  <SidebarMenu>...</SidebarMenu>
</nav>

// Main content
<main>
  <h1>Dashboard</h1>
  {/* Content */}
</main>

// Buttons (not divs)
<Button onClick={handleClick}>
  Add Trade
</Button>

// Forms
<form onSubmit={handleSubmit}>
  <fieldset>
    <legend>Trade Details</legend>
    {/* Fields */}
  </fieldset>
</form>
```

### Heading Structure

Maintain logical hierarchy:

```tsx
<h1>Dashboard</h1>          {/* Page title */}
<h2>Performance Overview</h2>  {/* Section */}
<h3>Recent Trades</h3>       {/* Subsection */}
```

### Focus Management

Radix UI handles focus for modals and dialogs:

```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    {/* Focus automatically moves to dialog */}
    {/* Escape key closes and returns focus */}
  </DialogContent>
</Dialog>
```

### Best Practices

- **Trust Radix UI**: Most accessibility handled by components
- **Focus Indicators**: Always visible with Terminal theme primary color
- **Keyboard First**: Test all features with keyboard only
- **Color + Text**: Never rely on color alone
- **Semantic HTML**: Use correct elements (button, not div with onClick)
- **Form Labels**: Always associate labels with inputs
- **ARIA Sparingly**: Only when semantic HTML isn't sufficient
- **High Contrast**: Terminal theme maintains AAA contrast ratios
