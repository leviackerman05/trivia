import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useVotingGame } from './useVotingGame';
import { getGame } from '../lib/games';
import type { VotingGameState, VotingOption } from '../lib/voting';

/**
 * Voting game arena (M6), one island for all four voting games. Lobby is the
 * shared RoomLobbyPanel; rounds render per game via KIND_UI:
 *
 * - Would You Rather: two big dilemma cards (blue A / red B), live bars,
 *   total-votes counter, submit-your-own-dilemma queue
 * - Most Likely To: player-name chips, ranked reveal with a crown
 * - Never Have I Ever: turn rotation, statement input/suggestions,
 *   I HAVE / I HAVE NOT voting, wildness scoreboard
 * - This or That: rapid pairs, tap-to-vote, live bars, 6s auto-advance,
 *   herd streak, herd-alignment score at the end
 */

interface Props {
  gameSlug: string;
}

const KIND_LABELS: Record<string, string> = {
  'would-you-rather': 'Would You Rather',
  'most-likely-to': 'Most Likely To…',
  'never-have-i-ever': 'Never Have I Ever',
  'this-or-that': 'This or That',
};

/** M15, This or That genre buckets (server dataset genres). */
const TOT_GENRES: { id: string; label: string }[] = [
  { id: 'food', label: 'Food' },
  { id: 'animals', label: 'Animals' },
  { id: 'nature', label: 'Nature & Weather' },
  { id: 'tech', label: 'Tech & Social' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'entertainment', label: 'Movies, Music & Shows' },
  { id: 'travel', label: 'Travel' },
  { id: 'money', label: 'Money & Shopping' },
  { id: 'love', label: 'Love & Relationships' },
  { id: 'lifestyle', label: 'Lifestyle' },
];

/** M15, Never Have I Ever content tiers (super-dirty is NSFW; hosts opt in). */
const NHIE_TIERS: { id: string; label: string }[] = [
  { id: 'boring', label: 'Boring' },
  { id: 'moderate', label: 'Moderate' },
  { id: 'dirty', label: 'Dirty' },
  { id: 'super-dirty', label: 'Super dirty (NSFW)' },
];

const NHIE_SOURCES: { id: 'provided' | 'own' | 'both'; label: string }[] = [
  { id: 'provided', label: 'Provided scenarios' },
  { id: 'own', label: 'My own statements' },
  { id: 'both', label: 'Both' },
];

