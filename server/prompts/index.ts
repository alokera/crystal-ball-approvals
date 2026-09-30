/**
 * Prompt registry. Files are named `<id>.v<major>.ts`; a breaking rewrite gets a
 * new file (e.g. summary.v2.ts) so old and new can be A/B-compared. Bump a
 * prompt's `version` whenever its text changes; the
 * version is returned in the `x-prompt-version` response header and logged
 * with every LLM call so outputs can be traced back to the exact prompt.
 */
import { talkPrompt } from './chat.v1';
import { greetingPrompt } from './greeting.v1';
import { helpPrompt } from './help.v1';
import { summaryPrompt } from './summary.v1';
import { teachPrompt } from './teach.v1';

export const prompts = {
  greeting: greetingPrompt,
  summary: summaryPrompt,
  talk: talkPrompt,
  help: helpPrompt,
  teach: teachPrompt,
} as const;

export const promptTag = (p: { id: string; version: string }) => `${p.id}@${p.version}`;

export type { PromptContext, VersionedPrompt } from './shared';
