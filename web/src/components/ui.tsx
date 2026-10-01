/** Small presentational pieces shared across the assistant views. */
import type { ReactNode } from 'react';

export function ErrorBanner({ message, onRetry, className = '' }: { message?: string; onRetry: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 text-sm text-orange-800 ${className}`}
    >
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-900">
        Retry
      </button>
    </div>
  );
}

export function FallbackBadge({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-block w-fit rounded-md bg-amber-100 px-2 py-0.5 text-[0.72rem] font-semibold text-amber-700">
      {children}
    </span>
  );
}

export function Skeleton({ className = 'h-16' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-100 motion-reduce:animate-none ${className}`} />;
}

export const ghostButton =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:border-brand hover:text-brand';
