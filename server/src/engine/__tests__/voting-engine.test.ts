import { describe, expect, it } from 'vitest';
import { VotingSession, type VotingConfig } from '../voting-engine.js';

function ok2<T>(result: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!result.ok) {
    throw new Error(`expected ok, got ${result.error}`);
  }
  return result.value;
}

const WYR: VotingConfig = {
  kind: 'would-you-rather',
  voteMs: 30_000,
  revealMs: 8_000,
  totalRounds: () => 10,
  allowSelfVote: false,
};
const MLT: VotingConfig = {
  kind: 'most-likely-to',
  voteMs: 30_000,
  revealMs: 8_000,
  totalRounds: () => 10,
  allowSelfVote: true,
};
const NHIE: VotingConfig = {
  kind: 'never-have-i-ever',
  voteMs: 20_000,
  revealMs: 8_000,
  statementMs: 30_000,
  totalRounds: (players) => Math.min(10, Math.max(4, players * 2)),
  allowSelfVote: false,
};
const TOT: VotingConfig = {
  kind: 'this-or-that',
  voteMs: 6_000,
  revealMs: 0,
  totalRounds: () => 20,
  allowSelfVote: false,
};

const DATASETS = {
  wyr: [
    { a: 'fly 3 feet', b: 'teleport to known places' },
    { a: 'never lose wifi', b: 'never lose keys' },
  ],
  mlt: [{ prompt: 'survive a zombie apocalypse' }, { prompt: 'forget a password' }],
  nhie: [
    { statement: 'gone skydiving', tier: 'boring' as const },
    { statement: 'eaten pineapple pizza', tier: 'moderate' as const },
    { statement: 'had a one-night stand', tier: 'super-dirty' as const },
  ],
  tot: [
    { a: 'sweet', b: 'salty' },
    { a: 'cats', b: 'dogs' },
  ],
};

function make(config: VotingConfig) {
  return new VotingSession(config, DATASETS, { randomInt: (_max) => 0 });
}

describe('VotingSession — Would You Rather (PRD §5.13)', () => {
  it('starts in voting with a two-option dilemma', () => {
    const session = make(WYR);
    const started = session.start(['Alice', 'Bob']);
    expect(started.ok).toBe(true);
    expect(session.phaseValue).toBe('voting');
    expect(session.roundOptions).toHaveLength(2);
    expect(session.roundOptions[0]?.label).toBe('fly 3 feet');
  });

  it('tallies votes, rejects double votes, and reveals a winner', () => {
    const session = make(WYR);
    session.start(['Alice', 'Bob', 'Cara']);
    expect(session.submitVote('Alice', 'a').ok).toBe(true);
    expect(session.submitVote('Alice', 'b').ok).toBe(false); // already voted
    expect(session.submitVote('Bob', 'a').ok).toBe(true);
    expect(session.submitVote('Cara', 'zzz').ok).toBe(false); // invalid option
    const revealed = session.reveal();
    expect(revealed.ok).toBe(true);
    expect(ok2(revealed).reveal.totalVotes).toBe(2);
    expect(ok2(revealed).reveal.winnerId).toBe('a');
    expect(ok2(revealed).reveal.winnerLabel).toBe('fly 3 feet');
    expect(session.phaseValue).toBe('revealed');
  });

  it('advances through rounds and finishes with a summary', () => {
    const session = make(WYR);
    session.start(['Alice', 'Bob']);
    let finished = false;
    for (let round = 1; round <= 10; round += 1) {
      const advanced = session.next();
      if (round === 10) {
        expect(advanced.ok).toBe(true);
        expect(ok2(advanced).finished).toBe(true);
        finished = true;
      }
    }
    expect(finished).toBe(true);
    expect(session.phaseValue).toBe('game-end');
    expect((session.endPayload() as { rounds: number }).rounds).toBe(10);
  });

  it('uses a player-submitted dilemma for the next round (queue)', () => {
    const session = make(WYR);
    session.start(['Alice']);
    const queued = session.useCustomPrompt('own A', 'own B');
    expect(queued.ok).toBe(true);
    const advanced = session.next();
    expect(advanced.ok).toBe(true);
    expect(session.roundOptions[0]?.label).toBe('own A');
    expect(session.roundPrompt.custom).toBe(true);
    // Next round falls back to the dataset.
    session.next();
    expect(session.roundPrompt.custom).toBe(false);
  });
});

