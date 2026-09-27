import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";

/** A settings card: a white panel with a small heading and an optional action. */
export function SettingsCard({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col gap-4 p-[22px]", className)}>
      {(title || action) && (
        <div className="flex items-center gap-3">
          {title && <h2 className="m-0 flex-1 text-[15px] font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

/** One setting: a label and hint on the left, its control on the right. A row right after another gets a divider. */
export function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row flex flex-wrap items-center gap-x-4 gap-y-2.5 border-divider [.setting-row+&]:border-t [.setting-row+&]:pt-3.5">
      <div className="flex min-w-[180px] flex-1 flex-col gap-[3px]">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-[13px] leading-normal text-muted">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** A labelled text field matching the settings mockups. */
export function Field({
  label,
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-1 flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      <input
        {...input}
        className="h-[42px] rounded-control border border-line bg-card px-3 text-sm text-ink outline-none placeholder:text-[#a3a5ac] focus:border-accent focus-visible:shadow-[0_0_0_3px_#eaeffc] read-only:bg-subtle read-only:text-ink-2"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/** A big number with its caption, as on the Public links page. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-4 md:p-[22px]">
      <span className="text-xs leading-snug text-muted md:text-[13px]">{label}</span>
      <span className="text-2xl font-semibold tracking-[-0.02em] md:text-[28px]">{value}</span>
    </Card>
  );
}

/** Small pill for statuses: expired, pending, this device. */
export function Pill({ tone, children }: { tone: "danger" | "warning" | "success" | "accent" | "ink"; children: ReactNode }) {
  const tones = {
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    success: "bg-success-soft text-success",
    accent: "bg-accent-soft text-accent-hover",
    ink: "bg-ink text-white",
  };
  return (
    <span className={cn("inline-flex rounded-full px-[9px] py-[3px] text-xs font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}
