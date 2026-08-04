import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useCharadesGame } from './useCharadesGame';
import { getGame } from '../lib/games';

/**
 * Charades arena (M9, PRD §5.12) — co-located pass-the-phone play. The
 * actor's device shows the secret movie title; anyone presses "Got it!"
 * when the team shouts the answer (+1); the 60s timer auto-advances. The
 * host picks Hollywood / Bollywood / Mixed in the lobby. The movie title
 * is actor-only (D023).
 */

interface Props {
  gameSlug: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  hollywood: 'Hollywood',
  bollywood: 'Bollywood',
  mixed: 'Mixed',
};

export default function CharadesArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: charades, actions: gameActions } = useCharadesGame(
    room?.code ?? null,
    myName ?? null
  );

  const [now, setNow] = useState(() => Date.now());
  const [chatDraft, setChatDraft] = useState('');

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const inGame = room !== null && room.phase !== 'lobby';
  const isActor = charades.actor !== null && charades.actor === myName;

  useEffect(() => {
    if (charades.view !== 'acting' || charades.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [charades.view, charades.endsAt]);
  const secondsLeft =
    charades.view === 'acting' && charades.endsAt !== null
      ? Math.max(0, Math.ceil((charades.endsAt - now) / 1000))
      : 0;

  if (!room) {
    return (
      <RoomLobbyPanel
        game={game}
        status={status}
        error={error}
        room={room}
        messages={messages}
        actions={roomActions}
        isHost={isHost}
        gamePlayable={game?.playable === true}
      />
    );
  }

  if (!inGame) {
    return (
      <RoomLobbyPanel
        game={game}
        status={status}
        error={error}
        room={room}
        messages={messages}
        actions={roomActions}
        isHost={isHost}
        gamePlayable={game?.playable === true}
        lobbyExtras={
          isHost ? (
            <CategoryToggle
              category={charades.category}
              onSelect={(category) => void gameActions.setCategory(category)}
            />
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          {CATEGORY_LABELS[charades.category] ?? 'Mixed'} · Round {charades.round} of{' '}
          {charades.totalRounds}
        </span>
        {charades.view === 'acting' && (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              secondsLeft <= 10
                ? 'bg-danger-soft text-danger-strong'
                : 'bg-success-soft text-success-strong'
            }`}
          >
            {secondsLeft}s
          </span>
        )}
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          Team score: {charades.score}
        </span>
        <button
          type="button"
          onClick={() => roomActions.leaveRoom()}
          className="ml-auto rounded-pill border-3 border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      {charades.view === 'acting' && (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
          {isActor ? (
            <>
              <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
                You're the actor — act it out!
              </p>
              <p className="text-center font-display text-h1 text-ink">{charades.movie ?? '…'}</p>
              <p className="text-center text-body text-ink-muted">
                No talking! The team shouts the title and someone taps the button.
              </p>
            </>
          ) : (
            <>
              <p className="font-display text-h2 text-ink">{charades.actor} is acting!</p>
              <p className="text-body text-ink-muted">
                Shout your guesses — when the team gets it, tap “Got it!”.
              </p>
            </>
          )}
          {charades.lastRound && (
            <p role="status" className="text-body font-semibold text-ink">
              {charades.lastRound.scored
                ? `✅ Correct! +1 — ${charades.lastRound.nextActor ?? 'the team'} is next.`
                : `⏱️ Time's up — ${charades.lastRound.nextActor ?? 'the team'} is next.`}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void gameActions.markCorrect()}
              className="inline-flex min-h-14 items-center justify-center rounded-pill bg-primary-strong px-8 py-3 text-xl font-bold text-white shadow-coral transition-colors hover:bg-primary-hover"
            >
              🎉 Got it! (+1)
            </button>
            {isHost && (
              <button
                type="button"
                onClick={() => void gameActions.skip()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill border-3 border-primary bg-transparent px-6 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
              >
                Skip this word (host)
              </button>
            )}
          </div>
        </div>
      )}

      {charades.view === 'game-end' && (
        <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
          <h2 className="font-display text-h2 text-ink">
            {charades.score > 0 ? `🎭 The team scored ${charades.score}!` : 'Game over'}
          </h2>
          <p className="text-body text-ink-muted">
            {charades.score} correct {charades.score === 1 ? 'title' : 'titles'} in {charades.round}{' '}
            rounds of charades.
          </p>
          {isHost ? (
            <button
              type="button"
              onClick={() => void gameActions.restartGame()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
            >
              Play again
            </button>
          ) : (
            <p className="text-small text-ink-muted">Waiting for the host to start another game.</p>
          )}
        </div>
      )}

      <div className="flex flex-col rounded-lg border-2 border-border bg-surface-raised p-5 shadow-sm">
        <h3 className="mb-2 font-display text-h4 text-ink">Room chat</h3>
        <ul
          aria-live="polite"
          className="flex max-h-40 min-h-20 flex-col gap-2 overflow-y-auto pr-1"
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
            <li className="text-small text-ink-muted">
              Guesses can be shouted out loud — or typed here!
            </li>
          )}
        </ul>
        <form
          onSubmit={(event: SyntheticEvent<HTMLFormElement>) => {
            event.preventDefault();
            const text = chatDraft;
            setChatDraft('');
            if (text.trim()) {
              void roomActions.sendMessage(text);
            }
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={chatDraft}
            onChange={(event) => setChatDraft(event.target.value)}
            maxLength={300}
            placeholder="Type a guess…"
            aria-label="Chat message"
            className="min-w-0 flex-1 rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
          />
          <button
            type="submit"
            disabled={!chatDraft.trim()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-secondary px-5 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-danger bg-danger-soft px-4 py-3 text-body text-danger-strong"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Host lobby control: Hollywood / Bollywood / Mixed. */
function CategoryToggle({
  category,
  onSelect,
}: {
  category: string;
  onSelect: (category: 'hollywood' | 'bollywood' | 'mixed') => void;
}) {
  return (
    <div className="rounded-lg border-2 border-dashed border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="font-display text-h4 text-ink">Category (host)</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['hollywood', 'bollywood', 'mixed'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={category === option}
            onClick={() => onSelect(option)}
            className={`rounded-pill border-2 px-4 py-2 text-small font-semibold transition-colors ${
              category === option
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
            }`}
          >
            {CATEGORY_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
