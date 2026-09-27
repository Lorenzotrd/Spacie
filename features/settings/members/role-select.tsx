import { ChevronDown } from "lucide-react";
import { cn } from "@/components/ui/cn";

export type EditableRole = "admin" | "member" | "viewer";
const LABELS: Record<EditableRole, string> = { admin: "Admin", member: "Member", viewer: "Viewer" };

/** Native select styled as the mockup's dropdown: keyboard and screen readers work as-is. */
export function RoleSelect({
  value,
  onChange,
  allowAdmin,
  label,
  disabled,
  className,
}: {
  value: EditableRole;
  onChange: (role: EditableRole) => void;
  allowAdmin: boolean;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const roles: EditableRole[] = allowAdmin || value === "admin" ? ["admin", "member", "viewer"] : ["member", "viewer"];
  return (
    <span className={cn("relative flex h-9 items-center", className)}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as EditableRole)}
        className="h-full w-full cursor-pointer appearance-none rounded-control border border-line bg-card pr-8 pl-3 text-sm text-ink outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_#eaeffc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {roles.map((r) => (
          <option key={r} value={r} disabled={r === "admin" && !allowAdmin}>
            {LABELS[r]}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-3 text-muted" aria-hidden />
    </span>
  );
}
