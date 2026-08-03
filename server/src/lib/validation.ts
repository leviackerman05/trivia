/**
 * Hand-rolled validation helpers (M1 scaffold; ARCHITECTURE §13 — every
 * inbound boundary validates). Kept dependency-free by design.
 */

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const NICKNAME_MAX_LENGTH = 20;
export const CHAT_MESSAGE_MAX_LENGTH = 300;

/** Strip ASCII control characters (PRD §13 — sanitize nicknames/messages). */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, '');
}

export function sanitizeNickname(input: unknown): ValidationResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, error: 'nickname must be a string' };
  }
  const trimmed = stripControlChars(input).trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'nickname cannot be empty' };
  }
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `nickname must be at most ${NICKNAME_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

export function sanitizeChatMessage(input: unknown): ValidationResult<string> {
  if (typeof input !== 'string') {
    return { ok: false, error: 'message must be a string' };
  }
  const trimmed = stripControlChars(input).trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'message cannot be empty' };
  }
  if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) {
    return {
      ok: false,
      error: `message must be at most ${CHAT_MESSAGE_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

/** Room codes are 6-character alphanumeric, case-insensitive (PRD §4.1). */
export function isRoomCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]{6}$/i.test(value);
}

/** gameId is a game slug from the catalog (short, safe). */
export function isGameId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

const MAX_SCORE = 1_000_000;
const CLIENT_KEY_MAX_LENGTH = 128;

function isClientKey(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= CLIENT_KEY_MAX_LENGTH &&
    /^[A-Za-z0-9._:-]+$/.test(value)
  );
}

export interface ScoreInput {
  gameId: string;
  playerName: string;
  score: number;
  /** Idempotency key: client-generated once per completed game (M3). */
  clientKey?: string;
}

/** PRD §8.1: POST /api/scores body { gameId, playerName, score }. */
export function validateScoreInput(input: unknown): ValidationResult<ScoreInput> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'body must be an object' };
  }
  const { gameId, playerName, score, clientKey } = input as Record<string, unknown>;

  if (!isGameId(gameId)) {
    return { ok: false, error: 'invalid gameId' };
  }
  const name = sanitizeNickname(playerName);
  if (!name.ok) {
    return name;
  }
  if (typeof score !== 'number' || !Number.isFinite(score) || !Number.isInteger(score)) {
    return { ok: false, error: 'score must be an integer' };
  }
  if (score < 0 || score > MAX_SCORE) {
    return { ok: false, error: `score must be between 0 and ${MAX_SCORE}` };
  }
  if (clientKey !== undefined && !isClientKey(clientKey)) {
    return { ok: false, error: 'invalid clientKey' };
  }
  return { ok: true, value: { gameId, playerName: name.value, score, clientKey } };
}

export interface RoomCreateInput {
  gameId: string;
}

/** PRD §8.1: POST /api/room/create body { gameId }. */
export function validateRoomCreateInput(input: unknown): ValidationResult<RoomCreateInput> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'body must be an object' };
  }
  const { gameId } = input as Record<string, unknown>;
  if (!isGameId(gameId)) {
    return { ok: false, error: 'invalid gameId' };
  }
  return { ok: true, value: { gameId } };
}

export interface JoinRoomInput {
  roomCode: string;
  playerName: string;
}

/** PRD §8.2: join-room payload { roomCode, playerName }. */
export function validateJoinRoomInput(input: unknown): ValidationResult<JoinRoomInput> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'payload must be an object' };
  }
  const { roomCode, playerName } = input as Record<string, unknown>;
  if (!isRoomCode(roomCode)) {
    return { ok: false, error: 'invalid room code' };
  }
  const name = sanitizeNickname(playerName);
  if (!name.ok) {
    return name;
  }
  return { ok: true, value: { roomCode, playerName: name.value } };
}

