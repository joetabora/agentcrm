# Design System — Joe Real Estate OS ("Harbor")

Identity: confident, quiet, financial-grade. Precision over decoration.

## Brand

**Harbor** — deep blue-teal primary for product chrome. **Iris** accent reserved exclusively for AI.

Do not use AI color for ordinary actions. Do not use gradients or glows.

## Color tokens

### Core (light)

| Token | Value | Use |
|-------|-------|-----|
| `--background` | `oklch(0.995 0.002 217)` | App canvas |
| `--foreground` | `oklch(0.18 0.02 250)` | Body text |
| `--card` | `oklch(1 0 0)` | Elevated surfaces |
| `--primary` | `oklch(0.51 0.10 217)` | Primary actions, active nav, links |
| `--primary-foreground` | `oklch(0.99 0.005 217)` | On primary |
| `--secondary` | `oklch(0.96 0.01 217)` | Secondary fills |
| `--muted` | `oklch(0.96 0.008 217)` | Subtle fills |
| `--muted-foreground` | `oklch(0.50 0.02 250)` | Secondary text |
| `--accent` | `oklch(0.95 0.015 217)` | Hover / soft highlight |
| `--destructive` | `oklch(0.577 0.245 27.325)` | Errors / destructive |
| `--border` | `oklch(0.91 0.01 217)` | Hairline borders |
| `--ring` | `oklch(0.51 0.10 217)` | Focus |

### Semantic

| Token | Light | Use |
|-------|-------|-----|
| `--success` | `oklch(0.55 0.12 155)` | Completed, positive deltas |
| `--warning` | `oklch(0.70 0.14 78)` | Overdue, attention |
| `--info` | maps to primary | Informational callouts |

### Status (temperature)

| Token | Use |
|-------|-----|
| `--temp-hot` | Hot leads |
| `--temp-warm` | Warm leads |
| `--temp-cold` | Cold leads |

### AI (iris)

| Token | Light | Use |
|-------|-------|-----|
| `--ai` | `oklch(0.58 0.13 292)` | AI labels, icons |
| `--ai-foreground` | `oklch(0.99 0.01 292)` | On AI solid |
| `--ai-surface` | `oklch(0.58 0.13 292 / 6%)` | Soft AI panels |

### Charts

Five-step ramp on brand hue (`--chart-1` … `--chart-5`). No rainbow.

### Sidebar

Use `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--sidebar-ring` for the app shell only.

Dark mode inverts neutrals; primary lightens to `oklch(0.72 0.11 217)`; AI lightens similarly. Wire via `next-themes` class strategy on `<html>`.

## Typography

Font: Geist Sans (body/UI), Geist Mono (codes). `--font-sans` must resolve to `--font-geist-sans`.

| Role | Class convention | Weight |
|------|------------------|--------|
| Display | `text-3xl tracking-tight` | semibold |
| Page title | `text-2xl tracking-tight` | semibold |
| Section | `text-xs font-semibold uppercase tracking-wide text-muted-foreground` | semibold |
| Card title | `text-sm font-medium` | medium |
| Body | `text-sm` | normal |
| Secondary | `text-sm text-muted-foreground` | normal |
| Meta | `text-xs text-muted-foreground` | normal |
| Label | `text-xs font-medium` | medium |
| Numeric | `text-sm tabular-nums` (metrics: `text-2xl font-semibold tabular-nums`) | as needed |

Avoid bold everywhere. Prefer medium for emphasis.

## Spacing, radius, elevation

- Base radius: `--radius: 0.625rem` (keep).
- Spacing: 4px grid (`gap-1` … `gap-6`); page padding `p-4 md:p-6`.
- Shadows: `--shadow-card` (subtle), `--shadow-overlay` (menus/dialogs). No glassmorphism.

## Breakpoints

| Name | Width | Role |
|------|------:|------|
| `sm` | 640 | Form grids |
| `md` | 768 | Sidebar vs mobile shell |
| `lg` | 1024 | Two-column workspaces |
| `xl` | 1280 | Contact detail rail |

## Components

### Primitives (shadcn)

Button, IconButton (Button `size="icon"`), Input, SearchInput, Select, Textarea, Combobox, Badge, Avatar, Tooltip, DropdownMenu, Dialog, Sheet, Tabs, Card, Table, Skeleton, Toast (Sonner), Command, Separator, ScrollArea, Popover.

### Patterns (`src/components/patterns/`)

| Component | Contract |
|-----------|----------|
| `PageShell` | Title, description, actions, optional breadcrumbs |
| `SectionHeader` | Uppercase section label + optional action |
| `Metric` | Label + numeric value + optional delta |
| `StatusBadge` | Semantic / temperature / pipeline status |
| `EmptyState` | Title, description, primary action (Button) |
| `DataTable` | Sticky header, sort, row select, bulk bar, pagination |
| `Timeline` | Activity stream |
| `AIInsight` / `AIBadge` | Iris surface + label |
| `PropertyCard` / `ContactCard` / `LeadCard` | Dense entity cards |
| Charts | Hand-built SVG bar / line / sparkline / donut |

## AI visual language

- Iris accent + `--ai-surface` tint only.
- Labels: "AI insight", "AI recommended", "AI generated".
- Sparkles icon sparingly (16–18px).
- No neon, no full-bleed AI gradients, no chatbot chrome on CRM pages.

## Interaction

- Transitions ≤ 150ms for hover; ≤ 200ms for sheets/dialogs.
- Prefer `transition-colors` / `transition-opacity` over layout animation.
- Skeletons preserve layout; avoid spinner-only loading for page shells.

## Accessibility

- Visible focus rings via `--ring`.
- Icon-only buttons require `aria-label`.
- Dialogs/menus use base-nova focus traps.
- Contrast: primary and muted-foreground must pass WCAG AA on background/card.

## Do not

- Mix icon libraries (Lucide only).
- Introduce chart or animation libraries.
- Invent metrics or placeholder CRM data in production UI.
- Use emoji as primary UI affordances.
