'use client';

import type { ChatMode } from '@cb/contracts';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAssistant, type View } from '@/store/assistant';
import { ChatView } from './ChatView';
import { SummaryView } from './SummaryView';
import { ErrorBanner, FallbackBadge, Skeleton } from './ui';

// Same four entry points, labels and order as the reference panel.
const ACTIONS: Array<{ view: View; label: string; icon: string }> = [
  { view: 'summary', label: 'Present me Summary', icon: '📋' },
  { view: 'talk', label: 'Talk to me', icon: '💬' },
  { view: 'help', label: 'Help me', icon: '🙋' },
  { view: 'teach', label: 'Teach me', icon: '🎓' },
];

const LOCALES = [
  { tag: 'en', label: 'English' },
  { tag: 'hi', label: 'हिन्दी' },
  { tag: 'es', label: 'Español' },
  { tag: 'fr', label: 'Français' },
  { tag: 'de', label: 'Deutsch' },
];

const iconButton =
  'grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white';

function Greeting() {
  const greeting = useAssistant((s) => s.greeting);
  const loadGreeting = useAssistant((s) => s.loadGreeting);

  if (greeting.status === 'error') {
    return <ErrorBanner message={greeting.error} onRetry={() => void loadGreeting()} />;
  }
  if (greeting.status !== 'success' || !greeting.data) {
    return (
      <div role="status" aria-label="Loading greeting">
        <Skeleton className="h-12" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-brand-soft px-3.5 py-2.5 text-sm text-slate-700">
      <p>{greeting.data.greeting}</p>
      {greeting.data.source === 'fallback' && <FallbackBadge>AI unavailable · template</FallbackBadge>}
    </div>
  );
}

function Avatar() {
  return (
    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-50">
      <svg viewBox="0 0 32 32" width="24" height="24">
        <circle cx="16" cy="12" r="6" fill="#fbbf24" />
        <path d="M5 29c1.5-6.5 6-9.5 11-9.5s9.5 3 11 9.5" fill="#f59e0b" />
        <circle cx="13.8" cy="11.5" r="0.9" fill="#1f2937" />
        <circle cx="18.2" cy="11.5" r="0.9" fill="#1f2937" />
      </svg>
    </span>
  );
}

export function AssistantPanel({ itemCount }: { itemCount: number }) {
  const { open, expanded, view, locale } = useAssistant(
    useShallow((s) => ({ open: s.open, expanded: s.expanded, view: s.view, locale: s.locale })),
  );
  const setOpen = useAssistant((s) => s.setOpen);
  const setView = useAssistant((s) => s.setView);
  const setLocale = useAssistant((s) => s.setLocale);
  const toggleExpanded = useAssistant((s) => s.toggleExpanded);
  const loadGreeting = useAssistant((s) => s.loadGreeting);

  // (Re)generate the greeting when the panel opens or the language changes.
  useEffect(() => {
    if (open) void loadGreeting();
  }, [open, locale, loadGreeting]);

  const fab =
    'fixed bottom-5 right-5 z-30 grid h-13 w-13 place-items-center rounded-full bg-navy text-lg text-white shadow-xl transition hover:scale-105';

  if (!open) {
    return (
      <button type="button" className={fab} aria-label="Open Approvals assistant" onClick={() => setOpen(true)}>
        <Avatar />
      </button>
    );
  }

  const current = ACTIONS.find((a) => a.view === view);

  return (
    <>
      <section
        aria-label="Approvals assistant"
        className={`fixed inset-x-2 bottom-21 top-4 z-20 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(20,24,40,0.16)] sm:inset-x-auto sm:right-5 sm:top-auto ${
          expanded ? 'sm:h-[calc(100vh-7rem)] sm:w-[min(760px,calc(100vw-2.5rem))]' : 'sm:h-[min(680px,calc(100vh-7rem))] sm:w-[400px]'
        }`}
      >
        <header className="flex items-center gap-3 bg-navy px-4 py-3">
          <Avatar />
          <h2 className="flex-1 text-lg font-semibold text-white">Approvals</h2>
          <div className="flex gap-1">
            <button
              type="button"
              className={iconButton}
              aria-label="About this assistant"
              title="Actions are answered by Claude. If the model is slow (8s) or unavailable, a rule-based answer is shown and labelled."
            >
              ⓘ
            </button>
            <button type="button" className={iconButton} aria-label={expanded ? 'Collapse' : 'Expand'} onClick={toggleExpanded}>
              {expanded ? '⤡' : '⤢'}
            </button>
            <button type="button" className={iconButton} aria-label="Close assistant" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
        </header>

        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm">
          <nav aria-label="Assistant navigation" className="flex min-w-0 items-center gap-1.5 truncate">
            <button type="button" className="font-medium text-slate-800 hover:text-brand" onClick={() => setView('home')}>
              ⌂ Approvals
            </button>
            {current && <span className="truncate text-slate-500">› {current.label}</span>}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <select
              aria-label="Assistant language"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-700"
            >
              {LOCALES.map((l) => (
                <option key={l.tag} value={l.tag}>
                  {l.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void loadGreeting()} className="text-xs font-semibold text-replay hover:underline">
              Replay Greeting
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {view === 'home' ? (
            <>
              <Greeting />
              <div className={`grid gap-4 ${expanded ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                {ACTIONS.map((a) => (
                  <button
                    key={a.view}
                    type="button"
                    onClick={() => setView(a.view)}
                    className="flex min-h-40 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_6px_18px_rgba(124,58,237,0.12)] focus-visible:outline-2 focus-visible:outline-brand motion-reduce:transition-none"
                  >
                    <span aria-hidden className="text-5xl">
                      {a.icon}
                    </span>
                    <span className="font-medium text-slate-700">{a.label}</span>
                  </button>
                ))}
              </div>
            </>
          ) : view === 'summary' ? (
            <SummaryView />
          ) : (
            <ChatView key={view} mode={view as ChatMode} />
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5 text-sm text-slate-500">
          <span>{itemCount} folders / items</span>
          {/* Shown as in the reference; the HMS panel itself is outside this assignment's scope. */}
          <span className="font-medium text-slate-700" title="Opens the HMS panel in the full product (out of scope here)">
            HMS Panel ↗
          </span>
        </footer>
      </section>
      <button type="button" className={fab} aria-label="Close assistant" onClick={() => setOpen(false)}>
        ✕
      </button>
    </>
  );
}
