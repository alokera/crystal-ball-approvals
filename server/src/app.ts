import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { z } from 'zod';
import {
  ApprovalQueue,
  ChatRequest,
  GreetingRequest,
  SummaryRequest,
  type ApprovalItem,
  type ErrorResponse,
} from '@cb/contracts';
import rawQueue from './data/approvals.json';
import { prompts, promptTag } from '../prompts';
import type { LlmClient } from './llm/types';
import { describeError, log } from './lib/logger';
import { generateGreeting } from './services/greeting';
import { generateSummary } from './services/summary';
import { streamChat } from './services/chat';

export type AppOptions = {
  llm: LlmClient;
  queue?: ApprovalItem[];
  /** Per-call LLM budget. The spec asks for 8s. */
  timeoutMs?: number;
  rateLimit?: { windowMs: number; max: number };
  corsOrigin?: string | string[];
};

const sendError = (res: Response, status: number, error: ErrorResponse['error']) =>
  res.status(status).json({ error } satisfies ErrorResponse);

/** Validates req.body against a contract schema; responds 400 with a typed error otherwise. */
function validateBody<S extends z.ZodType>(schema: S) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return sendError(res, 400, {
        code: 'bad_request',
        message: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'Invalid request body',
      });
    }
    req.body = parsed.data;
    next();
  };
}

/**
 * Throttle key: the client's session id (a random UUID kept in sessionStorage)
 * combined with its IP. Session-scoped as the spec asks, but a client can't
 * escape the limit entirely by omitting the header.
 */
function sessionKey(req: Request): string {
  const session = req.header('x-session-id');
  const valid = session && /^[\w-]{8,64}$/.test(session) ? session : 'anonymous';
  return `${req.ip}:${valid}`;
}

export function createApp({
  llm,
  queue = ApprovalQueue.parse(rawQueue),
  timeoutMs = 8000,
  rateLimit: limits = { windowMs: 60_000, max: 20 },
  corsOrigin = 'http://localhost:3000',
}: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin, allowedHeaders: ['content-type', 'x-session-id'], exposedHeaders: ['x-prompt-version'] }));
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/approvals', (_req, res) => {
    res.json({ items: queue });
  });

  const ai = express.Router();
  ai.use(
    rateLimit({
      windowMs: limits.windowMs,
      limit: limits.max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      keyGenerator: sessionKey,
      handler: (_req, res) =>
        sendError(res, 429, { code: 'rate_limited', message: 'Too many assistant requests. Please wait a minute and try again.' }),
    }),
  );

  ai.post('/greeting', validateBody(GreetingRequest), async (req, res) => {
    const { locale } = req.body as GreetingRequest;
    const body = await generateGreeting({ llm, queue, locale, timeoutMs });
    res.set('x-prompt-version', promptTag(prompts.greeting)).json(body);
  });

  ai.post('/summary', validateBody(SummaryRequest), async (req, res) => {
    const { locale } = req.body as SummaryRequest;
    const body = await generateSummary({ llm, queue, locale, timeoutMs });
    res.set('x-prompt-version', promptTag(prompts.summary)).json(body);
  });

  ai.post('/chat', validateBody(ChatRequest), async (req, res) => {
    const request = req.body as ChatRequest;
    const disconnected = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) disconnected.abort();
    });

    res.status(200).set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
      'x-prompt-version': promptTag(prompts[request.mode]),
    });
    res.flushHeaders();

    for await (const event of streamChat({ llm, queue, request, timeoutMs, signal: disconnected.signal })) {
      if (disconnected.signal.aborted) break;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
  });

  app.use('/api/ai', ai);

  app.use((_req, res) => {
    sendError(res, 404, { code: 'not_found', message: 'Route not found' });
  });

  // Last line of defence: never leak a stack trace or an HTML 500.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    log('error', 'unhandled', { reason: describeError(err) });
    if (res.headersSent) return res.end();
    const status = (err as { status?: number }).status === 400 ? 400 : 500;
    sendError(res, status, {
      code: status === 400 ? 'bad_request' : 'internal',
      message: status === 400 ? 'Malformed JSON body' : 'Something went wrong. Please try again.',
    });
  });

  return app;
}
