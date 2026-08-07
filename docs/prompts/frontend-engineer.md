**TASK: Fix PlaceGuessr pano not loading on mobile (`src/islands/solo/Placeguessr.tsx`)**

**Symptom:** On mobile devices the Leaflet map renders, but the Mapillary 360° pano never loads. Desktop works. The game is `placeguessr`, mounted `client:load` in `src/pages/game/[slug].astro` (L187).

**Diagnosis (verify each with instrumentation before fixing):**

1. **Hard 20s timeout, no recovery (L191–195):** `setTimeout(..., 20000)` flips `panoStatus` to `'error'` and the round is dead — the viewer instance persists across LOOK→PIN, so a failure in LOOK kills the pano everywhere for that round. On mobile networks the pano tiles (several MB) routinely exceed 20s. Fix: adaptive timeout via `navigator.connection?.effectiveType` (4g→35s, 3g→60s, slow-2g→90s), plus an auto-retry loop — on timeout or `moveTo` rejection, destroy the viewer, reset `panoStatus` to `'loading'`, recreate with backoff (up to 3 attempts), and only then show the error state.
2. **`waitForSize` 10-frame cap (L200–213):** on mobile the container can report 0×0 for longer than ~166ms (URL-bar animation, layout settle). A 0×0 viewer never starts fetching. Fix: wait up to ~2s for a real size; if still 0×0, construct anyway, and on the first ResizeObserver tick with a real size call `viewer.resize()` and re-issue `moveTo` if the pano hasn't loaded.
3. **Error overlay needs a Retry button (L519–527):** add a `Retry` button to the error state that runs the same recreate logic as (1). Also show the _actual_ error reason as small muted text under the message during this fix so the owner can report it from his phone.
4. **WebGL2 check:** log `!!document.createElement('canvas').getContext('webgl2')` at mount. If unsupported (old iOS/Android), show a friendly message instead of the generic error.

**Instrumentation (temporary, remove after root cause confirmed):** console-log at viewer construction — container size (`clientWidth`/`clientHeight`), `moveTo` rejection reason, WebGL2 availability, `navigator.connection?.effectiveType`. Then reproduce on mobile (devtools device emulation + throttled 3G is a good proxy; also test a real phone via `pnpm dev --host`).

**Constraints:** no new dependencies. Leaflet + mapillary-js already approved (D062). Don't touch the map/reveal logic — only the viewer lifecycle, timeout, and error UI. Keep the existing cleanup discipline (viewer.remove() in effect teardown). Run `pnpm verify` before returning; report: root cause confirmed, files changed, retry behavior, and the exact error string you saw under throttling.

**SKILLS TO LOAD:** `vercel-react-best-practices` (effect/ref/cleanup patterns), `astro` (island + `?url` CSS injection context). No other skills needed — this is lifecycle/debug work, not design.

END OF PROMPT
