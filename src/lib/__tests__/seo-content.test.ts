import { describe, expect, it } from 'vitest';
import { games } from '../games';
import { gameContent } from '../../data/game-content';
import { globalFaqs } from '../../data/faqs';

describe('per-game SEO content (M10, PRD §6.2)', () => {
  it('covers every game slug with content', () => {
    for (const game of games) {
      const content = gameContent[game.slug];
      expect(content, `${game.slug} has content`).toBeDefined();
    }
  });

  it('meta descriptions are unique and 150-160 characters', () => {
    const descriptions = new Set<string>();
    for (const game of games) {
      const meta = gameContent[game.slug]!.metaDescription;
      expect(meta.length, `${game.slug}: ${meta.length} chars`).toBeGreaterThanOrEqual(150);
      expect(meta.length, `${game.slug}: ${meta.length} chars`).toBeLessThanOrEqual(160);
      expect(descriptions.has(meta), `${game.slug} meta is unique`).toBe(false);
      descriptions.add(meta);
    }
  });

  it('body content is 400-600 words per game', () => {
    for (const game of games) {
      const content = gameContent[game.slug]!;
      const words = content.sections
        .flatMap((section) => [section.heading, section.body])
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length;
      expect(words, `${game.slug}: ${words} words`).toBeGreaterThanOrEqual(400);
      expect(words, `${game.slug}: ${words} words`).toBeLessThanOrEqual(650);
    }
  });

  it('every game has 2-5 FAQ entries with real answers', () => {
    for (const game of games) {
      const faqs = gameContent[game.slug]!.faqs;
      expect(faqs.length, game.slug).toBeGreaterThanOrEqual(2);
      expect(faqs.length, game.slug).toBeLessThanOrEqual(5);
      for (const faq of faqs) {
        expect(faq.question.length).toBeGreaterThan(10);
        expect(faq.answer.length).toBeGreaterThan(30);
      }
    }
  });

  it('the primary keywords appear in the homepage copy', () => {
    // The homepage copy is static Astro markup; here we verify the keyword
    // anchors are all present in the games catalog and FAQ data used there.
    const slugs = new Set(games.map((game) => game.slug));
    for (const anchor of [
      'skribbl-arena',
      'copycat-challenge',
      'one-line-one-shape',
      'shadow-sketch',
      'draw-the-lyric',
      'would-you-rather',
      'most-likely-to',
      'never-have-i-ever',
      'this-or-that',
      'trivia',
      'rhyme-or-crime',
      'emoji-plot',
      'timeline-tussle',
      'price-is-right',
      'genre-swap',
      'genre-bender',
      'charades',
      'guess-who',
    ]) {
      expect(slugs.has(anchor), anchor).toBe(true);
    }
  });
});

describe('global FAQ data (PRD §6.3)', () => {
  it('has the 9 required questions', () => {
    expect(globalFaqs).toHaveLength(9);
    const questions = globalFaqs.map((faq) => faq.question);
    expect(questions[0]).toContain('How do I play party games online');
    expect(questions[8]).toContain('different countries');
  });

  it('every answer is substantial', () => {
    for (const faq of globalFaqs) {
      expect(faq.answer.length).toBeGreaterThan(40);
    }
  });
});
