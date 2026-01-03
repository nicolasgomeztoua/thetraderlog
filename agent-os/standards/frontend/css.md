## CSS Standards (Tailwind v4 + Terminal Design System)

EdgeJournal uses Tailwind CSS v4 with a custom "Terminal Design System" theme for a data-dense, professional trading interface.

### Tailwind v4

**Configuration**: `@tailwindcss/postcss` plugin
**Theme Definition**: `src/styles/globals.css` (CSS custom properties)
**No Config File**: Tailwind v4 uses CSS-based configuration instead of `tailwind.config.js`

### Terminal Design System

**Design Philosophy**:
- Monospace-first typography for all interactive elements
- Dark theme optimized for extended screen time
- High-contrast accent colors for data visualization
- Subtle transparency for depth and layering
- Grid backgrounds for technical aesthetic

### Color Palette

**Default Theme (EdgeJournal)**:
```css
--background: #121212;           /* Obsidian black */
--foreground: #e0e0e0;          /* Off-white text */
--primary: #d4ff00;             /* Electric chartreuse (main accent) */
--secondary: #00d4ff;           /* Ice blue (AI features) */
--card: #0a0a0a;                /* Darker card surfaces */

/* Trading-specific colors */
--profit: #00ff88;              /* Bright green for wins */
--loss: #ff3b3b;                /* Red for losses */
--breakeven: #ffd700;           /* Gold for breakeven */
```

**Theme System**:
9 themes total (5 dark, 4 light) defined in `src/lib/themes.ts`:
- Dark: EdgeJournal, One Dark Pro, Dracula, Night Owl, Monokai Pro
- Light: EdgeJournal Light, GitHub Light, Ayu Light, Solarized Light

### Typography

**Monospace Everywhere**:
All interactive elements use JetBrains Mono monospace font.

```tsx
// Button
<Button className="font-mono text-xs uppercase tracking-wider">
  Add Trade
</Button>

// Form label
<Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
  Symbol
</Label>

// Badge
<Badge className="font-mono text-[10px]">
  Long
</Badge>

// Data display
<span className="font-mono text-xl font-bold">
  $1,245.50
</span>
```

**Font Sizes**:
- `text-[10px]` - Labels, badges, small UI elements
- `text-xs` - Buttons, form inputs, navigation
- `text-sm` - Body text
- `text-base` / `text-lg` - Headings
- `text-xl` / `text-2xl` - Data values, metrics

### Transparency Pattern

Subtle white overlays create depth without heavy borders:

```tsx
// Card
<Card className="border border-white/10 bg-white/[0.02]">

// Input
<Input className="border-white/10 bg-white/[0.02]" />

// Hover states
<Button className="hover:bg-white/[0.05]">

// Focus states
<Input className="focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20" />
```

**Opacity Levels**:
- `white/[0.02]` - Subtle background tint
- `white/[0.05]` - Hover states
- `white/10` - Borders, dividers
- `white/20` - Active/selected states
- `primary/50` - Focus indicators

### Grid Background

Micro-grid pattern for technical aesthetic:

```tsx
<main className="relative min-h-screen">
  <div className="grid-bg absolute inset-0 opacity-30" />
  <div className="relative z-10">{children}</div>
</main>
```

Defined in `globals.css`:
```css
.grid-bg {
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
  background-size: 80px 80px;
}
```

### Component Styling Patterns

**Buttons**:
```tsx
// Default
<Button className="font-mono text-xs uppercase tracking-wider">

// Outline
<Button variant="outline" className="border-white/10 hover:border-white/20">

// Ghost
<Button variant="ghost" className="hover:bg-white/[0.02]">
```

**Cards**:
```tsx
<Card className="rounded border border-white/10 bg-white/[0.02]">
  <CardHeader>
    <CardTitle className="font-mono text-sm uppercase tracking-wider">
      Account Performance
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**Form Elements**:
```tsx
<div className="space-y-2">
  <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
    Symbol
  </Label>
  <Input className="h-8 font-mono text-xs border-white/10 bg-white/[0.02]" />
</div>
```

**Data Display**:
```tsx
// Metric card
<div className="space-y-1">
  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
    Win Rate
  </p>
  <p className="font-mono text-2xl font-bold text-primary">
    67.5%
  </p>
</div>

// P&L with color
<span className={cn(
  "font-mono font-bold",
  pnl > 0 ? "text-profit" : "text-loss"
)}>
  {formatCurrency(pnl)}
</span>
```

### Visual Effects

**Glow** (for landing page):
```tsx
<div className="glow-primary">
  {/* Electric chartreuse glow */}
</div>

<div className="glow-accent">
  {/* Ice blue glow */}
</div>
```

**Scanlines**:
```tsx
<div className="scanlines">
  {/* Subtle horizontal lines for terminal feel */}
</div>
```

**Glass Morphism**:
```tsx
<div className="terminal-card backdrop-blur-xl bg-background/80">
  {/* Translucent card with blur */}
</div>
```

### Spacing & Layout

**Tailwind's 4px Scale**:
- `space-y-1` (4px)
- `space-y-2` (8px)
- `space-y-4` (16px)
- `gap-2`, `gap-4`, `gap-6`

**Grid Layouts**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Responsive grid */}
</div>
```

### Utility Classes

**Custom Utilities** (in `globals.css`):
- `grid-bg` - Grid background pattern
- `glow-primary` - Primary color glow effect
- `glow-accent` - Secondary color glow effect
- `terminal-card` - Glass morphism card
- `scanlines` - Horizontal scan line effect

### Responsive Design

**Breakpoints**:
- `sm:` - 640px
- `md:` - 768px
- `lg:` - 1024px
- `xl:` - 1280px
- `2xl:` - 1536px

**Desktop-First Approach**:
EdgeJournal is optimized for desktop trading setups (data density priority).

```tsx
<div className="grid-cols-4 md:grid-cols-2 sm:grid-cols-1">
  {/* Desktop first, then adapt to smaller screens */}
</div>
```

### Performance

**Tailwind v4 Optimizations**:
- Automatic CSS purging (unused classes removed)
- Lightning CSS for faster compilation
- Zero-runtime overhead

**Best Practices**:
- Use Tailwind utilities over custom CSS
- Leverage design tokens from theme
- Minimize `@apply` directives
- Use `cn()` helper for conditional classes

### Design Token Usage

**Accessing Theme Colors**:
```tsx
// Via Tailwind classes
<div className="bg-primary text-primary-foreground">

// Via CSS custom properties
<div style={{ backgroundColor: 'var(--primary)' }}>
```

### Best Practices

- **Monospace Everything Interactive**: All buttons, labels, badges, inputs use `font-mono`
- **Uppercase Labels**: Form labels and UI labels use `uppercase tracking-wider`
- **Subtle Transparency**: Use `white/10` for borders, `white/[0.02]` for backgrounds
- **Color Semantics**: Profit (green), Loss (red), Breakeven (gold) consistently applied
- **Grid Backgrounds**: Add `grid-bg` to sections for terminal aesthetic
- **Hover States**: `hover:border-primary/30` or `hover:bg-white/[0.02]`
- **Focus Indicators**: `focus-visible:ring-2 focus-visible:ring-primary/50`
- **No Custom CSS**: Use Tailwind utilities and theme tokens
- **Theme Awareness**: Design works across all 9 themes
