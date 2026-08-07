/**
 * Topic-file loader (TRIVIA-TOPICS §2.2) at the ISLAND layer: import.meta.glob
 * code-splits every src/data/topics/{slug}.json into its own chunk (Vite
 * platform feature, no new dependency) — the registry is the only static
 * import. Lives here because the browser build (Astro/Vite) transforms
 * import.meta.glob; the node unit-test pipeline does not.
 *
 * A topic without a question file resolves to null so the hub can show
 * "coming soon" without 404 noise.
 */

import type { TopicQuestion } from '../../lib/trivia-topics';

const topicLoaders = import.meta.glob<{ default: TopicQuestion[] }>('../../data/topics/*.json');

/** The slugs with a question file at build time — the hub's playability
 * check. Zero fetches: the glob record's keys are known statically. The
 * registry itself is excluded (it lives in the same directory). */
export function availableTopicSlugs(): string[] {
  return Object.keys(topicLoaders)
    .map((key) => {
      const parts = key.split('/');
      const file = parts[parts.length - 1] ?? '';
      return file.replace(/\.json$/, '');
    })
    .filter((slug) => slug !== 'registry');
}

export async function loadTopicQuestions(slug: string): Promise<TopicQuestion[] | null> {
  const loader = topicLoaders[`../../data/topics/${slug}.json`];
  if (!loader) {
    return null;
  }
  const module = await loader();
  // Browser (Vite) resolves JSON modules as { default: data }; accept the
  // direct-array shape defensively too.
  const questions = Array.isArray(module)
    ? (module as TopicQuestion[])
    : (module as { default?: TopicQuestion[] }).default;
  return Array.isArray(questions) ? questions : null;
}
