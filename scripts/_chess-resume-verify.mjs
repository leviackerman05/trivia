// Headless: Chess Resume After Refresh — all 6 steps, both widths.
// Uses CDP directly (same harness as .chess-qa/render.mjs).
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const { spawn } = await import('node:child_process');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(width, height) {
  const port = 9300 + (width === 390 ? 1 : 2);
  const userDir = `/tmp/chess-resume-${width}-${Date.now()}`;
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-extensions',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  await sleep(2200);
  const res = await fetch(`http://localhost:${port}/json`);
  const page = (await res.json()).find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0,
    pending = new Map();
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      id += 1;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const ev = async (expr) =>
    (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))
      .result.value;
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: width === 390,
  });
  return { chrome, send, ev, port, ws };
}

function assert(name, ok, extra) {
  console.log((ok ? 'PASS' : 'FAIL') + ': ' + name + (extra ? ' — ' + extra : ''));
  if (!ok) process.exitCode = 1;
}

// Full Moves panel text lives in the panel container: the <ol> rows are a
// sibling of the h4's header row, so read h4.parentElement.parentElement.

async function probe(h) {
  return h.ev(`(() => {
    const t = document.body.innerText;
    const board = document.querySelector('[role="grid"]');
    const panel = (() => { const h4 = [...document.querySelectorAll('h4')].find((x) => x.textContent === 'Moves'); return h4 ? h4.parentElement.innerText : null; })();
    const difficulty = ([...document.querySelectorAll('span')].find((s) => s.textContent.startsWith('Difficulty:')) || {}).textContent || null;
    const hasSoloChip = document.body.innerText.includes(' solo game');
    const startScreen = t.includes('Start game') && !board;
    const rematch = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Rematch');
    const resign = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Resign');
    const remRect = rematch ? rematch.getBoundingClientRect() : null;
    const resRect = resign ? resign.getBoundingClientRect() : null;
    const vis = (r) => r && r.height > 0;
    const snap = (() => { try { const v = localStorage.getItem('triviahub:chess:v1'); if (!v) return null; const j = JSON.parse(v); return j.fen?.slice(0, 24) + '|' + j.history?.length + '|' + j.difficulty + '|' + j.phase; } catch { return 'bad'; } })();
    return { startScreen, board: Boolean(board), difficulty, hasSoloChip, rematchInView: Boolean(vis(remRect)), resignInView: Boolean(vis(resRect)), remRectTop: remRect ? Math.round(remRect.top) : null, scrollY: Math.round(window.scrollY), innerH: window.innerHeight, snap, movesDigest: (panel || '').replace(/\\s+/g, ' ') };
  })()`);
}

async function nav(h, url, wait = 6500) {
  await h.send('Page.navigate', { url });
  await sleep(wait);
}

// Poll body text for the "CPU thinking" pill right after a reload.
async function waitThinkingPill(h, timeoutMs = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    let ok = false,
      thinking = false;
    try {
      thinking = await h.ev(`document.body.innerText.includes('CPU thinking')`);
      ok = true;
    } catch {
      /* execution context churn during load */
    }
    if (ok && thinking) return Date.now() - t0;
    await sleep(100);
  }
  return null;
}

// Wait until the saved snapshot's history grows to the target ply count.
async function waitHistory(h, plies, timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const n = await h.ev(
        `(() => { const s = localStorage.getItem('triviahub:chess:v1'); return s ? JSON.parse(s).history.length : 0; })()`
      );
      if (n >= plies) return n;
    } catch {
      /* context churn */
    }
    await sleep(300);
  }
  return null;
}

