import type { ApprovalItem, ChatRequest, ChatStreamEvent, Citation, FallbackReason } from '@cb/contracts';
import { prompts, promptTag } from '../../prompts';
import type { LlmClient } from '../llm/types';
import { POLICY_CHUNKS, retrieve, type RetrievedChunk } from '../knowledge/retrieval';
import { describeError, log } from '../lib/logger';
import { TimeoutError, nextWithin } from '../lib/timeout';
import { ruleBasedHeadline, ruleBasedItems, todayIso } from './rules';

type Deps = {
  llm: LlmClient;
  queue: ApprovalItem[];
  request: ChatRequest;
  /** Max wait for the first token, and between any two tokens. */
  timeoutMs: number;
  /** Fires when the client disconnects; cancels the upstream call. */
  signal?: AbortSignal;
  now?: Date;
};

type Plan = {
  system: string;
  promptTag: string;
  citations: Citation[];
  /** Deterministic answer used when the model is unavailable. */
  fallback: () => string;
};

const NO_CONTEXT_ANSWER =
  "The approval policy doesn't cover that question, so I won't guess. Try rephrasing it around reviewing, approving, rejecting, escalating or SLAs, or ask a senior reviewer.";

function teachFallback(): string {
  const reviewing = POLICY_CHUNKS.find((c) => /how to review/i.test(c.title));
  const deciding = POLICY_CHUNKS.find((c) => /approve/i.test(c.title));
  return [
    'The AI tutor is unavailable, so here is the standard walkthrough from the approval policy:',
    `1. Open the item from the Pending Approval Requests list.\n2. ${reviewing?.text ?? ''}`,
    `3. Decide. ${deciding?.text ?? ''}`,
    '4. If anything looks unsafe, escalate to the Site Safety Lead before deciding.',
  ].join('\n\n');
}

function talkFallback(queue: ApprovalItem[], today: string): string {
  const lines = ruleBasedItems(queue, today).map((i, n) => `${n + 1}. ${i.title} (${i.priority}): ${i.reason}`);
  return [
    'AI unavailable, showing basic summary. The queue below is ranked by the standard urgency rules:',
    ruleBasedHeadline(queue, today),
    lines.join('\n'),
  ].join('\n\n');
}

function helpFallback(chunks: RetrievedChunk[]): string {
  return [
    "I can't reach the AI model right now. This is the policy section that best matches your question:",
    ...chunks.map((c) => `${c.title} [${c.id}]\n${c.text}`),
  ].join('\n\n');
}

/** Splits deterministic text into paragraph-sized deltas so the UI renders it like a stream. */
function* asDeltas(text: string): Generator<ChatStreamEvent> {
  for (const part of text.split(/(?<=\n\n)/)) yield { type: 'delta', text: part };
}

export async function* streamChat({
  llm,
  queue,
  request,
  timeoutMs,
  signal,
  now = new Date(),
}: Deps): AsyncGenerator<ChatStreamEvent> {
  const today = todayIso(now);
  const ctx = { queue, locale: request.locale, today };
  const question = request.messages[request.messages.length - 1]!.content;

  let plan: Plan;
  if (request.mode === 'help') {
    const chunks = retrieve(question, 2);
    const citations = chunks.map(({ id, title }) => ({ id, title }));
    yield { type: 'start', mode: 'help', citations };
    if (chunks.length === 0) {
      // Nothing to ground on: answering would mean relying on general knowledge,
      // which "Help me" must not do. Skip the model call entirely.
      yield { type: 'fallback', reason: 'no_context' };
      yield* asDeltas(NO_CONTEXT_ANSWER);
      yield { type: 'done', source: 'fallback' };
      return;
    }
    const context = chunks.map((c) => `[${c.id}] ${c.title}\n${c.text}`).join('\n\n');
    plan = {
      system: prompts.help.system({ ...ctx, context }),
      promptTag: promptTag(prompts.help),
      citations,
      fallback: () => helpFallback(chunks),
    };
  } else {
    const prompt = request.mode === 'teach' ? prompts.teach : prompts.talk;
    plan = {
      system: prompt.system(ctx),
      promptTag: promptTag(prompt),
      citations: [],
      fallback: () => (request.mode === 'teach' ? teachFallback() : talkFallback(queue, today)),
    };
    yield { type: 'start', mode: request.mode, citations: [] };
  }

  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });

  const started = Date.now();
  let produced = false;
  try {
    const iterator = llm
      .streamText({ system: plan.system, messages: request.messages, maxTokens: 4000, signal: controller.signal })
      [Symbol.asyncIterator]();

    for (;;) {
      const next = await nextWithin(iterator, timeoutMs, abort);
      if (next.done) break;
      if (!next.value) continue;
      produced = true;
      yield { type: 'delta', text: next.value };
    }
    log('info', 'llm.ok', { prompt: plan.promptTag, ms: Date.now() - started });
    yield { type: 'done', source: 'ai' };
  } catch (err) {
    abort();
    const reason: FallbackReason = err instanceof TimeoutError ? 'timeout' : 'llm_error';
    log('warn', produced ? 'llm.interrupted' : 'llm.fallback', {
      prompt: plan.promptTag,
      ms: Date.now() - started,
      reason: describeError(err),
    });
    if (signal?.aborted) return; // client went away; nobody to answer
    if (produced) {
      // Mixing a canned answer into a half-written AI answer would be confusing:
      // keep the partial text and tell the UI it was cut short.
      yield { type: 'error', message: 'The assistant stopped responding mid-answer. The reply above is incomplete, so please try again.' };
      return;
    }
    yield { type: 'fallback', reason };
    yield* asDeltas(plan.fallback());
    yield { type: 'done', source: 'fallback' };
  } finally {
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}
