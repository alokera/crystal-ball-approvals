'use client';

import type { ChatMode } from '@cb/contracts';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAssistant, type UiMessage } from '@/store/assistant';
import { ErrorBanner, FallbackBadge } from './ui';

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
    return (
      <div className="max-w-[88%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm text-white">
        {message.content}
      </div>
    );
  }
  return (
    <div
      className={`flex max-w-[88%] flex-col gap-1.5 self-start rounded-2xl rounded-bl-md border bg-slate-100 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800 ${
        message.interrupted ? 'border-dashed border-orange-400' : 'border-transparent'
      }`}
      data-testid={message.streaming ? 'assistant-message-streaming' : 'assistant-message'}
    >
      {message.source === 'fallback' && (
        <FallbackBadge title="The AI model was unavailable, so this answer is rule-based.">AI unavailable · rule-based answer</FallbackBadge>
      )}
      <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {message.content}
        {message.streaming && (
          <span aria-hidden className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-brand align-text-bottom motion-reduce:animate-none" />
        )}
      </div>
      {!!message.citations?.length && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-slate-500">Sources:</span>
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1" aria-live="polite">
        {chat.messages.length === 0 && (
          <div className="text-sm text-slate-500">
            <p className="mb-3">{copy.intro}</p>
            <div className="flex flex-col items-start gap-1.5">
              {copy.suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => submit(s)}
                  className="chip text-left transition hover:border-brand hover:text-brand"
                >
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
          <div
            role="status"
            aria-label="Assistant is thinking"
            className="flex gap-1 self-start rounded-2xl rounded-bl-md bg-slate-100 px-3.5 py-3"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                style={{ animationDelay: `${delay}ms` }}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none"
              />
            ))}
          </div>
        )}
        {chat.status === 'error' && <ErrorBanner message={chat.error} onRetry={() => void retry(mode)} />}
        <div ref={endRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2 border-t border-slate-200 pt-3">
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
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={busy || !draft.trim()}
          className="w-11 shrink-0 rounded-xl bg-brand text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ➤
        </button>
      </form>
    </div>
  );
}
