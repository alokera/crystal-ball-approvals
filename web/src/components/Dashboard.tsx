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
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>OomniEye</strong>
          <span>DIGITAL TWIN SOLUTIONS</span>
        </div>
        <div className="user-avatar" aria-label="Signed in as R">
          R
        </div>
      </header>

      <aside className="sidebar" aria-label="Main navigation">
        {['▦', '👤', '👥', '🎫', '🏬', '📊', '🧪'].map((icon, i) => (
          <span key={i} className="side-icon" aria-hidden>
            {icon}
          </span>
        ))}
      </aside>

      <main className="main">
        <section className="card header-card">
          <div className="header-row">
            <button type="button" className="btn-outline">
              ← Back to Dashboard
            </button>
            <h1>Approvals &amp; Review</h1>
          </div>
          <label className="search">
            <span aria-hidden>🔍</span>
            <input
              type="search"
              placeholder="Search approvals by title, author, folder, or page…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search approvals"
            />
          </label>
        </section>

        <ApprovalsTable items={visible} status={load.status} error={load.error} onRetry={() => fetchQueue()} />
      </main>

      <footer className="statusbar">
        <span>Ready</span>
        <span>© 2026 OomniEye. All rights reserved.</span>
        <span />
      </footer>

      <AssistantPanel itemCount={load.items?.length ?? 0} />
    </div>
  );
}
