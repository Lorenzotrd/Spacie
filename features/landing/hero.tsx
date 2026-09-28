"use client";
import { ArrowRight, Layers, Play, ShieldCheck, Lock } from "lucide-react";
import NextImage from "next/image";
import { cn } from "@/components/ui/cn";
import { AGENTS, EVENT_AGES, EVENTS, FILES, HERO_ROTATION, HERO_TILES, TEAM } from "./data";
import { AgentTile, KindIcon, Mark, Person, WhoAvatar } from "./parts";
import { useTicker } from "./use-ticker";

const at = <T,>(list: readonly T[], i: number) => list[((i % list.length) + list.length) % list.length];

function RotatingAgent() {
  const tick = useTicker(2200);
  const name = at(HERO_ROTATION, tick);
  const logo = AGENTS[name];
  return (
    <span key={tick} className="inline-flex animate-[lp-word-in_.55s_cubic-bezier(.2,.8,.2,1)_both] items-center gap-2.5 text-accent md:gap-4">
      <span className="flex size-[42px] shrink-0 items-center justify-center self-center rounded-xl border border-line bg-white shadow-[0_10px_24px_-8px_rgba(23,24,28,0.18)] md:size-[66px] md:rounded-[18px]">
        <NextImage
          src={logo.logo}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="size-[var(--s)] object-contain md:size-[var(--l)]"
          style={{ ["--s" as string]: `${Math.round(logo.size * 0.68)}px`, ["--l" as string]: `${Math.round(logo.size * 1.45)}px` }}
        />
      </span>
      <span className="self-baseline">{name}</span>
    </span>
  );
}

