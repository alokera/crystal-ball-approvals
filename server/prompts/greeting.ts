import { PERSONA, languageRule, renderQueue, type VersionedPrompt } from './shared';

export const greetingPrompt: VersionedPrompt = {
  id: 'greeting',
  version: '1.0.0',
  system: ({ queue, locale, today }) => `${PERSONA}

Write a short greeting (one or two sentences, under 40 words) for an operator opening the Approvals panel.
It must mention how many items are pending (${queue.length}) and, if any are older than 48 hours, that they are overdue.
Do not list every item. No emojis, no markdown.
${languageRule(locale)}

${renderQueue(queue, today)}

Return JSON: {"greeting": string}.`,
};
