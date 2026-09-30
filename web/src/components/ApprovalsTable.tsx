'use client';

import type { ApprovalItem, ApprovalType } from '@cb/contracts';

const TYPE_META: Record<ApprovalType, { label: string; icon: string; tone: string }> = {
  folder: { label: 'Folder', icon: '📁', tone: 'amber' },
  video: { label: 'Video', icon: '🎬', tone: 'rose' },
  pdf: { label: 'Pdf', icon: '📄', tone: 'blue' },
  image: { label: 'Image', icon: '🖼️', tone: 'green' },
};

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type Props = {
  items: ApprovalItem[] | undefined;
  status: 'loading' | 'error' | 'success';
  error?: string;
  onRetry: () => void;
};

export function ApprovalsTable({ items, status, error, onRetry }: Props) {
  return (
    <section className="card table-card" aria-labelledby="pending-heading">
      <div className="table-toolbar">
        <h2 id="pending-heading">
          <span aria-hidden>≡</span> PENDING APPROVAL REQUESTS
        </h2>
        <span className="count-pill">{items?.length ?? 0} items</span>
      </div>

      {status === 'error' ? (
        <div className="error-banner table-message" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-link" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Folder / Content name</th>
                <th>Type</th>
                <th>Submitted by</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {status === 'loading' &&
                [0, 1, 2, 3].map((i) => (
                  <tr key={i}>
                    <td colSpan={5}>
                      <div className="skeleton skeleton-line" />
                    </td>
                  </tr>
                ))}
              {items?.map((item, i) => {
                const meta = TYPE_META[item.type];
                return (
                  <tr key={item.id} className={i === 0 ? 'row-active' : undefined}>
                    <td>
                      <div className="name-cell">
                        <span className={`type-icon tone-${meta.tone}`} aria-hidden>
                          {meta.icon}
                        </span>
                        <div>
                          <div className="item-title">{item.title}</div>
                          <div className="muted">{item.path.join(' › ')}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="type-chip">{meta.label}</span>
                    </td>
                    <td>{item.submittedBy}</td>
                    <td>{formatDate(item.submittedAt)}</td>
                    <td>
                      <span className="status-pill">Pending Review</span>
                    </td>
                  </tr>
                );
              })}
              {status === 'success' && items?.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
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
