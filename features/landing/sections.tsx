import Link from "next/link";
import { ArrowRight, Link2, Monitor, ShieldCheck } from "lucide-react";
import { FORMATS, HISTORY, MARQUEE, TIMELINE } from "./data";
import { AgentTile, Mark, SectionHead, WhoAvatar } from "./parts";
import { PermissionsDemo } from "./permissions-demo";
import { cn } from "@/components/ui/cn";

const SECTION = "mx-auto max-w-[1440px] px-4 md:px-10 xl:px-20";

export function AgentMarquee() {
  const row = [...MARQUEE, ...MARQUEE];
  return (
    <section className="flex flex-col items-center gap-4 pt-3 pb-9 md:gap-[22px] md:pt-9 md:pb-11" aria-label="Agents that work with Spacie">
      <span className="text-[13px] text-muted">Plug in the agents you already use</span>
      <div className="relative w-full max-w-[1440px] overflow-hidden">
        <div aria-hidden className="absolute inset-y-0 left-0 z-10 hidden w-40 bg-gradient-to-r from-[#faf9f6] to-transparent md:block" />
        <div aria-hidden className="absolute inset-y-0 right-0 z-10 hidden w-40 bg-gradient-to-l from-[#faf9f6] to-transparent md:block" />
        <ul className="m-0 flex w-max animate-[lp-marquee_26s_linear_infinite] list-none gap-2.5 p-0 md:animate-[lp-marquee_32s_linear_infinite] md:gap-3.5">
          {row.map((name, i) => (
            <li
              key={`${name}-${i}`}
              aria-hidden={i >= MARQUEE.length}
              className="flex h-12 shrink-0 items-center gap-2.5 rounded-xl border border-[#eceae4] bg-white pr-3.5 pl-2 md:h-14 md:gap-3 md:rounded-[14px] md:pr-5 md:pl-2.5"
            >
              <AgentTile name={name} size={36} className="border-divider bg-[#faf9f6]" />
              <span className="text-sm font-medium md:text-[15px]">{name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const MESS = [
  { text: <><span className="text-muted">Downloads /</span> audit_v3_FINAL(2).pptx</>, pos: "left-4 top-[52px] md:left-[50px] md:top-20", anim: "animate-[lp-drift-1_7s_ease-in-out_infinite]" },
  { text: <>Which Claude chat was the deck in?</>, pos: "right-3.5 top-[108px] md:right-11 md:top-[110px]", anim: "animate-[lp-drift-2_8s_ease-in-out_infinite]" },
  { text: <>Can you send me the latest version?</>, pos: "left-[26px] top-[162px] md:left-[90px] md:top-[196px]", anim: "animate-[lp-drift-3_6.5s_ease-in-out_infinite]", bubble: true },
  { text: <><span className="text-muted">Drive /</span> audit (1) copy.pptx</>, pos: "hidden md:block right-[70px] top-[238px]", anim: "animate-[lp-drift-1_9s_ease-in-out_1s_infinite]" },
  { text: <>Who changed slide 4??</>, pos: "right-[22px] top-[238px] md:right-auto md:left-[140px] md:top-[322px]", anim: "animate-[lp-drift-2_7.5s_ease-in-out_.5s_infinite]", alarm: true },
];

export function Problem() {
  return (
    <section className={cn(SECTION, "flex flex-col gap-[22px] pt-11 pb-5 md:gap-12 md:pt-[110px] md:pb-10")}>
      <SectionHead
        eyebrow="THE PROBLEM"
        title={<>Your AI ships work.<br className="hidden md:block" /> Your files get lost.</>}
        lead="A deck in a Claude chat, a PDF in your downloads, the “latest version” on WhatsApp. And nobody knows who changed what."
      />
      <div className="grid gap-3.5 md:grid-cols-2 md:gap-5">
        <div className="relative h-[300px] overflow-hidden rounded-[20px] bg-[#f1efea] md:h-[420px] md:rounded-3xl" aria-label="Without Spacie: files scattered across chats, downloads and drives">
          <span className="absolute top-4 left-[18px] text-xs font-semibold text-muted md:top-6 md:left-7 md:text-[13px]">WITHOUT SPACIE</span>
          {MESS.map((m, i) => (
            <div
              key={i}
              aria-hidden
              className={cn(
                "absolute px-[13px] py-[11px] text-[13px] md:px-4 md:py-3.5 md:text-sm",
                m.pos,
                m.anim,
                m.bubble
                  ? "rounded-[12px_12px_12px_4px] bg-[#dcf8c6] md:rounded-[14px_14px_14px_4px]"
                  : m.alarm
                    ? "rounded-xl border-[1.5px] border-dashed border-[#d0ccc3] bg-white font-semibold text-danger md:rounded-[14px]"
                    : "rounded-xl border border-line bg-white md:rounded-[14px]",
              )}
            >
              {m.text}
            </div>
          ))}
        </div>

        <div className="lp-lift flex flex-col gap-3.5 rounded-[20px] border border-line bg-white p-[18px] md:h-[420px] md:gap-[18px] md:rounded-3xl md:px-7 md:py-6">
          <span className="text-xs font-semibold text-accent md:text-[13px]">WITH SPACIE</span>
          <div className="flex items-center gap-3 rounded-[14px] border border-[#eceae4] bg-[#faf9f6] p-3 md:gap-3.5 md:rounded-2xl md:p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-accent-soft text-accent md:size-11 md:rounded-xl">
              <Monitor size={20} strokeWidth={1.8} aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold md:text-base">Launch deck.pptx</span>
              <span className="text-xs text-muted md:text-[13px]">One file, every version</span>
            </div>
            <span className="rounded-full bg-accent-soft px-2 py-[3px] text-[11px] font-semibold whitespace-nowrap text-accent-hover md:px-2.5 md:py-1 md:text-xs">
              3 versions
            </span>
          </div>
          <ol className="m-0 flex list-none flex-col p-0 pl-1 md:pl-2">
            {HISTORY.map((h, i) => (
              <li key={h.v} className="flex gap-3 md:gap-3.5">
                <div className="flex w-7 flex-col items-center">
                  <WhoAvatar who={h} size={28} />
                  {i < HISTORY.length - 1 && <span className="min-h-3.5 w-[1.5px] flex-1 bg-[#eceae4]" />}
                </div>
                <div className="flex flex-1 items-start gap-2 pb-3.5 md:gap-2.5 md:pb-4">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-sm text-ink-2">
                      <b className="text-ink">{h.name}</b> {h.what}
                    </span>
                    <span className="text-xs text-muted">{h.when}</span>
                  </div>
                  <span className="font-mono text-xs text-muted">{h.v}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  title,
  text,
  className,
  tone = "light",
  children,
}: {
  title: string;
  text: string;
  className?: string;
  tone?: "light" | "blue";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "lp-lift flex flex-col justify-between gap-[18px] overflow-hidden rounded-[20px] p-[22px] md:rounded-3xl md:p-[30px]",
        tone === "blue" ? "bg-accent text-white" : "border border-line bg-white",
        className,
      )}
    >
      <div className="flex max-w-[460px] flex-col gap-2 md:gap-2.5">
        <h3 className="m-0 text-xl font-semibold tracking-[-0.02em] md:text-[22px]">{title}</h3>
        <p className={cn("m-0 text-[15px] leading-[1.55]", tone === "blue" ? "text-accent-border" : "text-[#55575f]")}>{text}</p>
      </div>
      {children}
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className={cn(SECTION, "flex scroll-mt-4 flex-col gap-3.5 pt-14 pb-5 md:gap-12 md:pt-[110px] md:pb-[60px]")}>
      <SectionHead eyebrow="FEATURES" title={<>Everything is tracked.<br className="hidden md:block" /> Nothing gets lost.</>} className="pb-2 md:pb-0" />
      <div className="grid gap-3.5 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
        <FeatureCard
          title="Every edit creates a version"
          text="Who, when, what. Human or AI. Compare, restore, and the history stays intact."
          className="md:col-span-2 md:h-[320px]"
        >
          <div className="relative h-[84px] md:h-24">
            <div className="absolute inset-x-[18px] top-[18px] h-0.5 bg-[#eceae4] md:inset-x-5 md:top-[22px]" />
            <div className="absolute inset-x-[18px] top-[18px] h-0.5 origin-left animate-[lp-line-grow_3s_ease-in-out_infinite_alternate] bg-accent md:inset-x-5 md:top-[22px]" />
            <ol className="relative m-0 flex list-none justify-between p-0">
              {TIMELINE.map((t, i) => (
                <li key={t.v} className={cn("flex w-[60px] flex-col items-center gap-2 md:w-[90px] md:gap-2.5", i === 4 && "max-md:hidden")}>
                  <WhoAvatar who={t} size={40} className="border-[3px] border-white shadow-[0_0_0_1px_#e4e2dc]" />
                  <span className="font-mono text-[11px] font-medium md:text-xs">{t.v}</span>
                  <span className="text-[11px] text-muted md:text-xs">{t.name}</span>
                </li>
              ))}
            </ol>
          </div>
        </FeatureCard>

        <FeatureCard title="Everything opens in the app" text="PDF, PowerPoint, Word, Excel, images. Instant preview, nothing to download." className="md:h-[320px]">
          <div className="grid grid-cols-4 gap-2">
            {FORMATS.map((f, i) => (
              <div
                key={f.ext}
                className="flex h-24 animate-[lp-float_4s_ease-in-out_infinite] flex-col items-start justify-between rounded-[14px] p-2.5 font-mono text-xs font-medium"
                style={{ background: f.bg, color: f.fg, animationDelay: `${i * 0.4}s` }}
              >
                <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-white shadow-[0_1px_2px_rgba(23,24,28,0.06)] md:size-[34px] md:rounded-[10px]">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5" />
                  </svg>
                </span>
                {f.ext}
              </div>
            ))}
          </div>
        </FeatureCard>

        <FeatureCard title="Permissions per agent" text="Choose what each AI can see and do. Disconnect it in one click." className="md:h-[340px]">
          <PermissionsDemo />
        </FeatureCard>

        <FeatureCard tone="blue" title="Client links, no account needed" text="A file, a folder or a whole project. Password, expiry, view count." className="md:h-[340px]">
          <div className="flex animate-[lp-float_5s_ease-in-out_infinite] flex-col gap-2.5 rounded-[14px] bg-white p-3.5 text-ink md:rounded-2xl md:p-4">
            <div className="flex h-9 items-center gap-2 rounded-[9px] bg-[#f4f3ef] px-3 font-mono text-xs text-ink-2 md:h-[38px] md:rounded-[10px]">
              <Link2 size={13} className="text-accent" aria-hidden />
              spacie / l / 8fk2q
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-hover">Password</span>
              <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-hover">Expires in 30 days</span>
              <span className="rounded-full bg-[#f1efea] px-2.5 py-1 text-xs font-medium text-ink-2">12 views</span>
            </div>
          </div>
        </FeatureCard>

        <FeatureCard title="Nobody overwrites anybody" text="If you and your AI edit the same doc at once, the second one gets warned." className="md:h-[340px]">
          <div className="flex flex-col gap-2 md:gap-2.5">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#eceae4] p-3">
              <AgentTile name="Claude" size={28} />
              <span className="flex-1 text-[13px]">
                Claude is editing <b>Product brief</b>
              </span>
              <span className="size-[7px] animate-[lp-pulse_1.6s_infinite] rounded-full bg-accent" />
            </div>
            <div className="flex animate-[lp-fade-up_.6s_ease_.3s_both] items-center gap-2.5 rounded-xl bg-ink p-3 text-[13px] text-code-ink">
              <ShieldCheck size={15} className="text-[#8fa8f0]" aria-hidden />
              Your changes are kept aside.
            </div>
          </div>
        </FeatureCard>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={cn(SECTION, "pt-12 pb-10 md:py-[60px]")}>
      <div className="relative mx-auto flex max-w-[1280px] flex-col items-center justify-center gap-4 overflow-hidden rounded-[26px] bg-accent px-[22px] py-12 text-center md:h-[400px] md:gap-[22px] md:rounded-[32px]">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:20px_20px] md:bg-[size:22px_22px]" />
        <div aria-hidden className="absolute top-[70px] left-[120px] hidden size-14 animate-[lp-float_5s_ease-in-out_infinite] items-center justify-center rounded-2xl bg-white/15 text-white lg:flex">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />
          </svg>
        </div>
        <div aria-hidden className="absolute right-[140px] bottom-20 hidden size-14 animate-[lp-float_6s_ease-in-out_1s_infinite] overflow-hidden rounded-full border-[3px] border-white/50 lg:block">
          <WhoAvatar who={{ name: "Tom", ai: false }} size={50} />
        </div>
        <div aria-hidden className="absolute top-[60px] right-[220px] hidden size-11 animate-[lp-float_7s_ease-in-out_.5s_infinite] rounded-xl bg-white/10 lg:block" />
        <h2 className="relative m-0 text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-white md:text-[60px] md:leading-[1.02] md:tracking-[-0.045em]">
          Give your AI a desk.
        </h2>
        <p className="relative m-0 text-base leading-normal text-accent-border md:text-lg">Create your space, connect Claude, invite your team. Two minutes.</p>
        <Link
          href="/workspace"
          className="relative flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-white px-7 text-base font-semibold text-accent-hover no-underline shadow-[0_12px_30px_rgba(0,0,0,0.15)] transition hover:-translate-y-px hover:text-accent-hover md:h-14 md:w-auto"
        >
          Create my free space
          <ArrowRight size={17} aria-hidden />
        </Link>
        <span className="relative text-[13px] text-accent-border">5 GB free · no credit card</span>
      </div>
    </section>
  );
}

const FOOTER_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Footer() {
  const links = FOOTER_LINKS;
  return (
    <footer className="border-t border-[#eceae4] text-sm text-muted">
      <div className={cn(SECTION, "flex flex-col gap-[18px] py-7 md:h-[110px] md:flex-row md:items-center md:gap-8 md:py-0")}>
        <div className="flex items-center gap-2 text-ink md:gap-2.5">
          <Mark size={26} />
          <span className="text-[17px] font-bold tracking-[-0.03em]">spacie</span>
        </div>
        <span className="order-last md:order-none">© {new Date().getFullYear()} Spacie.</span>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-3 md:ml-auto md:flex md:gap-7">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="text-[#55575f] no-underline transition-colors hover:text-ink md:text-muted">
              {l.label}
            </a>
          ))}
          <Link href="/login" className="text-[#55575f] no-underline transition-colors hover:text-ink md:text-muted">
            Log in
          </Link>
        </nav>
      </div>
    </footer>
  );
}