for (const width of [390, 1440]) {
  console.log('\n========== ' + width + 'x' + (width === 390 ? 844 : 900) + ' ==========');
  const h = await launch(width, width === 390 ? 844 : 900);
  await nav(h, 'http://localhost:4321/game/chess');
  // First width starts clean; second width should also resume a saved game —
  // but keep a clean slate for a predictable Step 1 (clear both widths).
  await h.ev(`localStorage.removeItem('triviahub:chess:v1');`);
  await h.send('Page.reload');
  await sleep(7000);

  // --- Step 1: Start Medium, white, e4, Nf3, wait for both CPU replies ---
  console.log('\n[Step 1] start Medium/White, e4 / Nf3');
  await h.ev(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Start game')).click()`
  );
  await sleep(900);
  await h.ev(`document.querySelector('button[aria-label="e2, pawn white"]').click()`);
  await sleep(300);
  await h.ev(`document.querySelector('button[aria-label="e4, empty"]').click()`);
  await waitHistory(h, 2); // CPU reply to e4 (engine WASM latency varies)
  await h.ev(`document.querySelector('button[aria-label="g1, knight white"]').click()`);
  await sleep(300);
  await h.ev(`document.querySelector('button[aria-label="f3, empty"]').click()`);
  await waitHistory(h, 4); // CPU reply to Nf3
  let p = await probe(h);
  console.log(' after Nf3:', JSON.stringify(p).slice(0, 400));
  const fenAfterNf3 = p.snap;
  const movesAfterNf3 = p.movesDigest;
  assert(
    width + ': Step1 moves show e4 and Nf3',
    p.movesDigest.includes('E4') && p.movesDigest.includes('F3'),
    p.movesDigest.slice(0, 160)
  );

  // --- Step 2: Refresh → same board, same Moves, Difficulty: Medium, no chip ---
  console.log('\n[Step 2] refresh');
  await h.send('Page.reload');
  await sleep(8000);
  let q = await probe(h);
  console.log(' after reload:', JSON.stringify(q).slice(0, 400));
  assert(width + ': refresh keeps board', q.board && !q.startScreen);
  assert(
    width + ': refresh keeps Moves',
    q.movesDigest === movesAfterNf3,
    `before="${movesAfterNf3.slice(0, 160)}" after="${q.movesDigest.slice(0, 160)}"`
  );
  assert(width + ': refresh keeps Difficulty: Medium', q.difficulty === 'Difficulty: Medium');
  assert(width + ': no solo game chip', !q.hasSoloChip);
  const fen2 = q.snap;
  assert(width + ': refresh keeps FEN/history/difficulty', fen2 === fenAfterNf3);

  // --- Step 3: reload while CPU to move → 1.8s thinking pill then CPU moves ---
  // After Step 2 it's the player's turn, so make a move and reload inside the
  // thinking window to force the CPU-to-move-on-reload case.
  console.log('\n[Step 3] reload during CPU thinking');
  await h.ev(`document.querySelector('button[aria-label="b1, knight white"]').click()`);
  await sleep(300);
  await h.ev(`document.querySelector('button[aria-label="c3, empty"]').click()`);
  await sleep(300); // still inside the 1.8s thinking beat
  await h.send('Page.reload');
  const thinkingMs = await waitThinkingPill(h);
  console.log(
    ' thinking pill after reload:',
    thinkingMs !== null ? `YES (+${thinkingMs}ms)` : 'NO'
  );
  const plies = await waitHistory(h, 6); // 1.e4 r1 2.Nf3 r2 3.Nc3 r3 = 6 plies
  await sleep(1000);
  const afterCpu = await probe(h);
  console.log(
    ' after CPU reply:',
    JSON.stringify({ plies, moves: afterCpu.movesDigest.slice(0, 160) })
  );
  assert(width + ': CPU thinking pill after reload', thinkingMs !== null);
  assert(
    width + ': CPU moved after reload',
    plies !== null && plies >= 6 && afterCpu.movesDigest.includes('C3'),
    `plies=${plies}`
  );
  assert(width + ': still not start screen', !afterCpu.startScreen);

  // --- Step 4: resign → refresh → game-over + Rematch in place ---
  console.log('\n[Step 4] resign → refresh → game-over + Rematch');
  const beforeResign = await probe(h);
  const remTopBefore = beforeResign.remRectTop;
  const resignBtn = await h.ev(
    `Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Resign'))`
  );
  if (resignBtn) {
    await h.ev(
      `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Resign').click()`
    );
    await sleep(700);
  }
  const beforeOver = await probe(h);
  console.log(' before refresh game-over:', JSON.stringify(beforeOver).slice(0, 400));
  await h.send('Page.reload');
  await sleep(8000);
  const afterOverReload = await probe(h);
  console.log(' after refresh game-over:', JSON.stringify(afterOverReload).slice(0, 400));
  assert(
    width + ': game-over persists after refresh',
    !afterOverReload.startScreen && !afterOverReload.resignInView && afterOverReload.rematchInView
  );
  const resignedShown = await h.ev(`document.body.innerText.includes('You resigned')`);
  assert(width + ': game-over text shown', resignedShown);
  if (afterOverReload.remRectTop !== null && remTopBefore !== null) {
    const drift = Math.abs(afterOverReload.remRectTop - remTopBefore);
    console.log('  Rematch top drift:', drift, drift < 8 ? 'PASS' : 'FAIL drift > 8');
  }
  console.log(
    '  Rematch no-scroll:',
    afterOverReload.remRectTop !== null && afterOverReload.remRectTop < afterOverReload.innerH
      ? 'PASS'
      : 'FAIL'
  );

  // --- Step 5: Rematch → new board, refresh → new board persists (not old) ---
  console.log('\n[Step 5] Rematch');
  await h.ev(
    `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Rematch').click()`
  );
  await sleep(900);
  const afterRematch = await probe(h);
  console.log(' after rematch:', JSON.stringify(afterRematch).slice(0, 300));
  await h.send('Page.reload');
  await sleep(7500);
  const afterRematchReload = await probe(h);
  console.log(' after rematch+reload:', JSON.stringify(afterRematchReload).slice(0, 300));
  const rematchFenDiffers =
    afterRematchReload.snap !== null &&
    afterRematchReload.snap !== fenAfterNf3 &&
    afterRematchReload.board;
  assert(
    width + ': Rematch new board persists (not old)',
    rematchFenDiffers,
    `snap="${afterRematchReload.snap}"`
  );

  // --- Step 6: clear key → refresh → start screen ---
  console.log('\n[Step 6] clear storage');
  await h.ev(`localStorage.removeItem('triviahub:chess:v1');`);
  await h.send('Page.reload');
  await sleep(7500);
  const afterClear = await probe(h);
  console.log(' after clear+reload:', JSON.stringify(afterClear).slice(0, 300));
  assert(width + ': clear → start screen', afterClear.startScreen);

  h.chrome.kill();
  await sleep(800);
  if (process.exitCode) break;
}
setTimeout(() => process.exit(process.exitCode || 0), 1000);
