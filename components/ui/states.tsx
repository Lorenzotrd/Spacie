import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "./button";
import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      {icon && (
        <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-segment text-muted">{icon}</div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-xs text-[0.8125rem] text-muted">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}>
      <AlertCircle size={20} className="text-danger" aria-hidden />
      <p className="text-sm font-medium text-ink">Something went wrong</p>
      <p className="max-w-xs text-[0.8125rem] text-muted">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-segment", className)} />;
}

/** Placeholder rows while a list loads. */
export function SkeletonRows({ rows = 4, height = "h-[3.625rem]" }: { rows?: number; height?: string }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn("flex items-center gap-3 border-b border-divider px-4", height)}>
          <Skeleton className="size-[2.125rem] rounded-[0.5625rem]" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="ml-auto h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
