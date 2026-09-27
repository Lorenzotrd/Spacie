import type { Principal } from "@/lib/types";
import { cn } from "./cn";

/** The eight-point mark that identifies an AI agent everywhere in the UI. */
export function AgentMark({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.7}
      strokeLinecap="round"
      aria-hidden="true"
      className={cn("agent-mark", className)}
    >
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
    </svg>
  );
}

type Size = "xs" | "sm" | "md" | "lg";
const boxes: Record<Size, { box: string; text: string; mark: number; radius: string }> = {
  xs: { box: "size-4", text: "text-[0.5rem]", mark: 8, radius: "rounded-[0.3125rem]" },
  sm: { box: "size-6", text: "text-[0.6875rem]", mark: 11, radius: "rounded-[0.4375rem]" },
  md: { box: "size-[1.875rem]", text: "text-xs", mark: 13, radius: "rounded-[0.5625rem]" },
  lg: { box: "size-[2.125rem]", text: "text-sm", mark: 15, radius: "rounded-[0.625rem]" },
};

const initial = (person?: Pick<Principal, "name" | "initials">) =>
  (person?.initials?.[0] ?? person?.name?.[0] ?? "?").toUpperCase();

/**
 * Humans are a round black disc with their initial; agents are a rounded square
 * with the agent mark. Shape and glyph carry the distinction, never colour alone.
 */
export function Avatar({
  person,
  small = false,
  size,
  ring = false,
  className,
}: {
  person?: Pick<Principal, "type" | "name" | "initials">;
  /** Legacy shorthand for size="sm". */
  small?: boolean;
  size?: Size;
  /** Adds a border matching the panel, for overlapping stacks. */
  ring?: boolean;
  className?: string;
}) {
  const s = boxes[size ?? (small ? "sm" : "md")];
  const agent = person?.type === "agent";
  return (
    <span
      role="img"
      aria-label={person ? `${person.name}${agent ? " (AI agent)" : ""}` : "Unknown"}
      title={person?.name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold",
        s.box,
        agent ? cn("bg-accent-soft text-accent", s.radius) : cn("rounded-full bg-ink text-white", s.text),
        ring && "border-2 border-panel",
        className,
      )}
    >
      {agent ? <AgentMark size={s.mark} /> : initial(person)}
    </span>
  );
}

/** Overlapping avatars, e.g. the people and agents in a project. */
export function AvatarStack({
  people,
  max = 4,
}: {
  people: Pick<Principal, "id" | "type" | "name" | "initials">[];
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <Avatar key={p.id} person={p} ring className={i ? "-ml-1.5" : undefined} />
      ))}
      {rest > 0 && (
        <span className="-ml-1.5 inline-flex size-[1.875rem] items-center justify-center rounded-full border-2 border-panel bg-segment text-[0.6875rem] font-semibold text-ink-2">
          +{rest}
        </span>
      )}
    </div>
  );
}
