import { ChatStreamEvent, type ChatRequest } from '@cb/contracts';
import { streamChat } from '../src/services/chat';
import { collect, fakeLlm, hangUntilAborted, queue, tokens } from './helpers/fakeLlm';

const req = (mode: ChatRequest['mode'], content: string): ChatRequest => ({
  mode,
  locale: 'en',
  messages: [{ role: 'user', content }],
});

const textOf = (events: ChatStreamEvent[]) =>
  events.flatMap((e) => (e.type === 'delta' ? [e.text] : [])).join('');

describe('streamChat', () => {
  it('streams model tokens as delta events between start and done', async () => {
    const { client } = fakeLlm({ stream: () => tokens('Start ', 'with ', 'apr-003.') });
    const events = await collect(streamChat({ llm: client, queue, request: req('talk', 'What first?'), timeoutMs: 200 }));

    events.forEach((e) => ChatStreamEvent.parse(e));
    expect(events[0]).toEqual({ type: 'start', mode: 'talk', citations: [] });
    expect(textOf(events)).toBe('Start with apr-003.');
    expect(events.at(-1)).toEqual({ type: 'done', source: 'ai' });
  });

  it('grounds "help" answers in retrieved policy chunks and cites them', async () => {
    const { client, calls } = fakeLlm({ stream: () => tokens('Escalate to the Site Safety Lead.') });
    const events = await collect(
      streamChat({ llm: client, queue, request: req('help', 'Who do I escalate a safety issue to?'), timeoutMs: 200 }),
    );

    const start = events[0];
    expect(start?.type === 'start' && start.citations.length).toBeGreaterThan(0);
    expect(calls.stream[0]?.system).toMatch(/escalat/i);
  });

  it('does not call the model for "help" questions the policy cannot answer', async () => {
    const { client, calls } = fakeLlm({ stream: () => tokens('should not be used') });
    const events = await collect(
      streamChat({ llm: client, queue, request: req('help', 'Best pizza topping?'), timeoutMs: 200 }),
    );

    expect(calls.stream).toHaveLength(0);
    expect(events).toContainEqual({ type: 'fallback', reason: 'no_context' });
    expect(events.at(-1)).toEqual({ type: 'done', source: 'fallback' });
  });

  it.each(['talk', 'help', 'teach'] as const)(
    '"%s" degrades to a deterministic answer when the model stalls before the first token',
    async (mode) => {
      const { client } = fakeLlm({
        stream: ({ signal }) => ({
          [Symbol.asyncIterator]: () => ({ next: () => hangUntilAborted(signal) }),
        }),
      });
      const question = mode === 'help' ? 'How do I reject an approval?' : 'Help me review';
      const events = await collect(streamChat({ llm: client, queue, request: req(mode, question), timeoutMs: 30 }));

      expect(events).toContainEqual({ type: 'fallback', reason: 'timeout' });
      expect(textOf(events).length).toBeGreaterThan(20);
      expect(events.at(-1)).toEqual({ type: 'done', source: 'fallback' });
    },
  );

  it('degrades to a deterministic answer when the model errors before the first token', async () => {
    const { client } = fakeLlm({
      stream: () => ({
        [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(new Error('401')) }),
      }),
    });
    const events = await collect(streamChat({ llm: client, queue, request: req('talk', 'hi'), timeoutMs: 200 }));
    expect(events).toContainEqual({ type: 'fallback', reason: 'llm_error' });
    expect(textOf(events)).toMatch(/^AI unavailable, showing basic summary\./);
    expect(events.at(-1)).toEqual({ type: 'done', source: 'fallback' });
  });

  it('keeps partial text and ends with an error event when the model fails mid-answer', async () => {
    async function* brokenAfterOne() {
      yield 'Partial ';
      throw new Error('socket hang up');
    }
    const { client } = fakeLlm({ stream: () => brokenAfterOne() });
    const events = await collect(streamChat({ llm: client, queue, request: req('talk', 'hi'), timeoutMs: 200 }));

    expect(textOf(events)).toBe('Partial ');
    expect(events.at(-1)?.type).toBe('error');
    expect(events.some((e) => e.type === 'done')).toBe(false);
  });

  it('sends the full multi-turn history to the model', async () => {
    const { client, calls } = fakeLlm({ stream: () => tokens('ok') });
    const request: ChatRequest = {
      mode: 'teach',
      locale: 'en',
      messages: [
        { role: 'user', content: 'Teach me' },
        { role: 'assistant', content: 'Step 1: open the item.' },
        { role: 'user', content: 'What does step 1 look like?' },
      ],
    };
    await collect(streamChat({ llm: client, queue, request, timeoutMs: 200 }));
    expect(calls.stream[0]?.messages).toEqual(request.messages);
  });
});