/** Payloads that only carry a room code (clear-canvas, undo-stroke, resync…). */
export interface RoomCodeInput {
  roomCode: string;
}

export function validateRoomCodeInput(input: unknown): ValidationResult<RoomCodeInput> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'payload must be an object' };
  }
  const { roomCode } = input as Record<string, unknown>;
  if (!isRoomCode(roomCode)) {
    return { ok: false, error: 'invalid room code' };
  }
  return { ok: true, value: { roomCode } };
}

const STROKE_ID_MAX_LENGTH = 64;
const STROKE_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** PRD §8.2 draw-stroke payload + additive strokeId/type (M4). */
export function validateStrokePayload(input: unknown): ValidationResult<{
  strokeId: string;
  type: 'pen' | 'fill';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  color: string;
  brushSize: number;
  tool: 'pen' | 'eraser';
}> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'payload must be an object' };
  }
  const { strokeId, type, x, y, prevX, prevY, color, brushSize, tool } = input as Record<
    string,
    unknown
  >;
  if (
    typeof strokeId !== 'string' ||
    strokeId.length === 0 ||
    strokeId.length > STROKE_ID_MAX_LENGTH
  ) {
    return { ok: false, error: 'invalid strokeId' };
  }
  // Additive: "fill" flood-fills the region at (x, y); segment fields are
  // still required so every log entry has a stable shape.
  const strokeType = type === 'fill' ? 'fill' : type === undefined ? 'pen' : null;
  if (strokeType === null) {
    return { ok: false, error: 'invalid stroke type' };
  }
  for (const value of [x, y, prevX, prevY]) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { ok: false, error: 'stroke coordinates must be finite numbers' };
    }
  }
  if (typeof color !== 'string' || !STROKE_COLOR_PATTERN.test(color)) {
    return { ok: false, error: 'invalid stroke color' };
  }
  if (
    typeof brushSize !== 'number' ||
    !Number.isFinite(brushSize) ||
    brushSize < 1 ||
    brushSize > 60
  ) {
    return { ok: false, error: 'invalid brush size' };
  }
  if (tool !== 'pen' && tool !== 'eraser') {
    return { ok: false, error: 'invalid tool' };
  }
  return {
    ok: true,
    value: {
      strokeId,
      type: strokeType,
      x: x as number,
      y: y as number,
      prevX: prevX as number,
      prevY: prevY as number,
      color,
      brushSize,
      tool,
    },
  };
}

const GUESS_MAX_LENGTH = 60;

/** PRD §8.2 send-guess payload { roomCode, text }. */
export function validateGuessInput(
  input: unknown
): ValidationResult<{ roomCode: string; text: string }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'payload must be an object' };
  }
  const { roomCode, text } = input as Record<string, unknown>;
  if (!isRoomCode(roomCode)) {
    return { ok: false, error: 'invalid room code' };
  }
  if (typeof text !== 'string') {
    return { ok: false, error: 'text must be a string' };
  }
  const trimmed = stripControlChars(text).trim();
  if (trimmed.length === 0 || trimmed.length > GUESS_MAX_LENGTH) {
    return { ok: false, error: 'guess must be 1–60 characters' };
  }
  return { ok: true, value: { roomCode, text: trimmed } };
}

/** M4 additive choose-word payload { roomCode, word }. */
export function validateChooseWordInput(
  input: unknown
): ValidationResult<{ roomCode: string; word: string }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'payload must be an object' };
  }
  const { roomCode, word } = input as Record<string, unknown>;
  if (!isRoomCode(roomCode)) {
    return { ok: false, error: 'invalid room code' };
  }
  if (typeof word !== 'string') {
    return { ok: false, error: 'word must be a string' };
  }
  const trimmed = stripControlChars(word).trim();
  if (trimmed.length === 0 || trimmed.length > 24) {
    return { ok: false, error: 'word must be 1–24 characters' };
  }
  return { ok: true, value: { roomCode, word: trimmed } };
}
