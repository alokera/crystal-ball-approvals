'use client';

import type { ChatMode } from '@cb/contracts';
import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAssistant, type View } from '@/store/assistant';
import { ChatView } from './ChatView';
import { SummaryView } from './SummaryView';

const ACTIONS: Array<{ view: View; label: string; icon: string; hint: string }> = [
  { view: 'summary', label: 'Present me Summary', icon: '📋', hint: 'Queue ranked by urgency' },
  { view: 'talk', label: 'Talk to me', icon: '💬', hint: 'Chat about your approvals' },
  { view: 'help', label: 'Help me', icon: '❓', hint: 'Answers from the policy' },
  { view: 'teach', label: 'Teach me', icon: '🎓', hint: 'Step-by-step review guide' },
];

const LOCALES = [
  { tag: 'en', label: 'English' },
  { tag: 'hi', label: 'हिन्दी' },
  { tag: 'es', label: 'Español' },
  { tag: 'fr', label: 'Français' },
  { tag: 'de', label: 'Deutsch' },
];

function Greeting() {
  const greeting = useAssistant((s) => s.greeting);
  const loadGreeting = useAssistant((s) => s.loadGreeting);

  if (greeting.status === 'error') {
    return (
      <div className="greeting error-banner" role="alert">
        <span>{greeting.error}</span>
        <button type="button" className="btn-link" onClick={() => void loadGreeting()}>
          Retry
        </button>
      </div>
    );
  }
  if (greeting.status !== 'success' || !greeting.data) {
    return <div className="greeting skeleton skeleton-line" role="status" aria-label="Loading greeting" />;
  }
  return (
    <div className="greeting">
      <p>{greeting.data.greeting}</p>
      {greeting.data.source === 'fallback' && <span className="badge badge-fallback">AI unavailable · template</span>}
    </div>
  );
}

function Avatar() {
  return (
    <span className="avatar" aria-hidden>
      <svg viewBox="0 0 32 32" width="22" height="22">
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

  if (!open) {
    return (
      <button type="button" className="fab" aria-label="Open Approvals assistant" onClick={() => setOpen(true)}>
        <Avatar />
      </button>
    );
  }

  const current = ACTIONS.find((a) => a.view === view);

  return (
    <>
      <section className={`panel${expanded ? ' panel-expanded' : ''}`} aria-label="Approvals assistant">
        <header className="panel-header">
          <Avatar />
          <h2>Approvals</h2>
          <div className="panel-header-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label="About this assistant"
              title="Actions are answered by Claude. If the model is slow (8s) or unavailable, a rule-based answer is shown and labelled."
            >
              ⓘ
            </button>
            <button type="button" className="icon-btn" aria-label={expanded ? 'Collapse' : 'Expand'} onClick={toggleExpanded}>
              {expanded ? '⤡' : '⤢'}
            </button>
            <button type="button" className="icon-btn" aria-label="Close assistant" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
        </header>

        <div className="panel-subheader">
          <nav className="crumbs" aria-label="Assistant navigation">
            <button type="button" className="crumb" onClick={() => setView('home')}>
              ⌂ Approvals
            </button>
            {current && <span className="crumb-current">› {current.label}</span>}
          </nav>
          <div className="subheader-actions">
            <select aria-label="Assistant language" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {LOCALES.map((l) => (
                <option key={l.tag} value={l.tag}>
                  {l.label}
                </option>
              ))}
            </select>
            <button type="button" className="replay" onClick={() => void loadGreeting()}>
              Replay Greeting
            </button>
          </div>
        </div>

        <div className="panel-body">
          {view === 'home' ? (
            <>
              <Greeting />
              <div className="action-grid">
                {ACTIONS.map((a) => (
                  <button key={a.view} type="button" className="action-card" onClick={() => setView(a.view)}>
                    <span className="action-icon" aria-hidden>
                      {a.icon}
                    </span>
                    <span className="action-label">{a.label}</span>
                    <span className="action-hint">{a.hint}</span>
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

        <footer className="panel-footer">
          <span>
            {itemCount} folders / items
          </span>
          <a href="#" onClick={(e) => e.preventDefault()}>
            HMS Panel ↗
          </a>
        </footer>
      </section>
      <button type="button" className="fab fab-close" aria-label="Close assistant" onClick={() => setOpen(false)}>
        ✕
      </button>
    </>
  );
}
