# UI/UX Audit — Joe Real Estate OS

Audit date: 2026-08-13. Scope: entire authenticated CRM under `/app` plus marketing/auth surfaces.

## Executive summary

The primitive layer (shadcn base-nova, 19 components) is solid. Application pages largely bypass it. The product reads as a competent developer CRUD scaffold, not a premium proptech OS. This redesign replaces the visual language, navigation model, and densest workspaces while preserving domain services and server-action contracts.

## Current problems

### Brand and color

- `--primary` is achromatic (`oklch(0.205 0 0)`). There is no distinctive brand color.
- Charts are grayscale steps; only `--destructive` carries chroma.
- Hardcoded palette classes appear in `TemperatureBadge` (`bg-red-100`, `bg-amber-100`, `bg-slate-100`), offline banner (`bg-amber-50`), and AI claim labels (`emerald-*`, `sky-*`).
- Sidebar CSS tokens (`--sidebar-*`) exist but the shell uses `bg-card` instead.

### Typography

- `--font-sans: var(--font-sans)` in `globals.css` is circular. Geist Sans is loaded as `--font-geist-sans` and never applied.
- No formal type scale. Pages mix `text-2xl`, `text-xl`, `text-base`, `text-sm`, `text-xs`, `text-[11px]`, `text-[10px]` ad hoc.
- Metrics (GCI, pipeline value, conversion) lack a consistent `numeric` treatment.

### Component inconsistencies

| Pattern | Count | Notes |
|---------|------:|-------|
| Raw `<select>` | 54 | Zero uses of `@/components/ui/select` |
| Raw visible `<input>` | 22 | Mix with `Input` on the same pages |
| Raw `<textarea>` | 11 | Zero uses of `Textarea` |
| Raw `<button>` with button classes | 10 | Bypass `Button` |
| `<Link>` / `<a>` styled as buttons | ~27 | Bypass `buttonVariants` |
| Raw `<table>` | 1 | Reports results |
| Hardcoded color classes | 13 | Status / AI / offline |

Three competing control style families coexist: shadcn tokens, `h-8 rounded-md border`, and `h-8 rounded-lg border`.

### Installed but unused primitives

`Select`, `Textarea`, `Tabs`, `Dialog`, `Command`, `DropdownMenu`, `Popover`, `Avatar`, `Separator`, `ScrollArea` are present and unused in app pages.

### Missing primitives for a premium CRM

`Tooltip`, `Skeleton`, Combobox. Dark mode is scaffolding only (`next-themes` installed, never wired).

### Layout and navigation

- Fixed 240px sidebar, no collapse.
- 15 flat nav items including four separate settings entries.
- Mobile bottom nav exposes only Home / Contacts / Tasks — 12 destinations require the hamburger sheet.
- No top bar: no global search, quick create, notifications, or profile menu in the chrome.
- Search is a sidebar destination instead of a global affordance.

### Missing routes vs desired IA

| Desired | Status |
|---------|--------|
| Inbox | Missing |
| Calendar | Missing (appointments live on Tasks) |
| Settings hub | Missing (four sibling pages) |
| Help | Missing |
| Marketing | Exists as Campaigns |
| AI | Exists as Assistant |

### Overloaded pages

| Lines | Route | Issue |
|------:|-------|-------|
| 616 | `/app/contacts/[id]` | ~10 sections in one file |
| 456 | `/app/transactions/[id]` | Six domains |
| 331 | `/app/leads` | Filter + views + bulk + table |
| 281 | `/app/settings/workflows` | Create + list + enrollments |
| 278 | `/app/tasks` | Tasks + appointments + two creates |
| 244 | `/app` | Scattershot widgets |

Lead detail (210 lines) is under-built relative to contact detail.

### States and a11y

- Zero `loading.tsx`, `error.tsx`, or `not-found.tsx` files.
- Empty states exist but often say little and use a hand-styled link instead of `Button`.
- Focus rings come from base-nova; many raw controls lack `Label` associations.
- No theme toggle; viewport `themeColor` is dark while the app always renders light tokens.

### Responsive

- Shell breakpoint is `md` (consistent).
- Content grids are ad-hoc (`sm` / `lg` / `xl` per page).
- Tables and kanban are horizontal-scroll only on mobile (leads, contacts, properties, pipeline).

### Performance posture

Pages are Server Components (good). Client islands are leaf-level. Risk: redesign must not pull large client trees into every page, or ship a chart library.

## Recommended architecture

1. Establish Harbor design tokens and fix fonts before any page work.
2. Promote primitives and add composites under `src/components/patterns/`.
3. Rebuild shell + Cmd-K first so every subsequent page lands in the right chrome.
4. Split overloaded detail pages into tabs / subcomponents.
5. Add Inbox and Calendar as thin domain wrappers over existing models.
6. Ship loading / error / empty states as part of each surface, not as a cleanup pass.
7. Keep domain services and server actions; redesign presentation only (except `listThreads` and calendar mapper).

## Success criteria

- Screenshot reads as premium proptech, not a Tailwind admin template.
- Agent understands what needs attention within 5 seconds on Home.
- Contact reachable in ≤2 clicks from any primary surface.
- AI visually distinct but not toy-like.
- Typecheck, lint, tests, and production build pass.
