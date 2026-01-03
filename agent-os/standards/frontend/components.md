## UI Components (shadcn/ui + Terminal Design)

EdgeJournal uses shadcn/ui components customized with Terminal Design System aesthetics.

### shadcn/ui Foundation

**Component Library**: shadcn/ui (copy-paste components, not npm package)
**Location**: `src/components/ui/`
**Customization**: All components styled for Terminal theme
**Base**: Radix UI primitives + Tailwind CSS

### Base Components

**Button** (`src/components/ui/button.tsx`):
```tsx
import { Button } from "~/components/ui/button";

// Variants: default, outline, ghost, destructive, secondary, link
<Button variant="default" className="font-mono text-xs uppercase tracking-wider">
  Add Trade
</Button>

<Button variant="outline" className="border-white/10">
  Cancel
</Button>

<Button variant="ghost" size="sm">
  Settings
</Button>
```

**Card** (`src/components/ui/card.tsx`):
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

<Card className="border-white/10 bg-white/[0.02]">
  <CardHeader>
    <CardTitle className="font-mono text-sm uppercase">
      Performance
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**Input** (`src/components/ui/input.tsx`):
```tsx
<Input
  className="h-8 font-mono text-xs border-white/10 bg-white/[0.02]"
  placeholder="EURUSD"
/>
```

**Select** (`src/components/ui/select.tsx`):
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-[120px] font-mono text-xs">
    <SelectValue placeholder="Status" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="open">Open</SelectItem>
    <SelectItem value="closed">Closed</SelectItem>
  </SelectContent>
</Select>
```

**Badge** (`src/components/ui/badge.tsx`):
```tsx
// Variants: default, secondary, outline, destructive, profit, loss
<Badge variant="profit" className="font-mono text-[10px]">
  +$125.50
</Badge>

<Badge variant="outline">
  Long
</Badge>
```

### Custom Components

**MetricCard** (`src/components/analytics/metric-card.tsx`):
```tsx
<MetricCard
  title="Win Rate"
  value="67.5%"
  icon={TrendingUp}
  colorClass="text-profit"
  tooltip={{
    what: "Percentage of profitable trades",
    why: "Indicates overall trading effectiveness",
    benchmark: ">50% is breakeven, >60% is excellent"
  }}
/>
```

**Pattern**:
- Title in tiny uppercase monospace
- Value in large bold monospace
- Optional icon from Lucide
- Info tooltip with What/Why/Benchmark
- Hover state changes border color

### Component Patterns

**Data Display**:
```tsx
// Value + Label pattern
<div className="space-y-1">
  <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
    Net P&L
  </p>
  <p className="font-mono text-2xl font-bold text-profit">
    +$1,245.50
  </p>
</div>
```

**Form Pattern**:
```tsx
<div className="space-y-2">
  <Label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
    Symbol
  </Label>
  <Input className="h-8 font-mono text-xs" />
</div>
```

**List Item Pattern**:
```tsx
<div className="flex items-center justify-between p-2 border-b border-white/10 hover:bg-white/[0.02]">
  <span className="font-mono text-xs">{item.name}</span>
  <Badge variant="outline">{item.status}</Badge>
</div>
```

### Composition

**Build Complex UIs from Simple Parts**:
```tsx
// Dashboard stat card composed of Card + MetricCard
<Card>
  <CardHeader>
    <CardTitle>Overview</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-4">
      <MetricCard title="Win Rate" value="67.5%" />
      <MetricCard title="Total P&L" value="+$1,245" />
    </div>
  </CardContent>
</Card>
```

### State Management

**Local State** (useState):
```tsx
function TradeForm() {
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<"long" | "short">("long");

  // Form logic
}
```

**Server State** (tRPC):
```tsx
function TradeList() {
  const { data: trades } = api.trades.getAll.useQuery();
  const utils = api.useUtils();

  const deleteMutation = api.trades.delete.useMutation({
    onSuccess: () => {
      utils.trades.getAll.invalidate();
    },
  });
}
```

**Context** (for cross-cutting concerns):
```tsx
// Account context
const { selectedAccount } = useAccount();

// Theme context
const { theme, setTheme } = useTheme();
```

### Props & TypeScript

**Type-Safe Props**:
```tsx
interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  colorClass?: string;
  tooltip?: {
    what: string;
    why: string;
    benchmark: string;
  };
}

export function MetricCard({ title, value, icon: Icon, colorClass, tooltip }: MetricCardProps) {
  // Implementation
}
```

**Default Props**:
```tsx
interface ButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
}

// Use defaults in destructuring
function Button({
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  // Implementation
}
```

### Accessibility

**Built-in from shadcn/ui**:
- Semantic HTML from Radix UI
- Keyboard navigation
- ARIA attributes
- Focus management

**Terminal Design Focus States**:
```tsx
<Input className="focus-visible:ring-2 focus-visible:ring-primary/50" />
<Button className="focus-visible:ring-2 focus-visible:ring-primary/50" />
```

### Styling Patterns

**CVA (Class Variance Authority)**:
```tsx
import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "font-mono text-xs uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-white/10 hover:border-white/20",
        ghost: "hover:bg-white/[0.02]",
      },
      size: {
        sm: "h-8 px-3",
        default: "h-10 px-4",
        lg: "h-12 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

**cn() Helper** (conditional classes):
```tsx
import { cn } from "~/lib/utils";

<div className={cn(
  "font-mono font-bold",
  pnl > 0 ? "text-profit" : "text-loss"
)}>
  {formatCurrency(pnl)}
</div>
```

### Best Practices

- **Single Responsibility**: MetricCard displays one metric, not a dashboard
- **Composition over Configuration**: Combine simple components instead of adding props
- **Minimal Props**: Keep prop count low, use composition for complexity
- **Type Safety**: Define TypeScript interfaces for all props
- **Local State First**: Use useState unless state needs to be shared
- **Server State via tRPC**: Don't duplicate server data in local state
- **Monospace Interactive Elements**: All buttons, labels, badges use `font-mono`
- **Terminal Aesthetics**: Follow white/10 borders, white/[0.02] backgrounds
- **Accessible by Default**: Leverage Radix UI primitives
