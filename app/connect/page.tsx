"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Box } from "lucide-react";

type Consent = {
  client: { name: string; redirectHost: string };
  user: string;
  workspace: string;
  projects: { id: string; name: string }[];
  canShareAll: boolean;
  canWrite: boolean;
};
type Access = "read" | "comment" | "write";

/** OAuth consent: choose what a connecting app (e.g. a Claude connector) may do. */
export default function Connect() {
  const router = useRouter();
  const [request, setRequest] = useState("");
  const [consent, setConsent] = useState<Consent | null>(null);
  const [name, setName] = useState("");
  const [access, setAccess] = useState<Access>("write");
  const [allProjects, setAllProjects] = useState(false);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error && !params.get("client_id")) {
      setMessage(error);
      return;
    }
    const query = params.toString();
    setRequest(query);
    fetch(`/api/oauth/consent?${query}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/connect?${query}`)}`);
          return;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setConsent(data);
        setName(`${data.client.name} (${data.user})`);
        setAccess(data.canWrite ? "write" : "read");
      })
      .catch((e: Error) => setMessage(e.message || "This connection request is invalid."));
  }, [router]);

  async function decide(decision: "approve" | "deny") {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/oauth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "deny"
            ? { decision, request }
            : { decision, request, choice: { name, access, allProjects, projectIds } },
        ),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      window.location.replace(data.redirect);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="loading-screen">
      <Box size={35} />
      <h1>{consent ? `Connect ${consent.client.name}` : "Connect an app"}</h1>
      {consent && (
        <>
          <p>
            <strong>{consent.client.name}</strong> wants to work in <strong>{consent.workspace}</strong> as an AI
            teammate. Everything it does is recorded under its own name, and you can disconnect it anytime.
          </p>
          <form
            style={{ width: 360 }}
            onSubmit={(e) => {
              e.preventDefault();
              void decide("approve");
            }}
          >
            <label className="field-label">
              Name in Spacie
              <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field-label">
              Access level
              <select value={access} onChange={(e) => setAccess(e.target.value as Access)}>
                <option value="read">Read only</option>
                <option value="comment">Read + comment</option>
                {consent.canWrite && <option value="write">Read + write</option>}
              </select>
            </label>
            <fieldset>
              <legend>Projects it can access</legend>
              {consent.canShareAll && (
                <label className="check-label">
                  <input type="checkbox" checked={allProjects} onChange={(e) => setAllProjects(e.target.checked)} />
                  All projects, including future ones
                </label>
              )}
              {!allProjects &&
                consent.projects.map((p) => (
                  <label className="check-label" key={p.id}>
                    <input
                      type="checkbox"
                      checked={projectIds.includes(p.id)}
                      onChange={(e) =>
                        setProjectIds(
                          e.target.checked ? [...projectIds, p.id] : projectIds.filter((x) => x !== p.id),
                        )
                      }
                    />
                    {p.name}
                  </label>
                ))}
              {!consent.projects.length && !consent.canShareAll && (
                <p className="subtle-copy">You have no projects to share yet.</p>
              )}
            </fieldset>
            <p className="subtle-copy">You will be sent back to {consent.client.redirectHost}.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="button"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={busy}
                onClick={() => void decide("deny")}
              >
                Deny
              </button>
              <button
                className="button primary"
                style={{ flex: 1, justifyContent: "center" }}
                disabled={busy || (!allProjects && !projectIds.length)}
              >
                {busy ? "Connecting…" : "Allow"}
              </button>
            </div>
          </form>
        </>
      )}
      <p role="status">{message}</p>
    </div>
  );
}
