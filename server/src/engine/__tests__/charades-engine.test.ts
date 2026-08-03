import { describe, expect, it } from 'vitest';
import { CharadesSession, type CharadesMovie } from '../charades-engine.js';

const MOVIES: CharadesMovie[] = [
  { title: 'Titanic', category: 'hollywood' },
  { title: 'Inception', category: 'hollywood' },
  { title: 'Sholay', category: 'bollywood' },
  { title: 'Dangal', category: 'bollywood' },
];

function make() {
  return new CharadesSession(MOVIES, { roundMs: 60_000 }, { randomInt: (_max) => 0 });
}

describe('CharadesSession (PRD §5.12)', () => {
  it('starts with the first actor and a movie matching the category', () => {
    const session = make();
    const started = session.start(['Alice', 'Bob'], 'hollywood');
    expect(started.ok).toBe(true);
    expect(session.phaseValue).toBe('acting');
    expect(session.currentActor).toBe('Alice');
    expect(session.currentMovie?.category).toBe('hollywood');
    expect(session.totalRoundsValue).toBe(2); // pass-the-phone
  });

  it('mixed draws from the whole pool; bollywood filters', () => {
    const mixed = make();
    mixed.start(['Alice'], 'mixed');
    expect(mixed.currentMovie).not.toBeNull();
    const bollywood = make();
    bollywood.start(['Alice'], 'bollywood');
    expect(bollywood.currentMovie?.category).toBe('bollywood');
  });

  it('markCorrect scores +1 and rotates to the next actor', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'mixed');
    expect(ok2(session.markCorrect('Bob'))).toMatchObject({ score: 1, finished: false });
    const advanced = session.next();
    expect(ok2(advanced)).toMatchObject({ finished: false });
    expect(session.currentActor).toBe('Bob');
    expect(session.scoreValue).toBe(1);
  });

  it('finishes after every actor has acted and reports the team score', () => {
    const session = make();
    session.start(['Alice', 'Bob'], 'mixed');
    session.markCorrect('Alice');
    session.next();
    session.markCorrect('Bob');
    const advanced = session.next();
    expect(ok2(advanced).finished).toBe(true);
    expect(session.phaseValue).toBe('game-end');
    const payload = session.endPayload() as { kind: string; score: number };
    expect(payload.kind).toBe('charades');
    expect(payload.score).toBe(2);
  });

  it('rejects bad categories and late marks', () => {
    const session = make();
    expect(session.start(['Alice'], 'kpop' as 'mixed').ok).toBe(false);
    session.start(['Alice'], 'mixed');
    session.next(); // → game-end after 1 round
    expect(session.markCorrect('Alice').ok).toBe(false); // WRONG_PHASE
  });
});

function ok2<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}
