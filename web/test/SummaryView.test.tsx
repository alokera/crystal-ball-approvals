import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SummaryView } from '@/components/SummaryView';
import { resetAssistantStore } from '@/store/assistant';
import { jsonResponse, stubFetch } from './helpers';

const summary = {
  headline: 'Four items waiting; start with the safety specs.',
  items: [
    {
      id: 'apr-003',
      title: 'Safety Equipment & Sensor Specs',
      type: 'pdf',
      priority: 'high',
      reason: 'Safety-critical and overdue.',
      recommendedAction: 'Review now',
    },
  ],
  pendingCount: 4,
  source: 'ai',
  generatedAt: '2026-09-30T10:00:00.000Z',
};

describe('<SummaryView />', () => {
  beforeEach(() => resetAssistantStore());

  it('shows a loading state, then the validated summary', async () => {
    stubFetch(jsonResponse(summary));
    render(<SummaryView />);

    expect(screen.getByRole('status', { name: /preparing summary/i })).toBeInTheDocument();
    expect(await screen.findByText(summary.headline)).toBeInTheDocument();
    expect(screen.getByText('Safety Equipment & Sensor Specs')).toBeInTheDocument();
    expect(screen.getByText(/high/i)).toBeInTheDocument();
  });

  it('marks a fallback summary as rule-based', async () => {
    stubFetch(jsonResponse({ ...summary, source: 'fallback' }));
    render(<SummaryView />);
    expect(await screen.findByText('AI unavailable, showing basic summary.')).toBeInTheDocument();
  });

  it('shows an error instead of rendering a malformed summary', async () => {
    stubFetch(jsonResponse({ headline: 'no items field' }));
    render(<SummaryView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected response/i);
    expect(screen.queryByText('no items field')).not.toBeInTheDocument();
  });
});
