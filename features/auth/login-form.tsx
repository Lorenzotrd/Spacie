"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Box, Eye, EyeOff } from "lucide-react";
import { LoginShowcase } from "@/features/auth/login-showcase";
import { GoogleButton, googleError, OrDivider } from "@/features/auth/google-button";

/** Only same-site paths: `next` must never send someone to another origin. */
function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/workspace";
}

const input =
  "h-12 w-full rounded-xl border border-line bg-white px-4 text-[0.9375rem] text-ink outline-none transition-shadow placeholder:text-[#a3a5ac] focus:border-accent focus:shadow-[0_0_0_4px_#eaeffc]";

export function LoginForm({ google }: { google: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleHref, setGoogleHref] = useState("/api/auth/google");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setGoogleHref(`/api/auth/google?next=${encodeURIComponent(safeNext())}`);
    const error = googleError(params.get("error"));
    if (error) setMessage(error);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (r.ok) {
        router.push(safeNext());
        return;
      }
      const body = await r.json().catch(() => ({}));
      setMessage(String(body.error ?? "Could not sign you in.").replace(/^(UNAUTHORIZED|FORBIDDEN): /, ""));
    } catch {
      setMessage("Could not reach the server. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="grid min-h-dvh bg-app p-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-3">
      <LoginShowcase />

      <main className="flex flex-col rounded-[1.75rem] bg-panel px-6 py-8 sm:px-10 lg:border lg:border-line">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-ink no-underline lg:invisible" aria-label="Spacie home">
            <span className="flex size-8 items-center justify-center rounded-[0.5625rem] bg-accent text-white">
              <Box size={17} strokeWidth={2} aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-[-0.02em]">spacie</span>
          </Link>
          <Link href="/" className="text-[0.8125rem] text-muted no-underline hover:text-ink">
            What is Spacie?
          </Link>
        </div>

        <div className="m-auto flex w-full max-w-[25rem] flex-col gap-8 py-10">
          <div className="flex flex-col gap-2.5">
            <h1 className="m-0 text-[2.25rem] leading-tight font-semibold tracking-[-0.03em]">Welcome back</h1>
            <p className="m-0 text-[0.9375rem] text-muted">Sign in to pick up where your team, and your agents, left off.</p>
          </div>

          {google && (
            <div className="flex flex-col gap-5">
              <GoogleButton href={googleHref} />
              <OrDivider />
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-2">Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={input}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-ink-2">Password</span>
              <span className="relative">
                <input
                  type={reveal ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setReveal((r) => !r)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  aria-pressed={reveal}
                  className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-segment hover:text-ink"
                >
                  {reveal ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                </button>
              </span>
            </label>

            {message && (
              <p role="alert" className="m-0 flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-[0.8125rem] text-danger">
                <AlertCircle size={16} className="mt-px shrink-0" aria-hidden />
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-[0.9375rem] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(43,89,217,0.8)] transition-colors hover:bg-accent-hover disabled:opacity-70"
            >
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />}
            </button>
          </form>

          <div className="flex items-center gap-3 rounded-2xl border border-line-soft bg-card p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[0.625rem] bg-accent-soft text-accent">
              <Box size={17} strokeWidth={1.9} aria-hidden />
            </span>
            <p className="m-0 text-[0.8125rem] leading-normal text-ink-2">
              <span className="font-semibold text-ink">New here?</span> Spacie is invite-only for now. Ask a teammate for
              an invitation link.
            </p>
          </div>
        </div>

        <p className="m-0 text-center text-xs text-muted">Every file, every version, every agent action. In one place.</p>
      </main>
    </div>
  );
}
