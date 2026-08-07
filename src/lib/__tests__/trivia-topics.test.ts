import { afterEach, describe, expect, it } from 'vitest';
import { hashString, type TriviaQuestion } from '../trivia';
import {
  bumpTopicReplay,
  getTopicRow,
  readTopicReplay,
  selectTopicQuestions,
  topicRegistry,
  topicSeed,
  TOPIC_REPLAY_KEY,
  type TopicQuestion,
} from '../trivia-topics';
import { ICON_PATHS } from '../icons';
import cricketJson from '../../data/topics/sports-cricket.json';
import spaceJson from '../../data/topics/science-space.json';
import hollywoodJson from '../../data/topics/movies-hollywood.json';

/**
 * M-T1 gates (TRIVIA-TOPICS §1.3 + §3/§4.5): registry invariants, the exact
 * seed contract, golden rotation properties, the replay counter, and the
 * on-demand loader with the sample topic files.
 */

const cricket = cricketJson as TopicQuestion[];
const space = spaceJson as TopicQuestion[];
const hollywood = hollywoodJson as TopicQuestion[];

describe('topic registry (TRIVIA-TOPICS §1.3)', () => {
  it('has 40 unique slugs', () => {
    expect(topicRegistry).toHaveLength(40);
    expect(new Set(topicRegistry.map((row) => row.slug)).size).toBe(40);
  });

  it('launches exactly the 15 §1.1 topics', () => {
    const launch = topicRegistry.filter((row) => row.launch).map((row) => row.slug);
    expect(launch).toEqual([
      'tv-general',
      'tv-friends',
      'movies-hollywood',
      'movies-bollywood',
      'movies-harry-potter',
      'bollywood-scandals',
      'sports-cricket',
      'sports-football',
      'sports-f1',
      'sports-tennis',
      'games-general',
      'music-bollywood',
      'history-india',
      'science-space',
      'food-india',
    ]);
    expect(launch).toHaveLength(15);
  });

  it('region, difficulty, label, and icon enums hold for every row', () => {
    for (const row of topicRegistry) {
      expect(['US', 'IN', 'global'], row.slug).toContain(row.region);
      expect([1, 2, 3], row.slug).toContain(row.difficulty);
      expect(row.label.length, row.slug).toBeGreaterThan(0);
      expect(ICON_PATHS[row.icon], `${row.slug} icon`).toBeTruthy();
    }
  });

  it('D058: at least 6 Indian-region topics at launch', () => {
    const launch = topicRegistry.filter((row) => row.launch);
    const indian = launch.filter((row) => row.region === 'IN');
    expect(indian.length).toBeGreaterThanOrEqual(6);
  });

  it('every launch slug resolves in the registry (file-name = slug contract)', () => {
    for (const row of topicRegistry.filter((entry) => entry.launch)) {
      expect(getTopicRow(row.slug)?.slug).toBe(row.slug);
    }
  });
});

describe('topic rotation seed contract (TRIVIA-TOPICS §3)', () => {
  it('first set of the day seeds from topic:dateKey; replays append :N', () => {
    expect(topicSeed('cricket', '2026-08-06', 0)).toBe(hashString('cricket:2026-08-06'));
    expect(topicSeed('cricket', '2026-08-06', 1)).toBe(hashString('cricket:2026-08-06:1'));
    expect(topicSeed('cricket', '2026-08-06', 2)).toBe(hashString('cricket:2026-08-06:2'));
  });

  it('same topic + date + replay ⇒ identical set, order, and option order', () => {
    const a = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', 0);
    const b = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', 0);
    expect(a.map((q) => q.question)).toEqual(b.map((q) => q.question));
    expect(a.map((q) => q.options)).toEqual(b.map((q) => q.options));
    // The remapped answer still points at the same text.
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i]!.options[a[i]!.answer]).toBe(b[i]!.options[b[i]!.answer]);
    }
  });

  it('adjacent days give different first sets', () => {
    const today = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', 0);
    const tomorrow = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-07', 0);
    expect(today.map((q) => q.question)).not.toEqual(tomorrow.map((q) => q.question));
  });

  it('replays 0/1/2 give different ordered sets', () => {
    const sets = [0, 1, 2].map((replay) =>
      selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', replay).map((q) => q.question)
    );
    expect(sets[0]).not.toEqual(sets[1]);
    expect(sets[1]).not.toEqual(sets[2]);
  });

  it('no in-game repeats; pick order is the round order', () => {
    const full = selectTopicQuestions([...cricket, ...space], 'mixed-test', '2026-08-06', 0);
    expect(full).toHaveLength(10);
    expect(new Set(full.map((q) => q.question)).size).toBe(10);
  });

  it('pool-edge contract: fewer than 10 entries returns all, seeded order', () => {
    const small = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', 0);
    expect(small).toHaveLength(cricket.length);
    expect(new Set(small.map((q) => q.question)).size).toBe(cricket.length);
  });

  it('classic rows (no topic fields) work through the same rotation', () => {
    const classicPool = cricket as TriviaQuestion[]; // any pool of TriviaQuestion
    const set = selectTopicQuestions(classicPool, 'classic', '2026-08-06', 0);
    expect(set).toHaveLength(cricket.length);
    expect(set.every((q) => Array.isArray(q.options) && q.options.length === 4)).toBe(true);
  });
});

describe('replay counter (TRIVIA-TOPICS §3)', () => {
  const fakeWindow = () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
      },
    };
    return store;
  };

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('reads 0 for a missing or cleared counter', () => {
    fakeWindow();
    expect(readTopicReplay('sports-cricket')).toBe(0);
  });

  it('bump is monotonic per topic and persists the {slug: number} shape', () => {
    const store = fakeWindow();
    expect(bumpTopicReplay('sports-cricket')).toBe(1);
    expect(bumpTopicReplay('sports-cricket')).toBe(2);
    expect(bumpTopicReplay('science-space')).toBe(1);
    const stored = JSON.parse(store.get(TOPIC_REPLAY_KEY)!) as Record<string, number>;
    expect(stored['sports-cricket']).toBe(2);
    expect(stored['science-space']).toBe(1);
  });

  it('the first play of a day ignores the stored counter (replay 0 seed)', () => {
    fakeWindow();
    bumpTopicReplay('sports-cricket'); // 1
    bumpTopicReplay('sports-cricket'); // 2
    // First play of the day: the island passes replay 0 — the seed is the
    // bare topic:dateKey string regardless of the stored counter.
    const firstOfDay = topicSeed('sports-cricket', '2026-08-06', 0);
    expect(firstOfDay).toBe(hashString('sports-cricket:2026-08-06'));
    const a = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', 0);
    const b = selectTopicQuestions(cricket, 'sports-cricket', '2026-08-06', 0);
    expect(a.map((q) => q.question)).toEqual(b.map((q) => q.question));
  });
});

describe('sample topic files (file-slug contract, §2.1)', () => {
  it('every row in a shipped file carries the file slug, difficulty, and 4 options', () => {
    const samples: [string, TopicQuestion[]][] = [
      ['sports-cricket', cricket],
      ['science-space', space],
      ['movies-hollywood', hollywood],
    ];
    for (const [slug, questions] of samples) {
      expect(questions.length, slug).toBeGreaterThanOrEqual(5);
      for (const question of questions) {
        expect(question.topic, slug).toBe(slug);
        expect([1, 2, 3]).toContain(question.difficulty);
        expect(question.options).toHaveLength(4);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(4);
      }
    }
  });
});
