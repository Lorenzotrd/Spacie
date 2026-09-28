"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus } from "lucide-react";
import { cn } from "@/components/ui/cn";
import { EXTRA_STORAGE, FAQ, PLANS } from "./data";
import { SectionHead } from "./parts";

const CURRENCY = "$";

/** The price shown for a plan, and what the year costs, with Studio's extra storage. */
export function planPrice(plan: (typeof PLANS)[number], yearly: boolean, extraSteps: number) {
  const base = yearly ? plan.yearly : plan.monthly;
  const month = plan.name === "Studio" ? base + extraSteps * EXTRA_STORAGE.price : base;
  return { month, year: month * 12 };
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [extra, setExtra] = useState(0);
  return (
    <section id="pricing" className="mx-auto flex max-w-[1440px] scroll-mt-4 flex-col items-center gap-5 px-4 pt-14 pb-5 md:gap-9 md:px-10 md:pt-[110px] md:pb-[60px] xl:px-20">
      <SectionHead
        center
        eyebrow="PRICING"
        title={<>Pay for your agents,<br className="hidden md:block" /> not for gigabytes.</>}
        lead="No per seat pricing. Generous storage on every plan."
      />
      <div role="radiogroup" aria-label="Billing period" className="flex gap-0.5 rounded-xl bg-[#f1efea] p-1">
        {[false, true].map((y) => (
          <button
            key={String(y)}
            type="button"
            role="radio"
            aria-checked={yearly === y}
            onClick={() => setYearly(y)}
            className={cn(
              "flex h-[38px] items-center gap-2 rounded-[9px] px-4 text-sm",
              yearly === y ? "bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(23,24,28,0.1)]" : "text-[#55575f]",
            )}
          >
            {y ? "Yearly" : "Monthly"}
            {y && <span className="rounded-full bg-success-soft px-[7px] py-0.5 text-[11px] font-semibold text-success">2 months free</span>}
          </button>
        ))}
      </div>

      <div className="grid w-full max-w-[1280px] items-stretch gap-3.5 md:gap-4 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const featured = plan.featured;
          const { month, year } = planPrice(plan, yearly, extra);
          const features = plan.name === "Studio"
            ? [`${EXTRA_STORAGE.baseGb + extra * EXTRA_STORAGE.stepGb} GB storage`, ...plan.features.slice(1)]
            : plan.features;
          return (
            <div
              key={plan.name}
              className={cn(
                "lp-lift flex flex-col gap-2.5 rounded-[20px] p-[22px] md:rounded-3xl md:p-[30px]",
                featured ? "bg-accent text-white shadow-[0_30px_60px_-20px_rgba(43,89,217,0.45)]" : "border border-line bg-white",
              )}
            >
              <div className="flex items-center gap-2.5">
                <h3 className="m-0 text-lg font-semibold">{plan.name}</h3>
                {featured && <span className="rounded-full bg-white px-[9px] py-[3px] text-[11px] font-semibold text-accent">Recommended</span>}
              </div>
              <p className={cn("m-0 text-sm leading-normal", featured ? "text-accent-border" : "text-[#55575f]")}>{plan.desc}</p>
              <div className="flex items-baseline gap-1.5 pt-1.5">
                <span className="text-[44px] font-semibold tracking-[-0.04em] md:text-[52px]" aria-live="polite">
                  {CURRENCY}
                  {month}
                </span>
                {month > 0 && <span className={cn("text-[15px]", featured ? "text-accent-border" : "text-muted")}>/ month</span>}
              </div>
              <span className={cn("text-[13px]", featured ? "text-accent-border" : "text-muted")}>
                {month === 0 ? "Free forever" : yearly ? `Billed ${CURRENCY}${year} per year` : "Billed monthly"}
              </span>
              {plan.name === "Studio" && (
                <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-[#eceae4] bg-[#faf9f6] p-3 md:gap-3 md:rounded-[14px] md:px-3.5">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">Extra storage</span>
                    <span className="text-xs text-muted">
                      {CURRENCY}
                      {EXTRA_STORAGE.price} / month per {EXTRA_STORAGE.stepGb} GB
                    </span>
                  </div>
                  <div className="flex items-center gap-0.5 rounded-[10px] border border-line bg-white p-[3px] md:gap-1">
                    <button
                      type="button"
                      aria-label={`Remove ${EXTRA_STORAGE.stepGb} GB`}
                      disabled={extra === 0}
                      onClick={() => setExtra(Math.max(0, extra - 1))}
                      className="flex size-[34px] items-center justify-center rounded-[7px] text-ink disabled:opacity-40 md:size-8"
                    >
                      <Minus size={14} strokeWidth={2.4} aria-hidden />
                    </button>
                    <span className="min-w-[58px] text-center text-[13px] font-semibold text-ink md:min-w-16" aria-live="polite">
                      {extra ? `+${extra * EXTRA_STORAGE.stepGb} GB` : "0 GB"}
                    </span>
                    <button
                      type="button"
                      aria-label={`Add ${EXTRA_STORAGE.stepGb} GB`}
                      disabled={extra === EXTRA_STORAGE.max}
                      onClick={() => setExtra(Math.min(EXTRA_STORAGE.max, extra + 1))}
                      className="flex size-[34px] items-center justify-center rounded-[7px] bg-accent text-white disabled:opacity-40 md:size-8"
                    >
                      <Plus size={14} strokeWidth={2.4} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
              <Link
                href="/workspace"
                className={cn(
                  "mt-2.5 flex h-12 items-center justify-center rounded-xl text-[15px] font-semibold no-underline transition hover:-translate-y-px",
                  featured ? "bg-white text-accent-hover hover:text-accent-hover" : "bg-ink text-white hover:text-white",
                )}
              >
                {plan.cta}
              </Link>
              <div className={cn("mt-3.5 mb-1.5 h-px", featured ? "bg-white/20" : "bg-[#eceae4]")} />
              <ul className="m-0 flex list-none flex-col gap-[11px] p-0 md:gap-3">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check size={16} strokeWidth={2.4} className={cn("mt-0.5 shrink-0", featured ? "text-white" : "text-accent")} aria-hidden />
                    <span className={cn("text-sm leading-[1.45]", featured ? "text-white" : "text-ink-2")}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="mx-auto flex max-w-[1440px] scroll-mt-4 flex-col gap-3.5 px-4 pt-14 pb-5 md:flex-row md:gap-20 md:px-10 md:pt-[110px] md:pb-[60px] xl:px-20">
      <div className="flex shrink-0 flex-col gap-3.5 md:w-[380px] md:gap-4">
        <span className="text-xs font-semibold tracking-[0.08em] text-accent md:text-[13px]">FAQ</span>
        <h2 className="font-display m-0 text-[32px] leading-[1.1] font-semibold tracking-[-0.035em] md:text-[44px] md:leading-[1.08]">Questions we get asked.</h2>
      </div>
      <div className="flex flex-1 flex-col">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          const id = `faq-${i}`;
          return (
            <div key={item.q} className="border-b border-line">
              <h3 className="m-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={id}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="flex min-h-16 w-full items-center gap-3 text-left md:min-h-[72px] md:gap-4"
                >
                  <span className="flex-1 text-base font-medium text-ink md:text-lg">{item.q}</span>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-200",
                      isOpen ? "bg-accent text-white" : "bg-[#f1efea] text-ink",
                    )}
                  >
                    <Plus size={16} strokeWidth={2.2} className={cn("transition-transform duration-200", isOpen && "rotate-45")} aria-hidden />
                  </span>
                </button>
              </h3>
              <div id={id} hidden={!isOpen}>
                <p className="m-0 animate-[lp-fade-up_.35s_ease_both] pr-2 pb-5 text-[15px] leading-[1.6] text-[#55575f] md:pr-[60px] md:pb-6 md:text-base">
                  {item.a}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
