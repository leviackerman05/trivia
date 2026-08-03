/**
 * Socket.io event contract — client mirror of server/src/lib/events.ts.
 * PRD §8.2 events verbatim plus additive extensions (ARCHITECTURE §12).
 * Lockstep is enforced by src/lib/__tests__/events.contract.test.ts —
 * never edit one side without the other.
 */

export const ClientEvents = {
  // PRD §8.2 — Room System
  createRoom: 'create-room',
  joinRoom: 'join-room',
  leaveRoom: 'leave-room',
  startGame: 'start-game',
  // PRD §8.2 — Drawing
  drawStroke: 'draw-stroke',
  clearCanvas: 'clear-canvas',
  undoStroke: 'undo-stroke',
  // PRD §8.2 — Chat/Guessing
  sendGuess: 'send-guess',
  chatMessage: 'chat-message',
  // PRD §8.2 — Voting
  castVote: 'cast-vote',
  // Additive (M5 — one-line lift penalty + Copycat private drawings)
  strokeLift: 'stroke-lift',
  submitDrawing: 'submit-drawing',
  // Additive (M6 — voting games: player-submitted prompts)
  submitPrompt: 'submit-prompt',
  // Additive (M9 — Charades + Guess Who)
  markCorrect: 'mark-correct',
  askQuestion: 'ask-question',
  answerQuestion: 'answer-question',
  // Additive: rejoin mid-game resync
  gameResync: 'game-resync',
  // Additive (M4 — Skribbl Arena round lifecycle)
  chooseWord: 'choose-word',
  nextRound: 'next-round',
  restartGame: 'restart-game',
  setCustomWords: 'set-custom-words',
  endRoundNow: 'end-round-now',
} as const;

export const ServerEvents = {
  // PRD §8.2 — Room System
  gameStateUpdate: 'game-state-update',
  // PRD §8.2 — Chat/Guessing (echoed)
  chatMessage: 'chat-message',
  // Additive — room lifecycle detail (ARCHITECTURE §12)
  roomCreated: 'room-created',
  playerJoined: 'player-joined',
  playerLeft: 'player-left',
  playerDisconnected: 'player-disconnected',
  playerReconnected: 'player-reconnected',
  hostChanged: 'host-changed',
  roomClosed: 'room-closed',
  // Additive — round lifecycle
  roundStart: 'round-start',
  roundEnd: 'round-end',
  roundReveal: 'round-reveal',
  gameEnd: 'game-end',
  gameRestart: 'game-restart',
  // Additive — drawing (broadcast: strokes/undo/clear echo to the room)
  strokeReplay: 'stroke-replay',
  canvasSnapshot: 'canvas-snapshot',
  drawStroke: 'draw-stroke',
  undoStroke: 'undo-stroke',
  clearCanvas: 'clear-canvas',
  // Additive — guessing
  guessResult: 'guess-result',
  guessFeedback: 'guess-feedback',
  // Additive — round hints (Skribbl Arena: first letter at 30s, last at 45s)
  roundHint: 'round-hint',
  // Additive — voting
  voteUpdate: 'vote-update',
  voteReveal: 'vote-reveal',
  // Additive (M5) — round timer adjustments + Copycat gallery/voting phases
  roundTimer: 'round-timer',
  voteStart: 'vote-start',
  // Additive — errors (typed)
  gameError: 'game-error',
} as const;

export type ClientEventName = (typeof ClientEvents)[keyof typeof ClientEvents];
export type ServerEventName = (typeof ServerEvents)[keyof typeof ServerEvents];
