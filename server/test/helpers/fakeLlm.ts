import type { LlmClient, StreamArgs, StructuredArgs } from '../../src/llm/types';
import { ApprovalQueue } from '@cb/contracts';
import rawQueue from '../../src/data/approvals.json';

export const queue = ApprovalQueue.parse(rawQueue);

type Overrides = {
  structured?: (args: StructuredArgs) => Promise<unknown>;
  stream?: (args: StreamArgs) => AsyncIterable<string>;
};

/** An LlmClient whose behaviour each test scripts. Records every call. */
export function fakeLlm(overrides: Overrides = {}) {
  const calls = { structured: [] as StructuredArgs[], stream: [] as StreamArgs[] };
  const client: LlmClient = {
    generateStructured(args) {
      calls.structured.push(args);
      if (!overrides.structured) throw new Error('generateStructured not scripted');
      return overrides.structured(args);
    },
    streamText(args) {
      calls.stream.push(args);
      if (!overrides.stream) throw new Error('streamText not scripted');
      return overrides.stream(args);
    },
  };
  return { client, calls };
}

/** Resolves only when the caller aborts — simulates a stalled upstream. */
export function hangUntilAborted(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
}

export async function* tokens(...parts: string[]): AsyncIterable<string> {
  for (const p of parts) yield p;
}

export async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of it) out.push(x);
  return out;
}

/** A well-formed summary covering every queue item. */
export const validSummary = {
  headline: 'Four items are waiting; start with the safety specs.',
  items: [
    { id: 'apr-003', priority: 'high', reason: 'Safety-critical equipment specs.', recommendedAction: 'Review today' },
    { id: 'apr-001', priority: 'medium', reason: 'Blocks onboarding of new staff.', recommendedAction: 'Review checklists' },
    { id: 'apr-004', priority: 'medium', reason: 'Camera coverage map.', recommendedAction: 'Verify coverage' },
    { id: 'apr-002', priority: 'low', reason: 'Demo video, informational.', recommendedAction: 'Watch when free' },
  ],
};