/** Newest event highlighted on top, then three older ones; one new event every 2.6 s. */
export function LiveFeed({ older = 3, compact = false }: { older?: number; compact?: boolean }) {
  const tick = useTicker(2600);
  const newest = at(EVENTS, tick);
  const rest = Array.from({ length: older }, (_, k) => ({ ...at(EVENTS, tick - k - 1), when: EVENT_AGES[k] }));
  const line = (e: (typeof EVENTS)[number], strong: boolean) => (
    <span className={cn("leading-[1.45]", compact ? "text-[13px]" : "text-[12.5px]", strong ? "text-ink-2" : "text-[#55575f]")}>
      <b className="text-ink">{e.name}</b> {e.what} <span className={cn("text-ink", strong && "font-medium")}>{e.target}</span>
    </span>
  );
  return (
    <div className="flex flex-col gap-2.5 md:gap-3" aria-live="off">
      <div key={tick} className="flex animate-[lp-slide-in_.55s_cubic-bezier(.2,.8,.2,1)_both] gap-2.5 rounded-xl border border-accent-border bg-accent-tint p-3 text-left">
        <WhoAvatar who={newest} size={28} />
        <div className="flex min-w-0 flex-col gap-[3px]">
          {line(newest, true)}
          <span className="text-[11px] font-medium text-accent-hover">just now</span>
        </div>
      </div>
      {rest.map((e, i) => (
        <div key={`${tick}-${i}`} className="flex gap-2.5 rounded-xl border border-divider bg-white p-3 text-left">
          <WhoAvatar who={e} size={28} />
          <div className="flex min-w-0 flex-col gap-[3px]">
            {line(e, false)}
            <span className="text-[11px] text-muted">{e.when}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function LivePill() {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-accent-hover">
      <span className="size-[7px] animate-[lp-pulse_1.8s_infinite] rounded-full bg-accent" />
      Live
    </span>
  );
}

function VersionPill({ v, hot }: { v: string; hot?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-[9px] py-[3px] text-[11px] whitespace-nowrap",
        hot ? "animate-[lp-pulse_2s_infinite] bg-accent font-semibold text-white" : "bg-segment font-medium text-[#55575f]",
      )}
    >
      {v}
    </span>
  );
}

/** Desktop: a small Spacie window with sidebar, files and the live activity feed. */
function DesktopMock() {
  return (
    <div className="relative mx-auto mt-[60px] hidden w-full max-w-[1200px] animate-[lp-fade-up_1s_ease_.5s_both] text-left md:block">
      <div className="flex h-[560px] flex-col overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_40px_80px_-20px_rgba(23,24,28,0.18),0_0_0_8px_rgba(255,255,255,0.6)]">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-divider bg-[#faf9f6] px-[18px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-[11px] rounded-full bg-[#e1ded6]" />
          ))}
          <div className="mx-auto flex h-7 items-center gap-2 rounded-lg border border-[#eceae4] bg-white px-3.5 text-xs text-muted">
            <Lock size={12} aria-hidden />
            spacie / spacie / launch
          </div>
          <span className="w-[50px]" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-[210px] shrink-0 flex-col gap-1 border-r border-divider bg-[#faf9f6] px-3 py-[18px] lg:flex">
            <div className="flex items-center gap-[9px] px-2 pb-3.5">
              <Mark size={26} />
              <span className="text-[13px] font-semibold">Spacie</span>
            </div>
            <div className="px-2 pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted">PROJECTS</div>
            <div className="flex h-[34px] items-center gap-2 rounded-lg bg-accent-soft px-2 text-[13px] font-medium text-accent-hover">
              <span className="size-[7px] rounded-[2px] bg-accent" />
              Spacie launch
            </div>
            {["Brand", "Website"].map((p) => (
              <div key={p} className="flex h-[34px] items-center gap-2 px-2 text-[13px] text-ink-2">
                <span className="size-[7px] rounded-[2px] bg-[#c9ccd6]" />
                {p}
              </div>
            ))}
            <div className="px-2 pt-[18px] pb-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted">TEAM</div>
            {TEAM.map((m) => (
              <div key={m.name} className="flex h-8 items-center gap-[9px] px-2 text-[13px]">
                <WhoAvatar who={m} size={22} />
                <span className="flex-1">{m.name}</span>
                <span className="size-1.5 rounded-full bg-[#2e9e63]" />
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4 px-6 py-[22px]">
            <div className="flex items-center gap-2.5">
              <div className="flex flex-1 flex-col gap-[3px]">
                <span className="text-xl font-semibold tracking-[-0.02em]">Spacie launch</span>
                <span className="text-xs text-muted">5 files · 3 agents connected</span>
              </div>
              <span className="flex h-8 items-center rounded-lg border border-line px-3 text-xs font-medium">Share</span>
              <span className="flex h-8 items-center rounded-lg bg-accent px-3 text-xs font-medium text-white">New</span>
            </div>
            <div className="flex flex-col overflow-hidden rounded-xl border border-divider">
              <div className="grid h-[34px] grid-cols-[2.4fr_1fr_1.1fr] items-center bg-[#faf9f6] px-3.5 text-[11px] font-medium text-muted">
                <span>Name</span>
                <span>Version</span>
                <span>Edited by</span>
              </div>
              {FILES.map((f) => (
                <div
                  key={f.name}
                  className={cn("grid h-14 grid-cols-[2.4fr_1fr_1.1fr] items-center border-t border-[#f3f1ed] px-3.5", f.hot && "bg-[#f7f9fe]")}
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-[#f4f3ef]">
                      <KindIcon kind={f.kind} />
                    </span>
                    <span className="truncate text-[13px] font-medium">{f.name}</span>
                  </div>
                  <div>
                    <VersionPill v={f.v} hot={f.hot} />
                  </div>
                  <div className="flex items-center gap-[7px] text-xs">
                    <WhoAvatar who={f.by} size={22} />
                    {f.by.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden w-[300px] shrink-0 flex-col gap-3 border-l border-divider px-[18px] py-[22px] xl:flex">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[13px] font-semibold">Activity</span>
              <LivePill />
            </div>
            <LiveFeed />
          </div>
        </div>
      </div>

      {/* Floating cursors, a version card and a conflict toast around the window. */}
      <div aria-hidden className="pointer-events-none absolute top-[190px] left-[35%] hidden animate-[lp-cursor-a_11s_ease-in-out_infinite] lg:block">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#2B59D9" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M4 3l16 7-7 2-2 7z" />
        </svg>
        <span className="absolute top-[18px] left-4 flex h-6 items-center gap-[5px] rounded-[7px] bg-accent pr-2 pl-1 text-[11px] font-semibold whitespace-nowrap text-white">
          <AgentTile name="Claude" size={16} className="rounded-[4px] border-0" />
          Claude
        </span>
      </div>
      <div aria-hidden className="pointer-events-none absolute top-[330px] left-[80%] hidden animate-[lp-cursor-b_9s_ease-in-out_1s_infinite] lg:block">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#17181C" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M4 3l16 7-7 2-2 7z" />
        </svg>
        <span className="absolute top-[18px] left-4 flex h-6 items-center gap-[5px] rounded-full bg-ink pr-[9px] pl-1 text-[11px] font-semibold whitespace-nowrap text-white">
          <Person name="Emma" size={16} />
          Emma
        </span>
      </div>
      <div className="absolute bottom-[70px] -left-14 hidden w-[250px] animate-[lp-float_5s_ease-in-out_infinite] flex-col gap-2.5 rounded-2xl border border-line bg-white p-3.5 shadow-[0_24px_48px_-12px_rgba(23,24,28,0.18)] xl:flex">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-accent" aria-hidden />
          <span className="text-xs font-semibold">Versions · Launch deck</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full bg-accent" />
          <b>v3</b>
          <span className="flex-1 text-muted">Claude · now</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="size-2 rounded-full bg-[#c9ccd6]" />
          <b>v2</b>
          <span className="flex-1 text-muted">Emma · yesterday</span>
          <span className="text-[11px] font-semibold text-accent-hover">Restore</span>
        </div>
      </div>
      <div className="absolute top-24 -right-11 hidden w-[240px] animate-[lp-float_6s_ease-in-out_.8s_infinite] gap-2.5 rounded-[14px] bg-ink px-3.5 py-3 shadow-[0_24px_48px_-12px_rgba(23,24,28,0.35)] xl:flex">
        <ShieldCheck size={16} className="mt-px shrink-0 text-[#8fa8f0]" aria-hidden />
        <span className="text-xs leading-[1.45] text-code-ink">Claude is editing this doc. You get warned before overwriting its work.</span>
      </div>
    </div>
  );
}

/** Mobile: the file list and the live feed stacked in one card. */
function MobileMock() {
  return (
    <div className="mt-9 flex flex-col overflow-hidden rounded-[20px] border border-line bg-white text-left shadow-[0_30px_60px_-24px_rgba(23,24,28,0.2)] md:hidden">
      <div className="flex items-center gap-2.5 border-b border-divider p-4">
        <Mark size={30} />
        <div className="flex flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold">Spacie launch</span>
          <span className="text-xs text-muted">5 files · 3 agents connected</span>
        </div>
        <LivePill />
      </div>
      {FILES.slice(0, 3).map((f) => (
        <div key={f.name} className={cn("flex items-center gap-3 border-b border-[#f3f1ed] px-4 py-3", f.hot && "bg-[#f7f9fe]")}>
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#f4f3ef]">
            <KindIcon kind={f.kind} size={15} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="truncate text-sm font-medium">{f.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <WhoAvatar who={f.by} size={18} />
              {f.by.name}
            </span>
          </div>
          <VersionPill v={f.v} hot={f.hot} />
        </div>
      ))}
      <div className="flex flex-col gap-2.5 bg-[#faf9f6] p-4">
        <span className="text-xs font-semibold tracking-[0.06em] text-muted">ACTIVITY</span>
        <LiveFeed older={2} compact />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative px-4 pt-10 pb-8 text-center md:px-10 md:pt-[72px] md:pb-16 xl:px-20">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(#e1ded6_1px,transparent_1px)] bg-[size:20px_20px] opacity-55 md:h-[640px] md:bg-[size:24px_24px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto hidden max-w-[1440px] [--k:0.3] lg:block xl:[--k:1]">
        {HERO_TILES.map((t) => (
          <div key={t.name} className="absolute" style={{ [t.side]: `calc(var(--k) * ${t.x}px)`, top: t.y, transform: `rotate(${t.r}deg)` }}>
            <div
              className="flex size-14 animate-[lp-float_var(--dur)_ease-in-out_var(--delay)_infinite] items-center justify-center rounded-2xl border border-line bg-white shadow-[0_16px_32px_-12px_rgba(23,24,28,0.2)] xl:size-16 xl:rounded-[18px]"
              style={{ ["--dur" as string]: `${5 + t.d}s`, ["--delay" as string]: `${t.d}s` }}
            >
              <NextImage src={AGENTS[t.name].logo} alt="" width={40} height={40} unoptimized className="object-contain" style={{ width: AGENTS[t.name].size, height: AGENTS[t.name].size }} />
            </div>
          </div>
        ))}
      </div>

      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center">
        <div className="flex h-8 animate-[lp-fade-up_.7s_ease_both] items-center gap-2 rounded-full border border-line bg-white pr-3 pl-[5px] text-[13px] text-ink-2 md:h-[34px] md:gap-2.5 md:pr-3.5 md:pl-1.5">
          <span className="flex size-[22px] items-center justify-center rounded-md bg-accent-soft text-accent md:size-6 md:rounded-[7px]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden>
              <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
            </svg>
          </span>
          <span>
            The <span className="font-semibold text-ink">agent native</span> drive
          </span>
        </div>

        <h1 className="m-0 mt-[22px] animate-[lp-fade-up_.8s_ease_.1s_both] text-[42px] leading-[1.12] font-semibold tracking-[-0.04em] md:mt-7 md:text-[60px] md:leading-[1.1] md:tracking-[-0.045em] xl:text-[76px] xl:whitespace-nowrap">
          Your team and <br className="md:hidden" />
          <RotatingAgent />
          <br />
          on the same files.
        </h1>

        <p className="m-0 mt-[18px] max-w-[640px] animate-[lp-fade-up_.8s_ease_.2s_both] text-base leading-[1.55] text-[#55575f] md:mt-[26px] md:text-[19px]">
          Claude, Codex or Hermes drop their docs, decks and PDFs straight into your projects. See who changed what, and roll back in one click.
        </p>

        <div className="mt-[26px] flex w-full animate-[lp-fade-up_.8s_ease_.3s_both] flex-col gap-2.5 md:mt-9 md:w-auto md:flex-row md:gap-3">
          <a
            href="#pricing"
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] bg-accent px-[26px] text-base font-medium text-white no-underline shadow-[0_8px_24px_rgba(43,89,217,0.28)] transition hover:-translate-y-px hover:bg-accent-hover hover:text-white md:h-[54px]"
          >
            Start for free
            <ArrowRight size={17} aria-hidden />
          </a>
          <a
            href="#how"
            className="flex h-[52px] items-center justify-center gap-2.5 rounded-[14px] border border-line bg-white px-6 text-base font-medium text-ink no-underline transition-colors hover:bg-[#f1efea] hover:text-ink md:h-[54px]"
          >
            <Play size={15} fill="currentColor" aria-hidden />
            See how it works
          </a>
        </div>
        <p className="m-0 mt-3.5 animate-[lp-fade-up_.8s_ease_.4s_both] text-[13px] text-muted md:mt-[18px]">
          5 GB free, no credit card<span className="hidden md:inline"> · Connect Claude in 2 clicks</span>
        </p>

        <DesktopMock />
        <MobileMock />
      </div>
    </section>
  );
}
