"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box } from "lucide-react";
import { MIN_PASSWORD } from "@/lib/password-rules";
import { GoogleButton, googleError, OrDivider } from "@/features/auth/google-button";

type Invite = { workspace: string; role: string; email: string | null };

export function JoinForm({ google }: { google: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [invite, setInvite] = useState<Invite | null>(null);
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  /** Signed-in people join with their existing account instead of creating one. */
  const [signedIn, setSignedIn] = useState(false);
  const [newAccount, setNewAccount] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(value);
    const error = googleError(new URLSearchParams(window.location.search).get("error"));
    if (!value) {
      setMessage("This page needs an invitation link.");
      return;
    }
    fetch(`/api/auth/join?token=${encodeURIComponent(value)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data: Invite = await r.json();
        setInvite(data);
        if (data.email) setEmail(data.email);
        if (error) setMessage(error);
      })
      .catch(() => setMessage("This invitation link is invalid or has expired."));
    fetch("/api/workspaces", { cache: "no-store" })
      .then((r) => setSignedIn(r.ok))
      .catch(() => setSignedIn(false));
  }, []);
  async function joinSignedIn() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (r.ok) router.push("/workspace");
      else setMessage((await r.json()).error);
    } catch {
      setMessage("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }
  const signInLink = `/login?next=${encodeURIComponent(`/join?token=${token}`)}`;
  return (
    <div className="loading-screen">
      <Box size={35} />
      <h1>{invite ? `Join ${invite.workspace}` : "Join Spacie"}</h1>
      <p>{invite ? `You're invited as ${invite.role}.` : "Your team. Your agents. One shared space."}</p>
      {invite && signedIn && !newAccount && (
        <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 10 }}>
          <button className="button primary" style={{ justifyContent: "center" }} disabled={busy} onClick={() => void joinSignedIn()}>
            {busy ? "Joining…" : `Join ${invite.workspace} with my account`}
          </button>
          <button className="button" style={{ justifyContent: "center" }} onClick={() => setNewAccount(true)}>
            Create a separate account instead
          </button>
        </div>
      )}
      {invite && google && (!signedIn || newAccount) && (
        <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
          <GoogleButton href={`/api/auth/google?invite=${encodeURIComponent(token)}`} label="Join with Google" />
          <OrDivider />
        </div>
      )}
      {invite && (!signedIn || newAccount) && (
        <form
          style={{ width: 320 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const r = await fetch("/api/auth/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, name, email, password }),
              });
              if (r.ok) router.push("/workspace");
              else setMessage((await r.json()).error);
            } catch {
              setMessage("Could not reach the server. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="field-label">
            Your name
            <input required maxLength={80} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field-label">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              readOnly={!!invite.email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              required
              minLength={MIN_PASSWORD}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`At least ${MIN_PASSWORD} characters`}
            />
          </label>
          <button style={{ width: "100%", justifyContent: "center" }} className="button primary" disabled={busy}>
            {busy ? "Creating your account…" : "Create account"}
          </button>
        </form>
      )}
      <p role="status">{message}</p>
      {invite && !signedIn && (
        <p className="subtle-copy">
          Already have a Spacie account? <a href={signInLink}>Sign in to join with it</a>
        </p>
      )}
    </div>
  );
}
