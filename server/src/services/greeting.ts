import { GreetingLLMOutput, GreetingResponse, type ApprovalItem } from '@cb/contracts';
import { prompts, promptTag } from '../../prompts';
import type { LlmClient } from '../llm/types';
import { describeError, log } from '../lib/logger';
import { withTimeout } from '../lib/timeout';
import { ruleBasedGreeting, todayIso } from './rules';

type Deps = { llm: LlmClient; queue: ApprovalItem[]; locale: string; timeoutMs: number; now?: Date };

export async function generateGreeting({ llm, queue, locale, timeoutMs, now = new Date() }: Deps): Promise<GreetingResponse> {
  const today = todayIso(now);
  const started = Date.now();
  try {
    const raw = await withTimeout(timeoutMs, (signal) =>
      llm.generateStructured({
        system: prompts.greeting.system({ queue, locale, today }),
        messages: [{ role: 'user', content: 'Greet me.' }],
        schema: GreetingLLMOutput,
        maxTokens: 1000,
        signal,
      }),
    );
    const { greeting } = GreetingLLMOutput.parse(raw);
    log('info', 'llm.ok', { prompt: promptTag(prompts.greeting), ms: Date.now() - started });
    return { greeting, pendingCount: queue.length, source: 'ai' };
  } catch (err) {
    log('warn', 'llm.fallback', { prompt: promptTag(prompts.greeting), ms: Date.now() - started, reason: describeError(err) });
    return { greeting: ruleBasedGreeting(queue, today), pendingCount: queue.length, source: 'fallback' };
  }
}
