/**
 * Minimal keyword retrieval over the policy note.
 *
 * Five chunks don't justify embeddings or pgvector: an IDF-weighted term
 * overlap with a crude stemmer is deterministic, fast, testable and good
 * enough to demonstrate the retrieve → ground → cite pattern.
 */
import { POLICY_MARKDOWN } from './approval-policy';

export type PolicyChunk = { id: string; title: string; text: string };
export type RetrievedChunk = PolicyChunk & { score: number };

const STOPWORDS = new Set(
  'a an and are as at be but by can do does for from how i if in into is it its me my of on or should so that the their them then there these they this to up was we what when where which who why will with you your have many much need'.split(
    ' ',
  ),
);

/** Lowercase, drop stopwords, and truncate to a 6-char stem ("escalate" ≈ "escalation"). */
export function terms(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9°]+/g) ?? [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => t.slice(0, 6));
}

export function chunkDocument(markdown: string): PolicyChunk[] {
  return markdown
    .split(/^## /m)
    .slice(1)
    .map((section, i) => {
      const [title = '', ...body] = section.split('\n');
      return { id: `policy-${i + 1}`, title: title.trim(), text: body.join('\n').trim() };
    });
}

export const POLICY_CHUNKS = chunkDocument(POLICY_MARKDOWN);

const indexed = POLICY_CHUNKS.map((chunk) => ({
  chunk,
  titleTerms: new Set(terms(chunk.title)),
  bodyTerms: terms(chunk.text),
}));

const idf = new Map<string, number>();
for (const term of new Set(indexed.flatMap((c) => [...c.titleTerms, ...c.bodyTerms]))) {
  const df = indexed.filter((c) => c.titleTerms.has(term) || c.bodyTerms.includes(term)).length;
  idf.set(term, Math.log(1 + indexed.length / df));
}

export function retrieve(query: string, k = 2): RetrievedChunk[] {
  const queryTerms = [...new Set(terms(query))];
  return indexed
    .map(({ chunk, titleTerms, bodyTerms }) => {
      const score = queryTerms.reduce((sum, term) => {
        const weight = idf.get(term) ?? 0;
        const tf = bodyTerms.filter((t) => t === term).length + (titleTerms.has(term) ? 3 : 0);
        return sum + weight * tf;
      }, 0);
      return { ...chunk, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
