import { useCallback, useEffect, useState, type SyntheticEvent } from 'react';
import type { UseRoom } from './useRoom';
import type { Game } from '../../lib/games';
import { fetchLeaderboard, type LeaderboardEntry } from '../../lib/api';
import type { RoomState, ChatMessage } from '../../lib/room-types';

/**
 * Shared room lobby UI (create/join forms, leaderboard, player list, chat,
 * start button), reused by the generic RoomLobby island (all multiplayer
 * games) and game-specific islands that need a lobby before their round
 * logic takes over (Skribbl Arena, M4). Pure presentation: all room state
 * and socket actions come in through props.
 */

export interface RoomLobbyPanelProps {
  game: Game | undefined;
  status: UseRoom['status'];
  error: string | null;
  room: RoomState | null;
  messages: ChatMessage[];
  actions: UseRoom['actions'];
  isHost: boolean;
  /** False for room games whose round logic hasn't shipped yet (start is gated). */
  gamePlayable: boolean;
  /** Extra actions a game island may render inside the lobby (e.g. custom words). */
  lobbyExtras?: React.ReactNode;
}

const PHASE_LABELS: Record<RoomState['phase'], string> = {
  lobby: 'Lobby',
  'game-setup': 'Setting up…',
  'in-progress': 'In progress',
  results: 'Results',
};

