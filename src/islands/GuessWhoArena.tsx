import { useMemo, useState, type SyntheticEvent } from 'react';
import { useRoom } from './room/useRoom';
import RoomLobbyPanel from './room/RoomLobbyPanel';
import { useGuessWhoGame } from './useGuessWhoGame';
import { getGame } from '../lib/games';
import type { CelebrityView, GuessWhoGameState } from '../lib/guess-who';

/**
 * Guess Who? Celebrity Edition arena (M9, PRD §5.17), the host (answerer)
 * holds a secret celebrity with trait objects; everyone else asks yes/no
 * questions (the answerer judges), sees the question log, and can guess at
 * any time. 20-question cap → reveal. The secret is answerer-only (D023).
 */

interface Props {
  gameSlug: string;
}

export default function GuessWhoArena({ gameSlug }: Props) {
  const game = getGame(gameSlug);
  const { status, error, room, messages, actions: roomActions, myName } = useRoom();
  const { game: gw, actions: gameActions } = useGuessWhoGame(room?.code ?? null, myName ?? null);

  const [questionDraft, setQuestionDraft] = useState('');
  const [guessDraft, setGuessDraft] = useState('');

  const isHost = useMemo(
    () => room?.players.some((player) => player.isHost && player.connected) ?? false,
    [room]
  );
  const inGame = room !== null && room.phase !== 'lobby';
  const isAnswerer = gw.answerer !== null && gw.answerer === myName;
  const openQuestion = [...gw.questions].reverse().find((entry) => entry.answer === null) ?? null;

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
      />
    );
  }

  const ask = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = questionDraft;
    setQuestionDraft('');
    if (text.trim()) {
      void gameActions.askQuestion(text);
    }
  };

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
          Round {gw.round} of {gw.totalRounds} · {gw.questionCount}/{gw.maxQuestions} questions
        </span>
        <span className="rounded-pill bg-tertiary/40 px-4 py-1.5 text-xs font-semibold text-ink">
          {isAnswerer ? 'You hold the secret' : `${gw.answerer} holds the secret`}
        </span>
        <button
          type="button"
          onClick={() => roomActions.leaveRoom()}
          className="ml-auto rounded-pill border-3 border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15"
        >
          Leave room
        </button>
      </div>

      {gw.view === 'questioning' && isAnswerer && (
        <AnswererView
          celebrity={gw.celebrity}
          openQuestion={openQuestion}
          onAnswer={(yes) => void gameActions.answerYesNo(yes)}
        />
      )}

      {gw.view === 'questioning' && !isAnswerer && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
            <h2 className="font-display text-h2 text-ink">Who is the secret celebrity?</h2>
            <p className="mt-1 text-body text-ink-muted">
              Ask yes/no questions to narrow it down, you can guess the name at any time.
            </p>
            <form onSubmit={ask} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={questionDraft}
                onChange={(event) => setQuestionDraft(event.target.value)}
                maxLength={140}
                placeholder="Are they alive? Are they an actor?"
                aria-label="Yes/no question"
                className="min-w-0 flex-1 rounded-md border-2 border-border bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-border-strong focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
              />
              <button
                type="submit"
                disabled={!questionDraft.trim()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-6 text-small font-semibold text-white shadow-teal transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40"
              >
                Ask
              </button>
            </form>
            <form onSubmit={guess} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={guessDraft}
                onChange={(event) => setGuessDraft(event.target.value)}
                maxLength={60}
                placeholder="Guess the name…"
                aria-label="Celebrity guess"
                className="min-w-0 flex-1 rounded-md border-2 border-dashed border-primary/50 bg-surface-raised px-4 py-2.5 text-lg text-ink transition-colors hover:border-primary focus:border-primary-strong focus:outline-none focus:ring-4 focus:ring-primary/25"
              />
              <button
                type="submit"
                disabled={!guessDraft.trim()}
                className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-6 text-small font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
              >
                Guess!
              </button>
            </form>
          </div>

          <QuestionLog questions={gw.questions} />
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
        <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
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
            <ol className="flex flex-col divide-y-2 divide-dashed divide-border">
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
              className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
            >
              Play again
            </button>
          ) : (
            <p className="text-small text-ink-muted">Waiting for the host to start another game.</p>
          )}
        </div>
      )}

      {gw.feedback && (
        <p role="status" className="text-small font-semibold text-danger-strong">
          {gw.feedback}
        </p>
      )}

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

