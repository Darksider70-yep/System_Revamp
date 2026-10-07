# System Revamp v2.0 — Design System Specification

## 1. Principles & Philosophy
- **Information-First Infrastructure Console:** Purpose-built for system administrators managing 100s–1000s of endpoints across university labs and enterprise campuses.
- **No Decoration without Utility:** Zero glassmorphism, blur effects, glowing neon shadows, or arbitrary gradients. Every visual element communicates state, structure, or hierarchy.
- **Multi-Theme Parity:** Rigorously tuned **Light Mode** (high ambient-light lab visibility) and **Dark Mode** (low-fatigue operations centers).
- **Redundant Status Encoding:** Saturated color is strictly reserved for status semantics, and **never used alone** (always paired with unambiguous icons and textual labels).

---

## 2. Color System & Semantic Status Scale

### Core Neutrals (Slate Architecture)
| Token | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|
| `--bg-base` | `#F8FAFC` (Slate 50) | `#0B0F17` (Deep Obsidian) | Root page canvas |
| `--bg-surface` | `#FFFFFF` | `#111827` (Gray 900) | Cards, panels, sidebars, tables |
| `--bg-surface-elevated` | `#F1F5F9` (Slate 100) | `#1F2937` (Gray 800) | Drawers, modals, popovers |
| `--bg-surface-hover` | `#E2E8F0` (Slate 200) | `#374151` (Gray 700) | Table row hover, menu item hover |
| `--border-subtle` | `#E2E8F0` (Slate 200) | `#1E293B` (Slate 800) | 1px data boundaries & dividers |
| `--border-strong` | `#CBD5E1` (Slate 300) | `#334155` (Slate 700) | Active inputs, selected cards |
| `--text-primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Primary headers, values, active labels |
| `--text-secondary` | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Descriptions, table headers, metadata |
| `--text-muted` | `#94A3B8` (Slate 400) | `#64748B` (Slate 500) | Disabled elements, placeholders |

### Semantic Status Scale
| Status Level | Base Hue | Badge BG (Light) | Badge Border / Text (Light) | Badge BG (Dark) | Badge Text (Dark) | Meaning & Trigger |
|---|---|---|---|---|---|---|
| **Critical** | Crimson Red | `#FEF2F2` | `#DC2626` | `#450A0A` | `#FCA5A5` | CVSS $\ge 7.0$, Major version jump $\ge 2$, known active malware |
| **High** | Burnt Orange | `#FFF7ED` | `#EA580C` | `#431407` | `#FDBA74` | Major jump = 1, deprecated library, unsigned execution |
| **Medium** | Warm Amber | `#FFFBEB` | `#D97706` | `#451A03` | `#FCD34D` | Minor version drift, optional driver updates |
| **Low / OK** | Emerald Green | `#F0FDF4` | `#16A34A` | `#052E16` | `#86EFAC` | Patch drift, fully compliant, signed & validated |
| **Offline / Unknown** | Neutral Gray | `#F1F5F9` | `#64748B` | `#1E293B` | `#94A3B8` | Agent heartbeat timed out, unparsable metadata |

### Interactive Accent
- `--accent-primary`: `#4F46E5` (Indigo 600)
- `--accent-hover`: `#4338CA` (Indigo 700)
- `--accent-subtle`: `rgba(79, 70, 229, 0.08)` (Light) / `rgba(99, 102, 241, 0.15)` (Dark)

---

## 3. Typography Scale & Hierarchy

All body and UI text uses system sans-serif (`Inter`, `-apple-system`, `BlinkMacSystemFont`), while code, hashes, versions, CVE IDs, and IPs strictly use `JetBrains Mono` / `Courier New`.

- **Numeric Tabularity:** `font-variant-numeric: tabular-nums` applied globally to ensure numerical columns, metrics, and timestamps remain perfectly aligned during live updates.
- **Type Scale:**
  - `12px` (`0.75rem`) — Micro badges, table header captions, sparkline bounds
  - `13px` (`0.8125rem`) — Dense table body, meta tags, timestamps
  - `14px` (`0.875rem`) — Standard body, form inputs, button labels, drawer copy
  - `16px` (`1.0rem`) — Card headings, sub-navigation titles, modal headers
  - `20px` (`1.25rem`) — Screen titles, modal primary headlines
  - `28px` (`1.75rem`) — KPI hero counters and metric totals

---

## 4. Density & Layout Grid

- **Spacing Rhythm:** 4px base multiplier (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).
- **Table Density Settings:**
  - `Compact Mode`: 32px row height, 6px cell padding, optimal for scanning >50 rows on 1080p.
  - `Comfortable Mode`: 40px row height, 10px cell padding, standard ergonomic spacing.
- **Presentation Mode:** Adds +10% scaling, hides tertiary subtitles, emphasizes delta badge animations for video demos and projection in meeting rooms.

---

## 5. Motion & Accessibility (WCAG AA)
- Transitions capped at `150ms ease-out` for hover and drawer slides.
- Strict `@media (prefers-reduced-motion: reduce)` override disabling all animations.
- Visible focus rings: `2px solid var(--accent-primary)` with `2px offset`.
- Color contrast ratio exceeds `4.5:1` for normal text and `3:1` for UI components across both light and dark themes.
