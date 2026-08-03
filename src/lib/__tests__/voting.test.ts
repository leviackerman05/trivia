import { describe, expect, it } from 'vitest';
import {
  initialVotingState,
  votingReducer,
  type VotingAction,
  type VotingGameState,
  type VotingReveal,
} from '../voting';

function stateWith(overrides: Partial<VotingGameState> = {}): VotingGameState {
  return { ...initialVotingState(), myName: 'Me', ...overrides };
}

const roundStart = (overrides: Record<string, unknown> = {}): VotingAction => ({
  type: 'round-start' as const,
  myName: 'Me',
  payload: {
    kind: 'would-you-rather',
    phase: 'voting',
    prompt: { title: 'Would you rather…', subtitle: null },
    options: [
      { id: 'a', label: 'fly 3 feet' },
      { id: 'b', label: 'teleport to known places' },
    ],
    round: 1,
    totalRounds: 10,
    statementBy: null,
    statement: null,
    custom: false,
    endsAt: 1_750_000_000_000,
    ...overrides,
  },
});

describe('votingReducer — rounds and votes', () => {
  it('round-start enters the voting view with options and deadline', () => {
    const state = votingReducer(stateWith(), roundStart());
    expect(state.view).toBe('voting');
    expect(state.options).toHaveLength(2);
    expect(state.endsAt).toBe(1_750_000_000_000);
    expect(state.myName).toBe('Me');
  });

  it('statement phase carries the NHIE author and suggestions', () => {
    const state = votingReducer(
      stateWith(),
      roundStart({
        kind: 'never-have-i-ever',
        phase: 'statement',
        statementBy: 'Me',
        options: [
          { id: 'have', label: 'I HAVE' },
          { id: 'have-not', label: 'I HAVE NOT' },
        ],
        suggestions: ['gone skydiving', 'eaten pineapple pizza'],
      })
    );
    expect(state.view).toBe('statement');
    expect(state.statementBy).toBe('Me');
    expect(state.suggestions).toContain('gone skydiving');
  });

  it('vote-update refreshes live tallies; vote-cast locks my pick', () => {
    let state = votingReducer(stateWith(), roundStart());
    state = votingReducer(state, {
      type: 'vote-update',
      tallies: [
        { optionId: 'a', label: 'fly 3 feet', count: 2 },
        { optionId: 'b', label: 'teleport', count: 1 },
      ],
      totalVotes: 3,
    });
    expect(state.tallies[0]?.count).toBe(2);
    state = votingReducer(state, { type: 'vote-cast', optionId: 'b' });
    expect(state.myVote).toBe('b');
  });

  it('vote-reveal shows the winner and totals', () => {
    const reveal: VotingReveal = {
      kind: 'would-you-rather',
      tallies: [
        { optionId: 'a', label: 'fly 3 feet', count: 4 },
        { optionId: 'b', label: 'teleport', count: 1 },
      ],
      totalVotes: 5,
      winnerId: 'a',
      winnerLabel: 'fly 3 feet',
    };
    const state = votingReducer(stateWith({ view: 'voting' }), { type: 'vote-reveal', reveal });
    expect(state.view).toBe('revealed');
    expect(state.reveal?.winnerId).toBe('a');
  });

  it('this-or-that reveal updates the herd streak from the majority', () => {
    const base = stateWith({
      kind: 'this-or-that',
      view: 'voting',
      myVote: 'a',
      herdStreak: 2,
    });
    const matched = votingReducer(base, {
      type: 'vote-reveal',
      reveal: {
        kind: 'this-or-that',
        tallies: [],
        totalVotes: 2,
        winnerId: 'a',
        winnerLabel: 'sweet',
        majorityId: 'a',
      },
    });
    expect(matched.herdStreak).toBe(3);
    const left = votingReducer(base, {
      type: 'vote-reveal',
      reveal: {
        kind: 'this-or-that',
        tallies: [],
        totalVotes: 2,
        winnerId: 'b',
        winnerLabel: 'salty',
        majorityId: 'b',
      },
    });
    expect(left.herdStreak).toBe(0);
  });

  it('the streak survives the next round (no revealed phase for TOT)', () => {
    let state = stateWith({ kind: 'this-or-that', view: 'voting', myVote: 'a', herdStreak: 3 });
    state = votingReducer(state, roundStart({ kind: 'this-or-that', round: 2 }));
    expect(state.herdStreak).toBe(3);
    expect(state.view).toBe('voting');
  });
});

describe('votingReducer — game end', () => {
  it('this-or-that adopts the server herd score and shows the podium', () => {
    const state = votingReducer(
      stateWith({ kind: 'this-or-that', view: 'voting', herdStreak: 4 }),
      {
        type: 'game-end',
        payload: {
          kind: 'this-or-that',
          rounds: 20,
          scores: [
            { playerName: 'Me', score: 18 },
            { playerName: 'Bob', score: 12 },
          ],
          winner: 'Me',
        },
      }
    );
    expect(state.view).toBe('game-end');
    expect(state.herdMatches).toBe(18);
    expect((state.endPayload?.scores as { playerName: string }[])[0]?.playerName).toBe('Me');
  });

  it('never-have-i-ever adopts wildness tallies', () => {
    const state = votingReducer(stateWith({ kind: 'never-have-i-ever' }), {
      type: 'game-end',
      payload: {
        kind: 'never-have-i-ever',
        rounds: 8,
        wildness: [
          { playerName: 'Bob', count: 3 },
          { playerName: 'Me', count: 1 },
        ],
      },
    });
    expect(state.wildness[0]).toEqual({ playerName: 'Bob', count: 3 });
  });

  it('most-likely-to adopts crown tallies', () => {
    const state = votingReducer(stateWith({ kind: 'most-likely-to' }), {
      type: 'game-end',
      payload: {
        kind: 'most-likely-to',
        rounds: 10,
        crowns: [{ playerName: 'Cara', count: 4 }],
      },
    });
    expect(state.crowns[0]).toEqual({ playerName: 'Cara', count: 4 });
  });
});

describe('votingReducer — resync and reset', () => {
  it('resync rebuilds a mid-game snapshot', () => {
    const state = votingReducer(stateWith({ view: 'voting', round: 3 }), {
      type: 'resync',
      myName: 'Me',
      state: {
        view: 'voting',
        kind: 'most-likely-to',
        prompt: { title: 'Who is most likely to…?', subtitle: null },
        options: [
          { id: 'Alice', label: 'Alice' },
          { id: 'Bob', label: 'Bob' },
        ],
        round: 5,
        totalRounds: 10,
        statementBy: null,
        statement: null,
        tallies: [],
        reveal: null,
        myVote: 'Alice',
        endsAt: 123,
      },
    });
    expect(state.round).toBe(5);
    expect(state.kind).toBe('most-likely-to');
    expect(state.myVote).toBe('Alice');
  });

  it('reset clears the game but keeps my name', () => {
    const state = votingReducer(stateWith({ round: 7, view: 'revealed' }), { type: 'reset' });
    expect(state.round).toBe(0);
    expect(state.myName).toBe('Me');
  });
});
