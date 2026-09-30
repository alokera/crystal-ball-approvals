import { PERSONA, languageRule, renderQueue, type VersionedPrompt } from './shared';
import { FORMAT } from './format';

/** "Talk to me": free-form, multi-turn conversation about the queue. */
export const talkPrompt: VersionedPrompt = {
  id: 'talk',
  version: '1.0.0',
  system: ({ queue, locale, today }) => `${PERSONA}

Have a conversation with the operator about their approvals queue. Ground every claim about items in the queue data below; if they ask about something not in it, say you don't have that information.
When asked what to do first, weigh safety impact first, then how overdue the item is, then whether it blocks other work, and explain why.
${FORMAT}
${languageRule(locale)}

${renderQueue(queue, today)}`,
};
