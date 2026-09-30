import type { ChatStreamEvent } from '@cb/contracts';
import { vi } from 'vitest';

const encoder = new TextEncoder();
export const frame = (event: ChatStreamEvent | Record<string, unknown>) =>
  encoder.encode(`event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`);

/**
 * An SSE response whose frames the test pushes one at a time, so it can
 * assert on the UI between tokens (true streaming, not a dump at the end).
 */
export function controlledSse() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    push: (event: ChatStreamEvent | Record<string, unknown>) => controller.enqueue(frame(event)),
    close: () => controller.close(),
  };
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Stubs global fetch with a queue of responses (or errors), returning the mock. */
export function stubFetch(...responses: Array<Response | Error | (() => Promise<Response>)>) {
  const mock = vi.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('Unexpected fetch');
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : next;
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}
