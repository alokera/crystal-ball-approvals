/** Small presentational pieces shared across the assistant views. */
import type { ReactNode } from 'react';

export function ErrorBanner({ message, onRetry, className = '' }: { message?: string; onRetry: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2.5 text-sm text-orange-200 ${className}`}
    >
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-orange-300 underline underline-offset-2 hover:text-orange-200">
        Retry
      </button>
    </div>
  );
}

export function FallbackBadge({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="inline-block w-fit rounded-md bg-amber-400/15 px-2 py-0.5 text-[0.72rem] font-semibold text-amber-300">
      {children}
    </span>
  );
}

export function Skeleton({ className = 'h-16' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/[0.06] motion-reduce:animate-none ${className}`} />;
}

export const ghostButton =
  'rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-200 transition hover:border-violet-400/50 hover:bg-white/10';
