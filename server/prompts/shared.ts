import type { ApprovalItem } from '@cb/contracts';

export type PromptContext = {
  queue: ApprovalItem[];
  /** Operator language tag, e.g. "en", "hi", "es-MX". */
  locale: string;
  /** ISO date used to compute item age; injected so prompts are deterministic. */
  today: string;
};

export type VersionedPrompt<Ctx = PromptContext> = {
  id: string;
  version: string;
  system: (ctx: Ctx) => string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function ageInDays(submittedAt: string, today: string): number {
  return Math.max(0, Math.floor((Date.parse(today) - Date.parse(submittedAt)) / DAY_MS));
}

/** Compact, model-friendly rendering of the queue. Data, never instructions. */
export function renderQueue(queue: ApprovalItem[], today: string): string {
  const rows = queue.map(
    (i) =>
      `- id=${i.id} | "${i.title}" | type=${i.type} | submitted by ${i.submittedBy} on ${i.submittedAt} ` +
      `(${ageInDays(i.submittedAt, today)} days ago) | location: ${i.path.join(' > ')} | ${i.description}`,
  );
  return `<approvals_queue today="${today}" pending="${queue.length}">\n${rows.join('\n')}\n</approvals_queue>`;
}

export function languageRule(locale: string): string {
  return `Write every user-facing sentence in the operator's language (BCP-47 tag "${locale}"). Keep item titles and ids exactly as given.`;
}

export const PERSONA =
  'You are the Approvals assistant inside the OomniEye digital-twin dashboard. You help site operators review pending content approvals. Be concise, concrete and calm.';
