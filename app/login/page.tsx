"use client";
import { useState } from "react";
import { Box } from "lucide-react";
export default function Login() {
  const [email, setEmail] = useState(""),
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
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const d = await r.json();
            setMessage(
              r.ok ? "Check your inbox for your sign-in link." : d.error,
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          Work email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
        <button
          style={{ width: "100%", justifyContent: "center" }}
          className="button primary"
          disabled={busy}
        >
          {busy ? "Sending…" : "Continue with email"}
        </button>
      </form>
      <p role="status">{message}</p>
    </div>
  );
}
