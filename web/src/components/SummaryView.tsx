'use client';

import { useEffect, useState } from 'react';
import { useAssistant } from '@/store/assistant';

function useSpeech(locale: string) {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const toggle = (text: string) => {
    if (!supported) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  return { supported, speaking, toggle };
}

export function SummaryView() {
  const summary = useAssistant((s) => s.summary);
  const locale = useAssistant((s) => s.locale);
  const loadSummary = useAssistant((s) => s.loadSummary);
  const speech = useSpeech(locale);

  useEffect(() => {
    if (useAssistant.getState().summary.status === 'idle') void loadSummary();
  }, [loadSummary, locale]);

  if (summary.status === 'error') {
    return (
      <div className="error-banner" role="alert">
        <span>{summary.error}</span>
        <button type="button" className="btn-link" onClick={() => void loadSummary()}>
          Retry
        </button>
      </div>
    );
  }

  if (summary.status !== 'success' || !summary.data) {
    return (
      <div className="skeleton-list" role="status" aria-label="Preparing summary">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    );
  }

  const data = summary.data;
  const spoken = [data.headline, ...data.items.map((i) => `${i.title}. ${i.reason} ${i.recommendedAction}.`)].join(' ');

  return (
    <div className="summary">
      <div className="summary-head">
        <p className="summary-headline">{data.headline}</p>
        <div className="summary-actions">
          {data.source === 'fallback' && (
            <span className="badge badge-fallback" title="The AI model was unavailable, so this summary uses the standard urgency rules.">
              AI unavailable, showing basic summary.
            </span>
          )}
          {speech.supported && (
            <button type="button" className="btn-ghost" onClick={() => speech.toggle(spoken)}>
              {speech.speaking ? '■ Stop' : '🔊 Read aloud'}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => void loadSummary()}>
            ↻ Refresh
          </button>
        </div>
      </div>
      <ol className="summary-list">
        {data.items.map((item) => (
          <li key={item.id} className="summary-item">
            <span className={`priority priority-${item.priority}`}>{item.priority}</span>
            <div>
              <div className="summary-title">{item.title}</div>
              <div className="muted">{item.reason}</div>
              <div className="summary-action">→ {item.recommendedAction}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
