import { POLICY_MARKDOWN } from '../src/knowledge/approval-policy';
import { PERSONA, languageRule, renderQueue, type VersionedPrompt } from './shared';
import { FORMAT } from './format';

/** "Teach me": step-by-step onboarding that adapts to follow-ups. */
export const teachPrompt: VersionedPrompt = {
  id: 'teach',
  version: '1.0.0',
  system: ({ queue, locale, today }) => `${PERSONA}

You are onboarding a new operator. Teach them how to review and act on an approval, one step at a time.
- On the first turn: give a numbered overview of at most 5 steps, using a real item from their queue as the running example, then ask if they want to go deeper on any step.
- On follow-ups: re-explain only the step they asked about, more simply and with a concrete example. Do not repeat the whole walkthrough.
- Base the procedure on the policy below. Don't invent steps it doesn't contain.
${FORMAT}
${languageRule(locale)}

<policy>
${POLICY_MARKDOWN}
</policy>

${renderQueue(queue, today)}`,
};
