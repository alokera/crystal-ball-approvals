'use client';

import type { ApprovalItem } from '@cb/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, getApprovals, MESSAGES } from '@/lib/api';
import { ApprovalsTable } from './ApprovalsTable';
import { AssistantPanel } from './AssistantPanel';

type Load = { status: 'loading' | 'error' | 'success'; items?: ApprovalItem[]; error?: string };

const NAV_ICONS = ['▦', '👤', '👥', '🎫', '🏬', '📊', '🧪'];

export function Dashboard() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [query, setQuery] = useState('');

  const fetchQueue = useCallback((signal?: AbortSignal) => {
    setLoad({ status: 'loading' });
    getApprovals(signal)
      .then(({ items }) => setLoad({ status: 'success', items }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.kind === 'aborted') return;
        setLoad({ status: 'error', error: err instanceof ApiError ? err.message : MESSAGES.network });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchQueue(controller.signal);
    return () => controller.abort();
  }, [fetchQueue]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return load.items;
    return load.items?.filter((i) => [i.title, i.submittedBy, ...i.path].some((f) => f.toLowerCase().includes(q)));
  }, [load.items, query]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Ambient colour behind the glass surfaces. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-sky-600/15 blur-3xl" />
      </div>

      <div className="grid min-h-screen grid-cols-1 grid-rows-[4.5rem_1fr_2.5rem] md:grid-cols-[4.5rem_minmax(0,1fr)]">
        <header className="flex items-center justify-between border-b border-white/10 bg-slate-950/60 px-4 backdrop-blur-xl md:col-span-2 md:px-6">
          <div className="flex flex-col leading-tight">
            <strong className="text-xl tracking-tight text-white">OomniEye</strong>
            <span className="text-[0.7rem] tracking-[0.18em] text-slate-400">DIGITAL TWIN SOLUTIONS</span>
          </div>
          <div aria-label="Signed in as R" className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 font-bold text-white">
            R
          </div>
        </header>

        <aside aria-label="Main navigation" className="hidden flex-col items-center gap-7 border-r border-white/10 bg-slate-950/40 pt-6 backdrop-blur-xl md:flex">
          {NAV_ICONS.map((icon, i) => (
            <span key={i} aria-hidden className="text-lg opacity-70 transition hover:opacity-100">
              {icon}
            </span>
          ))}
        </aside>

        <main className="flex min-w-0 flex-col gap-5 p-4 md:p-7">
          <section className="glass flex flex-col gap-4 rounded-3xl px-5 py-5 md:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-sm text-slate-200 transition hover:bg-white/10">
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-semibold tracking-tight text-white">Approvals &amp; Review</h1>
            </div>
            <label className="flex max-w-xl items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition focus-within:border-violet-400/60">
              <span aria-hidden>🔍</span>
              <input
                type="search"
                placeholder="Search approvals by title, author, folder, or page…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search approvals"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
              />
            </label>
          </section>

          <ApprovalsTable items={visible} status={load.status} error={load.error} onRetry={() => fetchQueue()} />
        </main>

        <footer className="flex items-center justify-between border-t border-white/10 bg-slate-950/60 px-4 text-xs text-slate-500 backdrop-blur-xl md:col-span-2 md:px-6">
          <span>Ready</span>
          <span className="hidden sm:inline">© 2026 OomniEye. All rights reserved.</span>
          <span />
        </footer>
      </div>

      <AssistantPanel itemCount={load.items?.length ?? 0} />
    </div>
  );
}
