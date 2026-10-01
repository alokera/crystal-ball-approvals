'use client';

import type { ApprovalItem, ApprovalType } from '@cb/contracts';
import { ErrorBanner, Skeleton } from './ui';

const TYPE_META: Record<ApprovalType, { label: string; icon: string; tone: string }> = {
  folder: { label: 'Folder', icon: '📁', tone: 'bg-amber-50' },
  video: { label: 'Video', icon: '🎬', tone: 'bg-rose-50' },
  pdf: { label: 'Pdf', icon: '📄', tone: 'bg-blue-50' },
  image: { label: 'Image', icon: '🖼️', tone: 'bg-emerald-50' },
};

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type Props = {
  items: ApprovalItem[] | undefined;
  status: 'loading' | 'error' | 'success';
  error?: string;
  onRetry: () => void;
};

const th = 'px-5 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500';
const td = 'px-5 py-3.5 align-middle';

export function ApprovalsTable({ items, status, error, onRetry }: Props) {
  return (
    <section aria-labelledby="pending-heading" className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <h2 id="pending-heading" className="text-sm font-semibold tracking-wider text-slate-800">
          <span aria-hidden className="mr-1.5 text-brand">
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
            <thead className="border-b border-slate-200">
              <tr>
                <th className={th}>Folder / Content name</th>
                <th className={th}>Type</th>
                <th className={th}>Submitted by</th>
                <th className={th}>Date</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {status === 'loading' &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={5} className={td}>
                      <Skeleton className="h-6" />
                    </td>
                  </tr>
                ))}
              {items?.map((item) => {
                const meta = TYPE_META[item.type];
                return (
                  <tr key={item.id}>
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                          {meta.icon}
                        </span>
                        <div>
                          <div className="font-medium text-slate-800">{item.title}</div>
                          <div className="text-xs text-slate-500">{item.path.join(' › ')}</div>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <span className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700">{meta.label}</span>
                    </td>
                    <td className={`${td} text-slate-600`}>{item.submittedBy}</td>
                    <td className={`${td} text-slate-600`}>{formatDate(item.submittedAt)}</td>
                    <td className={td}>
                      <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-replay">Pending Review</span>
                    </td>
                  </tr>
                );
              })}
              {status === 'success' && items?.length === 0 && (
                <tr>
                  <td colSpan={5} className={`${td} text-slate-500`}>
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
