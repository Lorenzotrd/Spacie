"use client";
import { useState } from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { STEP_CHIPS, STEP_VERSIONS, STEPS, WORK_ROWS } from "./data";
import { AgentTile, SectionHead, WhoAvatar } from "./parts";
import { useTicker } from "./use-ticker";

const STEP_MS = 5000;

function Terminal({ command }: { command: string }) {
  return (
    <div className="overflow-hidden rounded-[14px] bg-ink shadow-[0_30px_60px_-20px_rgba(23,24,28,0.4)] md:rounded-2xl">
      <div className="flex h-[34px] items-center gap-1.5 border-b border-code-line px-3 md:h-10 md:gap-[7px] md:px-4">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-[9px] rounded-full bg-[#3a3c44] md:size-2.5" />
        ))}
        <span className="ml-2 font-mono text-[11px] text-[#8a8d98] md:ml-2.5 md:text-xs">Terminal</span>
      </div>
      <div className="flex flex-col gap-2.5 p-3.5 text-left font-mono text-xs leading-[1.55] md:gap-3 md:p-[22px] md:text-[13.5px]">
        <div className="flex gap-2.5 break-all text-code-ink">
          <span className="text-[#8fa8f0]">$</span>
          {/* Typed out on wide screens; wrapped as-is on phones. */}
          <span
            className="md:inline-block md:animate-[lp-typing_2.2s_steps(60)_both] md:overflow-hidden md:whitespace-nowrap"
            style={{ ["--lp-chars" as string]: `${command.length}ch`, animationTimingFunction: `steps(${command.length})` }}
          >
            {command}
          </span>
          <span className="inline-block h-3.5 w-[7px] shrink-0 animate-[lp-blink_1s_steps(1)_infinite] self-center bg-[#8fa8f0] md:h-[18px] md:w-2" />
        </div>
        <div className="animate-[lp-fade-up_.4s_ease_.6s_both] text-[#6fd39b] md:[animation-delay:2.4s]">✓ Added MCP server &quot;spacie&quot;</div>
        <div className="hidden animate-[lp-fade-up_.4s_ease_2.8s_both] text-code-muted md:block">
          Sign in to Spacie to choose which projects it can access.
        </div>
      </div>
    </div>
  );
}

