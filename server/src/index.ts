import 'dotenv/config';
import { createApp } from './app';
import { loadConfig } from './config';
import { createAnthropicLlm } from './llm/anthropic';
import { log } from './lib/logger';

const config = loadConfig();

if (!config.ANTHROPIC_API_KEY) {
  log('warn', 'config.no_api_key', { message: 'ANTHROPIC_API_KEY is not set: every AI action will use its fallback.' });
}

const app = createApp({
  llm: createAnthropicLlm({ apiKey: config.ANTHROPIC_API_KEY, model: config.ANTHROPIC_MODEL }),
  timeoutMs: config.LLM_TIMEOUT_MS,
  rateLimit: { windowMs: config.RATE_LIMIT_WINDOW_MS, max: config.RATE_LIMIT_MAX },
  corsOrigin: config.WEB_ORIGIN,
});

app.listen(config.PORT, () => {
  log('info', 'server.listening', { port: config.PORT, model: config.ANTHROPIC_MODEL, timeoutMs: config.LLM_TIMEOUT_MS });
});
