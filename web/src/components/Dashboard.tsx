'use client';

import type { ApprovalItem } from '@cb/contracts';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, getApprovals, MESSAGES } from '@/lib/api';
import { ApprovalsTable } from './ApprovalsTable';
import { AssistantPanel } from './AssistantPanel';

type Load = { status: 'loading' | 'error' | 'success'; items?: ApprovalItem[]; error?: string };

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

      <main className="flex flex-col gap-5 p-4 md:p-8 lg:pr-[452px]">
        <header className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Approvals &amp; Review</h1>
            <p className="mt-1 text-sm text-slate-500">
              The pending queue the assistant reasons over. Use the assistant panel to summarise, ask, or learn how to review.
            </p>
          </div>
          <label className="flex max-w-xl items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 transition focus-within:border-brand">
            <span aria-hidden>🔍</span>
            <input
              type="search"
              placeholder="Search approvals by title, author or folder…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search approvals"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            />
          </label>
        </header>

        <ApprovalsTable items={visible} status={load.status} error={load.error} onRetry={() => fetchQueue()} />
      </main>

      <AssistantPanel itemCount={load.items?.length ?? 0} />
    </div>
  );
}
