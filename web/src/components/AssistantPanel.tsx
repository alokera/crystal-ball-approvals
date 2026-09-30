'use client';

import type { ChatMode } from '@cb/contracts';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAssistant, type View } from '@/store/assistant';
import { ChatView } from './ChatView';
import { SummaryView } from './SummaryView';
import { ErrorBanner, FallbackBadge, Skeleton } from './ui';

const ACTIONS: Array<{ view: View; label: string; icon: string; hint: string; glow: string }> = [
  { view: 'summary', label: 'Present me Summary', icon: '📋', hint: 'Queue ranked by urgency', glow: 'from-violet-500/25' },
  { view: 'talk', label: 'Talk to me', icon: '💬', hint: 'Chat about your approvals', glow: 'from-sky-500/25' },
  { view: 'help', label: 'Help me', icon: '❓', hint: 'Answers from the policy', glow: 'from-amber-500/25' },
  { view: 'teach', label: 'Teach me', icon: '🎓', hint: 'Step-by-step review guide', glow: 'from-emerald-500/25' },
];

const LOCALES = [
  { tag: 'en', label: 'English' },
  { tag: 'hi', label: 'हिन्दी' },
  { tag: 'es', label: 'Español' },
  { tag: 'fr', label: 'Français' },
  { tag: 'de', label: 'Deutsch' },
];

const iconButton =
  'grid h-8 w-8 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-violet-400';

function Greeting() {
  const greeting = useAssistant((s) => s.greeting);
  const loadGreeting = useAssistant((s) => s.loadGreeting);

  if (greeting.status === 'error') {
    return <ErrorBanner message={greeting.error} onRetry={() => void loadGreeting()} />;
  }
  if (greeting.status !== 'success' || !greeting.data) {
    return (
      <div role="status" aria-label="Loading greeting">
        <Skeleton className="h-14" />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/5 px-4 py-3 text-sm text-slate-100">
      <p>{greeting.data.greeting}</p>
      {greeting.data.source === 'fallback' && <FallbackBadge>AI unavailable · template</FallbackBadge>}
    </div>
  );
}

function Avatar({ size = 'h-9 w-9' }: { size?: string }) {
  return (
    <span aria-hidden className={`grid ${size} shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-400 shadow-lg shadow-orange-900/30`}>
      <svg viewBox="0 0 32 32" width="22" height="22">
        <circle cx="16" cy="12" r="6" fill="#fff7e6" />
        <path d="M5 29c1.5-6.5 6-9.5 11-9.5s9.5 3 11 9.5" fill="#fff7e6" />
        <circle cx="13.8" cy="11.5" r="0.9" fill="#7c2d12" />
        <circle cx="18.2" cy="11.5" r="0.9" fill="#7c2d12" />
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
    'fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full border border-white/15 bg-slate-900/80 text-white shadow-2xl shadow-violet-900/40 backdrop-blur-xl transition hover:scale-105';

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
        className={`glass fixed inset-x-2 bottom-22 top-20 z-20 flex flex-col overflow-hidden rounded-3xl bg-slate-900/70 sm:inset-x-auto sm:right-5 sm:top-auto ${
          expanded ? 'sm:h-[calc(100vh-7.5rem)] sm:w-[min(760px,calc(100vw-2.5rem))]' : 'sm:h-[min(680px,calc(100vh-7.5rem))] sm:w-[400px]'
        }`}
      >
        <header className="flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/10 to-transparent px-4 py-3">
          <Avatar />
          <h2 className="flex-1 text-lg font-semibold tracking-tight text-white">Approvals</h2>
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

        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-2 text-sm">
          <nav aria-label="Assistant navigation" className="flex min-w-0 items-center gap-1.5 truncate">
            <button type="button" className="font-medium text-slate-200 hover:text-white" onClick={() => setView('home')}>
              ⌂ Approvals
            </button>
            {current && <span className="truncate text-slate-400">› {current.label}</span>}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <select
              aria-label="Assistant language"
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="rounded-md border border-white/10 bg-slate-900/80 px-1.5 py-0.5 text-xs text-slate-200"
            >
              {LOCALES.map((l) => (
                <option key={l.tag} value={l.tag}>
                  {l.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void loadGreeting()} className="text-xs font-semibold text-amber-300 hover:text-amber-200">
              Replay Greeting
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {view === 'home' ? (
            <>
              <Greeting />
              <div className={`grid gap-3 ${expanded ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
                {ACTIONS.map((a) => (
                  <button
                    key={a.view}
                    type="button"
                    onClick={() => setView(a.view)}
                    className={`group flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-gradient-to-b ${a.glow} to-white/[0.02] p-4 text-center transition hover:-translate-y-0.5 hover:border-violet-400/50 hover:shadow-lg hover:shadow-violet-900/30 focus-visible:outline-2 focus-visible:outline-violet-400 motion-reduce:transition-none`}
                  >
                    <span aria-hidden className="text-4xl transition group-hover:scale-110 motion-reduce:transition-none">
                      {a.icon}
                    </span>
                    <span className="font-medium text-slate-100">{a.label}</span>
                    <span className="text-xs text-slate-400">{a.hint}</span>
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

        <footer className="border-t border-white/10 px-4 py-2.5 text-xs text-slate-400">{itemCount} folders / items</footer>
      </section>
      <button type="button" className={fab} aria-label="Close assistant" onClick={() => setOpen(false)}>
        ✕
      </button>
    </>
  );
}
