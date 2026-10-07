# System Revamp v2.0 — Visual Design System & Design Tokens Specification

This document defines the authoritative visual language and styling specifications for System Revamp v2.0 (Agent → Server → Admin Console).

---

## 1. Visual Philosophy & Direction

- **Calm, Friendly-Professional, and Modern**: Designed specifically for enterprise fleet engineers, university lab sysadmins, and IT security auditors managing thousands of endpoints.
- **Zero Hard Edges**: Every interactive component, container, input, table, badge, and tooltip has `border-radius > 0`. No harsh 0px square corners, no brutalist 1px black borders, no loud neons or aggressive glows.
- **Tonal Separation over Heavy Borders**: Structural elements separate cleanly through subtle surface tone shifts, spacious 4px grid rhythm, and soft, navy-tinted diffuse shadows rather than dark dividing lines.
- **Honest Data Provenance**: Design never synthesizes or masks missing telemetry. Every state clearly indicates its lineage, timestamp, and staleness.

---

## 2. Color System & Palette

Defined exclusively as CSS custom properties in `tokens.css`. No inline hex colors exist in component code.

### 2.1 Navy Blue (Primary Surface & Structural Brand)
Navy provides the visual anchor for headers, sidebars, and dark-mode elevation. **Navy is structural and never signals state.**

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--navy-950` | `#071426` | Deep base background in Dark Mode |
| `--navy-900` | `#0B1F3A` | Primary card and surface background in Dark Mode; text heading in Light Mode |
| `--navy-800` | `#12305A` | Elevated surface, hover states in Dark Mode |
| `--navy-700` | `#1B4373` | Active tab and border emphasis |
| `--navy-600` | `#255896` | Subtle accents and brand badges |

### 2.2 Cyan (Interactive Accent, Selection & Focus)
Cyan serves as the primary interactive accent, active navigation indicator, focus ring, and informational badge.

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--cyan-300` | `#67E8F9` | Hover text and high-contrast dark accents |
| `--cyan-400` | `#22D3EE` | Primary button & active link in Dark Mode |
| `--cyan-500` | `#06B6D4` | Primary hover accent |
| `--cyan-600` | `#0891B2` | Accessible primary button & link in Light Mode (4.5:1 contrast) |
| `--cyan-700` | `#0E7490` | Active press state in Light Mode |

### 2.3 Emerald (Healthy, Compliant & Online)
Emerald signals healthy workstations, clean patch compliance, verified Authenticode certificates, and completed jobs.

| Token | Hex | Role |
| :--- | :--- | :--- |
| `--emerald-400` | `#34D399` | Healthy status solid indicator in Dark Mode |
| `--emerald-500` | `#10B981` | Positive metric deltas, compliant checkmarks |
| `--emerald-600` | `#059669` | High-contrast compliant text in Light Mode |

### 2.4 Cool Slate Grey Scale (Neutral Surfaces, Borders & Inactive States)
Slate gray provides comfortable reading contrast and neutral backgrounds.

| Scale | Hex | Role |
| :--- | :--- | :--- |
| `Slate-50` | `#F8FAFC` | Light base background |
| `Slate-100` | `#F1F5F9` | Light hover state, code background |
| `Slate-200` | `#E2E8F0` | Subtle hairline borders |
| `Slate-400` | `#94A3B8` | Disabled text, neutral icons |
| `Slate-500` | `#64748B` | Secondary captions, offline badge text |
| `Slate-700` | `#334155` | Secondary body text |
| `Slate-900` | `#0F172A` | Primary high-contrast text |

### 2.5 Scoped Severity Exception: Warm Coral / Amber (High & Critical Risk Only)
To preserve accessibility without resorting to arbitrary rainbow hues, warm tones are **strictly reserved** for High and Critical security findings and destructive confirmations:

- **Critical Risk**: Filled soft warm coral badge (`--status-critical-bg: rgba(225, 29, 72, 0.22)`, `--status-critical-solid: #E11D48`), white/high-contrast text, accompanied by `ShieldAlert` icon.
- **High Risk**: Outlined warm amber badge (`--status-high-bg: rgba(217, 119, 6, 0.08)`, border: `rgba(217, 119, 6, 0.38)`), accompanied by `AlertCircle` icon.
- **Medium Risk**: Cyan badge, accompanied by `AlertTriangle` icon.
- **Low Risk / OK**: Emerald badge, accompanied by `CheckCircle2` icon.

---

## 3. Geometry & Radii Tokens

**Rule: Nothing has a 0px border radius.** Even scrollbars, tooltips, chart bars, and table containers feature rounded corners.