/** M17, between-round reveal: the celebrity, facts, scores, and the
 * host's advance control ("next celebrity" / "final results"). */
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
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
      <h2 className="font-display text-h2 text-ink">
        {gw.winner ? `🎉 ${gw.winner} guessed it!` : 'Nobody got it this round'}
      </h2>
      {revealed && (
        <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 p-5">
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
          className="inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-strong px-7 py-3 text-lg font-semibold text-white shadow-coral transition-colors hover:bg-primary-hover sm:self-start"
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

/** The answerer's card: secret celebrity + traits + yes/no controls. */
function AnswererView({
  celebrity,
  openQuestion,
  onAnswer,
}: {
  celebrity: CelebrityView | null;
  openQuestion: { playerName: string; question: string } | null;
  onAnswer: (yes: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border-2 border-border bg-surface-raised p-6 shadow-sm">
      <h2 className="font-display text-h3 text-ink">You hold the secret</h2>
      {celebrity && (
        <div className="rounded-lg border-2 border-dashed border-primary/50 bg-primary/10 p-5">
          <p className="text-center font-display text-h2 text-primary-deep">{celebrity.name}</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-body text-ink sm:grid-cols-3">
            <li>
              <span className="font-semibold">Gender:</span>{' '}
              {celebrity.gender === 'f' ? 'Female' : 'Male'}
            </li>
            <li>
              <span className="font-semibold">Status:</span>{' '}
              {celebrity.alive ? 'Alive' : 'Deceased'}
            </li>
            <li>
              <span className="font-semibold">Profession:</span> {celebrity.profession}
            </li>
            <li>
              <span className="font-semibold">Nationality:</span> {celebrity.nationality}
            </li>
            <li>
              <span className="font-semibold">Age:</span> {celebrity.ageRange}
            </li>
            <li>
              <span className="font-semibold">Hair:</span> {celebrity.hairColor}
            </li>
          </ul>
          <p className="mt-2 text-small text-ink-muted">Famous for: {celebrity.famousFor}</p>
        </div>
      )}
      {openQuestion ? (
        <div className="flex flex-col gap-3">
          <p className="text-body text-ink">
            <span className="font-semibold">{openQuestion.playerName} asks:</span> “
            {openQuestion.question}”
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onAnswer(true)}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-pill bg-green-600 px-6 text-lg font-bold text-white shadow-teal transition-colors hover:bg-green-700"
            >
              ✅ Yes
            </button>
            <button
              type="button"
              onClick={() => onAnswer(false)}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-pill bg-red-600 px-6 text-lg font-bold text-white shadow-coral transition-colors hover:bg-red-700"
            >
              ❌ No
            </button>
          </div>
        </div>
      ) : (
        <p className="text-body text-ink-muted">Waiting for a question…</p>
      )}
    </div>
  );
}

/** The question log everyone (except the answerer) sees. */
function QuestionLog({
  questions,
}: {
  questions: { playerName: string; question: string; answer: boolean | null }[];
}) {
  return (
    <div className="rounded-lg border-2 border-border bg-surface-raised p-5 shadow-sm">
      <h3 className="mb-2 font-display text-h4 text-ink">Question log</h3>
      {questions.length === 0 ? (
        <p className="text-small text-ink-muted">No questions yet, ask away!</p>
      ) : (
        <ol className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1">
          {questions.map((entry, index) => (
            <li key={index} className="text-body text-ink">
              <span className="font-semibold">{entry.playerName}:</span> “{entry.question}”
              {entry.answer !== null && (
                <span
                  className={
                    entry.answer
                      ? 'ml-1 font-semibold text-success-strong'
                      : 'ml-1 font-semibold text-danger-strong'
                  }
                >
                  → {entry.answer ? 'Yes' : 'No'}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
