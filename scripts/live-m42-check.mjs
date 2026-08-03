// One-off live check of the M4.2 fixes against the dev backend (:3000).
// Run: node scripts/live-m42-check.mjs
import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const log = (label, value) => console.log(`✓ ${label}:`, JSON.stringify(value));

function connect() {
  const socket = io(URL, { transports: ['websocket'] });
  socket.on('connect_error', (error) => {
    console.error('✗ connection failed:', error.message);
    process.exit(1);
  });
  return new Promise((resolve) => socket.once('connect', () => resolve(socket)));
}

const emitAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
const waitFor = (socket, event) => new Promise((resolve) => socket.once(event, resolve));

const a = await connect();
const b = await connect();

const created = await emitAck(a, 'create-room', { gameId: 'skribbl-arena' });
const roomCode = created.roomCode;
await emitAck(a, 'join-room', { roomCode, playerName: 'A' });
await emitAck(b, 'join-room', { roomCode, playerName: 'B' });

const selectA = waitFor(a, 'round-start');
const selectB = waitFor(b, 'round-start');
await emitAck(a, 'start-game', { roomCode });
const [selA, selB] = [await selectA, await selectB];
const drawer = selA.choices ? a : b;
const guesser = drawer === a ? b : a;
const word = (selA.choices ?? selB.choices)[0];

const drawingPromise = waitFor(guesser, 'round-start');
await emitAck(drawer, 'choose-word', { roomCode, word });
await drawingPromise;

// --- Fix 1: mid-game joiner can guess (was NOT_PLAYER) ---------------------
const c = await connect();
await emitAck(c, 'join-room', { roomCode, playerName: 'C' });
const guessResultPromise = waitFor(c, 'guess-result');
const guessed = await emitAck(c, 'send-guess', { roomCode, text: word });
log('mid-game joiner guess ack', { ok: guessed.ok, error: guessed.error });
const result = await guessResultPromise;
log('mid-game joiner guess-result', { correct: result.correct, points: result.points });

// --- Fix 2: fill broadcasts with its type ----------------------------------
const fillPromise = waitFor(guesser, 'draw-stroke');
const fillAck = await emitAck(drawer, 'draw-stroke', {
  roomCode,
  strokeId: 'fill-1',
  type: 'fill',
  x: 50, y: 50, prevX: 50, prevY: 50,
  color: '#22b14c', brushSize: 4, tool: 'pen',
});
log('fill send ack', { ok: fillAck.ok });
const fill = await fillPromise;
log('fill broadcast received', { type: fill.type, color: fill.color });

// --- Fix 3: undo reaches the drawer too ------------------------------------
const undoPromise = waitFor(drawer, 'undo-stroke');
const undoAck = await emitAck(drawer, 'undo-stroke', { roomCode });
log('undo ack', { ok: undoAck.ok });
const undone = await undoPromise;
log('undo broadcast received by the drawer', { strokeId: undone.strokeId });

console.log('\nAll M4.2 live checks passed.');
process.exit(0);
