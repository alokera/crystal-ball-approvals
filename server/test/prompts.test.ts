import { prompts } from '../prompts';
import { queue } from './helpers/fakeLlm';

describe('versioned prompts', () => {
  it('every prompt exports an id and a semver version', () => {
    for (const p of Object.values(prompts)) {
      expect(p.id).toMatch(/^[a-z-]+$/);
      expect(p.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('the summary prompt lists every queue item id and the target language', () => {
    const system = prompts.summary.system({ queue, locale: 'es', today: '2026-09-30' });
    for (const item of queue) expect(system).toContain(item.id);
    expect(system).toContain('es');
  });

  it('the help prompt tells the model to answer only from the supplied policy', () => {
    const system = prompts.help.system({ queue, locale: 'en', today: '2026-09-30', context: 'CHUNK-TEXT' });
    expect(system).toContain('CHUNK-TEXT');
    expect(system).toMatch(/only/i);
  });
});
