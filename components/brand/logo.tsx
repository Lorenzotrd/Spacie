import { cn } from "@/components/ui/cn";

/** The Atelio character, drawn in a 24-unit box (from atelio-brand/logo/atelio-icon.svg). */
const CHARACTER =
  "M12 4C13.3 4 14.3 4.7 15.6 5.8L19.3 9C20.8 10.3 21.4 12 21.5 14.3C21.6 16.6 21.2 18.3 19.9 19.2C18.5 20.2 15.9 20.4 12 20.4C8.1 20.4 5.5 20.2 4.1 19.2C2.8 18.3 2.4 16.6 2.5 14.3C2.6 12 3.2 10.3 4.7 9L8.4 5.8C9.7 4.7 10.7 4 12 4ZM13.5 11.3a0.85 1.3 0 1 0 1.7 0a0.85 1.3 0 1 0 -1.7 0ZM16.0 11.1a0.85 1.3 0 1 0 1.7 0a0.85 1.3 0 1 0 -1.7 0Z";

/** Proportions of atelio-logo.svg: the tile is 990 units, the wordmark box 2686 × 720, 211 units apart. */
const WORDMARK_RATIO = 720 / 990;
const WORDMARK_ASPECT = 2686 / 720;
const GAP_RATIO = 211 / 990;

export type LogoProps = {
  variant?: "full" | "icon";
  /** light: blue tile, ink word. blue: white character and word, for blue backgrounds. dark: blue tile, white word. */
  theme?: "light" | "blue" | "dark";
  /** Icon size in pixels; the wordmark scales with it. */
  size?: number;
  className?: string;
};

export function Logo({ variant = "full", theme = "light", size = 30, className }: LogoProps) {
  const icon =
    theme === "blue" ? (
      <svg width={size} height={size} viewBox="2 3 20 20" aria-hidden className="shrink-0">
        <path fill="#fff" fillRule="evenodd" d={CHARACTER} />
      </svg>
    ) : (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <rect width="24" height="24" rx="5.4" fill="#2B59D9" />
        <path fill="#fff" fillRule="evenodd" d={CHARACTER} transform="translate(1.8 1.4) scale(0.85)" />
      </svg>
    );
  if (variant === "icon")
    return (
      <span role="img" aria-label="Atelio" className={cn("inline-flex", className)}>
        {icon}
      </span>
    );
  const height = Math.round(size * WORDMARK_RATIO);
  return (
    <span role="img" aria-label="Atelio" className={cn("inline-flex items-center", className)} style={{ gap: Math.round(size * GAP_RATIO) }}>
      {icon}
      {/* eslint-disable-next-line @next/next/no-img-element -- a tiny static SVG, already outlined */}
      <img
        src={theme === "light" ? "/brand/atelio-wordmark-ink.svg" : "/brand/atelio-wordmark-white.svg"}
        alt=""
        width={Math.round(height * WORDMARK_ASPECT)}
        height={height}
        className="block"
      />
    </span>
  );
}
