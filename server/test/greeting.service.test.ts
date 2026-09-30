import { GreetingResponse } from '@cb/contracts';
import { generateGreeting } from '../src/services/greeting';
import { fakeLlm, hangUntilAborted, queue } from './helpers/fakeLlm';

describe('generateGreeting', () => {
  it('returns the model greeting when it matches the schema', async () => {
    const { client, calls } = fakeLlm({ structured: async () => ({ greeting: 'Morning! 4 approvals await you.' }) });
    const res = await generateGreeting({ llm: client, queue, locale: 'en', timeoutMs: 200 });

    expect(GreetingResponse.parse(res)).toEqual(res);
    expect(res).toEqual({ greeting: 'Morning! 4 approvals await you.', pendingCount: 4, source: 'ai' });
    expect(JSON.stringify(calls.structured[0])).toContain('4');
  });

  it.each([
    ['empty string', async () => ({ greeting: '' })],
    ['raw text instead of JSON', async () => 'Hello there'],
    ['throwing', async () => Promise.reject(new Error('boom'))],
  ])('falls back to a count-aware template when the model returns %s', async (_label, structured) => {
    const { client } = fakeLlm({ structured });
    const res = await generateGreeting({ llm: client, queue, locale: 'en', timeoutMs: 200 });
    expect(res.source).toBe('fallback');
    expect(res.greeting).toContain('4');
  });

  it('falls back on timeout', async () => {
    const { client } = fakeLlm({ structured: ({ signal }) => hangUntilAborted(signal) });
    const res = await generateGreeting({ llm: client, queue, locale: 'en', timeoutMs: 30 });
    expect(res.source).toBe('fallback');
  });
});
