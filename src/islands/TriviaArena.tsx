import { useEffect, useMemo, useState } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useTriviaGame } from './useTriviaGame';
import { getGame } from '../lib/games';
import type { TriviaGameState, TriviaMode } from '../lib/trivia-room';

/**
 * Trivia room arena (M8, PRD §5.15), 10-question race on a 10s clock, or
 * "Wrong Answers Only" comedy mode. The lobby is the shared RoomLobbyPanel
 * with a host mode toggle; rounds render question → reveal → podium.
 * All state is server-authoritative via useTriviaGame (the correct answer
 * only ever arrives in the round-reveal).
 */

interface Props {
  gameSlug: string;
}

export default function TriviaArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: trivia, actions: gameActions } = useTriviaGame(room?.code ?? null, myName ?? null);

  const [now, setNow] = useState(() => Date.now());

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const inGame = room !== null && room.phase !== 'lobby';

  useEffect(() => {
    if (trivia.view !== 'question' || trivia.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [trivia.view, trivia.endsAt]);
  const secondsLeft =
    trivia.view === 'question' && trivia.endsAt !== null
      ? Math.max(0, Math.ceil((trivia.endsAt - now) / 1000))
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
            <ModeToggle mode={trivia.mode} onSelect={(mode) => void gameActions.setMode(mode)} />
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
          {trivia.mode === 'wrong-answers' ? 'Wrong Answers Only' : 'Race mode'} · Question{' '}
          {trivia.round} of {trivia.totalRounds}
        </span>
        {trivia.view === 'question' && (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              secondsLeft <= 3
                ? 'bg-danger-soft text-danger-strong'
                : 'bg-success-soft text-success-strong'
            }`}
          >
            {secondsLeft}s
          </span>
        )}
        <button
          type="button"
          onClick={() => roomActions.leaveRoom()}
          className="ml-auto rounded-pill border border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      {trivia.view === 'question' && trivia.question && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
          <p className="text-small font-semibold uppercase tracking-wide text-primary-deep">
            {trivia.question.category}
          </p>
          <h2 className="font-display text-h2 text-ink">{trivia.question.question}</h2>
          <p className="text-small text-ink-muted">
            {trivia.mode === 'wrong-answers'
              ? 'Pick the most absurd WRONG answer, answering correctly scores nothing!'
              : 'Fastest correct answer earns the most points.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {trivia.question.options.map((option, index) => {
              const picked = trivia.myAnswer === index;
              const disabled = trivia.myAnswer !== null;
              return (
                <button
                  key={index}
                  type="button"
                  disabled={disabled}
                  onClick={() => void gameActions.answer(index)}
                  aria-pressed={picked}
                  className={`min-h-14 rounded-lg border px-5 py-3 text-left text-lg font-semibold transition-all disabled:cursor-default ${
                    picked
                      ? 'border-primary bg-primary/15 text-primary-deep'
                      : 'border-border bg-surface-raised text-ink hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  <span className="mr-2 font-mono text-sm text-ink-muted">
                    {String.fromCharCode(65 + index)}.
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
          {trivia.feedback && (
            <p role="status" className="text-body font-semibold text-ink">
              {trivia.feedback}
            </p>
          )}
        </div>
      )}

      {trivia.view === 'revealed' && (
        <RevealView trivia={trivia} isHost={isHost} onNext={() => void gameActions.nextRound()} />
      )}

      {trivia.view === 'game-end' && (
        <PodiumView
          trivia={trivia}
          myName={myName}
          isHost={isHost}
          onRestart={() => void gameActions.restartGame()}
        />
      )}

      <div className="rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-bold tracking-tight text-ink">Scoreboard</h3>
        <ol className="flex flex-col divide-y divide-border">
          {trivia.scores.map((entry, index) => (
            <li
              key={entry.playerName}
              className="flex min-h-10 items-center justify-between px-3 text-body text-ink"
            >
              <span className="font-semibold">
                {index + 1}. {entry.playerName}
                {entry.playerName === myName && (
                  <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                    You
                  </span>
                )}
              </span>
              <span className="text-ink-muted">{entry.score}</span>
            </li>
          ))}
        </ol>
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

/** Host lobby control: race vs Wrong Answers Only. */
function ModeToggle({
  mode,
  onSelect,
}: {
  mode: TriviaMode;
  onSelect: (mode: TriviaMode) => void;
}) {
  return (
    <div className="rounded-lg border  border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="text-lg font-bold tracking-tight text-ink">Game mode (host)</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={mode === 'race'}
          onClick={() => onSelect('race')}
          className={`rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
            mode === 'race'
              ? 'border-primary bg-primary/15 text-primary-deep'
              : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
          }`}
        >
          🏁 Race mode, fastest correct wins
        </button>
        <button
          type="button"
          aria-pressed={mode === 'wrong-answers'}
          onClick={() => onSelect('wrong-answers')}
          className={`rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
            mode === 'wrong-answers'
              ? 'border-primary bg-primary/15 text-primary-deep'
              : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
          }`}
        >
          🤡 Wrong Answers Only, the worst answer wins
        </button>
      </div>
    </div>
  );
}

/** Round reveal: correct answer highlighted, per-player points. */
function RevealView({
  trivia,
  isHost,
  onNext,
}: {
  trivia: TriviaGameState;
  isHost: boolean;
  onNext: () => void;
}) {
  const question = trivia.question;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-ink">The answer</h2>
      {question && trivia.correctIndex !== null && (
        <p className="text-body text-ink">
          <span className="font-semibold text-success-strong">
            {question.options[trivia.correctIndex]}
          </span>{' '}
          {trivia.mode === 'wrong-answers' && (
            <span className="text-ink-muted">
              , anyone who picked this gets nothing. The wronger, the better.
            </span>
          )}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {trivia.results.map((result) => (
          <li key={result.playerName} className="text-body text-ink">
            <span className="font-semibold">{result.playerName}</span>{' '}
            {result.correct ? (
              <span className="text-success-strong">✓ +{result.points}</span>
            ) : (
              <span className="text-danger-strong">✗ +{result.points}</span>
            )}
          </li>
        ))}
      </ul>
      {isHost ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          {trivia.round >= trivia.totalRounds ? 'See the podium' : 'Next question'}
        </button>
      ) : (
        <p className="text-small text-ink-muted">
          Waiting for the host, the next question starts automatically in a moment.
        </p>
      )}
    </div>
  );
}

/** Final podium. */
function PodiumView({
  trivia,
  myName,
  isHost,
  onRestart,
}: {
  trivia: TriviaGameState;
  myName: string | null;
  isHost: boolean;
  onRestart: () => void;
}) {
  const final = trivia.finalScores ?? [];
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="font-display text-h2 text-ink">
        {trivia.winner ? `🏆 ${trivia.winner} wins!` : 'Game over'}
      </h2>
      <ol className="flex flex-col divide-y divide-border">
        {final.map((entry, index) => (
          <li
            key={entry.playerName}
            className="flex min-h-12 items-center justify-between px-4 text-lg text-ink"
          >
            <span className="font-semibold">
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}{' '}
              {entry.playerName}
              {entry.playerName === myName && (
                <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                  You
                </span>
              )}
            </span>
            <span className="text-ink-muted">{entry.score}</span>
          </li>
        ))}
      </ol>
      {isHost ? (
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          Play again
        </button>
      ) : (
        <p className="text-small text-ink-muted">Waiting for the host to start another game.</p>
      )}
    </div>
  );
}
