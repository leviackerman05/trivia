# Design Merge: Cloudflare Cloud Identity × Dashboard × Vercel

> Research deliverable (2026-08-05). Owner asked to "experiment with a few
> design systems" and "use the best of both worlds". This doc is the evidence
> base and recommendation for a **merged token layer** — no production code
> changed. PM/TL can act on the RECOMMENDED column without re-researching;
> every flagged tradeoff needs an owner call (see [Owner decisions](#owner-decisions)).

## Summary

Three systems are in play:

| System                                                                                   | Provenance                                                                                  | Character                                                                                          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **A. Current site** (`src/styles/global.css`)                                            | Cloudflare Cloud Identity, owner-approved switch (BRANDING.md), replacing PRD §11 BounceBox | Dark-first `#09090B`, orange `#F38020` action, blue `#0051C3`, Inter, 8px radii, 2px emerald focus |
| **B. Dashboard** (owner-supplied tokens)                                                 | Owner paste, handoff 2026-08-05                                                             | Light `#e5e5e5`, black text/primary, 48px display, 2px radius, 100ms/1500ms motion                 |
| **C. Vercel** (`getdesign` capture → `DESIGN.md` in repo root; live-surface measurement) | `npx --yes getdesign@latest add vercel` succeeded 2026-08-05                                | Light `#fafafa` canvas, ink `#171717`, stacked shadows, mesh gradient decoration, 4px spacing base |

**Recommendation in one line:** keep the orange brand anchor and the
Cloudflare blue + emerald focus from A; flip the base to **light-first**
with Vercel's canvas ladder (`#fafafa` page / `#ffffff` cards / `#e5e5e5`
inset — B's background becomes the muted step); adopt B's 48px display,
2px radius precision, and 100ms micro-motion; adopt C's spacing scale,
stacked-shadow elevation, display tracking, and gradient decoration.
Dark stays fully supported as a theme (D036 token swap) — just no longer
the default. This also resolves the PRD §2 ("follow Vercel's design
aesthetic") vs §11 (BounceBox kids' system) contradiction flagged as
Open Question #1 in `PROJECT_STATE.md`: Vercel-minimal becomes the
structure, the existing Cloudflare identity provides the energy, and
BounceBox's pill shapes survive through Vercel's own marketing-pill
radius. The missing `@DESIGN.md` referenced by PRD §2 now exists
(repo root, getdesign output).

## Vercel tokens (frontmatter, owner-paste format)

Captured from `getdesign` (primary) + one live-surface measurement
(motion/focus). Provenance per token; inferred values are labeled.

```yaml
---
system: Vercel (getdesign capture DESIGN.md + dash.vercel.com measurement, 2026-08-05)
text: '#171717' # ink, measured
primary: '#171717' # marketing CTA ink (rejected as ACTION color, see matrix)
background: '#fafafa' # canvas-soft page base; cards #ffffff, inset #f5f5f5
on-primary: '#ffffff'
muted: '#4d4d4d' # body text
mute: '#888888' # placeholder/fine print
hairline: '#ebebeb'
hairline-strong: '#a1a1a1'
link: '#0070f3' # legacy geist; do not adopt (blue success quirk)
success: '#0070f3' # legacy quirk; do not adopt for games (see matrix)
error: '#ee0000'
warning: '#f5a623'
font: 'Geist (proprietary) → Inter is the documented substitute (getdesign note)'
display: '48px w600 lh1.0 ls-2.4px' # hero; 32px w600 ls-1.28px; 24px w600 ls-0.96px; 20px w600 ls-0.6px
body: '16px w400 lh1.5; 18px lead w400; 14px w400 ls-0.28px'
caption: '12px w400 lh1.33'
button: '14px w500 md / 16px w500 lg'
mono: 'Geist Mono → JetBrains Mono substitute, 12-13px w400'
spacing: 'base 4px; scale [4,8,12,16,24,32,40,48,64,96,128,192]'
radius: 'xs 4px, sm 6px, md 8px, lg 12px, xl 16px, pill 100px, full 9999px'
motion: '150ms ease-in-out (measured on live surface button classes); no base-slow token in md'
focus: '--ds-focus-ring var (measured reference; value not published in md)'
elevation: '5 stacked-shadow levels (alphas 0.05-0.15) + 1px inset hairline ring'
gradient: 'develop #007cf0→#00dfd8; preview #7928ca→#ff0080; ship #ff4d4d→#f9cb28'
---
```

Full extraction (components, layout, do's/don'ts) is in `DESIGN.md`.

## Merge matrix

Legend: **A** = current Cloudflare (dark values; light values in
`:root.light`), **B** = Dashboard (owner paste), **C** = Vercel.
➡ = RECOMMENDED merged token.

### Colors

| Token                     | A — Current                      | B — Dashboard | C — Vercel                                                                            | ➡ RECOMMENDED                                                                                                  | Rationale                                                                                                                                                                                                                                                                                                                |
| ------------------------- | -------------------------------- | ------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Action (primary)          | `#F38020`                        | `#000000`     | `#171717`                                                                             | **`#F38020` + existing strong/deep text variants** (`#A85100`/`#C2410C` on light, `#F6994F`/`#FFC28C` on dark) | Handoff mandate: orange survives as the action color. B/C's ink-primary rejected for actions (a party site's primary action in near-black reads as disabled); their ink is adopted as _text_ instead. Orange fill on white is ~2.5:1 — never white text on orange; the existing strong/deep pattern already solves this. |
| Ink (text)                | `#FAFAFA` dark / `#071428` light | `#000000`     | `#171717`                                                                             | **`#171717`** (light)                                                                                          | Near-black per C's 200-step gray discipline; ~17:1 on `#fafafa` (vs B's ~20:1 pure black). B's `#000000` acceptable if owner wants max contrast; `#171717` reduces halation on large surfaces.                                                                                                                           |
| Body text                 | `#A1A1AA` / `#52525B`            | —             | `#4D4D4D` body, `#888888` mute                                                        | **`#4D4D4D` + `#888888` two-tier**                                                                             | C's ladder gives deliberate hierarchy; current single muted tier is coarser.                                                                                                                                                                                                                                             |
| Page surface              | `#09090B` dark / `#FFFFFF` light | `#E5E5E5`     | `#FAFAFA` page, `#FFFFFF` cards, `#F5F5F5` inset                                      | **`#FAFAFA` page / `#FFFFFF` cards / `#E5E5E5` inset+hover**                                                   | ⚠ Tradeoff token (theme direction). B's `#e5e5e5` as a full page base is flat for reading; C's ladder places it exactly where an inset/muted step belongs — both identities survive, and C's pattern is the measured, shipped one.                                                                                       |
| Hairlines                 | `#E4E4E7` / `#27272A`            | —             | `#EBEBEB`, strong `#A1A1A1`                                                           | **`#EBEBEB` + `#A1A1A1`** (light)                                                                              | C's hairline tones are softer on light; current dark values stay for the dark theme.                                                                                                                                                                                                                                     |
| Secondary (blue)          | `#0051C3` light / `#3B82F6` dark | —             | link `#0070F3`                                                                        | **Keep `#0051C3` / `#3B82F6`**                                                                                 | Existing Cloudflare identity; C's `#0070F3` is a legacy geist value — one blue, not two. Also serves as link color.                                                                                                                                                                                                      |
| Success                   | `#10B981` / `#059669`            | —             | `#0070F3` (blue!)                                                                     | **Keep current**                                                                                               | ⚠ Reject C's blue-as-success: "correct!" must read green in a game UI (status semantics are a core feedback signal).                                                                                                                                                                                                     |
| Error                     | `#F87171` / `#DC2626`            | —             | `#EE0000`                                                                             | **Keep current**                                                                                               | `#DC2626` passes 4.5:1 on white; `#EE0000` is harsher with no contrast gain.                                                                                                                                                                                                                                             |
| Warning / info / tertiary | `#FFAC00`, `#38BDF8`/`#0284C7`   | —             | `#F5A623`                                                                             | **Keep current**                                                                                               | Amber `#FFAC00` is the brand tertiary; Vercel's amber differs trivially — churn without benefit.                                                                                                                                                                                                                         |
| Decorative gradient       | none                             | none          | 3 pairs: develop `#007CF0→#00DFD8`, preview `#7928CA→#FF0080`, ship `#FF4D4D→#F9CB28` | **Adopt as optional tokens, hero/celebration scale only**                                                      | Satisfies PRD §2's "subtle gradients" literally; C's rule — gradient is the entire decoration system, never miniaturized. Orange stays the action anchor.                                                                                                                                                                |
| Selection                 | orange bg + white text           | —             | ink bg `#171717`, `#F2F2F2` fg                                                        | **Keep orange**                                                                                                | Brand signature; selection contrast is exempt from WCAG, and orange selection is a Cloudflare identity mark.                                                                                                                                                                                                             |

### Typography

| Token        | A — Current                            | B — Dashboard   | C — Vercel                  | ➡ RECOMMENDED                                  | Rationale                                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------- | --------------- | --------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Font         | Inter self-hosted 400-800 (latin only) | system-ui       | Geist (proprietary)         | **Inter, keep self-hosted**                    | C's own extraction names Inter the closest substitute; swapping to Geist is impossible (proprietary) and system-ui loses the brand voice. Zero new font weight/size cost (perf gate, PRD §10).                                                                                                                  |
| Display / h1 | 36px / 1.15 / 700-800                  | 48px w700 lh1.5 | 48px w600 lh1.0 ls-2.4px    | **48px w700 lh1.1 ls -0.04em**                 | 48px from B+C (handoff: adopt B's 48px display). w700 keeps party-brand energy (C's 600 ceiling is a calm-enterprise voice — ⚠ brand-voice tradeoff, see risks). lh1.1 over B's 1.5: 48px/72px stacks sparse and breaks card rhythm; 1.0-1.15 is the display norm (C + current agree). ls -0.04em = C's -2.4px. |
| Heading / h2 | 28px                                   | 32px w600       | 32px w600 ls-1.28px         | **32px w600 lh1.2 ls -0.04em**                 | B and C independently agree on 32px — adopt.                                                                                                                                                                                                                                                                    |
| h3           | 22px                                   | —               | 24px w600                   | **24px w600 lh1.3 ls -0.04em**                 | C's display-md slot.                                                                                                                                                                                                                                                                                            |
| h4           | 18px                                   | —               | 20px w600                   | **20px w600 lh1.4 ls -0.03em**                 | C's display-sm slot.                                                                                                                                                                                                                                                                                            |
| Body         | 16px / 1.5                             | 16px w400       | 16px w400 / 1.5             | **16px w400 / 1.5 — keep**                     | All three systems agree; zero debate.                                                                                                                                                                                                                                                                           |
| Lead (new)   | —                                      | —               | 18px w400 lh1.55            | **Add 18px**                                   | C's body-lg for page leads; current site has no lead tier.                                                                                                                                                                                                                                                      |
| Small / xs   | 14px / 12px                            | —               | 14px / 12px caption         | **Keep; adopt C's -0.28px tracking on 14px**   | Sizes agree; C's slight negative tracking on small text is measured and cheap.                                                                                                                                                                                                                                  |
| Buttons      | none (inherits body)                   | —               | 14px w500 md / 16px w500 lg | **14px w500 default, 16px w500 for hero CTAs** | C's button tokens; fills a real gap (buttons currently inherit body weight).                                                                                                                                                                                                                                    |
| Mono         | JetBrains Mono                         | —               | Geist Mono                  | **JetBrains Mono — keep**                      | C's extraction names JetBrains Mono the substitute; already installed for room codes/timers.                                                                                                                                                                                                                    |

### Radius

| Token                 | A — Current                   | B — Dashboard | C — Vercel               | ➡ RECOMMENDED                                          | Rationale                                                                                                                                                                                             |
| --------------------- | ----------------------------- | ------------- | ------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Precision (new)       | none                          | sm **2px**    | xs 4px                   | **Add 2px token** for chips/tags/badges/micro-elements | Handoff: adopt B's "2px radius precision". Tailwind v4 ships a 2px step already — free.                                                                                                               |
| Controls              | md **8px**                    | —             | md 8px                   | **8px — keep**                                         | A and C independently agree; B has no control radius.                                                                                                                                                 |
| Cards                 | lg 12px                       | —             | lg 12px / xl 16px        | **12px cards, 16px for hero-image chrome**             | C's xl slot maps to photo/OG cards.                                                                                                                                                                   |
| Pill (buttons, chips) | **8px** (legacy pill utility) | —             | pill 100px / full 9999px | **`9999px` full round**                                | ⚠ Restyles every button/chip/tag. C uses full-round pills for marketing CTAs; this is the BounceBox gesture (PRD §11) that survives inside the Vercel-minimal frame — the concrete §2/§11 compromise. |

### Spacing

| Token         | A — Current                                      | B — Dashboard           | C — Vercel                                            | ➡ RECOMMENDED                                           | Rationale                                                                                                                                                                        |
| ------------- | ------------------------------------------------ | ----------------------- | ----------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base          | Tailwind default (4px) — implicit, not tokenized | base 8px, scale [16,32] | base 4px, scale [4,8,12,16,24,32,40,48,64,96,128,192] | **4px base, C's 12-step scale, documented in `@theme`** | B's 8px base and [16,32] values are a subset of C's 4px grid — no conflict. Making spacing explicit (currently implicit Tailwind defaults) is the "spacing discipline" adoption. |
| Card padding  | 16px mobile / varies                             | 16                      | md-lg (16-24)                                         | **16px mobile, 24px desktop**                           | C measured.                                                                                                                                                                      |
| Section bands | varies                                           | 32                      | 4xl-5xl (64-96), hero 192                             | **64-96px bands; 192px hero**                           | C's generous-band rhythm is its signature whitespace principle.                                                                                                                  |

### Motion

| Token                         | A — Current               | B — Dashboard        | C — Vercel                   | ➡ RECOMMENDED                                     | Rationale                                                                                                       |
| ----------------------------- | ------------------------- | -------------------- | ---------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Micro (hover/active/checkbox) | 120ms                     | **100ms fast**       | 150ms (measured)             | **100ms ease-out**                                | B's fast token; current 120ms is close — 100ms feels snappier on controls, both fine.                           |
| Standard (cards, reveals)     | 150ms                     | —                    | 150ms ease-in-out (measured) | **150ms ease-out**                                | A and C agree on 150ms; B's ease-out wins the easing (snappier entry than in-out).                              |
| Slow (overlays/panels)        | —                         | —                    | —                            | **300ms ease-out**                                | Needed once 150ms becomes the standard; no source conflicts.                                                    |
| Ambient / celebration         | none                      | **1500ms base-slow** | —                            | **1500ms reserved for celebration/confetti only** | B's base-slow is too slow for UI transitions (perceived lag); it is right for ambient score/celebration motion. |
| Reduced motion                | global kill switch (WCAG) | —                    | —                            | **Keep, mandatory**                               | Already implemented; C ships the same behavior.                                                                 |

### Focus

| Token | A — Current                                 | B — Dashboard | C — Vercel                           | ➡ RECOMMENDED                                                                                          | Rationale                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------------------------------------- | ------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ring  | 2px `#059669`, 2px offset, `:focus-visible` | —             | `--ds-focus-ring` var (measured ref) | **Keep 2px solid ring + 2px offset; add `--color-focus-ring` token: `#10B981` dark / `#047857` light** | ⚠ Contrast math: `#059669` on `#E5E5E5` ≈ **3.0:1** — right at the WCAG 2.2 2.4.11 boundary (3:1); on `#FAFAFA` ≈ 3.6:1. Splitting the ring from `--color-success` and using emerald-700 `#047857` on light gives ≈ **4.4:1** on `#E5E5E5` (~5.5:1 on white). Keep the emerald brand color; fix the light-theme step. Ring radius follows element radius (current 4px outline radius stays). |

### Elevation

| Token            | A — Current                                               | B — Dashboard | C — Vercel                                                               | ➡ RECOMMENDED                                                                                                     | Rationale                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------- | ------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shadows          | single drop shadows (alpha 0.06-0.1 light / 0.4-0.6 dark) | —             | **5-level stacked shadows** (alphas 0.05-0.15) + 1px inset hairline ring | **Adopt C's stacked method: 3 levels (sm/md/lg) + inset hairline ring on light; keep current dark-theme shadows** | C's evidence: stacked low-alpha shadows read as "card sits on the page" without the material-heavy single-drop look — the minimalism the handoff asks for. Dark surfaces need the current higher alphas to read at all. |
| Scrim / overlays | `rgba(0,0,0,0.8)` + `backdrop-blur-sm`                    | —             | —                                                                        | **Keep**                                                                                                          | Already correct; B/C supply nothing better.                                                                                                                                                                             |

## Theme direction: dark-first vs light-first

**Recommendation: flip the default to light-first; dark remains a fully
supported theme (D036 semantic swap, no-FOUC script — architecture
already built for this).**

Evidence:

- Both owner-supplied systems are light-first (B `#e5e5e5`, C `#FAFAFA`);
  the handoff itself says to adopt "Dashboard's `#e5e5e5` light base".
- PRD §2 (Vercel minimal = light) and §11's BounceBox base (`#FFFFFF`)
  are both light; the current dark-first default is a Cloudflare-identity
  artifact (BRANDING.md), not a product requirement.
- The light theme already exists and is verified (`:root.light`, 23 files
  swept to tokens, D036) — flipping the default is a one-line change.

Tokens where this is a **real tradeoff** (all others are pure token swaps):

| Token                                            | Dark-first cost               | Light-first cost                                                                                                           | ➡                                                                                |
| ------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| OG images (19 PNGs, `scripts/generate-og.mjs`)   | match current base, no regen  | dark OG canvas stays (recommended — dark cards pop in light social feeds) OR regen light (~35 KB each, +2-3 s build, D019) | **Keep OG dark either way; no regen needed.** Owner can revisit.                 |
| Game-room islands (drawing canvas, room screens) | naturally suited to dim rooms | light rooms are brighter in dark rooms at parties                                                                          | **Light-first globally; keep dark toggle. Dark game rooms = future owner call.** |
| Drawing canvas itself                            | stays white by design (D036)  | unaffected                                                                                                                 | —                                                                                |
| Orange-on-dark brand look (logo, hero)           | current                       | orange `#F38020` on `#FAFAFA` = ~2.5:1 — needs the existing strong/deep text pattern (already tokenized)                   | Covered by the color matrix.                                                     |
| `color-scheme` / system-preference sync          | default dark, toggle to light | default light, toggle to dark; no-FOUC script handles both                                                                 | Implementation detail, not a risk.                                               |

## Owner decisions

1. **Theme default:** light-first (recommended) or keep dark-first? Everything else in this doc is consistent with light-first; dark stays available either way.
2. **Pill radius:** buttons/chips go full-round (`9999px`)? This is the single most visible restyle (every Button/Chip in the UI kit).
3. **Gradient decoration:** adopt Vercel's mesh gradient pairs as hero/celebration-only tokens, or skip (orange-only)?
4. **Display weight:** h1 at 700 (party energy) vs Vercel's 600 ceiling (calm).
5. **OG images:** confirm keep-dark (recommended, no regen).
6. **Implementation scope:** when approved, this is token-layer-only work in `src/styles/global.css` (`@theme` + `:root.light` swap + `:root.dark` cleanup), per D004's "tokens isolated, restyling is cheap". Components change only where a token was previously hardcoded.

## Pros / Cons of the merged direction

**Pros**

- Every system contributes its strongest, _measured_ evidence: A's brand + a11y system (orange, blue, emerald ring with corrected light step), B's 48px display + 2px precision + fast motion, C's spacing/elevation/gradient discipline.
- Light-first aligns with both owner-supplied systems and both PRD design sections — the §2/§11 contradiction (Open Question #1) gets a concrete resolution.
- Token-layer-only migration; D004/D036 already de-risked it. No new font downloads (perf gate PRD §10 intact).

**Cons**

- Visible restyle: pill radius, h1 36→48px, light default — every page's chrome shifts; Lighthouse/axe re-verification required (PRD §10).
- Three-way provenance makes the token file more complex (every token needs a comment noting its source).
- Rejecting two Vercel specifics (blue-success quirk, 600 display ceiling) means the result is "Vercel-inspired", not "Vercel" — acceptable, but the team should not claim pixel-parity.

## Sources

- `getdesign` capture, 2026-08-05: `npx --yes getdesign@latest add vercel` → `DESIGN.md` (Vercel tokens, typography, spacing, radius, elevation, components). Note: its own description is "an inspired interpretation" — treat as analysis, not Vercel's official token file.
- Live-surface measurement, 2026-08-05 (vercel.com/geist 404 page HTML): button `transition … duration 150ms ease-in-out`, `--ds-focus-ring` variable.
- Owner-supplied Dashboard tokens, handoff 2026-08-05.
- `src/styles/global.css` (current tokens), `docs/BRANDING.md` (identity), `docs/PRD.md` §2/§7/§10/§11/§13, `docs/DECISIONS.md` D004/D019/D036/D045, `docs/PROJECT_STATE.md` Open Question #1.
- WCAG 2.2 criterion 2.4.11 (focus appearance, 3:1); contrast ratios computed with WCAG relative luminance (rounded; verify in axe at M11).

## Risks

- **Contrast math is hand-computed.** The emerald-ring numbers are correct to ~0.1 but must be confirmed by axe/Lighthouse CI (scheduled at M11) before shipping.
- **Restyle churn vs. Lighthouse gates.** Pill + type + theme flip touch all pages; PRD §10 budgets (home 95+, games 90+, <100 KB) must be re-verified. Page weight should improve (no new fonts; light theme has no weight delta).
- **Provenance drift.** Vercel values come from an "inspired interpretation" plus one measured page; if pixel-parity with real Vercel ever matters, re-measure dash.vercel.com. Motion/focus tokens are the thinnest evidence (inferred/marked).
- **Owner vetoes.** Theme direction, pill, and gradient are owner calls; until decided, keep the merge at token layer and do not restyle components.
- **Token sprawl.** A 5-scale color ladder invites drift; mitigate with provenance comments in `global.css` and a "one source per value" rule (no near-duplicate hexes).
