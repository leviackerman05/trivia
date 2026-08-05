import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useGuessWhoGame } from './useGuessWhoGame';
import { getGame } from '../lib/games';
import {
  filterLabel,
  GENRE_LABELS,
  GUESS_WHO_TOTAL_ROUNDS,
  REGION_LABELS,
  type GuessWhoFilter,
  type GuessWhoGameState,
} from '../lib/guess-who';

/**
 * Guess Who? Celebrity Edition arena (M9, PRD §5.17 + owner redesign
 * 2026-08-06): the celebrity's NAME is hidden from every device — not even
 * the host sees it. Everyone gets the traits + facts (the clue) with a
 * 60-second round timer and a Skribbl-style letter pattern that reveals more
 * of the name over time; anyone can guess (the server verifies). A correct
 * guess scores +1 and reveals the celebrity + facts (M17); the host advances
 * to the next round.
 */

interface Props {
  gameSlug: string;
}

export default function GuessWhoArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: gw, actions: gameActions } = useGuessWhoGame(room?.code ?? null, myName ?? null);

  const [guessDraft, setGuessDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const inGame = room !== null && room.phase !== 'lobby';

  useEffect(() => {
    if (gw.view !== 'questioning' || gw.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [gw.view, gw.endsAt]);
  const secondsLeft =
    gw.view === 'questioning' && gw.endsAt !== null
      ? Math.max(0, Math.ceil((gw.endsAt - now) / 1000))
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
            gw.filterOptions ? (
              <FilterControl
                filter={gw.filter}
                options={gw.filterOptions}
                onSelect={(filter) => void gameActions.setFilter(filter)}
              />
            ) : undefined
          ) : (
            <p className="text-small text-ink-muted">
              Region: {filterLabel(gw.filter.region, REGION_LABELS)} · Genre:{' '}
              {filterLabel(gw.filter.genre, GENRE_LABELS)}
            </p>
          )
        }
      />
    );
  }

  const guess = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = guessDraft;
    setGuessDraft('');
    if (text.trim()) {
      void gameActions.submitGuess(text);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          Round {gw.round} of {gw.totalRounds}
        </span>
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          Region: {filterLabel(gw.filter.region, REGION_LABELS)} · Genre:{' '}
          {filterLabel(gw.filter.genre, GENRE_LABELS)}
        </span>
        {gw.view === 'questioning' && (
          <span
            className={`rounded-pill px-4 py-1.5 text-xs font-semibold ${
              secondsLeft <= 10 ? 'bg-danger-soft text-danger-strong' : 'bg-tertiary/40 text-ink'
            }`}
          >
            {secondsLeft}s left
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

      {gw.view === 'questioning' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
            <h2 className="font-display text-h2 text-ink">Who is the secret celebrity?</h2>
            <p className="mt-1 text-body text-ink-muted">
              Nobody sees the name, not even the host. Use the clues, watch the letters reveal, and
              guess before the timer runs out.
            </p>
            <NamePattern namePattern={gw.namePattern} />
            <ClueCard clue={gw.clue} />
            <form onSubmit={guess} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={guessDraft}
                onChange={(event) => setGuessDraft(event.target.value)}
                maxLength={60}
                placeholder="Guess the name…"
                aria-label="Celebrity guess"
                className="min-w-0 flex-1 rounded-md border border-primary/50 bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-primary focus:ring-2 focus:ring-ink"
              />
              <button
                type="submit"
                disabled={!guessDraft.trim()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-6 text-small font-semibold text-white transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                Guess!
              </button>
            </form>
          </div>

          {gw.feedback && (
            <p role="status" className="text-small font-semibold text-ink-muted">
              {gw.feedback}
            </p>
          )}
        </div>
      )}

      {gw.view === 'revealed' && (
        <RevealView
          gw={gw}
          isHost={isHost}
          myName={myName}
          onNext={() => void gameActions.nextCelebrity()}
        />
      )}

      {gw.view === 'game-end' && (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
          <h2 className="font-display text-h2 text-ink">
            {gw.winner ? `🏆 ${gw.winner} wins!` : 'Game over'}
          </h2>
          {gw.revealed && (
            <p className="text-body text-ink">
              The last celebrity was{' '}
              <span className="font-display text-h3 text-primary-deep">{gw.revealed.name}</span>{' '}
              <span className="text-ink-muted"> - {gw.revealed.famousFor}</span>
            </p>
          )}
          {gw.scores.length > 0 && (
            <ol className="flex flex-col divide-y divide-border">
              {gw.scores.map((entry, index) => (
                <li
                  key={entry.playerName}
                  className="flex min-h-12 items-center justify-between px-4 text-body text-ink"
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
                  <span className="text-ink-muted">
                    {entry.score} {entry.score === 1 ? 'guess' : 'guesses'}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {isHost ? (
            <button
              type="button"
              onClick={() => void gameActions.restartGame()}
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover sm:self-start"
            >
              Play again
            </button>
          ) : (
            <p className="text-small text-ink-muted">Waiting for the host to start another game.</p>
          )}
        </div>
      )}

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

/** Skribbl-style letter boxes: revealed letters, hidden letters as blanks,
 * spaces/punctuation as spacing. */
function NamePattern({ namePattern }: { namePattern: string | null }) {
  if (!namePattern) {
    return (
      <p className="mt-4 rounded-md bg-surface-muted px-4 py-3 text-small text-ink-muted">
        Loading the name puzzle…
      </p>
    );
  }
  const chars = [...namePattern];
  return (
    <div
      className="mt-4 flex flex-wrap gap-1"
      role="img"
      aria-label={`Name puzzle: ${namePattern}`}
    >
      {chars.map((char, index) => {
        if (char === '_') {
          return (
            <span
              key={index}
              className="inline-flex h-9 w-7 items-center justify-center rounded-md border border-border bg-surface-muted sm:h-11 sm:w-9"
              aria-hidden="true"
            />
          );
        }
        if (/[a-z0-9]/i.test(char)) {
          return (
            <span
              key={index}
              className="inline-flex h-9 w-7 items-center justify-center rounded-md border border-primary bg-primary/15 font-mono text-lg font-bold text-primary-deep sm:h-11 sm:w-9"
            >
              {char}
            </span>
          );
        }
        // Space or punctuation: visual spacing, never a tile.
        return (
          <span key={index} className="w-2 sm:w-3" aria-hidden="true">
            {char === ' ' ? '' : char}
          </span>
        );
      })}
    </div>
  );
}

/** The traits + facts everyone sees (the name is never here). */
function ClueCard({ clue }: { clue: GuessWhoGameState['clue'] }) {
  if (!clue) {
    return <p className="mt-4 text-small text-ink-muted">Loading the clues…</p>;
  }
  return (
    <div className="mt-4 rounded-lg border border-border bg-surface-raised p-5">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-body text-ink sm:grid-cols-3">
        <p>
          <span className="font-semibold">Gender:</span> {clue.gender === 'f' ? 'Female' : 'Male'}
        </p>
        <p>
          <span className="font-semibold">Status:</span> {clue.alive ? 'Alive' : 'Deceased'}
        </p>
        <p>
          <span className="font-semibold">Profession:</span> {clue.profession}
        </p>
        <p>
          <span className="font-semibold">Nationality:</span> {clue.nationality}
        </p>
        <p>
          <span className="font-semibold">Age:</span> {clue.ageRange}
        </p>
        <p>
          <span className="font-semibold">Hair:</span> {clue.hairColor}
        </p>
      </div>
      <p className="mt-2 text-body text-ink">
        <span className="font-semibold">Famous for:</span> {clue.famousFor}
      </p>
      {clue.facts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {clue.facts.map((fact, index) => (
            <li key={index} className="flex gap-2 text-body text-ink">
              <span aria-hidden="true">✨</span>
              <span>{fact}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Between-round reveal: the celebrity, facts, scores, and the host's
 * advance control ("next celebrity" / "final results"). */
function RevealView({
  gw,
  isHost,
  myName,
  onNext,
}: {
  gw: GuessWhoGameState;
  isHost: boolean;
  myName: string | null;
  onNext: () => void;
}) {
  const revealed = gw.revealed;
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="font-display text-h2 text-ink">
        {gw.winner ? `🎉 ${gw.winner} guessed it!` : 'Nobody got it this round'}
      </h2>
      {revealed && (
        <div className="rounded-lg border border-primary/50 bg-primary/10 p-5">
          <p className="text-center font-display text-h2 text-primary-deep">{revealed.name}</p>
          <p className="mt-1 text-center text-body text-ink-muted">{revealed.famousFor}</p>
          {revealed.facts.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {revealed.facts.map((fact, index) => (
                <li key={index} className="flex gap-2 text-body text-ink">
                  <span aria-hidden="true">✨</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {gw.scores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {gw.scores.map((entry) => (
            <span
              key={entry.playerName}
              className="rounded-pill bg-surface-muted px-3 py-1.5 text-small font-semibold text-ink"
            >
              {entry.playerName} {entry.playerName === myName ? '(you)' : ''} · {entry.score}
            </span>
          ))}
        </div>
      )}
      {isHost ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white transition-colors hover:bg-primary-hover sm:w-auto sm:self-start"
        >
          {gw.revealFinished ? 'See final results' : 'Next celebrity'}
        </button>
      ) : (
        <p className="text-small text-ink-muted">
          Waiting for the host to deal the next celebrity.
        </p>
      )}
    </div>
  );
}

/** D064, host lobby control: region + genre chip rows with pool counts. */
function FilterControl({
  filter,
  options,
  onSelect,
}: {
  filter: GuessWhoFilter;
  options: NonNullable<GuessWhoGameState['filterOptions']>;
  onSelect: (filter: GuessWhoFilter) => void;
}) {
  const regions = options.regions.filter((option) => option.count >= GUESS_WHO_TOTAL_ROUNDS);
  const genres = options.genres.filter((option) => option.count >= GUESS_WHO_TOTAL_ROUNDS);
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="text-lg font-bold tracking-tight text-ink">Filter (host)</h3>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-small font-semibold text-ink-muted">Region</span>
        {regions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter.region === option.value}
            onClick={() =>
              onSelect({ ...filter, region: option.value as GuessWhoFilter['region'] })
            }
            className={`rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
              filter.region === option.value
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
            }`}
          >
            {filterLabel(option.value, REGION_LABELS)} ({option.count})
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-small font-semibold text-ink-muted">Genre</span>
        {genres.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter.genre === option.value}
            onClick={() => onSelect({ ...filter, genre: option.value as GuessWhoFilter['genre'] })}
            className={`rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
              filter.genre === option.value
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-raised text-ink hover:bg-surface-muted'
            }`}
          >
            {filterLabel(option.value, GENRE_LABELS)} ({option.count})
          </button>
        ))}
      </div>
    </div>
  );
}
