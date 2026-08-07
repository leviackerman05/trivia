# Chess Redesign — Figma-ready Spec (Piece Art · Board Theme · Move List · Layout · Cleanup)

> Owner: Design Lead · Branch: `design-airbnb` (docs-only, no code)  
> Source files read: `src/islands/solo/Chess.tsx` (675 lines, current `PIECE_PATHS` 32×32 stroke-style), `src/lib/chess.ts` (`toSimpleSAN`), `src/styles/global.css` (Airbnb tokens), `src/islands/solo/SoloShell.tsx`, `src/pages/game/[slug].astro`  
> Status: **SPEC READY — FE implements from this doc** · No production code touched

---

## 0 · Design Read

**Reading this as:** a _premium game surface_ inside an Airbnb-light product (Rausch #ff385c, Ink #222, canvas #fff, Inter, 8px/14px radii). Job: make chess feel like a real Staunton set on a sunlit board — warm, tactile, instantly scannable at 360px. Risk: one memorable move — the solid filled pieces (not stroke icons) that finally make the board feel physical.

**Dial:** `VARIANCE 6 / MOTION 4 / DENSITY 4` — calm, precise, generous whitespace.

---

## 1 · Piece Art (P0) — Solid Staunton Silhouettes, FILLED

### 1.1 Principles

- **Filled, not stroked.** 45×45 viewBox, single solid silhouette. No hand-drawn wobble, no multi-path “sketch” look. Geometry is symmetric (except knight), with 0.6–1.2px corner radii where a real piece has them.
- **House style, filled.** Same silhouette language as `src/lib/icons.ts` (currentColor, `stroke-linejoin: round`) but **filled** — the icon system stays stroke for chrome; pieces are the exception.
- **No emoji, no CDN.** Inline SVG, self-hosted. Org order 8×8 (a1 dark-square convention preserved via `isLight` logic).

### 1.2 Color Treatment (contrast-checked at 360px → 40px pieces on 45px squares)

| Variant   | Fill                   | Stroke                                                                 | Effect                                                                         |
| --------- | ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **White** | `#f7f5ef` (warm paper) | `2px #1f1f1f` outline + `drop-shadow(0 1px 1px rgb(0 0 0 / 0.25))`     | Reads on light `#EEEED2` via dark outline; on dark `#769656` via fill contrast |
| **Black** | `#1f1f1f` (ink)        | `1px #ffffff` highlight + `drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.35))` | Reads on dark via white rim; on light via fill                                 |

**Luminance contrast (WCAG, piece edge vs square):**

| Pair                                                | Ratio                               | Verdict                                       |
| --------------------------------------------------- | ----------------------------------- | --------------------------------------------- |
| White outline `#1f1f1f` on light `#EEEED2` (L 0.84) | ~14:1                               | AAA                                           |
| White outline on dark `#769656` (L 0.26)            | 4.9:1                               | AA (graphics 3:1 ✓)                           |
| Black fill `#1f1f1f` on light `#EEEED2`             | 14:1                                | AAA                                           |
| Black fill on dark `#769656`                        | 4.9:1 + white rim 3.35:1            | AA                                            |
| White fill `#f7f5ef` on dark `#769656`              | 3.07:1 via fill + 4.9:1 via outline | Pass (outline is load-bearing — never remove) |

_Note:_ Alt palette `#f0d9b5` (L 0.72) / `#b58863` (L 0.28) yields the same ≈12:1 / 5.3:1. Either palette passes; pick one, lock it (see §2).

**Sizes:** Piece renders at `80%` of square (current `PieceGlyph` does `width:80% height:80%` — keep). At 360px board → 45px square → 36px piece. Minimum recognizable size: 28px (320px board) — silhouette stays solid, no fine details below 2px.

### 1.3 The 6 Silhouettes (single-path, 45×45)

> **SUPERSEDED (owner feedback 2026-08-08): the hand-drawn shapes below were
> rejected except the pawn — use the Cburnett set instead.** The approved
> pieces live at `public/images/chess/pieces/{w|b}-{k,q,r,b,n,p}.svg`
> (Cburnett cdt45 geometry, site palette baked in, attribution embedded).
> The paths in this section are kept for reference only.
> Deliverable: 12 self-contained SVGs + attribution line. See
> `docs/DESIGN-CHESS.md` §1.4 handoff below.

> Deliverable: 6 base SVGs. White/black are the **same path** with different fill/stroke (see §1.2). Save as `docs/chess-assets/pieces/{k,q,r,b,n,p}.svg` for Figma import; FE inlines via `PieceGlyph` (see §1.4).

#### Pawn — ball head · tapered collar · flared bell · double-tier base

```svg
<!-- pawn.svg — 45×45, single filled silhouette -->
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M22.5 5.2A5.8 5.8 0 0 0 16.7 11A5.8 5.8 0 0 0 20.2 16.2L18.6 19.8L14.2 28.6L12.8 33.2L11.6 36.2L11.6 40.2H33.4V36.2L32.2 33.2L30.8 28.6L26.4 19.8L24.8 16.2A5.8 5.8 0 0 0 28.3 11A5.8 5.8 0 0 0 22.5 5.2Z
           M13.2 36.6H31.8V38.2H13.2Z" fill="currentColor"/>
</svg>
```

_Geometry note:_ Head is a true circle (r 5.8, center 22.5,11). Body is a symmetric trapezoid flaring 14.2→30.8 at the bell, stepping to a 11.6→33.4 plinth. No interior strokes.

#### Rook — 3 crenellations · collar · straight-sided body · plinth

```svg
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13.2 7H17.6V12.2H20.4V7H24.6V12.2H27.4V7H31.8V12.2H32.8V15.2L31.2 30.8L33 34L33 40H12V34L13.8 30.8L12.2 15.2V12.2H13.2ZM14.8 36.4H30.2V38H14.8Z" fill="currentColor"/>
</svg>
```

_Crenellations:_ 3 merlons (4.4w each) with 2.8w embrasures — the classic `██  ██  ██` silhouette. Body is straight with a 0.8px chamfer at the bell.

#### Knight — horse profile facing left (the only asymmetric piece)

```svg
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M30.2 7.2L27.8 5.6L26.2 8.2L24 6L22 9.5L18.2 8.8L15.6 11.2L14.2 15.8L13.6 20.2L15.2 24.6L18.8 28.2L22.4 32L24.6 35.6L24.6 38H32V34.2L30.6 31L32.2 26.2L31.4 20.6L29.2 14.8L28.4 10.2ZM14.8 36.2H30.2V38H14.8Z" fill="currentColor"/>
</svg>
```

_Profile:_ Muzzle left (14.2,15.8), chest swell (18.8,28.2), neck arch (22,9.5 → 24,6 → 27.8,5.6 with two ear notches), rump (32.2,26.2). Simplified from Cburnett/burnett — 7 anchor points, no nostril/mouth micro-detail (would vanish at 36px).

#### Bishop — mitre with central slit + ball finial · collar · bell

```svg
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M22.5 4.2A2.2 2.2 0 1 0 22.5 8.6A2.2 2.2 0 1 0 22.5 4.2ZM20.2 8.8L15.8 14.2L14.2 19.2L18.6 20L26.4 20L30.8 19.2L29.2 14.2L24.8 8.8ZM16.2 21.2H28.8L27.4 24H17.6ZM15.6 25.2H29.4L28 31.4L30 34.2L30 40H15V34.2L17 31.4Z M22 9H23V19H22Z" fill="currentColor" fill-rule="evenodd"/>
</svg>
```

_Mitre:_ Isosceles with ball finial (r 2.2 at 22.5,6.4), vertical slit (22–23,9→19) — the Staunton signature. Body bell matches pawn/rook proportions.

#### Queen — 5-lobed coronet · flared gown · plinth

```svg
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M13.6 12.2L15.2 7.8L17.8 11.2L20.6 6.2L22.5 10.2L24.4 6.2L27.2 11.2L29.8 7.8L31.4 12.2L32 15.2L31 19.2L27.6 20H17.4L14 19.2L13 15.2ZM15.8 21.4H29.2L27.8 24.2H17.2ZM14.6 25.6H30.4L28.6 31.8L30.8 34.6L30.8 40H14.2V34.6L16.4 31.8Z" fill="currentColor"/>
</svg>
```

_Coronet:_ 5 rounded lobes (center lobe tallest) — the “Cburnett simplified to 2D” crown. Gown flare is widest of the set (14.6→30.4) to read as queen vs king.

#### King — cross · stepped crown · cape · plinth

```svg
<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M21.4 3H23.6V5.6H26.2V7.8H23.6V10.4H21.4V7.8H18.8V5.6H21.4ZM14.8 11.2L17.2 8.2H27.8L30.2 11.2L32 15.2L31 19H14L13 15.2ZM15.6 20.2H29.4L28 23H17L15.6 20.2ZM14.8 24.2H30.2L28.4 30.6L30.6 34L30.6 40H14.4V34L16.6 30.6Z" fill="currentColor"/>
</svg>
```

_Cross:_ 2.2w arms, 2px stroke on white variant gives the cross its halo. Crown is a stepped block (not lobed) to contrast with queen.

> **Figma import:** Drop each SVG file on a `#EEEED2` and `#769656` artboard at 45px, duplicate, apply the two fill/stroke treatments, and eyeball at 36px. All six should be instantly distinguishable at a glance.

### 1.4 FE Handoff — `PieceGlyph` Replacement

**SUPERSEDED in part (2026-08-08):** the Cburnett set is now the source of
truth (`public/images/chess/pieces/`). The FE should render the pieces from
the 12 files (inline the file contents or `<img src="/images/chess/pieces/w-k.svg">`),
dropping the hand-drawn `PIECE_PATHS` below. Colors are baked per file; do
NOT apply dynamic fill/stroke on top.

---

_Reference only — old hand-drawn handoff, kept for history:_

**File:** `src/islands/solo/Chess.tsx` `PIECE_PATHS` (L61–68) + `PieceGlyph` (L78–105)

**Current:** Multi-path `PIECE_PATHS` (32×32, sketch style) + `stroke: DARK_FILL 2px` for both colors + `filter: drop-shadow` hack for black’s white rim. Reads childish; fails on light squares without outline.

**Replace with:**

```tsx
// 45×45 single-path silhouettes — same 6 keys, new d values (from §1.3)
const PIECE_PATHS: Record<string, string> = {
  k: 'M21.4 3H23.6V5.6H26.2V7.8H23.6V10.4H21.4V7.8H18.8V5.6H21.4ZM14.8 11.2L17.2 8.2H27.8L30.2 11.2L32 15.2L31 19H14L13 15.2ZM15.6 20.2H29.4L28 23H17L15.6 20.2ZM14.8 24.2H30.2L28.4 30.6L30.6 34L30.6 40H14.4V34L16.6 30.6Z',
  q: 'M13.6 12.2L15.2 7.8L17.8 11.2L20.6 6.2L22.5 10.2L24.4 6.2L27.2 11.2L29.8 7.8L31.4 12.2L32 15.2L31 19.2L27.6 20H17.4L14 19.2L13 15.2ZM15.8 21.4H29.2L27.8 24.2H17.2ZM14.6 25.6H30.4L28.6 31.8L30.8 34.6L30.8 40H14.2V34.6L16.4 31.8Z',
  r: 'M13.2 7H17.6V12.2H20.4V7H24.6V12.2H27.4V7H31.8V12.2H32.8V15.2L31.2 30.8L33 34L33 40H12V34L13.8 30.8L12.2 15.2V12.2H13.2ZM14.8 36.4H30.2V38H14.8Z',
  b: 'M22.5 4.2A2.2 2.2 0 1 0 22.5 8.6A2.2 2.2 0 1 0 22.5 4.2ZM20.2 8.8L15.8 14.2L14.2 19.2L18.6 20L26.4 20L30.8 19.2L29.2 14.2L24.8 8.8ZM16.2 21.2H28.8L27.4 24H17.6ZM15.6 25.2H29.4L28 31.4L30 34.2L30 40H15V34.2L17 31.4Z M22 9H23V19H22Z',
  n: 'M30.2 7.2L27.8 5.6L26.2 8.2L24 6L22 9.5L18.2 8.8L15.6 11.2L14.2 15.8L13.6 20.2L15.2 24.6L18.8 28.2L22.4 32L24.6 35.6L24.6 38H32V34.2L30.6 31L32.2 26.2L31.4 20.6L29.2 14.8L28.4 10.2ZM14.8 36.2H30.2V38H14.8Z',
  p: 'M22.5 5.2A5.8 5.8 0 0 0 16.7 11A5.8 5.8 0 0 0 20.2 16.2L18.6 19.8L14.2 28.6L12.8 33.2L11.6 36.2L11.6 40.2H33.4V36.2L32.2 33.2L30.8 28.6L26.4 19.8L24.8 16.2A5.8 5.8 0 0 0 28.3 11A5.8 5.8 0 0 0 22.5 5.2ZM13.2 36.6H31.8V38.2H13.2Z',
};

function PieceGlyph({ char, isWhite }: { char: string; isWhite: boolean }) {
  const d = PIECE_PATHS[char.toLowerCase()] ?? '';
  return (
    <svg viewBox="0 0 45 45" aria-hidden="true" className="block h-[82%] w-[82%]">
      <path
        d={d}
        fill={isWhite ? '#f7f5ef' : '#1f1f1f'}
        stroke={isWhite ? '#1f1f1f' : '#ffffff'}
        strokeWidth={isWhite ? 1.6 : 1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
```

_Changes vs current:_ 45×45 (was 32), single `<path>` (was multi-path `dangerouslySetInnerHTML`), explicit per-variant stroke (was `stroke: DARK_FILL` for both + filter hack), `82%` of square (was 80% — 1px bump for the tighter silhouette), `vectorEffect="non-scaling-stroke"` so the 1.6/1.1px strokes stay crisp at any board scale. Remove the `filter` entirely.

---

## 2 · Board Theme (P0) — Lighter Than Site Dark, Isolated Card

### 2.1 Tokens (add to `src/styles/global.css` `@theme` or as local CSS vars in `Chess.tsx`)

```css
/* Chess board — isolated light card, never follows :root.dark */
--chess-board-bg: #f7f7f7; /* isolated container, border */
--chess-board-border: rgba(0, 0, 0, 0.12);
--chess-light: #eeeed2; /* primary light square (lichess cream) */
--chess-dark: #769656; /* primary dark square (lichess green) */
--chess-light-alt: #f0d9b5; /* warm alt (chess.com beige) — keep as token, not default */
--chess-dark-alt: #b58863; /* warm alt (chess.com brown) */
--chess-selected: #f6e58d; /* selected square */
--chess-last-move: #cdd26b; /* last-move from/to */
--chess-legal-dot: rgba(0, 0, 0, 0.22); /* quiet move dot */
--chess-capture-ring: rgba(0, 0, 0, 0.45); /* capture ring (outer) */
--chess-check: #ff6b6b; /* king in check — subtle red tint, not Rausch */
```

**Why this palette:** `#EEEED2`/`#769656` is ~2.6:1 square-to-square contrast — high enough to read the board, low enough to keep pieces primary. On a 360px board each square is 45px; the warm alt (`#f0d9b5`/`#b58863`, ~2.1:1) is kept as a user preference token for a future toggle.

### 2.2 Container — Isolated Light Card

The board lives in a light card that **does not flip** in dark mode. Site header/footer stay dark (`--color-surface: #222` etc.); the board card stays `#f7f7f7`.

```tsx
// Outer wrapper — replaces the current bare grid
<div
  className="mx-auto rounded-[14px] border p-2 shadow-sm"
  style={{
    background: 'var(--chess-board-bg, #f7f7f7)',
    borderColor: 'var(--chess-board-border, rgba(0,0,0,0.12))',
    maxWidth: '30rem',
  }}
>
  <div
    role="grid"
    aria-label="Chess board"
    className="grid w-full overflow-hidden rounded-[10px] border"
    style={{
      borderColor: 'rgba(0,0,0,0.12)',
      aspectRatio: '1 / 1',
      gridTemplateColumns: 'repeat(8, minmax(0,1fr))',
      gridTemplateRows: 'repeat(8, minmax(0,1fr))',
    }}
  >
    {/* squares */}
  </div>
</div>
```

_Outer radius 14px (card), inner board 10px — matches site `--radius-lg`/`--radius-md`. Padding `p-2` (8px) gives the board a mat, like a real board frame. In dark mode, add `dark:[--chess-board-bg:#f7f7f7]` (force light) — do not let `dark:` recolor the board._

### 2.3 Square States (priority: selected > last-move > base)

```tsx
style={{
  background: isSelected ? "var(--chess-selected, #f6e58d)"
            : isLastMove ? "var(--chess-last-move, #cdd26b)"
            : isLight ? "var(--chess-light, #EEEED2)"
                      : "var(--chess-dark, #769656)",
}}
```

- **Selected** `#f6e58d` — warm yellow, distinct from both base colors, WCAG-safe with the piece outlines.
- **Last-move** `#cdd26b` — muted olive-yellow, quieter than selected (it’s history, not intent).
- **Hover** (desktop only): `hover:brightness-[0.97]` on light, `hover:brightness-[1.06]` on dark — no extra color, just a 3–6% luminance nudge. Keeps the palette locked.
- **Legal dot** `rgba(0,0,0,0.22)` — 26% of square, centered (`width:26% height:26% border-radius:9999px`). Current is `bg-primary/60` (Rausch) — replace; Rausch on green is muddy and competes with the brand. Capture ring: `inset-0.5 rounded-full border-[3px] border-[rgba(0,0,0,0.45)]` (was `border-primary` — replace).
- **Check:** when `game.inCheck()`, tint the king’s square `background: #ff6b6b / 0.35` (behind the piece) — new, subtle.

### 2.4 Rank/File Labels (optional, Figma-ready)

Outside the board frame, 8px labels: files `a–h` below (centered under each column), ranks `8–1` to the left (centered on each row), `text-[10px] font-medium text-ink-muted tracking-wide`. Keep `aria-hidden` — the board’s `aria-label` already announces squares.

---

## 3 · Move List UX (P1) — Human-Readable by Default

### 3.1 Toggle — Pill [Simple | Notation]

```
Moves                              [ Simple | Notation ]
                                   └─ pill toggle, Simple is default
```

- **Component:** `role="group" aria-label="Move notation"` with two `aria-pressed` buttons inside a `rounded-pill border p-0.5` track (existing markup is close — keep the `border p-0.5` track, just switch to pill).
- **Styling:** Track `bg-surface-muted border-border`; active `bg-white shadow-sm text-ink` (was `bg-surface-muted` — bump to white for contrast); inactive `text-ink-muted hover:text-ink`. `min-h-8` (32px) — compact, not competing with the board.
- **Behavior:** Default `Simple`. Persist to `localStorage` key `triviahub:chess:notation` (read on mount, write on toggle). No URL param — this is a display preference, not shareable state.
- **A11y:** `aria-pressed` on each, `focus-visible:ring-2`.

### 3.2 Table — No. | White | Black, Piece Icons in Cells

Keep the screenshot’s 3-column grid (`2.5rem 1fr 1fr`), but add icons + scannability:

```
┌─────────────────────────────────────────────────┐
│ No. │ White              │ Black               │
├─────┼────────────────────┼─────────────────────┤
│ 1.  │ ♟︎ Pawn to F4       │ ♟︎ Pawn to D5        │
│ 2.  │ ♞ Knight to F3     │ ♝ Bishop to F5      │
│ 3.  │ ♞ Knight captures… │ ♛ Queen to A4 Check │
│ 4.  │ ○ Kingside Castle  │ ♞ Knight to F2#     │
└─────┴────────────────────┴─────────────────────┘
  10px muted  14px semibold + 16px piece icon
```

**Cell rendering (per `history` entry via `game.history()` SAN):**

| SAN     | Simple (via `toSimpleSAN` in `src/lib/chess.ts`) | Icon                      |
| ------- | ------------------------------------------------ | ------------------------- |
| `f4`    | `Pawn to F4`                                     | `p` white/black per mover |
| `Nf3`   | `Knight to F3`                                   | `n`                       |
| `Nxc4`  | `Knight captures C4`                             | `n`                       |
| `Qa4+`  | `Queen to A4 Check`                              | `q`                       |
| `Nf2#`  | `Knight to F2 Checkmate`                         | `n`                       |
| `O-O`   | `Kingside Castle`                                | `k` (king)                |
| `O-O-O` | `Queenside Castle`                               | `k`                       |
| `exd5`  | `Pawn captures D5`                               | `p`                       |
| `e8=Q`  | `Pawn to E8 promotes to Queen`                   | `p` → `q`                 |

_Implementation note:_ `src/lib/chess.ts:toSimpleSAN` already exists and handles `O-O`/`O-O-O`, `x`→captures, `+`→Check, `#`→Checkmate, `=Q`→promotes. FE just needs to map SAN → piece char for the icon: `san[0]` is `KQRBN` or pawn (no letter); `O-O` maps to `k`. Render `<PieceGlyph char={iconChar} isWhite={moveIndex % 2 === 0 ? playerColorIsWhite : !playerColorIsWhite} size={14} />` — 14px icon, `text-ink` adjacent.

**Styling per cell:**

- Piece icon: 14×14, `flex-shrink-0`, same fill/stroke as board pieces but at `strokeWidth 1.2` (smaller scale).
- Text: `text-small font-medium text-ink` (was `font-semibold` — soften to medium for the longer Simple phrases).
- Row: `min-h-8` (32px) with `hover:bg-surface-muted/60` for scan.
- Number column: `text-xs font-medium text-ink-muted tabular-nums` — muted, not competing.

**Scrolling:** Move list container `max-h-64` (16rem) + `overflow-y-auto overscroll-contain` on desktop; on mobile it’s the only scrollable region in the side panel (board never scrolls). Auto-scroll to bottom on new move (`ref.scrollTop = ref.scrollHeight`).

### 3.3 Empty State

```
┌─────────────────────────────────┐
│  ♔                               │
│  No moves yet                   │
│  Your move — play white.        │  ← or "The CPU opens as white."
│  Tap a piece to see legal moves │
└─────────────────────────────────┘
```

- Centered, `py-8`, icon 32px `text-ink-muted` (use the king glyph at 32px, `opacity-40`), title `text-small font-semibold`, body `text-xs text-ink-muted`.
- Current empty state (`history.length===0 ? "Your move…" : …`) is close — just add the king icon + the hint line.

---

## 4 · Layout (P0) — One Viewport, No Scroll

### 4.1 Constraints

- Board + side panel must fit in **one viewport without scroll** on desktop (≥1024px) and **rematch must be visible without scrolling** on mobile.
- **48px touch targets** everywhere (board squares are 45–60px — pass; buttons are `min-h-12`).
- No layout shift on `Resign` → `Rematch` morph (same spot, same size).

### 4.2 Desktop — 2-Col Grid (board left, controls right ~340px)

```
┌──────────────────────────────────────────────────────────────────┐
│ [Chess] [Difficulty: Medium] [You play white] [Check!] [CPU…]   │ ← header pills (see §5)
├──────────────────────────────────┬───────────────────────────────┤
│                                  │  Resign  →  Rematch →         │ ← morphing primary action (same spot)
│   ┌──────────────────────────┐   │  ───────────────────────────  │
│   │                          │   │  Moves   [Simple|Notation]  │
│   │       Chess Board        │   │  ┌─────────────────────────┐ │
│   │       30rem max          │   │  │ 1. Pawn to F4  Pawn…   │ │
│   │       1:1, isolated      │   │  │ 2. Knight…     Bishop… │ │
│   │       light card         │   │  │ 3. …                      │ │
│   │       #f7f7f7 mat        │   │  │ (max-h-64, scroll)        │ │
│   │                          │   │  └─────────────────────────┘ │
│   └──────────────────────────┘   │                               │
│   [Promote to: Q R B N]          │  [New game]  Engine: Stock…  │
└──────────────────────────────────┴───────────────────────────────┘
  minmax(0,1fr)                      340px
  gap-6
```

**Spec:**

```css
.pb-chess-layout {
  display: grid;
  gap: 1.5rem; /* 24px */
}
@media (min-width: 1024px) {
  .pb-chess-layout {
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
  }
}
.pb-chess-moves {
  max-height: 20rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.pb-chess-root.pb-chess-fit {
  min-height: calc(100dvh - 80px - 3rem);
}
/* 80px nav + 3rem page padding — fills viewport, no scroll */
```

- Board column: `min-w-0 flex-1`, board `maxWidth: 30rem` (480px), centered in its column (`mx-auto`). At 1280px viewport: board 480 + gap 24 + panel 340 = 844, leaving 436 for gutters — comfortable.
- Side panel: `w-[340px]` (was `lg:w-56` / 224px — too narrow for Simple phrases like "Knight captures C4"). 340px fits the longest Simple string without wrapping at `text-small`.
- **Figma:** Artboard 1280×800, board frame 480×480 at (80, 160), panel 340×480 at (860, 160), header pills at (80, 104), gap 24.

### 4.3 Mobile — Stacked, Rematch Sticky

```
┌─────────────────────────┐
│ [Chess] [Difficulty…]   │  ← header pills wrap
│ [You play…] [Check!]    │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │                     │ │
│ │   Chess Board       │ │  ← full width, max 30rem, centered
│ │   1:1               │ │
│ │                     │ │
│ └─────────────────────┘ │
│ [Promote to: Q R B N]   │  ← appears below board when active
├─────────────────────────┤
│ Resign  →  Rematch →    │  ← STICKY BOTTOM BAR (see below)
├─────────────────────────┤
│ Moves  [Simple|Notation]│
│ 1. Pawn to F4  Pawn…   │
│ 2. Knight…              │  ← scrollable, max-h-56
└─────────────────────────┘
```

**Sticky morph bar (mobile):**

The `Resign` → `Rematch` control lives in a **sticky bottom bar** on mobile so it’s always visible without scrolling (mirrors `RoomLobbyPanel`’s `fixed inset-x-0 bottom-14` pattern already in the codebase).

```tsx
<div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80 lg:static lg:z-auto lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
  {phase === 'playing' ? (
    <button
      onClick={resign}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-pill border border-danger px-6 text-small font-semibold text-danger-strong hover:bg-danger-soft lg:w-auto"
    >
      Resign
    </button>
  ) : result ? (
    <button
      onClick={start}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-primary px-6 text-small font-semibold text-white hover:bg-primary-hover lg:w-auto"
    >
      Rematch{' '}
      <span aria-hidden className="ml-1">
        →
      </span>
    </button>
  ) : null}
</div>
```

- **Morph, not replace:** Same DOM spot (`flex items-center justify-between` in the side panel on desktop; sticky bar on mobile), same `min-h-12`, same horizontal padding. On `phase: 'done'` the button’s label, variant, and `onClick` swap — no layout shift, no scroll jump.
- **Desktop:** The sticky wrapper collapses to `lg:static` — the button sits at the top of the side panel (first element, above Moves), exactly where `Resign` was.
- **Figma mobile:** Artboard 390×844 (iPhone 14), board 358×358 (16px gutters), sticky bar 390×64 at bottom (above tab bar if present), board-to-bar gap 16.

### 4.4 Promotion UX (unchanged, but re-styled)

Promotion dialog stays `mt-3 flex items-center justify-center gap-2 rounded-lg border bg-surface-raised p-3` below the board. Piece buttons `h-14 w-14` with the **new** `PieceGlyph` (so the queen option actually looks like a queen). No change to logic.

---

## 5 · System Cleanup (P1)

### 5.1 Remove the Top “Solo Game” Chip

**Current:** Two places render a redundant “solo game” label:

1. `src/pages/game/[slug].astro:110` — `{game.family} game` Chip (renders “solo game” for chess)
2. `src/islands/solo/SoloShell.tsx:167` — `{name}` pill (`bg-primary/20`) + `src/islands/solo/Chess.tsx:470` — `Chess` pill (duplicate of the page `<h1>Chess</h1>`)

**Spec:**

| File                        | Current                                          | Replace With                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `game/[slug].astro:108–112` | `<Chip>{game.family} game</Chip>` for every game | **Chess page:** hide it (`{game.slug !== 'chess' && <Chip>…}`) — already done in the live file. **Site-wide (all solo pages):** replace with D10 metadata row: `1 player · 20 min · Low energy` (from `games.json` `players`/`durationMinutes`/`energy`), rendered as `text-xs text-ink-muted` with `·` separators — the same row used on cards. This is subtler than a pill and carries real information. |
| `SoloShell.tsx:166–169`     | `<span class="bg-primary/20">{name}</span>`      | **Remove.** The page `<h1>` already says the name. Keep only functional pills: `Round x of y` + `Score` + `Streak`. Saves 44px of vertical space and kills the “solo game chips are everywhere” complaint.                                                                                                                                                                                                 |
| `Chess.tsx:469–472`         | `<span>Chess</span>` pill                        | **Remove.** Same reason — page `<h1>` is “Chess”. The header becomes: `Difficulty: Medium` + `You play white` + `Check!`/`CPU thinking…` — all functional.                                                                                                                                                                                                                                                 |

_If the owner wants to keep a family indicator, use the D10 metadata row instead of a pill — never a “solo game” pill._

### 5.2 Difficulty Label — `Medium (800-1200)` → `Difficulty: Medium`

**File:** `src/islands/solo/Chess.tsx:474` + setup buttons `DIFFICULTY` table (L34–41) + `SoloShell` not affected

**Current:**

```tsx
<span>
  Difficulty: {DIFFICULTY[difficulty].label} ({DIFFICULTY[difficulty].rating})
</span>
// setup: {DIFFICULTY[level].label} + <span>{DIFFICULTY[level].rating}</span>
```

**Replace with:**

```tsx
// Header pill (playing):
<span>Difficulty: {DIFFICULTY[difficulty].label}</span>
// Setup buttons: just the label, no rating subline
<button>{DIFFICULTY[level].label}</button>
// Keep DIFFICULTY[].rating in data for a future tooltip/detail, but never render it.
// “No points shown” — the rating bands (200-600 etc.) are internal tuning, not user-facing.
```

**Setup card copy (keep):** “A full game of chess against Stockfish. Pick a level and a color…” — no change.

### 5.3 “No Points Shown” — Global

Audit: `SoloShell` shows `Score: {score}` — chess does **not** use `SoloShell` (it has its own header), so no score pill appears. Ensure no other chess surface renders a points/score number. The only numeric display is the move number (`1.`, `2.`) and the board coordinates — both are chess-native, not “points.”

---

## 6 · Tokens & Tailwind Mapping

Add to `src/styles/global.css` `@theme` or as scoped vars in `Chess.tsx` `<style>`:

```css
--chess-light: #eeeed2;
--chess-dark: #769656;
--chess-selected: #f6e58d;
--chess-last: #cdd26b;
--chess-dot: rgba(0, 0, 0, 0.22);
--chess-ring: rgba(0, 0, 0, 0.45);
--chess-board-bg: #f7f7f7;
--chess-board-border: rgba(0, 0, 0, 0.12);
--chess-check: rgba(255, 107, 107, 0.35);
```

**Dark-mode isolation:** The board card keeps `background: #f7f7f7` even when `html.dark` is set. Do not recolor squares in dark mode — the board is a physical object, not chrome. Header/footer and side panel (Moves, buttons) **do** follow `dark:` tokens.

---

## 7 · Wireframes (Figma-ready)

### Desktop 1280×800

```
 0                                                          1280
 ┌────────────────────────────────────────────────────────────┐
 │ Nav 80px · Trivia & Games · Daily · Games · Leaderboard   │  0-80
 ├────────────────────────────────────────────────────────────┤
 │                                                            │
 │  Chess                                    1 player · 20 min · Low energy  104
 │  Full chess against the CPU…                               136
 │                                                            │
 │  [Difficulty: Medium] [You play white] [Check!]            168
 │                                                            │
 │  ┌─────────────────────┐    ┌──────────────────────────┐   │  200
 │  │                     │    │ Resign  →  Rematch →     │   │
 │  │   Board 480×480     │ 24 │ ──────────────────────── │   │
 │  │   #f7f7f7 mat +     │    │ Moves  [Simple|Notation] │   │
 │  │   #EEEED2/#769656   │    │ 1. Pawn to F4  Pawn…    │   │
 │  │   rounded 10px      │    │ 2. Knight…     …         │   │
 │  │                     │    │ (scroll, max-h-80)       │   │
 │  └─────────────────────┘    │                          │   │  680
 │  [Promote to: Q R B N]      │ [New game]  Engine: …    │   │
 │                                                            │
 └────────────────────────────────────────────────────────────┘
   80      480        24  340              80
```

### Mobile 390×844

```
 0           390
┌─────────────────────┐
│ Nav 56px            │ 0-56
├─────────────────────┤
│ Chess               │ 72
│ 1 player · 20 min   │ 96
│ [Difficulty: Medium]│ 120
│ [You play white]    │ 148
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ Board 358×358   │ │ 164
│ │                 │ │ 522
│ └─────────────────┘ │
│ [Promote to: Q R B] │ 538
├─────────────────────┤  ← sticky bottom bar (z-10)
│ [  Resign  →  Rematch →  ] │  56px tall, always visible
├─────────────────────┤
│ Moves [Simple|Notation] │
│ 1. Pawn to F4  …   │  scroll
│ 2. Knight…         │
└─────────────────────┘
```

---

## 8 · Handoff Checklist (for FE)

- [ ] Replace `PIECE_PATHS` + `PieceGlyph` in `Chess.tsx:61–105` with §1.4 (45×45, single-path, per-variant stroke)
- [ ] Add board tokens (§6) and isolated card wrapper (§2.2) — `board` grid keeps `role="grid"`, squares keep `role="gridcell"` + `aria-label`
- [ ] Swap square `background` logic to `isSelected ? #f6e58d : isLastMove ? #cdd26b : isLight ? #EEEED2 : #769656` (§2.3); legal dot to `rgba(0,0,0,0.22)`, capture ring to `rgba(0,0,0,0.45)`
- [ ] Move list: add `notation` state + pill toggle + `toSimpleSAN` mapping + piece icons per cell (§3.2); empty state with king icon (§3.3); `max-h-64 overflow-y-auto`
- [ ] Layout: `pb-chess-layout` 1fr/340px grid + `pb-chess-fit` viewport fill (§4.2); sticky morph bar for Resign→Rematch (§4.3)
- [ ] Cleanup: hide/remove “Chess”/“solo game” pills (§5.1), `Difficulty: Medium` label (§5.2), no rating subline
- [ ] Keep `touch-action: manipulation`, `overscroll-behavior: contain`, `focus-visible:ring-2`, reduce-motion (existing `@media` in global.css)

---

## 9 · QA — What “Done” Looks Like

- [ ] All 12 piece variants (6×2) render crisp at 28px, 36px, and 56px on both square colors — no halo, no mud
- [ ] Board mat `#f7f7f7` stays light in dark mode; header/footer stay dark
- [ ] No layout shift when `Resign` morphs to `Rematch →` (same `min-h-12`, same spot)
- [ ] Move list Simple toggle defaults to Simple, persists, shows “Pawn to F4” not “f4”, with 14px piece icons; Notation shows raw SAN
- [ ] Mobile: board + Resign/Rematch visible without scrolling on first paint (390×844, 360px board)
- [ ] No “solo game” chip on chess; no `800-1200` text anywhere on the page
- [ ] Axe: no new violations (board buttons keep `aria-label`, toggle has `role="group"` + `aria-pressed`)

---

_End — FE owns implementation, Design owns the next review (read the code + preview URL, cite files, never guess)._
