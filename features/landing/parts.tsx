import NextImage from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { FileCode, FileText, Image as ImageIcon, Presentation, FileType2 } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { AGENTS, PEOPLE, type AgentName, type FileKind, type Who } from "./data";

/** An agent's logo on a white rounded tile. `size` is the tile in px. */
export function AgentTile({
  name,
  size = 28,
  className,
  style,
  logoScale = 1,
}: {
  name: AgentName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Grows or shrinks the logo inside the tile. */
  logoScale?: number;
}) {
  const agent = AGENTS[name];
  const px = Math.max(10, Math.round((agent.size / 40) * size * logoScale));
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center border border-[#e4e2dc] bg-white", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3), ...style }}
    >
      <NextImage src={agent.logo} alt={`${name} logo`} width={px} height={px} unoptimized className="object-contain" style={{ width: px, height: px }} />
    </span>
  );
}

/** Demo person: round photo when there is one, else a black disc with the initial. */
export function Person({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const photo = PEOPLE[name];
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink font-semibold text-white", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {photo ? (
        <NextImage src={photo} alt={name} width={size} height={size} unoptimized className="size-full object-cover" />
      ) : (
        <span aria-label={name}>{name[0]}</span>
      )}
    </span>
  );
}

/** Round for people, rounded square with a logo for agents, as in the app. */
export function WhoAvatar({ who, size = 28, className }: { who: Who; size?: number; className?: string }) {
  return who.ai ? (
    <AgentTile name={who.name as AgentName} size={size} className={className} />
  ) : (
    <Person name={who.name} size={size} className={className} />
  );
}

const FILE_ICONS = { slides: Presentation, doc: FileText, pdf: FileType2, image: ImageIcon, code: FileCode };
export function KindIcon({ kind, size = 14 }: { kind: FileKind; size?: number }) {
  const Icon = FILE_ICONS[kind];
  return <Icon size={size} strokeWidth={1.8} className="text-ink-2" aria-hidden />;
}

/** Section heading: blue eyebrow, big title, optional lead. */
export function SectionHead({
  eyebrow,
  title,
  lead,
  center = false,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-[760px] flex-col gap-3 md:gap-4", center && "items-center text-center", className)}>
      <span className="text-xs font-semibold tracking-[0.08em] text-accent md:text-[13px]">{eyebrow}</span>
      <h2 className="m-0 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] md:text-[52px] md:leading-[1.05] md:tracking-[-0.04em]">
        {title}
      </h2>
      {lead && <p className="m-0 text-base leading-[1.55] text-[#55575f] md:text-lg">{lead}</p>}
    </div>
  );
}

/** The Spacie mark: a white cube on a blue tile. */
export function Mark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center bg-accent"
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <svg width={Math.round(size * 0.53)} height={Math.round(size * 0.53)} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10" />
      </svg>
    </span>
  );
}
