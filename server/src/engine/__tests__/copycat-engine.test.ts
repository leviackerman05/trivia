import { describe, expect, it } from 'vitest';
import { COPYCAT_AWARDS, CopycatSession, type CopycatImage } from '../copycat-engine.js';

const TEST_IMAGES: CopycatImage[] = [
  {
    title: 'Mona Lisa',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mona_Lisa.jpg',
    kind: 'painting',
  },
  {
    title: 'Starry Night',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Starry_Night.jpg',
    kind: 'painting',
  },
  {
    title: 'Earthrise',
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Earthrise.jpg',
    kind: 'photo',
  },
];

function makeSession() {
  return new CopycatSession(TEST_IMAGES, { randomInt: (_max) => 0 });
}

function startThree() {
  const session = makeSession();
  const started = session.start(['Alice', 'Bob', 'Cara']);
  expect(started.ok).toBe(true);
  return session;
}

describe('CopycatSession, lifecycle (PRD §5.4)', () => {
  it('starts in image-reveal with a picked image and requires ≥1 player', () => {
    const session = makeSession();
    expect(session.start([]).ok).toBe(false);
    const started = ok2(session.start(['Solo']));
    expect(session.phaseValue).toBe('image-reveal');
    expect(started.image.title).toBe('Mona Lisa'); // randomInt 0 → first image
  });

  it('moves through reveal → drawing → voting → results', () => {
    const session = startThree();
    ok2(session.beginDrawing());
    expect(session.phaseValue).toBe('drawing');
    for (const name of ['Alice', 'Bob', 'Cara']) {
      const submitted = session.submitDrawing(name, 'data:image/png;base64,AAA');
      expect(submitted.ok).toBe(true);
      if (submitted.ok) {
        expect(submitted.value.allSubmitted).toBe(name === 'Cara');
      }
    }
    ok2(session.beginVoting());
    expect(session.phaseValue).toBe('voting');
    // Everyone votes for Alice in every category (except Alice → Bob).
    const voters = ['Alice', 'Bob', 'Cara'];
    for (const voter of voters) {
      for (const category of COPYCAT_AWARDS) {
        const target = voter === 'Alice' ? 'Bob' : 'Alice';
        const voted = session.submitVote(voter, category, target);
        expect(voted.ok).toBe(true);
      }
    }
    const finished = ok2(session.finish());
    expect(session.phaseValue).toBe('results');
    expect(finished.awards).toHaveLength(3);
    for (const award of finished.awards) {
      expect(award.winner).toBe('Alice');
      expect(award.votes[0]).toMatchObject({ playerName: 'Alice', count: 2 });
    }
  });

  it('rejects invalid votes: self, unknown target/category, double votes', () => {
    const session = startThree();
    ok2(session.beginDrawing());
    session.submitDrawing('Alice', 'img-a');
    session.submitDrawing('Bob', 'img-b');
    session.submitDrawing('Cara', 'img-c');
    ok2(session.beginVoting());

    expectError2(session.submitVote('Alice', 'recognizable', 'Alice'), 'CANNOT_VOTE_SELF');
    expectError2(session.submitVote('Alice', 'nope' as never, 'Bob'), 'INVALID_VOTE');
    expectError2(session.submitVote('Alice', 'recognizable', 'Ghost'), 'INVALID_VOTE');
    expect(session.submitVote('Alice', 'recognizable', 'Bob').ok).toBe(true);
    expectError2(session.submitVote('Alice', 'recognizable', 'Cara'), 'ALREADY_VOTED');
  });

  it('caps drawing uploads and rejects missing players', () => {
    const session = startThree();
    expectError2(session.submitDrawing('Alice', 'img'), 'WRONG_PHASE'); // reveal phase
    ok2(session.beginDrawing());
    expectError2(session.submitDrawing('Ghost', 'img'), 'NOT_PLAYER');
    expectError2(session.submitDrawing('Alice', 'x'.repeat(400_001)), 'IMAGE_TOO_LARGE');
    expect(session.submitDrawing('Alice', 'data:image/png;base64,ok').ok).toBe(true);
  });
});

function ok2<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}

function expectError2<T>(
  result: { ok: true; value: T } | { ok: false; error: string },
  expected: string
): void {
  expect(result.ok).toBe(false);
  if (result.ok) {
    return;
  }
  expect(result.error).toBe(expected);
}