function StepConnect({ command }: { command: string }) {
  return (
    <div className="relative flex w-full max-w-[640px] animate-[lp-fade-up_.5s_ease_both] flex-col gap-3.5 md:gap-[18px]">
      <Terminal command={command} />
      <ul className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0 md:justify-start md:gap-2">
        {STEP_CHIPS.map((name, i) => (
          <li
            key={name}
            className="flex h-8 animate-[lp-pop-in_.4s_ease_both] items-center gap-1.5 rounded-full border border-line bg-white pr-2.5 pl-[5px] text-xs font-medium md:h-[34px] md:pr-3 md:pl-1.5 md:text-[13px]"
            style={{ animationDelay: `${(1 + i * 0.15).toFixed(2)}s` }}
          >
            <AgentTile name={name} size={22} className="rounded-full border-0 bg-[#faf9f6]" />
            {name}
            <Check size={13} strokeWidth={2.6} className="hidden text-accent md:block" aria-hidden />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepWork() {
  return (
    <div className="relative flex w-full max-w-[600px] animate-[lp-fade-up_.5s_ease_both] flex-col overflow-hidden rounded-2xl border border-line bg-white text-left shadow-[0_30px_60px_-20px_rgba(23,24,28,0.2)] md:rounded-[18px]">
      <div className="flex h-11 items-center border-b border-divider px-3.5 text-sm font-semibold md:h-[50px] md:px-[18px]">Website</div>
      {WORK_ROWS.map((w, i) => (
        <div
          key={w.name}
          className="flex animate-[lp-fade-up_.5s_ease_both] items-center gap-3 border-b border-[#f3f1ed] p-3.5 md:gap-3.5 md:px-[18px] md:py-4"
          style={{ animationDelay: `${(0.2 + i * 0.3).toFixed(2)}s` }}
        >
          <AgentTile name={w.agent} size={34} />
          <div className="flex flex-1 flex-col gap-0.5 md:gap-[3px]">
            <span className="text-sm font-medium">{w.name}</span>
            <span className="text-xs text-muted">{w.meta}</span>
          </div>
          <span className="rounded-full bg-accent-soft px-2 py-[3px] text-[11px] font-semibold text-accent-hover md:px-[9px]">{w.tag}</span>
        </div>
      ))}
      <div className="flex animate-[lp-fade-up_.5s_ease_1.2s_both] items-center gap-3 p-3.5 md:gap-3.5 md:px-[18px] md:py-4">
        <AgentTile name="Hermes" size={34} />
        <div className="flex flex-1 flex-col gap-[7px]">
          <span className="text-sm font-medium">
            Hermes is writing<span className="hidden md:inline"> SEO plan</span>…
          </span>
          <span className="h-2 w-40 animate-[lp-shimmer_1.4s_linear_infinite] rounded-full bg-[linear-gradient(90deg,#eef2fd_0%,#d5dffa_50%,#eef2fd_100%)] bg-[size:480px_8px] md:w-60" />
        </div>
      </div>
    </div>
  );
}

function StepControl() {
  return (
    <div className="relative flex w-full max-w-[600px] animate-[lp-fade-up_.5s_ease_both] flex-col gap-2.5 rounded-2xl border border-line bg-white p-3.5 text-left shadow-[0_30px_60px_-20px_rgba(23,24,28,0.2)] md:gap-4 md:rounded-[18px] md:p-[22px]">
      <div className="flex items-center gap-2.5">
        <span className="flex-1 text-[15px] font-semibold md:text-base">Product brief.docx</span>
        <span className="text-xs text-muted">History</span>
      </div>
      {STEP_VERSIONS.map((v, i) => (
        <div
          key={v.label}
          className={cn(
            "flex animate-[lp-fade-up_.45s_ease_both] items-center gap-3 rounded-[14px] p-3",
            v.current ? "border-[1.5px] border-accent bg-[#f7f9fe]" : "border border-[#eceae4]",
          )}
          style={{ animationDelay: `${(0.15 + i * 0.2).toFixed(2)}s` }}
        >
          <WhoAvatar who={v} size={34} />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">{v.label}</span>
            <span className="text-xs text-muted">{v.meta}</span>
          </div>
          {v.current ? (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-hover">Current</span>
          ) : (
            <span className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium">Restore</span>
          )}
        </div>
      ))}
      <div className="flex items-center gap-2 rounded-[10px] bg-[#faf9f6] px-3 py-2.5 text-xs text-[#55575f] md:gap-2.5 md:rounded-xl md:px-3.5 md:py-3 md:text-[13px]">
        <Lock size={15} className="shrink-0 text-accent" aria-hidden />
        History can&apos;t be erased, not even by an admin.
      </div>
    </div>
  );
}

/** Three steps that advance on their own every 5 s until the visitor picks one. */
export function HowItWorks({ command }: { command: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const tick = useTicker(STEP_MS, picked === null);
  const step = picked ?? tick % STEPS.length;
  const pick = (i: number) => setPicked(i);

  return (
    <section id="how" className="mx-auto flex max-w-[1440px] scroll-mt-4 flex-col gap-[22px] px-4 pt-14 pb-5 md:gap-12 md:px-10 md:pt-[110px] md:pb-[60px] xl:px-20">
      <SectionHead eyebrow="HOW IT WORKS" title={<>Your AI becomes a teammate.<br className="hidden md:block" /> In 3 steps.</>} />

      <div className="flex flex-col gap-[22px] lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:gap-6">
        {/* Phones: three numbered tabs, then the open step's text. */}
        <div role="tablist" aria-label="Steps" className="flex gap-1.5 rounded-[14px] bg-[#f1efea] p-1 lg:hidden">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={step === i}
              aria-label={`Step ${i + 1}: ${s.title}`}
              onClick={() => pick(i)}
              className={cn(
                "flex h-11 flex-1 items-center justify-center rounded-[10px] font-mono text-sm font-medium",
                step === i ? "bg-white text-ink shadow-[0_1px_2px_rgba(23,24,28,0.1)]" : "text-[#55575f]",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 lg:hidden">
          <span className="text-xl font-semibold tracking-[-0.01em]">{STEPS[step].title}</span>
          <span className="text-[15px] leading-[1.55] text-[#55575f]">{STEPS[step].text}</span>
        </div>

        {/* Wide screens: the three steps as cards, the open one with a progress bar. */}
        <div role="tablist" aria-label="Steps" className="hidden flex-col gap-2.5 lg:flex">
          {STEPS.map((s, i) => {
            const active = step === i;
            return (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => pick(i)}
                className={cn(
                  "flex flex-col items-start justify-start gap-2 rounded-[18px] border p-[22px] text-left transition-all duration-200",
                  active ? "border-line bg-white shadow-[0_12px_30px_-12px_rgba(23,24,28,0.12)]" : "border-transparent opacity-60 hover:opacity-90",
                )}
              >
                <span className="flex items-center gap-3.5">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[10px] font-mono text-[13px] font-medium",
                      active ? "bg-accent text-white" : "bg-[#eceae4] text-ink-2",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-lg font-semibold tracking-[-0.01em] text-ink">{s.title}</span>
                </span>
                <span className="pl-[46px] text-sm leading-[1.55] text-[#55575f]">{s.text}</span>
                {active && picked === null && (
                  <span className="mt-1 ml-[46px] h-[3px] self-stretch overflow-hidden rounded-full bg-accent-soft">
                    <span key={tick} className="block h-[3px] animate-[lp-fill_5s_linear_both] rounded-full bg-accent" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          aria-label={STEPS[step].title}
          className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-[20px] bg-[#f1efea] px-3.5 py-[18px] md:px-8 lg:h-[480px] lg:rounded-3xl"
        >
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(#ddd9d0_1px,transparent_1px)] bg-[size:18px_18px] opacity-60 md:bg-[size:20px_20px]" />
          {step === 0 && <StepConnect key={`connect-${tick}`} command={command} />}
          {step === 1 && <StepWork key={`work-${tick}`} />}
          {step === 2 && <StepControl key={`control-${tick}`} />}
        </div>
      </div>
    </section>
  );
}
