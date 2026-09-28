import { Box, History, KeyRound, Link2 } from "lucide-react";
import { LiveFeed, LivePill } from "@/features/landing/hero";
import { AgentTile } from "@/features/landing/parts";
import type { AgentName } from "@/features/landing/data";

const AGENTS: AgentName[] = ["Claude", "Codex", "Hermes", "Grok Bot", "Muse", "OpenClaw"];

const PROMISES = [
  { icon: History, text: "Every change signed and versioned" },
  { icon: KeyRound, text: "Agents only reach what you allow" },
  { icon: Link2, text: "Clients see one clean link" },
];

/** The dark left half of the sign-in page: what Spacie is, shown with the landing's live feed. */
export function LoginShowcase() {
  return (
    <section
      aria-label="About Spacie"
      className="relative hidden overflow-hidden rounded-[1.75rem] bg-ink p-12 text-white lg:flex lg:flex-col xl:p-14"
    >
      {/* A soft blue glow and a faint dot grid give the panel depth without competing with the feed. */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[34rem] rounded-full bg-accent/35 blur-[120px]" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]"
      />

      <div className="relative flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-[0.625rem] bg-accent text-white">
          <Box size={19} strokeWidth={2} aria-hidden />
        </span>
        <span className="text-[1.375rem] font-bold tracking-[-0.02em]">spacie</span>
      </div>

      <div className="relative mt-auto flex flex-col gap-9 pt-12">
        <h2 className="m-0 max-w-[30rem] text-[2.625rem] leading-[1.08] font-semibold tracking-[-0.03em] xl:text-5xl">
          Your team and your agents, <span className="text-white/45">in the same files.</span>
        </h2>

        <div className="max-w-[27rem] rounded-[1.25rem] border border-white/10 bg-white/[0.06] p-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="text-xs font-medium text-white/60">Launch · Activity</span>
            <span className="rounded-full bg-white px-2 py-0.5">
              <LivePill />
            </span>
          </div>
          <LiveFeed older={2} />
        </div>

        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {PROMISES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-[0.9375rem] text-white/80">
              <span className="flex size-7 items-center justify-center rounded-lg bg-white/10 text-white">
                <Icon size={15} strokeWidth={1.9} aria-hidden />
              </span>
              {text}
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 border-t border-white/10 pt-6">
          <div className="flex">
            {AGENTS.map((name, i) => (
              <AgentTile key={name} name={name} size={30} className={i ? "-ml-2 border-ink" : "border-ink"} />
            ))}
          </div>
          <span className="text-[0.8125rem] text-white/55">Works with Claude, Codex and any MCP client</span>
        </div>
      </div>
    </section>
  );
}