export default function VotingArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: voting, actions: gameActions } = useVotingGame(room?.code ?? null, myName ?? null);

  const [now, setNow] = useState(() => Date.now());

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const inGame = room !== null && room.phase !== 'lobby';
  const kind = voting.kind;

  // Phase countdown (server deadline).
  useEffect(() => {
    if (voting.view !== 'voting' && voting.view !== 'statement') {
      return;
    }
    if (voting.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [voting.view, voting.endsAt]);
  const secondsLeft =
    voting.endsAt !== null && (voting.view === 'voting' || voting.view === 'statement')
      ? Math.max(0, Math.ceil((voting.endsAt - now) / 1000))
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
            // Use the PAGE slug, not voting.kind: the reducer's kind is the
            // initial 'would-you-rather' until the game starts, which made
            // the tier/genre settings invisible in the lobby (M19 fix).
            <VotingLobbySettings kind={gameSlug} onConfig={gameActions.setVotingConfig} />
          ) : undefined
        }
      />
    );
  }

  const totalVotes = voting.tallies.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <span className="rounded-pill bg-success-soft px-4 py-1.5 text-xs font-semibold text-success-strong">
          {KIND_LABELS[kind] ?? 'Voting'} · Round {voting.round} of {voting.totalRounds}
        </span>
        {(voting.view === 'voting' || voting.view === 'statement') && (
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
        {kind === 'this-or-that' && voting.view === 'voting' && (
          <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
            Herd streak: {voting.herdStreak}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {voting.view === 'statement' && (
            <StatementView voting={voting} myName={myName} onSubmit={gameActions.submitStatement} />
          )}

          {voting.view === 'voting' && (
            <VotingView
              voting={voting}
              myName={myName}
              totalVotes={totalVotes}
              onVote={gameActions.castVote}
            />
          )}

          {voting.view === 'revealed' && (
            <RevealView
              voting={voting}
              myName={myName}
              totalVotes={totalVotes}
              isHost={isHost}
              onNext={() => void gameActions.nextRound()}
            />
          )}

          {voting.view === 'game-end' && (
            <GameEndView
              voting={voting}
              myName={myName}
              isHost={isHost}
              onRestart={() => void gameActions.restartGame()}
            />
          )}

          {kind === 'would-you-rather' &&
            (voting.view === 'voting' || voting.view === 'revealed') && (
              <SubmitDilemma onSubmit={gameActions.submitDilemma} />
            )}

          {voting.feedback && (
            <p
              role="status"
              className="rounded-md border border-success/50 bg-success-soft px-4 py-2 text-small font-semibold text-success-strong"
            >
              {voting.feedback}
            </p>
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

        <div className="flex flex-col gap-5">
          {(kind === 'never-have-i-ever' || kind === 'most-likely-to') && (
            <Scoreboard voting={voting} myName={myName} />
          )}
          <ChatPanel messages={messages} onSend={roomActions.sendMessage} />
        </div>
      </div>
    </div>
  );
}

/** Host lobby controls (M15): NHIE tier/source, TOT genre, applied when
 * the game starts via set-voting-config (pendingVotingOptions server-side). */
function VotingLobbySettings({
  kind,
  onConfig,
}: {
  kind: string;
  onConfig: (config: {
    nhieTier?: string;
    nhieSource?: 'provided' | 'own' | 'both';
    totGenre?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [nhieTier, setNhieTier] = useState('moderate');
  const [nhieSource, setNhieSource] = useState<'provided' | 'own' | 'both'>('both');
  const [totGenre, setTotGenre] = useState<string | null>(null);

  if (kind === 'never-have-i-ever') {
    return (
      <div className="flex flex-col gap-4 rounded-lg border  border-border bg-surface-raised p-5 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Statements (host)</h3>
        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">Where statements come from</span>
          <div className="flex flex-wrap gap-2">
            {NHIE_SOURCES.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={nhieSource === option.id}
                onClick={() => {
                  setNhieSource(option.id);
                  void onConfig({ nhieSource: option.id, nhieTier });
                }}
                className={`inline-flex min-h-11 items-center justify-center rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
                  nhieSource === option.id
                    ? 'border-primary bg-primary/15 text-primary-deep'
                    : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-small font-semibold text-ink">How spicy?</span>
          <div className="flex flex-wrap gap-2">
            {NHIE_TIERS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={nhieTier === option.id}
                onClick={() => {
                  setNhieTier(option.id);
                  void onConfig({ nhieTier: option.id, nhieSource });
                }}
                className={`inline-flex min-h-11 items-center justify-center rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
                  nhieTier === option.id
                    ? 'border-primary bg-primary/15 text-primary-deep'
                    : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">
            Default is Moderate, super-dirty (NSFW) content is off until a host turns it on.
          </p>
        </div>
      </div>
    );
  }

  if (kind === 'this-or-that') {
    return (
      <div className="flex flex-col gap-3 rounded-lg border  border-border bg-surface-raised p-5 shadow-sm">
        <h3 className="text-lg font-bold tracking-tight text-ink">Category (host)</h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={totGenre === null}
            onClick={() => {
              setTotGenre(null);
              void onConfig({ totGenre: null });
            }}
            className={`inline-flex min-h-11 items-center justify-center rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
              totGenre === null
                ? 'border-primary bg-primary/15 text-primary-deep'
                : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
            }`}
          >
            All categories
          </button>
          {TOT_GENRES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={totGenre === option.id}
              onClick={() => {
                setTotGenre(option.id);
                void onConfig({ totGenre: option.id });
              }}
              className={`inline-flex min-h-11 items-center justify-center rounded-pill border px-4 py-2 text-small font-semibold transition-colors ${
                totGenre === option.id
                  ? 'border-primary bg-primary/15 text-primary-deep'
                  : 'border-border bg-surface-muted text-ink-muted hover:border-primary/50 hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

/** Never Have I Ever, current player writes or picks a confession (M15:
 * the host-chosen statementSource drives what the author sees, provided
 * suggestions, free text, or both). */
function StatementView({
  voting,
  myName,
  onSubmit,
}: {
  voting: VotingGameState;
  myName: string | null;
  onSubmit: (statement: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const isMine = voting.statementBy !== null && voting.statementBy === myName;
  const source = voting.statementSource ?? 'both';
  const submit = async (statement?: string) => {
    const text = statement ?? draft;
    if (text.trim().length < 3) {
      return;
    }
    setBusy(true);
    await onSubmit(text.trim());
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-ink">{voting.prompt.title}</h2>
      <p className="text-body text-ink-muted">{voting.prompt.subtitle}</p>
      {isMine ? (
        <>
          {source === 'provided' ? (
            <>
              <p className="text-small font-semibold text-ink">Pick one of these confessions:</p>
              <div className="flex flex-wrap gap-2">
                {voting.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={busy}
                    onClick={() => void submit(suggestion)}
                    className="inline-flex min-h-11 items-center justify-center rounded-pill border border-border bg-surface-raised px-4 py-2 text-small text-ink transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-40"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label htmlFor="nhie-statement" className="text-small font-semibold text-ink">
                Something you have never done (3-120 characters)
              </label>
              <textarea
                id="nhie-statement"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={120}
                placeholder="…eaten pineapple on pizza"
                className="w-full rounded-md border border-border bg-surface-raised px-4 py-3 text-base text-ink transition-colors hover:border-border-strong focus:ring-2 focus:ring-ink"
              />
              {source === 'both' && voting.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {voting.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setDraft(suggestion)}
                      className="rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-small text-ink transition-colors hover:bg-primary/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={busy || draft.trim().length < 3}
                onClick={() => void submit()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40 sm:self-start"
              >
                Confess, start the vote
              </button>
            </>
          )}
        </>
      ) : (
        <p className="text-body font-semibold text-primary-deep">
          Waiting for {voting.statementBy} to confess…
        </p>
      )}
    </div>
  );
}

/** Voting phase, prompt + options + live bars. */
function VotingView({
  voting,
  myName,
  totalVotes,
  onVote,
}: {
  voting: VotingGameState;
  myName: string | null;
  totalVotes: number;
  onVote: (optionId: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const tallies = new Map(voting.tallies.map((row) => [row.optionId, row.count]));
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="font-display text-h2 text-ink">{voting.prompt.title}</h2>
      {voting.prompt.subtitle && (
        <p className="text-body text-ink-muted">{voting.prompt.subtitle}</p>
      )}
      {voting.statement !== null && (
        <p className="rounded-md bg-primary/10 px-4 py-2 font-display text-h4 text-primary-deep">
          Never have I ever… {voting.statement}
        </p>
      )}
      {voting.custom && (
        <p className="text-small font-semibold text-primary-deep">✦ Submitted by a player</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {voting.options.map((option, index) => (
          <VoteCard
            key={option.id}
            option={option}
            index={index}
            kind={voting.kind}
            count={tallies.get(option.id) ?? 0}
            totalVotes={totalVotes}
            voted={voting.myVote === option.id}
            disabled={voting.myVote !== null}
            myName={myName}
            onVote={() => void onVote(option.id)}
          />
        ))}
      </div>
      {voting.kind === 'would-you-rather' && (
        <p className="text-small font-semibold text-ink-muted" aria-live="polite">
          {totalVotes} vote{totalVotes === 1 ? '' : 's'} so far
        </p>
      )}
    </div>
  );
}

/** One option card: big button, live percentage bar underneath. */
function VoteCard({
  option,
  index,
  kind,
  count,
  totalVotes,
  voted,
  disabled,
  myName,
  onVote,
}: {
  option: VotingOption;
  index: number;
  kind: string;
  count: number;
  totalVotes: number;
  voted: boolean;
  disabled: boolean;
  myName: string | null;
  onVote: () => void;
}) {
  const percent = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
  // WYR: option A is blue, option B is red (PRD §5.13).
  const accentClass =
    kind === 'would-you-rather' ? (index === 0 ? 'bg-blue-500' : 'bg-red-500') : 'bg-primary';
  const accentColor =
    kind === 'would-you-rather' ? (index === 0 ? '#3b82f6' : '#ef4444') : undefined;
  // M16, Most Likely To options are player names: give them big, obvious
  // tap targets (the owner's "clickable area is too small" report).
  const isNameCard = kind === 'most-likely-to';
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        type="button"
        disabled={disabled}
        onClick={onVote}
        aria-pressed={voted}
        className={`flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border px-5 py-4 text-center shadow-sm transition-colors disabled:cursor-default ${
          isNameCard ? 'min-h-32' : 'min-h-28'
        } ${
          voted
            ? 'border-transparent text-white'
            : 'border-border bg-surface-raised hover:border-primary'
        }`}
        style={voted && accentColor ? { backgroundColor: accentColor } : undefined}
      >
        <span
          className={`break-words leading-snug ${isNameCard ? 'font-display text-2xl' : 'text-xl'}`}
        >
          {option.label}
        </span>
        {option.label === myName && (
          <span className="rounded-pill bg-surface-raised/20 px-2 py-0.5 text-xs font-semibold">
            You
          </span>
        )}
        {voted && (
          <span className="text-xs font-semibold uppercase tracking-wide">✓ Your pick</span>
        )}
      </button>
      <div
        className="flex h-5 items-center gap-2 overflow-hidden rounded-pill bg-surface-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${option.label}: ${percent}%`}
      >
        <div
          className={`h-full rounded-pill transition-all duration-300 ${accentClass}`}
          style={{ width: `${percent}%` }}
        />
        <span className="pr-2 text-xs font-bold text-ink">{percent}%</span>
      </div>
    </div>
  );
}

/** Revealed phase, percentages, winner, crown, or confession tally. */
function RevealView({
  voting,
  myName,
  totalVotes,
  isHost,
  onNext,
}: {
  voting: VotingGameState;
  myName: string | null;
  totalVotes: number;
  isHost: boolean;
  onNext: () => void;
}) {
  const reveal = voting.reveal;
  if (!reveal) {
    return null;
  }
  const sorted = [...reveal.tallies].sort((a, b) => b.count - a.count);
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-bold tracking-tight text-ink">
        {voting.kind === 'never-have-i-ever' ? 'The verdict' : 'The results'}
      </h2>
      {voting.kind === 'never-have-i-ever' ? (
        <p className="text-body text-ink">
          <span className="font-display text-h2 text-primary-deep">{reveal.haveCount ?? 0}</span> of{' '}
          <span className="font-semibold">{reveal.totalVotes}</span> player
          {reveal.totalVotes === 1 ? '' : 's'} have done this -{' '}
          <span className="font-semibold">{reveal.haveNotCount ?? 0}</span> never have.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {sorted.map((row, index) => {
              const percent = totalVotes === 0 ? 0 : Math.round((row.count / totalVotes) * 100);
              const isWinner = reveal.winnerId !== null && row.optionId === reveal.winnerId;
              return (
                <div
                  key={row.optionId}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-2 ${
                    isWinner ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <span className="min-w-6 text-lg" aria-hidden="true">
                    {isWinner && voting.kind === 'most-likely-to' ? '👑' : `${index + 1}.`}
                  </span>
                  <span className="min-w-0 flex-1 break-words font-semibold text-ink">
                    {row.label}
                    {row.label === myName && (
                      <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                        You
                      </span>
                    )}
                  </span>
                  <div className="hidden h-3 w-40 shrink-0 overflow-hidden rounded-pill bg-surface-muted sm:block">
                    <div
                      className="h-full rounded-pill bg-primary transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-small font-semibold text-ink-muted">
                    {row.count} · {percent}%
                  </span>
                </div>
              );
            })}
          </div>
          {reveal.winnerId === null && (
            <p className="text-small text-ink-muted">No votes this round.</p>
          )}
        </>
      )}
      {isHost ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-primary-hover sm:self-start"
        >
          {voting.round >= voting.totalRounds ? 'See final results' : 'Next'}
        </button>
      ) : (
        <p className="text-small text-ink-muted">
          Waiting for the host, the next round starts automatically in a moment.
        </p>
      )}
    </div>
  );
}

/** Would You Rather, queue a player-submitted dilemma. */
function SubmitDilemma({
  onSubmit,
}: {
  onSubmit: (a: string, b: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border  border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="text-lg font-bold tracking-tight text-ink">Submit your own dilemma</h3>
      <p className="mt-1 text-small text-ink-muted">
        It joins the room's queue and appears in a future round.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          value={a}
          onChange={(event) => setA(event.target.value)}
          maxLength={160}
          placeholder="Option A, e.g. be able to fly 3 feet off the ground"
          aria-label="Dilemma option A"
          className="rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:ring-2 focus:ring-ink"
        />
        <input
          value={b}
          onChange={(event) => setB(event.target.value)}
          maxLength={160}
          placeholder="Option B, e.g. teleport to places you've been"
          aria-label="Dilemma option B"
          className="rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:ring-2 focus:ring-ink"
        />
      </div>
      <button
        type="button"
        disabled={busy || a.trim().length < 3 || b.trim().length < 3}
        onClick={() => {
          setBusy(true);
          void onSubmit(a.trim(), b.trim()).finally(() => {
            setA('');
            setB('');
            setBusy(false);
          });
        }}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-pill border border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-40"
      >
        {busy ? 'Adding…' : 'Add to queue'}
      </button>
    </div>
  );
}

/** NHIE wildness / MLT crowns running tallies. */
function Scoreboard({ voting, myName }: { voting: VotingGameState; myName: string | null }) {
  const rows = voting.kind === 'never-have-i-ever' ? voting.wildness : voting.crowns;
  const title = voting.kind === 'never-have-i-ever' ? 'Wildness score' : 'Crown count';
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="mb-2 text-lg font-bold tracking-tight text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-small text-ink-muted">No tallies yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.playerName}
              className="flex min-h-10 items-center justify-between px-3 text-body text-ink"
            >
              <span className="font-semibold">
                {row.playerName}
                {row.playerName === myName && (
                  <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                    You
                  </span>
                )}
              </span>
              <span className="text-ink-muted">{row.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Kind-specific game-end summary. */
function GameEndView({
  voting,
  myName,
  isHost,
  onRestart,
}: {
  voting: VotingGameState;
  myName: string | null;
  isHost: boolean;
  onRestart: () => void;
}) {
  const payload = voting.endPayload ?? {};
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface-raised p-4 sm:p-6 shadow-sm">
      <h2 className="font-display text-h2 text-ink">Game over!</h2>
      {voting.kind === 'this-or-that' && Array.isArray(payload.scores) && (
        <>
          <p className="text-body text-ink-muted">
            Herd alignment, how often your pick matched the room's majority:
          </p>
          <ol className="flex flex-col divide-y divide-border">
            {(payload.scores as { playerName: string; score: number }[]).map((entry, index) => (
              <li
                key={entry.playerName}
                className="flex min-h-12 items-center justify-between px-4 text-lg text-ink"
              >
                <span className="font-semibold">
                  {index === 0 ? '🐑' : `${index + 1}.`} {entry.playerName}
                  {entry.playerName === myName && (
                    <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary-deep">
                      You
                    </span>
                  )}
                </span>
                <span className="text-ink-muted">
                  {entry.score}/{voting.totalRounds}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
      {voting.kind === 'never-have-i-ever' && (
        <>
          <p className="text-body text-ink-muted">
            Final wildness, the number of confessions the room says you've lived:
          </p>
          <Scoreboard voting={voting} myName={myName} />
        </>
      )}
      {voting.kind === 'most-likely-to' && (
        <>
          <p className="text-body text-ink-muted">Most-crowned players of the game:</p>
          <Scoreboard voting={voting} myName={myName} />
        </>
      )}
      {voting.kind === 'would-you-rather' && (
        <p className="text-body text-ink-muted">
          {voting.totalRounds} dilemmas debated, the arguments were the real score.
        </p>
      )}
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

function ChatPanel({
  messages,
  onSend,
}: {
  messages: { kind: string; playerName: string; message: string; at: number }[];
  onSend: (message: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [draft, setDraft] = useState('');
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft;
    setDraft('');
    if (text.trim()) {
      void onSend(text);
    }
  };
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="mb-2 text-lg font-bold tracking-tight text-ink">Room chat</h3>
      <ul aria-live="polite" className="flex max-h-48 min-h-24 flex-col gap-2 overflow-y-auto pr-1">
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
          <li className="text-small text-ink-muted">The debate starts here!</li>
        )}
      </ul>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={300}
          placeholder="Type a message…"
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface-raised px-4 py-2.5 text-base text-ink transition-colors hover:border-border-strong focus:ring-2 focus:ring-ink"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-secondary px-5 text-small font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
