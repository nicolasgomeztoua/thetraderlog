---
name: frontend
description: Frontend implementation patterns and terminal-style UI guidance for TheTraderLog.
---

# Frontend Skill

You are a frontend engineer working on TheTraderLog, a professional trading journal with a distinctive "Terminal" design aesthetic.

---

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:

- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: TheTraderLog uses a specific tone—brutalist, terminal-inspired, data-dense, dark-by-default. New components must match this established aesthetic.
- **Constraints**: Technical requirements (Next.js 15, Tailwind CSS v4, Shadcn UI).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Execute the Terminal aesthetic with precision. Every UI element should feel like it came from a professional trading terminal or CLI.

Then implement working code that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with TheTraderLog's established aesthetic
- Meticulously refined in every detail

### Avoiding Generic AI Aesthetics

NEVER use:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Cliched color schemes (purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character
- Large border radius (`rounded-lg`, `rounded-xl`)

TheTraderLog uses distinctive choices: JetBrains Mono for UI, Electric Chartreuse (#d4ff00) accent, ultra-dark backgrounds, minimal border-radius.

---

## Design Philosophy

TheTraderLog uses **"The Terminal"** design language—a high-end trading terminal aesthetic meets brutalist design. Every UI element should feel like it came from a professional trading terminal.

### Core Principles

1. **Terminal-First**: UI elements feel like they're from a trading terminal or CLI
2. **Data-Dense**: Prioritize information density—traders want to see their data
3. **High Contrast**: Color used sparingly but with maximum impact
4. **Dark by Default**: Designed for extended use in low-light conditions
5. **Monospace Everything**: Labels, buttons, navigation, stats—all use `font-mono`
6. **Brutalist Precision**: Sharp edges, minimal border-radius, precise spacing

---

## Color Palette

| Name | Value | CSS Variable | Usage |
|------|-------|--------------|-------|
| Obsidian Black | `#050505` | `--background` | Primary background |
| Electric Chartreuse | `#d4ff00` | `--primary` | Primary accent, CTAs |
| Ice Blue | `#00d4ff` | `--accent` | AI features, secondary accent |
| Profit Green | `#00ff88` | `--profit` | Positive P&L, success |
| Loss Red | `#ff3b3b` | `--loss` | Negative P&L, errors |
| Breakeven Gold | `#ffd700` | `--breakeven` | Neutral, warnings |

### Opacity Scale (Critical)

```
bg-white/1     Barely visible card background
bg-white/2     Subtle card/element background
border-white/5      Default subtle border
border-white/10     Medium visibility (hover states)
border-primary/20   Highlighted border
border-primary/40   Highlighted hover border
```

---

## Typography Rules

**Use `font-mono` for:**
- All buttons and CTAs
- Navigation links
- Labels, captions, badges
- Data values (prices, stats)
- Form labels, table headers
- Section labels above headlines

**Use `font-sans` for:**
- Large headlines (h1, h2)
- Body paragraphs
- Long-form content

### Type Patterns

```
BUTTONS:      font-mono text-xs uppercase tracking-wider
NAV LINKS:    font-mono text-xs uppercase tracking-wider text-muted-foreground
LABELS:       font-mono text-[10px] text-muted-foreground uppercase tracking-wider
DATA VALUES:  font-mono font-bold text-lg
HEADLINES:    font-bold text-4xl sm:text-5xl tracking-tight
```

---

## Component Patterns

### Card Styles

```tsx
// Standard card
<div className="rounded border border-white/5 bg-white/1 p-6 hover:border-white/10 transition-all">

// Highlighted/accent card
<div className="rounded border border-primary/20 bg-primary/2 p-6 hover:border-primary/40 transition-all">

// Data-dense card
<div className="rounded border border-white/5 bg-white/2 p-3">
  <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Label</div>
  <div className="font-mono font-bold text-lg">$2,847.50</div>
</div>
```

### Buttons

```tsx
// Primary button
<Button className="h-12 px-8 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-wider">
  Start Free <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
</Button>

// Outline button
<Button variant="outline" className="h-12 px-8 border-white/10 hover:border-white/20 font-mono text-xs uppercase tracking-wider">
  Watch Demo
</Button>
```

### Terminal Window (Signature Element)

Use for preview/demo content:

```tsx
<div className="overflow-hidden rounded border border-white/10 bg-black/80 shadow-2xl">
  {/* Traffic light header */}
  <div className="flex items-center justify-between border-b border-white/5 bg-white/2 px-4 py-2">
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-2.5 rounded-full bg-loss/60" />
      <div className="h-2.5 w-2.5 rounded-full bg-breakeven/60" />
      <div className="h-2.5 w-2.5 rounded-full bg-profit/60" />
    </div>
    <span className="font-mono text-[10px] text-muted-foreground">traderlog — dashboard</span>
    <div className="w-14" />
  </div>
  <div className="p-6">{/* content */}</div>
</div>
```

### Section Header Pattern

```tsx
<div className="mb-16 max-w-2xl">
  <span className="mb-4 inline-block font-mono text-xs text-primary uppercase tracking-wider">
    Features
  </span>
  <h2 className="font-bold text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight">
    Everything you need to <span className="text-primary">find your edge</span>
  </h2>
  <p className="mt-6 font-mono text-base text-muted-foreground">
    A complete toolkit for serious traders.
  </p>
</div>
```

---

## P&L Display Pattern

Always use this pattern for profit/loss values:

```tsx
const formatPnl = (value: number) => {
  const prefix = value >= 0 ? "+$" : "-$";
  return `${prefix}${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

<span className={`font-mono font-bold ${value >= 0 ? "text-profit" : "text-loss"}`}>
  {formatPnl(value)}
</span>
```

---

## Spacing Guidelines

| Context | Value |
|---------|-------|
| Section padding | `py-32` |
| Section header margin | `mb-16` to `mb-20` |
| Container | `max-w-6xl mx-auto px-6` |
| Card padding | `p-6` (standard), `p-3` (dense) |
| Grid gap | `gap-3` to `gap-4` |

---

## Border Radius Rules

- Cards: `rounded` (4px)
- Small elements: `rounded-sm` (2px)
- Buttons: `rounded` (4px)
- **Never** use large radius (`rounded-lg`, `rounded-xl`)

---

## Interactive States

| Element | Default | Hover |
|---------|---------|-------|
| Card border | `border-white/5` | `border-white/10` |
| Highlighted card | `border-primary/20` | `border-primary/40` |
| Nav link | `text-muted-foreground` | `text-primary` |
| Arrow icons | normal | `group-hover:translate-x-1` |

---

## Background Effects

```tsx
// Grid background
<div className="absolute inset-0 opacity-50" style={{
  backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
  backgroundSize: '80px 80px'
}} />

// Gradient orbs (atmosphere)
<div className="absolute top-1/4 -left-32 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
<div className="absolute bottom-1/4 -right-32 h-[400px] w-[400px] rounded-full bg-accent/5 blur-[120px]" />
```

---

## File Locations

- UI Components: `src/components/ui/` (Shadcn, styled to match)
- Marketing pages: `src/app/(marketing)/_components/`
- App components: `src/app/(protected)/_components/`
- Global styles: `src/styles/globals.css`

---

## Reference

For complete documentation including all components, animations, and detailed patterns, see:
- [Full Design Reference](./DESIGN_REFERENCE.md)
