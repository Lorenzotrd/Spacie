"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box } from "lucide-react";
/** Only same-site paths: `next` must never send someone to another origin. */
function safeNext() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/workspace";
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="loading-screen">
      <Box size={35} />
      <h1>Welcome to Spacie</h1>
      <p>Your team. Your agents. One shared space.</p>
      <form
        style={{ width: 320 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          try {
            const r = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });
            if (r.ok) router.push(safeNext());
            else setMessage((await r.json()).error?.replace("UNAUTHORIZED: ", ""));
          } catch {
            setMessage("Could not reach the server. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <label className="field-label">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button
          style={{ width: "100%", justifyContent: "center" }}
          className="button primary"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p role="status">{message}</p>
      <p className="subtle-copy">New here? Ask a teammate for an invitation link.</p>
    </div>
  );
}
