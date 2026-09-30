import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChatView } from '@/components/ChatView';
import { resetAssistantStore } from '@/store/assistant';
import { controlledSse, jsonResponse, stubFetch } from './helpers';

async function ask(text: string) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: /message/i }), text);
  await user.click(screen.getByRole('button', { name: /send/i }));
}

describe('<ChatView />', () => {
  beforeEach(() => resetAssistantStore());

  it('shows a loading indicator while waiting for the first token', async () => {
    const sse = controlledSse();
    stubFetch(sse.response);
    render(<ChatView mode="talk" />);

    await ask('Which item first?');

    expect(await screen.findByRole('status', { name: /assistant is thinking/i })).toBeInTheDocument();
    expect(screen.getByText('Which item first?')).toBeInTheDocument();
    // Can't send a second question while one is in flight, even with text typed.
    await userEvent.setup().type(screen.getByRole('textbox', { name: /message/i }), 'another');
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();

    act(() => sse.push({ type: 'start', mode: 'talk', citations: [] }));
    act(() => sse.push({ type: 'delta', text: 'Start' }));
    await waitFor(() => expect(screen.queryByRole('status', { name: /assistant is thinking/i })).not.toBeInTheDocument());
  });

  it('renders tokens incrementally as they stream in', async () => {
    const sse = controlledSse();
    stubFetch(sse.response);
    render(<ChatView mode="talk" />);
    await ask('Which item first?');

    act(() => {
      sse.push({ type: 'start', mode: 'talk', citations: [] });
      sse.push({ type: 'delta', text: 'Start with ' });
    });
    const reply = await screen.findByTestId('assistant-message-streaming');
    await waitFor(() => expect(reply).toHaveTextContent('Start with'));
    expect(reply).not.toHaveTextContent('the safety specs');

    act(() => sse.push({ type: 'delta', text: 'the safety specs.' }));
    await waitFor(() => expect(reply).toHaveTextContent('Start with the safety specs.'));

    act(() => {
      sse.push({ type: 'done', source: 'ai' });
      sse.close();
    });
    await waitFor(() => expect(screen.queryByTestId('assistant-message-streaming')).not.toBeInTheDocument());
    expect(screen.getByTestId('assistant-message')).toHaveTextContent('Start with the safety specs.');
    await userEvent.setup().type(screen.getByRole('textbox', { name: /message/i }), 'next');
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled();
  });

  it('shows an error with a working retry when the request fails', async () => {
    const sse = controlledSse();
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), sse.response);
    render(<ChatView mode="talk" />);
    await ask('hello');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/couldn't reach the assistant/i);

    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }));
    act(() => {
      sse.push({ type: 'start', mode: 'talk', citations: [] });
      sse.push({ type: 'delta', text: 'Back online.' });
      sse.push({ type: 'done', source: 'ai' });
      sse.close();
    });

    expect(await screen.findByText('Back online.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('surfaces a typed server error (e.g. rate limit) instead of a generic failure', async () => {
    stubFetch(jsonResponse({ error: { code: 'rate_limited', message: 'Too many assistant requests.' } }, 429));
    render(<ChatView mode="talk" />);
    await ask('hello');
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many assistant requests.');
  });

  it('labels deterministic fallback answers so the operator knows AI was unavailable', async () => {
    const sse = controlledSse();
    stubFetch(sse.response);
    render(<ChatView mode="help" />);
    await ask('How do I reject?');

    act(() => {
      sse.push({ type: 'start', mode: 'help', citations: [{ id: 'policy-3', title: 'Approve, reject or request changes' }] });
      sse.push({ type: 'fallback', reason: 'timeout' });
      sse.push({ type: 'delta', text: 'Reject only when the content is wrong.' });
      sse.push({ type: 'done', source: 'fallback' });
      sse.close();
    });

    expect(await screen.findByText(/AI unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Approve, reject or request changes/)).toBeInTheDocument();
  });

  it('keeps partial text and flags the reply as interrupted when the stream errors mid-answer', async () => {
    const sse = controlledSse();
    stubFetch(sse.response);
    render(<ChatView mode="talk" />);
    await ask('hello');

    act(() => {
      sse.push({ type: 'start', mode: 'talk', citations: [] });
      sse.push({ type: 'delta', text: 'Partial answer' });
      sse.push({ type: 'error', message: 'The assistant stopped responding mid-answer.' });
      sse.close();
    });

    expect(await screen.findByText('Partial answer')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/stopped responding/i);
  });

  it('refuses to render a stream event that breaks the contract', async () => {
    const sse = controlledSse();
    stubFetch(sse.response);
    render(<ChatView mode="talk" />);
    await ask('hello');

    act(() => {
      sse.push({ type: 'start', mode: 'talk', citations: [] });
      sse.push({ type: 'delta', content: '<img src=x onerror=alert(1)>' });
      sse.close();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(/unexpected response/i);
    expect(screen.queryByText(/onerror/)).not.toBeInTheDocument();
  });

  it('treats a stream that ends without "done" as an error, not a silent success', async () => {
    const sse = controlledSse();
    stubFetch(sse.response);
    render(<ChatView mode="talk" />);
    await ask('hello');

    act(() => {
      sse.push({ type: 'start', mode: 'talk', citations: [] });
      sse.close();
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
