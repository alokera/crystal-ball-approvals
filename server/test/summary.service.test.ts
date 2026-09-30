import { SummaryResponse } from '@cb/contracts';
import { generateSummary } from '../src/services/summary';
import { fakeLlm, hangUntilAborted, queue, validSummary } from './helpers/fakeLlm';

const run = (structured: Parameters<typeof fakeLlm>[0]['structured'], timeoutMs = 200) => {
  const { client, calls } = fakeLlm({ structured });
  return { calls, result: generateSummary({ llm: client, queue, locale: 'en', timeoutMs }) };
};

describe('generateSummary', () => {
  it('returns a contract-valid AI summary, enriched with titles and sorted by priority', async () => {
    const { result } = run(async () => validSummary);
    const summary = await result;

    expect(SummaryResponse.parse(summary)).toEqual(summary);
    expect(summary.source).toBe('ai');
    expect(summary.pendingCount).toBe(4);
    expect(summary.items.map((i) => i.priority)).toEqual(['high', 'medium', 'medium', 'low']);
    expect(summary.items[0]).toMatchObject({ id: 'apr-003', title: 'Safety Equipment & Sensor Specs', type: 'pdf' });
  });

  it('passes the queue and the operator locale to the model', async () => {
    const { client, calls } = fakeLlm({ structured: async () => validSummary });
    await generateSummary({ llm: client, queue, locale: 'hi', timeoutMs: 200 });

    const prompt = JSON.stringify(calls.structured[0]);
    for (const item of queue) expect(prompt).toContain(item.id);
    expect(prompt).toContain('hi');
  });

  it('falls back when the model returns the wrong shape', async () => {
    const summary = await run(async () => ({ headline: 'missing items' })).result;
    expect(summary.source).toBe('fallback');
    expect(summary.items).toHaveLength(queue.length);
  });

  it('falls back when the model invents an item that is not in the queue', async () => {
    const hallucinated = {
      ...validSummary,
      items: [...validSummary.items.slice(1), { ...validSummary.items[0]!, id: 'apr-999' }],
    };
    const summary = await run(async () => hallucinated).result;
    expect(summary.source).toBe('fallback');
  });

  it('falls back when the model silently drops a queue item', async () => {
    const summary = await run(async () => ({ ...validSummary, items: validSummary.items.slice(0, 2) })).result;
    expect(summary.source).toBe('fallback');
    expect(summary.items.map((i) => i.id).sort()).toEqual(queue.map((i) => i.id).sort());
  });

  it('falls back when the model call throws (e.g. revoked API key)', async () => {
    const summary = await run(async () => {
      throw new Error('401 invalid x-api-key');
    }).result;
    expect(summary.source).toBe('fallback');
  });

  it('falls back and aborts the upstream call when it exceeds the timeout', async () => {
    let aborted = false;
    const started = Date.now();
    const summary = await run(({ signal }) => {
      signal.addEventListener('abort', () => (aborted = true));
      return hangUntilAborted(signal);
    }, 50).result;

    expect(summary.source).toBe('fallback');
    expect(aborted).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('rule-based fallback puts safety-related items first', async () => {
    const summary = await run(async () => {
      throw new Error('down');
    }).result;
    expect(summary.items[0]?.id).toBe('apr-003');
    expect(summary.items[0]?.priority).toBe('high');
  });
});
