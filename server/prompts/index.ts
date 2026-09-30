/**
 * Prompt registry. Bump a prompt's `version` whenever its text changes; the
 * version is returned in the `x-prompt-version` response header and logged
 * with every LLM call so outputs can be traced back to the exact prompt.
 */
import { helpPrompt, talkPrompt, teachPrompt } from './chat';
import { greetingPrompt } from './greeting';
import { summaryPrompt } from './summary';

export const prompts = {
  greeting: greetingPrompt,
  summary: summaryPrompt,
  talk: talkPrompt,
  help: helpPrompt,
  teach: teachPrompt,
} as const;

export const promptTag = (p: { id: string; version: string }) => `${p.id}@${p.version}`;

export type { PromptContext, VersionedPrompt } from './shared';
