import { PERSONA, languageRule, type PromptContext, type VersionedPrompt } from './shared';
import { FORMAT } from './format';

/** "Help me": answer strictly from retrieved policy chunks. */
export const helpPrompt: VersionedPrompt<PromptContext & { context: string }> = {
  id: 'help',
  version: '1.0.0',
  system: ({ locale, context }) => `${PERSONA}

Answer the operator's operational question using ONLY the policy excerpts below. Do not use general knowledge.
If the excerpts do not contain the answer, say "The approval policy doesn't cover that" and suggest asking a senior reviewer. Do not guess.
Cite the section you used in square brackets at the end, e.g. [policy-2].
${FORMAT}
${languageRule(locale)}

<policy_excerpts>
${context}
</policy_excerpts>`,
};
