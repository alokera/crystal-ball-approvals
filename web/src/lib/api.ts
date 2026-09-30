/**
 * Typed client for the assistant API. Every response is validated against the
 * shared Zod contract before the UI sees it; anything that doesn't match is
 * treated as an error, never rendered.
 */
import {
  ApprovalsResponse,
  ChatStreamEvent,
  ErrorResponse,
  GreetingResponse,
  SummaryResponse,
  type ChatRequest,
} from '@cb/contracts';
import type { z } from 'zod';
import { getSessionId } from './session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApiErrorKind = 'network' | 'server' | 'contract' | 'aborted';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const MESSAGES = {
  network: "Couldn't reach the assistant. Check your connection and try again.",
  contract: 'The assistant sent an unexpected response. Please try again.',
  truncated: 'The connection closed before the answer finished. Please try again.',
} as const;

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-session-id': getSessionId(), ...init.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new ApiError('Request cancelled', 'aborted');
    throw new ApiError(MESSAGES.network, 'network');
  }
  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(await res.json().catch(() => null));
    throw new ApiError(parsed.success ? parsed.data.error.message : `Request failed (${res.status}). Please try again.`, 'server');
  }
  return res;
}

async function json<S extends z.ZodType>(schema: S, path: string, init?: RequestInit): Promise<z.infer<S>> {
  const res = await request(path, init);
  const parsed = schema.safeParse(await res.json().catch(() => undefined));
  if (!parsed.success) throw new ApiError(MESSAGES.contract, 'contract');
  return parsed.data;
}

export const getApprovals = (signal?: AbortSignal) => json(ApprovalsResponse, '/api/approvals', { signal });

export const postGreeting = (locale: string) =>
  json(GreetingResponse, '/api/ai/greeting', { method: 'POST', body: JSON.stringify({ locale }) });

export const postSummary = (locale: string) =>
  json(SummaryResponse, '/api/ai/summary', { method: 'POST', body: JSON.stringify({ locale }) });

/** Yields validated SSE events from POST /api/ai/chat as they arrive. */
export async function* streamChat(body: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
  const res = await request('/api/ai/chat', { method: 'POST', body: JSON.stringify(body), signal });
  if (!res.body) throw new ApiError(MESSAGES.contract, 'contract');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        if (signal?.aborted) throw new ApiError('Request cancelled', 'aborted');
        throw new ApiError(MESSAGES.truncated, 'network');
      }
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;

        let payload: unknown;
        try {
          payload = JSON.parse(data);
        } catch {
          throw new ApiError(MESSAGES.contract, 'contract');
        }
        const event = ChatStreamEvent.safeParse(payload);
        if (!event.success) throw new ApiError(MESSAGES.contract, 'contract');
        yield event.data;
      }
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
}
