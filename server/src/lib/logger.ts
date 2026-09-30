type Level = 'info' | 'warn' | 'error';

const silent = process.env.NODE_ENV === 'test';

/** Structured one-line JSON logs; quiet under Jest. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  if (silent) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  (level === 'error' ? console.error : console.log)(line);
}

export function describeError(err: unknown): string {
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
}
