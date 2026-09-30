'use client';

import type { Priority } from '@cb/contracts';
import { useEffect, useState } from 'react';
import { useAssistant } from '@/store/assistant';
import { ErrorBanner, FallbackBadge, Skeleton, ghostButton } from './ui';

const PRIORITY_STYLE: Record<Priority, string> = {
  high: 'bg-red-500/15 text-red-300 ring-red-400/30',
  medium: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  low: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
};

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
    return <ErrorBanner message={summary.error} onRetry={() => void loadSummary()} />;
  }

  if (summary.status !== 'success' || !summary.data) {
    return (
      <div role="status" aria-label="Preparing summary" className="flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  const data = summary.data;
  const spoken = [data.headline, ...data.items.map((i) => `${i.title}. ${i.reason} ${i.recommendedAction}.`)].join(' ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <p className="font-semibold leading-snug text-white">{data.headline}</p>
        <div className="flex flex-wrap items-center gap-2">
          {data.source === 'fallback' && (
            <FallbackBadge title="The AI model was unavailable, so this summary uses the standard urgency rules.">
              AI unavailable, showing basic summary.
            </FallbackBadge>
          )}
          {speech.supported && (
            <button type="button" className={ghostButton} onClick={() => speech.toggle(spoken)}>
              {speech.speaking ? '■ Stop' : '🔊 Read aloud'}
            </button>
          )}
          <button type="button" className={ghostButton} onClick={() => void loadSummary()}>
            ↻ Refresh
          </button>
        </div>
      </div>
      <ol className="flex flex-col gap-2.5">
        {data.items.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <span
              className={`h-fit shrink-0 rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ring-1 ${PRIORITY_STYLE[item.priority]}`}
            >
              {item.priority}
            </span>
            <div className="min-w-0">
              <div className="font-medium text-slate-100">{item.title}</div>
              <div className="text-xs text-slate-400">{item.reason}</div>
              <div className="mt-1 text-xs text-violet-300">→ {item.recommendedAction}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
