import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { LlmClient } from './types';

export class RefusalError extends Error {
  override name = 'RefusalError';
}

type Options = { apiKey?: string; model: string };

/**
 * Anthropic implementation of LlmClient. Server-side only: the key is read
 * from the environment and never reaches the browser.
 *
 * - maxRetries: 0, because our own 8s budget is the source of truth and SDK
 *   retries would silently multiply it.
 * - effort "low" keeps latency inside that budget; these are short,
 *   well-specified tasks that don't benefit from deep reasoning.
 * - `fallbacks: "default"` lets the API re-route a safety-classifier refusal
 *   to another model inside the same call.
 */
export function createAnthropicLlm({ apiKey, model }: Options): LlmClient {
  let client: Anthropic | undefined;
  // Constructed lazily so a missing key surfaces as a rejected call (and
  // therefore a graceful fallback) rather than a crash at boot.
  const getClient = () => (client ??= new Anthropic({ apiKey, maxRetries: 0 }));

  const common = {
    model,
    output_config: { effort: 'low' as const },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default' as const,
  };

  return {
    async generateStructured({ system, messages, schema, maxTokens, signal }) {
      const response = await getClient().beta.messages.parse(
        {
          ...common,
          max_tokens: maxTokens,
          system,
          messages,
          output_config: { ...common.output_config, format: betaZodOutputFormat(schema) },
        },
        { signal },
      );
      if (response.stop_reason === 'refusal') throw new RefusalError('Model declined the request');
      return response.parsed_output;
    },

    async *streamText({ system, messages, maxTokens, signal }) {
      const stream = getClient().beta.messages.stream({ ...common, max_tokens: maxTokens, system, messages }, { signal });
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        } else if (event.type === 'message_delta' && event.delta.stop_reason === 'refusal') {
          throw new RefusalError('Model declined the request');
        }
      }
    },
  };
}
