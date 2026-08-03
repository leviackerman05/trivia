import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useSkribblGame } from './useSkribblGame';
import DrawingCanvas from '../components/DrawingCanvas';
import { getGame } from '../lib/games';
import { COLOR_PALETTE, DEFAULT_BRUSH_SIZE, DEFAULT_COLOR, type CanvasTool } from '../lib/canvas';
import type { SkribblRoundSummary, SkribblScoreEntry } from '../lib/skribbl';

/**
 * Skribbl Arena (PRD §5.1, M4) — the first fully playable room game.
 * Composes the shared room lobby (RoomLobbyPanel) with the round views:
 * word select (drawer only) → drawing canvas + chat → round results → podium.
 * All game state is server-authoritative via useSkribblGame.
 */

interface Props {
  gameSlug: string;
}

const BRUSH_SIZES = [2, 6, 12, 24] as const;

export default function SkribblArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: skribbl, actions: gameActions } = useSkribblGame(
    room?.code ?? null,
    myName ?? null
  );

  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [brushSize, setBrushSize] = useState<number>(DEFAULT_BRUSH_SIZE);
  const [tool, setTool] = useState<CanvasTool>('pen');
  /** Color applied by the fill tool (white when the eraser is armed). */
  const [fillColor, setFillColor] = useState<string>(DEFAULT_COLOR);
  const [chatDraft, setChatDraft] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const isDrawer = skribbl.drawerName !== null && skribbl.drawerName === myName;
  const inGame = room !== null && room.phase !== 'lobby';

  // Drawing-phase countdown (server deadline).
  useEffect(() => {
    if (skribbl.view !== 'drawing' || skribbl.endsAt === null) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [skribbl.view, skribbl.endsAt]);
  const secondsLeft =
    skribbl.view === 'drawing' && skribbl.endsAt !== null
      ? Math.max(0, Math.ceil((skribbl.endsAt - now) / 1000))
      : 0;

  const sendChatOrGuess = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatDraft;
    setChatDraft('');
    if (!text.trim()) {
      return;
    }
    // During the drawing phase short messages are guesses (server decides
    // match vs chat); everything else goes through the room chat.
    if (skribbl.view === 'drawing' && text.length <= 60) {
      void gameActions.sendGuess(text);
    } else {
      void roomActions.sendMessage(text);
    }
  };

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
          <CustomWordsBlock
            isHost={isHost}
            onApply={(words) => gameActions.setCustomWords(words)}
          />
        }
      />
    );
  }

  const sortedScores = [...room.players]
    .map((player) => ({ name: player.name, score: skribbl.scores[player.name] ?? 0 }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-pill bg-primary/20 px-5 py-2 font-mono text-lg font-semibold tracking-[0.25em] text-primary-deep">
          {room.code}
        </span>
        <span className="rounded-pill bg-green-100 px-4 py-1.5 text-xs font-semibold text-green-800">
          Round {skribbl.round} of {skribbl.totalRounds}
        </span>
        {skribbl.view === 'drawing' && (
          <span
            aria-live="polite"
            className={`rounded-pill px-4 py-1.5 font-mono text-sm font-semibold ${
              secondsLeft <= 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
            }`}
          >
            {secondsLeft}s
          </span>
        )}
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          {isDrawer ? `You're drawing — ${game?.name ?? ''}` : `Drawing: ${skribbl.drawerName}`}
        </span>
        <button
          type="button"
          onClick={() => roomActions.leaveRoom()}
          className="ml-auto rounded-pill border-3 border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          {skribbl.view === 'word-select' && (
            <WordSelectView
              choices={skribbl.choices}
              drawerName={skribbl.drawerName}
              isDrawer={isDrawer}
              onChoose={(word) => void gameActions.chooseWord(word)}
            />
          )}

          {skribbl.view === 'drawing' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PALETTE.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Color ${swatch}`}
                    aria-pressed={color === swatch && tool === 'pen'}
                    onClick={() => {
                      setColor(swatch);
                      setTool('pen');
                    }}
                    className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-110 ${
                      color === swatch && tool === 'pen'
                        ? 'scale-110 border-ink'
                        : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
                <button
                  type="button"
                  aria-label="Eraser"
                  aria-pressed={tool === 'eraser'}
                  onClick={() => setTool('eraser')}
                  className={`inline-flex h-9 min-w-14 items-center justify-center rounded-pill border-2 px-3 text-xs font-semibold ${
                    tool === 'eraser'
                      ? 'border-ink bg-secondary text-white'
                      : 'border-gray-300 bg-white text-ink hover:bg-gray-100'
                  }`}
                >
                  Eraser
                </button>
                <button
                  type="button"
                  aria-label="Fill (bucket) — tap the canvas to flood-fill"
                  aria-pressed={tool === 'fill'}
                  onClick={() => {
                    // Filling with the eraser armed paints white (patch holes).
                    setFillColor(tool === 'eraser' ? '#ffffff' : color);
                    setTool('fill');
                  }}
                  className={`inline-flex h-9 min-w-14 items-center justify-center rounded-pill border-2 px-3 text-xs font-semibold ${
                    tool === 'fill'
                      ? 'border-ink bg-secondary text-white'
                      : 'border-gray-300 bg-white text-ink hover:bg-gray-100'
                  }`}
                >
                  Fill
                </button>
                <span className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />
                {BRUSH_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-label={`Brush size ${size}`}
                    aria-pressed={brushSize === size}
                    onClick={() => setBrushSize(size)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-pill border-2 ${
                      brushSize === size
                        ? 'border-ink bg-primary/15'
                        : 'border-gray-300 bg-white hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className="rounded-full bg-ink"
                      style={{ width: size * 1.6, height: size * 1.6 }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
                <span className="mx-1 h-6 w-px bg-gray-300" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => void gameActions.undoStroke()}
                  className="rounded-pill border-2 border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-gray-100"
                >
                  Undo
                </button>
                <button
                  type="button"
                  onClick={() => void gameActions.clearCanvas()}
                  className="rounded-pill border-2 border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                >
                  Clear
                </button>
                {isHost && (
                  <button
                    type="button"
                    onClick={() => void gameActions.endRoundNow()}
                    className="ml-auto rounded-pill border-2 border-secondary bg-secondary px-3 py-1.5 text-xs font-semibold text-white hover:bg-secondary-dark"
                  >
                    End round now
                  </button>
                )}
              </div>

              <DrawingCanvas
                strokes={skribbl.strokes}
                onStroke={(stroke) => void gameActions.sendStroke(stroke)}
                onFill={(x, y) => {
                  void gameActions.sendFill(x, y, fillColor);
                  // One tap = one fill; return to the pen for the next stroke.
                  setTool('pen');
                }}
                enabled={isDrawer}
                color={color}
                brushSize={brushSize}
                tool={tool}
                ariaLabel={`Shared drawing canvas — ${isDrawer ? 'you are the drawer' : `waiting for ${skribbl.drawerName} to draw`}`}
              />

              <div className="flex flex-wrap items-center gap-3">
                <span className="flex gap-1 font-mono text-2xl font-semibold tracking-[0.35em] text-ink">
                  {Array.from({ length: skribbl.wordLength ?? 0 }, (_, index) => {
                    const last = (skribbl.wordLength ?? 1) - 1;
                    if (skribbl.firstLetter && index === 0) {
                      return <span key={index}>{skribbl.firstLetter}</span>;
                    }
                    if (skribbl.lastLetter && index === last && last > 0) {
                      return <span key={index}>{skribbl.lastLetter}</span>;
                    }
                    return <span key={index}>•</span>;
                  })}
                </span>
                <span aria-live="polite" className="text-small text-ink-muted">
                  {skribbl.guessFeedback ?? 'First letter at 30s, last letter at 45s.'}
                </span>
              </div>
            </div>
          )}

          {skribbl.view === 'round-results' && (
            <RoundResultsView
              summary={skribbl.summary}
              round={skribbl.round}
              totalRounds={skribbl.totalRounds}
              isHost={isHost}
              onNext={() => void gameActions.nextRound()}
            />
          )}

          {skribbl.view === 'game-end' && (
            <GameEndView
              finalScores={skribbl.finalScores}
              myName={myName}
              isHost={isHost}
              onRestart={() => void gameActions.restartGame()}
            />
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="rounded-lg border-2 border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-2 font-display text-h4 text-ink">Scores</h3>
            <ol className="flex flex-col divide-y-2 divide-dashed divide-gray-200">
              {sortedScores.map((entry, index) => (
                <li
                  key={entry.name}
                  className="flex min-h-11 items-center justify-between px-4 text-body text-ink"
                >
                  <span className="font-semibold">
                    {index + 1}. {entry.name}
                    {entry.name === myName && (
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

          <div className="flex flex-col rounded-lg border-2 border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-2 font-display text-h4 text-ink">Room chat</h3>
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
                <li className="text-small text-ink-muted">Guesses go here during the round!</li>
              )}
            </ul>
            <form onSubmit={sendChatOrGuess} className="mt-3 flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                maxLength={300}
                placeholder={skribbl.view === 'drawing' ? 'Type your guess…' : 'Type a message…'}
                aria-label={skribbl.view === 'drawing' ? 'Guess' : 'Chat message'}
                className="min-w-0 flex-1 rounded-md border-2 border-gray-200 bg-white px-4 py-2.5 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
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
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-red-500 bg-red-50 px-4 py-3 text-body text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Drawer-only word pick (PRD §5.1: 3 choices, drawer picks one). */
function WordSelectView({
  choices,
  drawerName,
  isDrawer,
  onChoose,
}: {
  choices: string[] | null;
  drawerName: string | null;
  isDrawer: boolean;
  onChoose: (word: string) => void;
}) {
  if (!isDrawer) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 bg-white p-10 text-center shadow-sm">
        <p className="font-display text-h3 text-ink">Waiting for the drawer…</p>
        <p className="text-body text-ink-muted">{drawerName} is picking a word.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="font-display text-h3 text-ink">Pick your word</h3>
      <p className="text-body text-ink-muted">
        Choose one of these — everyone else will try to guess it from your drawing.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {choices?.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => onChoose(word)}
            className="inline-flex min-h-16 items-center justify-center rounded-pill border-3 border-primary bg-white px-6 py-3 text-xl font-semibold text-primary-strong transition-colors hover:bg-primary/15 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Round reveal: word, who got it, drawer's cut (PRD §5.1). */
function RoundResultsView({
  summary,
  round,
  totalRounds,
  isHost,
  onNext,
}: {
  summary: SkribblRoundSummary | null;
  round: number;
  totalRounds: number;
  isHost: boolean;
  onNext: () => void;
}) {
  if (!summary) {
    return null;
  }
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="font-display text-h3 text-ink">
        The word was <span className="text-primary-deep">{summary.word}</span>
      </h3>
      <div className="flex flex-col gap-2">
        {summary.correct.length === 0 ? (
          <p className="text-body text-ink-muted">
            Nobody guessed it this round — {summary.drawerName} drew a stumper!
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {summary.correct.map((entry) => (
              <li key={entry.playerName} className="text-body text-ink">
                <span className="font-semibold">{entry.playerName}</span> +{entry.points} points
              </li>
            ))}
          </ul>
        )}
        <p className="text-body text-ink">
          <span className="font-semibold">{summary.drawerName}</span> earns{' '}
          <span className="font-semibold">+{summary.drawerPoints}</span> as the drawer
        </p>
      </div>
      {isHost ? (
        <button
          type="button"
          onClick={onNext}
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
        >
          {round >= totalRounds ? 'See final results' : 'Next round'}
        </button>
      ) : (
        <p className="text-small text-ink-muted">
          Waiting for the host — the next round starts automatically in a moment.
        </p>
      )}
    </div>
  );
}

/** Final podium (PRD §5.1). */
function GameEndView({
  finalScores,
  myName,
  isHost,
  onRestart,
}: {
  finalScores: SkribblScoreEntry[] | null;
  myName: string | null;
  isHost: boolean;
  onRestart: () => void;
}) {
  const final = finalScores ?? [];
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="font-display text-h2 text-ink">
        {final[0] ? `${final[0].playerName} wins!` : 'Game over'}
      </h3>
      <ol className="flex flex-col divide-y-2 divide-dashed divide-gray-200">
        {final.map((entry, index) => (
          <li
            key={entry.playerName}
            className="flex min-h-14 items-center justify-between px-5 text-lg text-ink"
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
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
        >
          Play again
        </button>
      ) : (
        <p className="text-small text-ink-muted">Waiting for the host to start another game.</p>
      )}
    </div>
  );
}

/** Host-only custom word list (PRD §5.1: paste your own words). */
function CustomWordsBlock({
  isHost,
  onApply,
}: {
  isHost: boolean;
  onApply: (words: string[]) => Promise<{ ok: boolean; error?: string; count?: number }>;
}) {
  const [draft, setDraft] = useState('');
  const [applying, setApplying] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!isHost) {
    return null;
  }

  const apply = async () => {
    const words = draft
      .split(/[\n,]+/)
      .map((word) => word.trim())
      .filter(Boolean);
    if (words.length < 3) {
      setFeedback({ kind: 'error', text: 'Enter at least 3 words.' });
      return;
    }
    setApplying(true);
    setFeedback(null);
    const result = await onApply(words);
    setApplying(false);
    if (result.ok) {
      setFeedback({
        kind: 'ok',
        text: `${result.count ?? words.length} custom words ready — applied when the game starts.`,
      });
    } else {
      setFeedback({
        kind: 'error',
        text: 'That list was rejected — use 3–200 words with letters, spaces, hyphens, or apostrophes.',
      });
    }
  };

  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-5 shadow-sm">
      <h3 className="font-display text-h4 text-ink">Custom words (host)</h3>
      <p className="mt-1 text-small text-ink-muted">
        Optional: paste your own word list — one per line or comma-separated — to replace the
        built-in bank.
      </p>
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={'pizza\nastronaut\nbanana'}
        aria-label="Custom word list"
        className="mt-3 w-full rounded-md border-2 border-gray-200 bg-white px-4 py-3 text-lg text-ink transition-colors hover:border-gray-400 focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={applying || !draft.trim()}
          onClick={() => void apply()}
          className="inline-flex min-h-11 items-center justify-center rounded-pill border-3 border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-40"
        >
          {applying ? 'Applying…' : 'Apply word list'}
        </button>
        {feedback && (
          <span
            role="status"
            className={`text-small font-semibold ${
              feedback.kind === 'ok' ? 'text-green-700' : 'text-red-700'
            }`}
          >
            {feedback.text}
          </span>
        )}
      </div>
    </div>
  );
}