export default function RoomLobbyPanel({
  game,
  status,
  error,
  room,
  messages,
  actions,
  isHost,
  gamePlayable,
  lobbyExtras,
}: RoomLobbyPanelProps) {
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState(() =>
    // Astro prerenders islands server-side, window only exists in the browser.
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('code') ?? '')
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [chatDraft, setChatDraft] = useState('');

  const gameSlug = game?.slug ?? '';

  const loadLeaderboard = useCallback(async () => {
    if (!gameSlug) {
      return;
    }
    try {
      const response = await fetchLeaderboard(gameSlug, 'all-time', 5);
      setLeaderboard(response.entries);
    } catch {
      setLeaderboard([]);
    }
  }, [gameSlug]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const run = async (operation: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true);
    try {
      await operation();
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickname.trim()) return;
    void run(() => actions.createRoom(gameSlug, nickname.trim()));
  };

  const handleJoin = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nickname.trim() || !joinCode.trim()) return;
    void run(() => actions.joinRoom(joinCode.trim().toUpperCase(), nickname.trim()));
  };

  const handleChat = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatDraft;
    setChatDraft('');
    void run(() => actions.sendMessage(message));
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/game/${gameSlug}?code=${room?.code ?? ''}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g., non-secure context), show the code instead
    }
  };

  if (status === 'connecting') {
    return <p className="text-body text-ink-muted">Connecting to the game server…</p>;
  }

  if (!room) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <form
            onSubmit={handleCreate}
            className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm"
          >
            <h3 className="text-lg font-bold tracking-tight text-ink">Create a room</h3>
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-semibold text-ink">Your nickname</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={20}
                placeholder="e.g. PartyPanda"
                className="rounded-md border border-border bg-surface-raised px-4 py-3 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !nickname.trim()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
            >
              {busy ? 'Creating…' : `Create ${game?.name ?? 'game'} room`}
            </button>
          </form>

          <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:self-center">
            <span
              aria-hidden="true"
              className="rounded-pill bg-primary/15 px-3 py-1 text-xs font-semibold text-primary-deep"
            >
              or
            </span>
          </div>

          <form
            onSubmit={handleJoin}
            className="flex flex-1 flex-col gap-3 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm"
          >
            <h3 className="text-lg font-bold tracking-tight text-ink">Join a room</h3>
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-semibold text-ink">Room code</span>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                aria-label="Room code"
                className="rounded-md border border-border bg-surface-raised px-4 py-3 font-mono text-lg uppercase tracking-[0.3em] text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-small font-semibold text-ink">Your nickname</span>
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={20}
                placeholder="e.g. PartyPanda"
                className="rounded-md border border-border bg-surface-raised px-4 py-3 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !nickname.trim() || joinCode.length !== 6}
              className="inline-flex min-h-12 items-center justify-center rounded-pill border border-primary bg-transparent px-7 py-3 text-lg font-semibold text-primary-strong transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-40"
            >
              {busy ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </div>

        {lobbyExtras}

        <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-bold tracking-tight text-ink">Top players, {game?.name}</h3>
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="rounded-pill border border-primary/40 bg-primary/20 px-4 py-1.5 text-xs font-semibold text-primary-deep transition-colors hover:bg-primary/30"
            >
              Refresh
            </button>
          </div>
          {leaderboard.length === 0 ? (
            <p className="text-body text-ink-muted">No scores yet, be the first on the board!</p>
          ) : (
            <ol className="flex flex-col divide-y divide-border">
              {leaderboard.map((entry) => (
                <li
                  key={entry.rank}
                  className="flex min-h-14 items-center justify-between px-5 text-lg text-ink"
                >
                  <span className="font-semibold">
                    {entry.rank}. {entry.playerName}
                  </span>
                  <span className="text-ink-muted">{entry.score}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-body text-danger-strong"
          >
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <button
          type="button"
          onClick={() => void handleCopyLink()}
          className="rounded-pill border border-primary/40 bg-primary/20 px-4 py-2 text-xs font-semibold text-primary-deep transition-colors hover:bg-primary/30"
        >
          {copied ? 'Link copied!' : 'Copy invite link'}
        </button>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          {PHASE_LABELS[room.phase]}
        </span>
        <button
          type="button"
          onClick={() => actions.leaveRoom()}
          className="ml-auto rounded-pill border border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
            <h3 className="mb-3 text-lg font-bold tracking-tight text-ink">Players ({room.players.length})</h3>
            <ul className="flex flex-col divide-y divide-border">
              {room.players.map((player) => (
                <li
                  key={player.name}
                  className="flex min-h-14 items-center justify-between px-5 text-lg text-ink"
                >
                  <span>
                    {player.name}
                    {player.isHost && (
                      <span className="ml-2 rounded-pill bg-tertiary/40 px-2.5 py-0.5 text-xs font-semibold text-ink">
                        Host
                      </span>
                    )}
                  </span>
                  {!player.connected && (
                    <span className="text-small text-ink-muted">disconnected</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {lobbyExtras}

          <button
            type="button"
            disabled={!isHost || room.phase !== 'lobby' || busy || !gamePlayable}
            onClick={() => void run(() => actions.startGame())}
            className="inline-flex min-h-14 items-center justify-center rounded-pill bg-primary px-9 py-4 text-xl font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
          >
            {room.phase === 'lobby' ? 'Start game' : 'Game in progress…'}
          </button>
          {!gamePlayable && room.phase === 'lobby' && (
            <p className="text-small text-ink-muted">
              The playable rounds for this game land in a later milestone, the room (invites,
              players, chat) works today, and Skribbl Arena is fully playable!
            </p>
          )}
          {!isHost && room.phase === 'lobby' && (
            <p className="text-small text-ink-muted">Waiting for the host to start the game.</p>
          )}
        </div>

        <div className="flex flex-col rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
          <h3 className="mb-3 text-lg font-bold tracking-tight text-ink">Room chat</h3>
          <ul
            aria-live="polite"
            className="flex max-h-64 min-h-32 flex-col gap-2 overflow-y-auto pr-1"
          >
            {messages.map((message, index) => (
              <li
                key={index}
                className={`text-body ${message.kind === 'system' ? 'text-small italic text-ink-muted' : 'text-ink'}`}
              >
                <span className="font-semibold">{message.playerName}: </span>
                {message.message}
              </li>
            ))}
            {messages.length === 0 && (
              <li className="text-small text-ink-muted">Say hi to the room!</li>
            )}
          </ul>
          <form onSubmit={handleChat} className="mt-3 flex gap-2">
            <input
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              maxLength={300}
              placeholder="Type a message…"
              aria-label="Chat message"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-success/30"
            />
            <button
              type="submit"
              disabled={!chatDraft.trim()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-secondary px-5 text-small font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger bg-danger-soft px-4 py-3 text-body text-danger-strong"
        >
          {error}
        </p>
      )}
    </div>
  );
}
