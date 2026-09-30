import { z } from 'zod';

const Env = z.object({
  PORT: z.coerce.number().int().default(4000),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5-5'),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
});

export type Config = z.infer<typeof Env>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => Env.parse(env);
