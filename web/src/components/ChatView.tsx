'use client';

import type { ChatMode } from '@cb/contracts';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAssistant, type UiMessage } from '@/store/assistant';

const COPY: Record<ChatMode, { intro: string; placeholder: string; suggestions: string[] }> = {
  talk: {
    intro: 'Ask me anything about your pending approvals.',
    placeholder: 'Ask about your approvals…',
    suggestions: ['Which of these needs my attention first and why?', 'What is overdue?', 'What did Sam submit?'],
  },
  help: {
    intro: 'Ask an operational question. Answers come only from the approval policy, with the section cited.',
    placeholder: 'Ask a policy question…',
    suggestions: ['Who do I escalate a safety issue to?', 'How long do I have to review an item?', 'When should I reject?'],
  },
  teach: {
    intro: "I'll walk you through reviewing an approval step by step. Ask about any step to go deeper.",
    placeholder: 'Ask about a step…',
    suggestions: ['Teach me how to review an approval', 'Explain step 2 more simply', 'What if I am unsure?'],
  },
};

function Message({ message }: { message: UiMessage }) {
  if (message.role === 'user') {
    return <div className="msg msg-user">{message.content}</div>;
  }
  return (
    <div
      className={`msg msg-assistant${message.interrupted ? ' msg-interrupted' : ''}`}
      data-testid={message.streaming ? 'assistant-message-streaming' : 'assistant-message'}
    >
      {message.source === 'fallback' && (
        <span className="badge badge-fallback" title="The AI model was unavailable, so this answer is rule-based.">
          AI unavailable · rule-based answer
        </span>
      )}
      <div className="msg-text">
        {message.content}
        {message.streaming && <span className="cursor" aria-hidden />}
      </div>
      {!!message.citations?.length && (
        <div className="citations">
          <span className="muted">Sources:</span>
          {message.citations.map((c) => (
            <span key={c.id} className="chip" title={c.id}>
              {c.title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatView({ mode }: { mode: ChatMode }) {
  const chat = useAssistant((s) => s.chats[mode]);
  const sendMessage = useAssistant((s) => s.sendMessage);
  const retry = useAssistant((s) => s.retry);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const busy = chat.status === 'waiting' || chat.status === 'streaming';
  const copy = COPY[mode];

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.messages, chat.status]);

  const submit = (text: string) => {
    if (!text.trim() || busy) return;
    setDraft('');
    void sendMessage(mode, text);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  };

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        {chat.messages.length === 0 && (
          <div className="chat-empty">
            <p>{copy.intro}</p>
            <div className="suggestions">
              {copy.suggestions.map((s) => (
                <button key={s} type="button" className="chip chip-button" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
        {chat.status === 'waiting' && (
          <div className="msg msg-assistant typing" role="status" aria-label="Assistant is thinking">
            <span />
            <span />
            <span />
          </div>
        )}
        {chat.status === 'error' && (
          <div className="error-banner" role="alert">
            <span>{chat.error}</span>
            <button type="button" className="btn-link" onClick={() => void retry(mode)}>
              Retry
            </button>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="chat-input" onSubmit={onSubmit}>
        <label htmlFor={`chat-input-${mode}`} className="sr-only">
          Message
        </label>
        <textarea
          id={`chat-input-${mode}`}
          rows={1}
          value={draft}
          maxLength={4000}
          placeholder={copy.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className="btn-primary" disabled={busy || !draft.trim()} aria-label="Send">
          ➤
        </button>
      </form>
    </div>
  );
}
