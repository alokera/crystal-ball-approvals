import { POLICY_CHUNKS, retrieve } from '../src/knowledge/retrieval';

describe('policy retrieval (RAG surface for "Help me")', () => {
  it('splits the policy note into 3–5 titled chunks', () => {
    expect(POLICY_CHUNKS.length).toBeGreaterThanOrEqual(3);
    expect(POLICY_CHUNKS.length).toBeLessThanOrEqual(5);
    for (const c of POLICY_CHUNKS) {
      expect(c.id).toMatch(/^policy-\d+$/);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.text.length).toBeGreaterThan(0);
    }
  });

  it('ranks the escalation section first for an escalation question', () => {
    const [top] = retrieve('Who do I escalate a safety issue to?');
    expect(top?.title).toMatch(/escalat/i);
  });

  it('ranks the SLA section first for a deadline question', () => {
    const [top] = retrieve('How many hours do I have to review a pending item?');
    expect(top?.title).toMatch(/turnaround|sla/i);
  });

  it('returns nothing for questions the policy does not cover', () => {
    expect(retrieve('What is a good pizza recipe?')).toEqual([]);
  });

  it('never returns more than k chunks', () => {
    expect(retrieve('approval review reject safety video', 2).length).toBeLessThanOrEqual(2);
  });
});