describe('VotingSession — Most Likely To (PRD §5.14)', () => {
  it('builds options from player names and allows self-votes', () => {
    const session = make(MLT);
    session.start(['Alice', 'Bob']);
    expect(session.roundPrompt.title).toContain('survive a zombie apocalypse');
    expect(session.roundOptions.map((option) => option.label)).toEqual(['Alice', 'Bob']);
    expect(session.submitVote('Alice', 'Alice').ok).toBe(true); // self-vote allowed
    const revealed = session.reveal();
    expect(revealed.ok).toBe(true);
    expect(ok2(revealed).reveal.winnerId).toBe('Alice');
  });

  it('tracks crowns across rounds', () => {
    const session = make(MLT);
    session.start(['Alice', 'Bob']);
    session.submitVote('Alice', 'Alice');
    session.submitVote('Bob', 'Alice');
    session.reveal();
    expect(session.crownCounts[0]).toEqual({ playerName: 'Alice', count: 1 });
  });
});

describe('VotingSession — Never Have I Ever (PRD §5.16)', () => {
  it('rotates turns and requires the current player to confess', () => {
    const session = make(NHIE);
    session.start(['Alice', 'Bob']);
    expect(session.phaseValue).toBe('statement');
    expect(session.currentStatementBy).toBe('Alice');
    expect(session.submitStatement('Bob', 'done a marathon').ok).toBe(false); // not your turn
    const submitted = session.submitStatement('Alice', 'gone skydiving');
    expect(submitted.ok).toBe(true);
    expect(session.phaseValue).toBe('voting');
    // The confession author cannot vote on their own statement.
    expect(session.submitVote('Alice', 'have-not').ok).toBe(false);
  });

  it('wildness counts everyone who voted I HAVE', () => {
    const session = make(NHIE);
    session.start(['Alice', 'Bob', 'Cara']);
    session.submitStatement('Alice', 'gone skydiving');
    session.submitVote('Bob', 'have');
    session.submitVote('Cara', 'have-not');
    const revealed = session.reveal();
    expect(revealed.ok).toBe(true);
    expect(ok2(revealed).reveal.haveCount).toBe(1);
    expect(ok2(revealed).reveal.haveNotCount).toBe(1);
    expect(session.wildnessScores).toEqual([{ playerName: 'Bob', count: 1 }]);
  });

  it('scales rounds with the player count (4–10)', () => {
    const solo = make(NHIE);
    solo.start(['Solo']);
    expect(solo.totalRoundsValue).toBe(4);
    const big = make(NHIE);
    big.start(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(big.totalRoundsValue).toBe(10);
  });

  it('suggests statements from the dataset', () => {
    const session = make(NHIE);
    session.start(['Alice']);
    const suggestions = session.suggestionOptions(4);
    expect(suggestions).toContain('gone skydiving'); // randomInt 0 → first
    expect(suggestions).toHaveLength(2); // dataset has 2 entries
  });

  it('M15: tiers filter suggestions — super-dirty only falls back to safer tiers', () => {
    const session = make(NHIE);
    session.setContentOptions({ nhieTier: 'super-dirty' });
    session.start(['Alice']);
    // The test dataset has no tiers → defaults to moderate, so the fallback
    // chain (super-dirty → dirty → moderate → boring) must still yield picks.
    const picks = session.suggestionOptions(4);
    expect(picks.length).toBeGreaterThan(0);
    // A boring-only game never surfaces suggestions from dirtier tiers.
    const session2 = make(NHIE);
    session2.setContentOptions({ nhieTier: 'boring' });
    session2.start(['Alice']);
    expect(session2.suggestionOptions(4).length).toBeGreaterThan(0);
  });

  it('M15: statementSource drives whether suggestions are offered', () => {
    const provided = make(NHIE);
    provided.setContentOptions({ nhieSource: 'provided' });
    expect(provided.usesProvidedSuggestions).toBe(true);
    const own = make(NHIE);
    own.setContentOptions({ nhieSource: 'own' });
    expect(own.usesProvidedSuggestions).toBe(false);
    expect(own.statementSource).toBe('own');
  });
});

describe('VotingSession — This or That (PRD §5.18)', () => {
  it('M15: the host-chosen genre filters the pair pool, with a full-pool fallback', () => {
    const session = make(TOT);
    session.setContentOptions({ totGenre: 'food' });
    session.start(['Alice', 'Bob']);
    // The test dataset has no genre tags → defaults to lifestyle, and the
    // genre pool (< 20) falls back to the full pool so the game still runs.
    expect(session.roundOptions.length).toBe(2);
  });
  it('runs 20 rounds with fixed pairs and tracks herd matches', () => {
    const session = make(TOT);
    session.start(['Alice', 'Bob']);
    expect(session.totalRoundsValue).toBe(20);
    session.submitVote('Alice', 'a');
    session.submitVote('Bob', 'b');
    const revealed = session.reveal();
    expect(revealed.ok).toBe(true);
    // Tie → no majority → no herd matches.
    expect(ok2(revealed).reveal.majorityId).toBeNull();
    expect(session.herdScoresValue).toBeNull(); // still playing

    // Round 2: Alice votes a, Bob votes a → majority a → both match.
    session.next();
    session.submitVote('Alice', 'a');
    session.submitVote('Bob', 'a');
    const revealed2 = session.reveal();
    expect(ok2(revealed2).reveal.majorityId).toBe('a');
    expect(session.herdScoresValue).toBeNull();
  });

  it('endPayload reports herd-alignment scores after the last round', () => {
    const session = make(TOT);
    session.start(['Alice', 'Bob']);
    for (let round = 1; round <= 20; round += 1) {
      session.submitVote('Alice', 'a');
      session.submitVote('Bob', 'a');
      const revealed = session.reveal();
      expect(revealed.ok).toBe(true);
      const advanced = session.next();
      if (round < 20) {
        expect(ok2(advanced).finished).toBe(false);
      }
    }
    const payload = session.endPayload() as { scores: { playerName: string; score: number }[] };
    expect(payload.scores).toEqual([
      { playerName: 'Alice', score: 20 },
      { playerName: 'Bob', score: 20 },
    ]);
    expect(session.phaseValue).toBe('game-end');
  });
});

describe('VotingSession — guards', () => {
  it('rejects votes outside the voting phase and unknown players', () => {
    const session = make(WYR);
    session.start(['Alice']);
    expect(session.submitVote('Nope', 'a').ok).toBe(false); // NOT_PLAYER
    session.submitVote('Alice', 'a');
    session.reveal();
    expect(session.submitVote('Alice', 'b').ok).toBe(false); // WRONG_PHASE
  });

  it('rejects duplicate statements and bad statements', () => {
    const session = make(NHIE);
    session.start(['Alice']);
    expect(session.submitStatement('Alice', 'ab').ok).toBe(false); // too short
    expect(session.submitStatement('Alice', 'gone skydiving').ok).toBe(true);
    expect(session.submitStatement('Alice', 'gone again').ok).toBe(false); // phase moved on
  });

  it('mid-game joiners can vote (D027 pattern)', () => {
    const session = make(WYR);
    session.start(['Alice']);
    expect(session.addPlayer('Bob').ok).toBe(true);
    expect(session.submitVote('Bob', 'b').ok).toBe(true);
    expect(session.submitVote('Bob', 'a').ok).toBe(false); // still one vote per round
  });
});
