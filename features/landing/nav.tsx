"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Mark } from "./parts";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header className="relative z-30 border-b border-[#eceae4]">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2.5 px-4 md:h-20 md:gap-10 md:px-10 xl:px-20">
        <a href="#top" className="flex flex-1 items-center gap-2 text-ink no-underline md:flex-none md:gap-2.5" aria-label="Spacie, back to top">
          <Mark size={30} />
          <span className="text-xl font-bold tracking-[-0.03em] md:text-[21px]">spacie</span>
        </a>
        <nav aria-label="Sections" className="hidden gap-8 text-sm md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[#55575f] no-underline transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 md:ml-auto">
          <Link
            href="/login"
            className="hidden h-[42px] items-center rounded-[11px] px-4 text-sm font-medium text-ink no-underline transition-colors hover:bg-[#f1efea] md:flex"
          >
            Log in
          </Link>
          <a
            href="#pricing"
            className="flex h-10 items-center rounded-[10px] bg-accent px-3.5 text-sm font-medium text-white no-underline transition hover:-translate-y-px hover:bg-accent-hover hover:text-white md:h-[42px] md:rounded-[11px] md:px-[18px]"
          >
            <span className="md:hidden">Start free</span>
            <span className="hidden md:inline">Start for free</span>
          </a>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-menu"
            onClick={() => setOpen(!open)}
            className="flex size-11 items-center justify-center rounded-[10px] border border-line bg-white md:hidden"
          >
            {open ? <X size={18} aria-hidden /> : <Menu size={18} aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="landing-menu"
          aria-label="Menu"
          className="absolute inset-x-0 top-full flex flex-col border-b border-[#eceae4] bg-[#faf9f6] px-4 pt-2 pb-4 shadow-[0_18px_30px_-18px_rgba(23,24,28,0.25)] md:hidden"
        >
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex h-12 items-center border-b border-[#eceae4] text-base font-medium text-ink no-underline"
            >
              {l.label}
            </a>
          ))}
          <Link href="/login" className="mt-3 flex h-12 items-center justify-center rounded-[14px] border border-line bg-white text-base font-medium text-ink no-underline">
            Log in
          </Link>
        </nav>
      )}
    </header>
  );
}
