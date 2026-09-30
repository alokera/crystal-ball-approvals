import request from 'supertest';
import { ApprovalsResponse, ChatStreamEvent, ErrorResponse, GreetingResponse, SummaryResponse } from '@cb/contracts';
import { createApp } from '../src/app';
import { fakeLlm, hangUntilAborted, tokens, validSummary } from './helpers/fakeLlm';

/** Parse an SSE body into validated events. */
function parseSse(body: string) {
  return body
    .split('\n\n')
    .map((frame) => frame.split('\n').find((l) => l.startsWith('data: ')))
    .filter((l): l is string => Boolean(l))
    .map((l) => ChatStreamEvent.parse(JSON.parse(l.slice('data: '.length))));
}

describe('GET /api/approvals', () => {
  it('returns the seeded queue', async () => {
    const app = createApp({ llm: fakeLlm().client });
    const res = await request(app).get('/api/approvals').expect(200);
    expect(ApprovalsResponse.parse(res.body).items).toHaveLength(4);
  });
});

describe('POST /api/ai/summary', () => {
  it('success: returns a schema-valid AI summary', async () => {
    const app = createApp({ llm: fakeLlm({ structured: async () => validSummary }).client });
    const res = await request(app).post('/api/ai/summary').send({ locale: 'en' }).expect(200);

    const body = SummaryResponse.parse(res.body);
    expect(body.source).toBe('ai');
    expect(res.headers['x-prompt-version']).toMatch(/^summary@\d+\.\d+\.\d+$/);
  });

  it('timeout: returns 200 with a fallback summary instead of hanging or 500', async () => {
    const app = createApp({
      llm: fakeLlm({ structured: ({ signal }) => hangUntilAborted(signal) }).client,
      timeoutMs: 50,
    });
    const res = await request(app).post('/api/ai/summary').send({}).expect(200);
    expect(SummaryResponse.parse(res.body).source).toBe('fallback');
  });

  it('LLM failure: returns 200 with a fallback summary', async () => {
    const app = createApp({
      llm: fakeLlm({ structured: () => Promise.reject(new Error('401 invalid x-api-key')) }).client,
    });
    const res = await request(app).post('/api/ai/summary').send({}).expect(200);
    expect(SummaryResponse.parse(res.body).source).toBe('fallback');
  });

  it('rejects an invalid body with a typed 400', async () => {
    const app = createApp({ llm: fakeLlm().client });
    const res = await request(app).post('/api/ai/summary').send({ locale: 'not a locale!' }).expect(400);
    expect(ErrorResponse.parse(res.body).error.code).toBe('bad_request');
  });
});

describe('POST /api/ai/greeting', () => {
  it('success and fallback both satisfy the contract', async () => {
    const ok = createApp({ llm: fakeLlm({ structured: async () => ({ greeting: 'Hi! 4 waiting.' }) }).client });
    const down = createApp({ llm: fakeLlm({ structured: () => Promise.reject(new Error('x')) }).client });

    const a = GreetingResponse.parse((await request(ok).post('/api/ai/greeting').send({}).expect(200)).body);
    const b = GreetingResponse.parse((await request(down).post('/api/ai/greeting').send({}).expect(200)).body);
    expect([a.source, b.source]).toEqual(['ai', 'fallback']);
  });
});

describe('POST /api/ai/chat (SSE)', () => {
  const body = { mode: 'talk', messages: [{ role: 'user', content: 'Which item first?' }] };

  it('success: streams start → delta* → done as text/event-stream', async () => {
    const app = createApp({ llm: fakeLlm({ stream: () => tokens('Safety ', 'specs ', 'first.') }).client });
    const res = await request(app).post('/api/ai/chat').send(body).expect(200);

    expect(res.headers['content-type']).toMatch(/text\/event-stream/);
    const events = parseSse(res.text);
    expect(events[0]?.type).toBe('start');
    expect(events.filter((e) => e.type === 'delta')).toHaveLength(3);
    expect(events.at(-1)).toEqual({ type: 'done', source: 'ai' });
  });

  it('timeout: streams a fallback answer instead of freezing', async () => {
    const app = createApp({
      llm: fakeLlm({
        stream: ({ signal }) => ({ [Symbol.asyncIterator]: () => ({ next: () => hangUntilAborted(signal) }) }),
      }).client,
      timeoutMs: 50,
    });
    const res = await request(app).post('/api/ai/chat').send(body).expect(200);
    const events = parseSse(res.text);

    expect(events).toContainEqual({ type: 'fallback', reason: 'timeout' });
    expect(events.at(-1)).toEqual({ type: 'done', source: 'fallback' });
  });

  it('rejects a conversation that does not end with a user turn', async () => {
    const app = createApp({ llm: fakeLlm().client });
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ mode: 'talk', messages: [{ role: 'assistant', content: 'hello' }] })
      .expect(400);
    expect(ErrorResponse.parse(res.body).error.code).toBe('bad_request');
  });
});

describe('rate limiting', () => {
  it('throttles AI endpoints per session with a typed 429', async () => {
    const app = createApp({
      llm: fakeLlm({ structured: async () => ({ greeting: 'hi' }) }).client,
      rateLimit: { windowMs: 60_000, max: 2 },
    });
    const call = (session: string) => request(app).post('/api/ai/greeting').set('x-session-id', session).send({});

    await call('session-a').expect(200);
    await call('session-a').expect(200);
    const limited = await call('session-a').expect(429);
    expect(ErrorResponse.parse(limited.body).error.code).toBe('rate_limited');

    await call('session-b').expect(200);
  });

  it('does not throttle the non-AI approvals endpoint', async () => {
    const app = createApp({ llm: fakeLlm().client, rateLimit: { windowMs: 60_000, max: 1 } });
    for (let i = 0; i < 3; i++) await request(app).get('/api/approvals').expect(200);
  });
});
