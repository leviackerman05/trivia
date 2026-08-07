// Focused: CPU to move on reload → "CPU thinking" pill then CPU moves.
// Plays e4, reloads inside the 1.8s thinking window, then asserts the pill
// appears on the restored board and the CPU replies.
import { spawn } from 'node:child_process';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9411;
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-extensions',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/chess-cpu-${Date.now()}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);
await sleep(2500);
const res = await fetch(`http://localhost:${PORT}/json`);
const page = (await res.json()).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0,
  pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (m, p = {}) =>
  new Promise((r) => {
    id += 1;
    pending.set(id, r);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });
const ev = async (e) =>
  (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }))
    .result.value;
await send('Page.navigate', { url: 'http://localhost:4321/game/chess' });
await sleep(7000);
// Start Medium White
await ev(
  `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Start game')).click()`
);
await sleep(800);
console.log('start ok');
// Play e4, then IMMEDIATELY reload before CPU reply (within 1.8s window)
await ev(`document.querySelector('button[aria-label="e2, pawn white"]')?.click()`);
await sleep(200);
await ev(`document.querySelector('button[aria-label="e4, empty"]')?.click()`);
console.log('e4 played, reloading during thinking window...');
const snapBefore = await ev(`localStorage.getItem('triviahub:chess:v1')`);
console.log(
  'snapshot before reload:',
  snapBefore ? JSON.parse(snapBefore).history.join(' ') : 'NONE'
);
await sleep(200); // still thinking
await send('Page.reload');

// Poll for the thinking pill immediately after reload (restore is fast).
let thinkingSeen = false,
  thinkingMs = null;
const t0 = Date.now();
while (Date.now() - t0 < 4000) {
  let ok = false,
    thinking = false;
  try {
    thinking = await ev(`document.body.innerText.includes('CPU thinking')`);
    ok = true;
  } catch {
    // Execution context churn during load — retry.
  }
  if (ok && thinking) {
    thinkingSeen = true;
    thinkingMs = Date.now() - t0;
    break;
  }
  await sleep(100);
}
console.log('thinking pill after reload:', thinkingSeen ? `YES (+${thinkingMs}ms)` : 'NO');

// Wait for the CPU reply: snapshot history grows to 2 (e4 + black reply).
let reply;
const replyStart = Date.now();
while (Date.now() - replyStart < 12000) {
  await sleep(300);
  let n = 0;
  try {
    n = await ev(`(() => {
      const s = localStorage.getItem('triviahub:chess:v1');
      return s ? JSON.parse(s).history.length : 0;
    })()`);
  } catch {
    /* context churn */
  }
  if (n >= 2) break;
}
// Read the rendered move list (full panel, not just the header row).
reply = await ev(`(() => {
  const h4 = [...document.querySelectorAll('h4')].find((h) => h.textContent === 'Moves');
  const panel = h4 ? h4.parentElement : null;
  const ol = panel ? panel.querySelector('ol') : null;
  return ol ? ol.innerText : null;
})()`);
console.log(
  'move list after reload:',
  reply ? JSON.stringify(reply.replace(/\n/g, ' | ')) : 'STILL EMPTY'
);

const PASS =
  thinkingSeen && reply !== null && reply.includes('E4') && reply.split('\n').length >= 3;
console.log('\nRESULT:', PASS ? 'PASS — CPU resumed thinking and moved after reload' : 'FAIL');
chrome.kill();
process.exit(PASS ? 0 : 1);