| Semantic Token | Radius Value | Applied Elements |
| :--- | :--- | :--- |
| `--radius-chip` / `--radius-input` | `10px` | Text inputs, dropdown selects, monospace tags, filter chips |
| `--radius-button` / `--radius-container` | `14px` | Buttons, action controls, data table wrappers, timeline cards |
| `--radius-card` / `--radius-modal` | `20px` | KPI tiles, summary panels, slide-out drawer corners, modal dialogs |
| `--radius-pill` | `9999px` | Status badges, risk badges, toggles, filter pills, scrollbar thumbs |

---

## 4. Elevation & Navy-Tinted Shadows

Rather than generic black drop shadows, shadows are tinted with deep navy (`rgba(11, 31, 58, ...)`) with generous blur and low vertical displacement:

- `--shadow-sm`: `0 2px 8px -2px rgba(11, 31, 58, 0.06)` — Standard cards & KPI tiles.
- `--shadow-md`: `0 8px 24px -4px rgba(11, 31, 58, 0.08)` — Elevated panels & hover states.
- `--shadow-lg`: `0 16px 36px -6px rgba(11, 31, 58, 0.12)` — Modals & dropdown menus.
- `--shadow-drawer`: `-12px 0 40px rgba(7, 20, 38, 0.16)` — Slide-out inspection drawer.
- `--shadow-modal`: `0 24px 48px -12px rgba(7, 20, 38, 0.22)` — Confirmation and setup modals.

---

## 5. Typography & Font Stack

- **Primary UI Typeface**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`.
  - Clean humanist geometric sans-serif ensuring legible numbers and labels at micro-sizes.
- **Monospace Typeface**: `JetBrains Mono`, `SFMono-Regular`, `Consolas`, `monospace`.
  - Used for SHA-256 hashes, device GUIDs, IP addresses, SemVer versions, CVE identifiers, and terminal execution logs.
- **Tabular Numerals**: `font-variant-numeric: tabular-nums` enabled on all tables, KPI metrics, version strings, and timers to prevent layout jittering during real-time polling updates.

---

## 6. Shared Component Set

All shared components reside in `frontend/src/components/common/` and strictly consume `tokens.css`:

1. **`StatusBadge`**: Pill badge indicating device, command, or agent state (`online`, `offline`, `running`, `failed`, `warning`). Features Lucide icon + label.
2. **`RiskBadge`**: Graded intensity pill badge (`LOW` = emerald, `MEDIUM` = cyan, `HIGH` = outlined coral, `CRITICAL` = filled coral). Includes tabular score in parentheses if CVSS is available.
3. **`KpiTile`**: 20px rounded summary tile displaying metric value, delta indicator, sparkline, and honest provenance source tooltip.
4. **`DataTable`**: 14px rounded table wrapper, 40px comfortable row height, sorting indicators, selectable checkboxes, pagination, and honest empty/skeleton states.
5. **`FilterBar`**: 14px container with 10px search bar, dynamic dropdown filters, record counters, and reset button.
6. **`Drawer`**: Slide-out inspection drawer with 20px rounded leading edge, backdrop blur, and escape key listener.
7. **`ConfirmDialog`**: 20px rounded modal requiring explicit admin approval for staged rollouts, driver fixes, and destructive operations.
8. **`PipelineStepper`**: Multi-phase stepper displaying staged remediation progress (`Targets` → `Dry-Run` → `Approval` → `Rollout` → `Results`).
9. **`LogViewer`**: Monospace console viewer with log level filtering (`ALL`, `ERROR`, `WARN`, `INFO`), text search, auto-scroll toggle, and copy-all action.
10. **`CodeBlock`**: Formatted syntax block with one-click copy button for PowerShell enrollment commands, silent MSI scripts, and diff views.
11. **`CopyField`**: Truncated monospace field for GUIDs and hashes with instant copy feedback.
12. **`EmptyState`**: Polite, friendly-professional empty state with Lucide icon, explanatory description, and primary call-to-action button.
13. **`Skeleton` & `TableSkeleton`**: Smooth animated placeholder boxes in slate grey tones (`10px` radius) during async fetch.

---

## 7. Do's and Don'ts

| Do | Don't |
| :--- | :--- |
| **Do** use `var(--radius-*)` tokens for all geometry. | **Don't** use `border-radius: 0` or sharp corners anywhere. |
| **Do** use Lucide React icons at consistent 2px stroke. | **Don't** use emoji icons (`💻`, `🚨`, `⚡`, `🟢`, etc.) in the UI. |
| **Do** show honest empty states when no telemetry is collected. | **Don't** display fake or plausible-looking placeholder data. |
| **Do** reserve warm coral/amber strictly for High/Critical risks. | **Don't** use red or orange for decorative buttons or neutral cards. |
| **Do** include an icon and a text label on every badge. | **Don't** rely on color alone to convey state (violates WCAG AA). |
| **Do** enable tabular numerals on all metrics and versions. | **Don't** allow layout shift when polling data updates. |
