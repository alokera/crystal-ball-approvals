import type { z } from 'zod';

export type LlmMessage = { role: 'user' | 'assistant'; content: string };

export type StructuredArgs = {
  system: string;
  messages: LlmMessage[];
  /** JSON schema the model is constrained to. Callers must still validate the result. */
  schema: z.ZodType;
  maxTokens: number;
  signal: AbortSignal;
};

export type StreamArgs = {
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  signal: AbortSignal;
};

/**
 * The only seam between the app and a model provider. Services depend on this
 * interface, so tests inject a scripted fake and the provider can be swapped.
 */
export interface LlmClient {
  /** Resolves to the model's parsed JSON. Typed `unknown` on purpose: callers validate. */
  generateStructured(args: StructuredArgs): Promise<unknown>;
  /** Yields text deltas as the model produces them. */
  streamText(args: StreamArgs): AsyncIterable<string>;
}
