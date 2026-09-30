import { SummaryLLMOutput, SummaryResponse, type ApprovalItem, type SummaryItem } from '@cb/contracts';
import { prompts, promptTag } from '../../prompts';
import type { LlmClient } from '../llm/types';
import { describeError, log } from '../lib/logger';
import { withTimeout } from '../lib/timeout';
import { ruleBasedHeadline, ruleBasedItems, sortByPriority, todayIso } from './rules';

export class InvalidOutputError extends Error {
  override name = 'InvalidOutputError';
}

type Deps = { llm: LlmClient; queue: ApprovalItem[]; locale: string; timeoutMs: number; now?: Date };

/**
 * Cross-checks model output against the queue: every id must exist and every
 * queue item must appear exactly once. Catches hallucinated or dropped items
 * that a schema alone cannot.
 */
function groundItems(output: SummaryLLMOutput, queue: ApprovalItem[]): SummaryItem[] {
  const byId = new Map(queue.map((i) => [i.id, i]));
  const seen = new Set<string>();
  const items = output.items.map((o) => {
    const item = byId.get(o.id);
    if (!item) throw new InvalidOutputError(`unknown item id ${o.id}`);
    if (seen.has(o.id)) throw new InvalidOutputError(`duplicate item id ${o.id}`);
    seen.add(o.id);
    return { ...o, title: item.title, type: item.type };
  });
  if (seen.size !== queue.length) throw new InvalidOutputError(`covered ${seen.size}/${queue.length} items`);
  return sortByPriority(items);
}

export async function generateSummary({ llm, queue, locale, timeoutMs, now = new Date() }: Deps): Promise<SummaryResponse> {
  const today = todayIso(now);
  const base = { pendingCount: queue.length, generatedAt: now.toISOString() };
  const started = Date.now();

  try {
    const raw = await withTimeout(timeoutMs, (signal) =>
      llm.generateStructured({
        system: prompts.summary.system({ queue, locale, today }),
        messages: [{ role: 'user', content: 'Summarise my pending approvals, most urgent first.' }],
        schema: SummaryLLMOutput,
        maxTokens: 4000,
        signal,
      }),
    );
    const parsed = SummaryLLMOutput.safeParse(raw);
    if (!parsed.success) throw new InvalidOutputError(parsed.error.message);

    const response = SummaryResponse.parse({
      ...base,
      headline: parsed.data.headline,
      items: groundItems(parsed.data, queue),
      source: 'ai',
    });
    log('info', 'llm.ok', { prompt: promptTag(prompts.summary), ms: Date.now() - started });
    return response;
  } catch (err) {
    log('warn', 'llm.fallback', { prompt: promptTag(prompts.summary), ms: Date.now() - started, reason: describeError(err) });
    return SummaryResponse.parse({
      ...base,
      headline: ruleBasedHeadline(queue, today),
      items: ruleBasedItems(queue, today),
      source: 'fallback',
    });
  }
}
