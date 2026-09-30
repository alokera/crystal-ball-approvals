'use client';

import type { ApprovalItem, ApprovalType } from '@cb/contracts';
import { ErrorBanner, Skeleton } from './ui';

const TYPE_META: Record<ApprovalType, { label: string; icon: string; tone: string }> = {
  folder: { label: 'Folder', icon: '📁', tone: 'bg-amber-400/15' },
  video: { label: 'Video', icon: '🎬', tone: 'bg-rose-400/15' },
  pdf: { label: 'Pdf', icon: '📄', tone: 'bg-sky-400/15' },
  image: { label: 'Image', icon: '🖼️', tone: 'bg-emerald-400/15' },
};

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type Props = {
  items: ApprovalItem[] | undefined;
  status: 'loading' | 'error' | 'success';
  error?: string;
  onRetry: () => void;
};

const th = 'px-5 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-slate-400';
const td = 'px-5 py-3.5 align-middle';

export function ApprovalsTable({ items, status, error, onRetry }: Props) {
  return (
    <section aria-labelledby="pending-heading" className="glass overflow-hidden rounded-3xl">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <h2 id="pending-heading" className="text-sm font-semibold tracking-wider text-slate-100">
          <span aria-hidden className="mr-1.5 text-violet-400">
            ≡
          </span>
          PENDING APPROVAL REQUESTS
        </h2>
        <span className="chip">{items?.length ?? 0} items</span>
      </div>

      {status === 'error' ? (
        <ErrorBanner message={error} onRetry={onRetry} className="m-5" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="border-b border-white/10">
              <tr>
                <th className={th}>Folder / Content name</th>
                <th className={th}>Type</th>
                <th className={th}>Submitted by</th>
                <th className={th}>Date</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {status === 'loading' &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} className={td}>
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))}
              {items?.map((item, i) => {
                const meta = TYPE_META[item.type];
                return (
                  <tr
                    key={item.id}
                    className={`transition hover:bg-white/[0.03] ${i === 0 ? 'bg-violet-500/10 shadow-[inset_3px_0_0_var(--color-violet-400)]' : ''}`}
                  >
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                          {meta.icon}
                        </span>
                        <div>
                          <div className="font-medium text-slate-100">{item.title}</div>
                          <div className="text-xs text-slate-400">{item.path.join(' › ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <span className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-slate-300">{meta.label}</span>
                    </td>
                    <td className={`${td} text-slate-300`}>{item.submittedBy}</td>
                    <td className={`${td} text-slate-300`}>{formatDate(item.submittedAt)}</td>
                    <td className={td}>
                      <span className="rounded-lg bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-300">Pending Review</span>
                    </td>
                  </tr>
                );
              })}
              {status === 'success' && items?.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${td} text-slate-400`}>
                    No items match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
