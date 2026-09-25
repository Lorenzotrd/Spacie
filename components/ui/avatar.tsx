import type { Principal } from "@/lib/types";
export function Avatar({
  person,
  small = false,
}: {
  person?: Principal;
  small?: boolean;
}) {
  return (
    <span
      className={`avatar ${small ? "small" : ""} ${person?.type === "agent" ? "agent" : ""}`}
      style={{ background: person?.color }}
    >
      {person?.initials ?? "?"}
    </span>
  );
}
