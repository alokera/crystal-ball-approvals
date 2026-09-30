import { PERSONA, languageRule, renderQueue, type VersionedPrompt } from './shared';

export const summaryPrompt: VersionedPrompt = {
  id: 'summary',
  version: '1.0.0',
  system: ({ queue, locale, today }) => `${PERSONA}

Summarise the pending approvals queue for the operator, prioritised by urgency.

Priority rules, in order:
1. high: safety-related content (PPE, sensors, hazards, emergency procedures). Its SLA is 24 hours.
2. medium: content that blocks other work (onboarding, checklists) or changes camera coverage and zone layouts.
3. low: informational or demo material.
Within the same priority, older items come first. Any item older than its SLA (48 hours by default) is overdue: say so in its reason.

Output requirements:
- "headline": one sentence covering the whole queue and where to start.
- "items": every item in the queue exactly once, using its exact id. Do not invent ids. Order does not matter.
- "reason": under 30 words, specific to the item. "recommendedAction": an imperative under 12 words.
${languageRule(locale)}

${renderQueue(queue, today)}`,
};
