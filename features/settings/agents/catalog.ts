import { CLIENT_LOGOS, clientOf, type ClientId } from "@/lib/agent-clients";

export { clientOf, type ClientId };

export type ClientGuide = {
  id: ClientId;
  name: string;
  /** Monogram, used as the logo's text alternative. */
  initial: string;
  /** Logo in /public/agents, and its size in a 40px tile. */
  logo: { src: string; size: number };
  via: string;
  /** OAuth clients connect from their own app; the others use a token generated here. */
  auth: "oauth" | "token";
  steps: string[];
  codeLabel: string;
  code: (mcpUrl: string, token?: string) => string;
};

export const TOKEN_PLACEHOLDER = "[AGENT TOKEN]";

const jsonConfig = (url: string, token = TOKEN_PLACEHOLDER) =>
  JSON.stringify({ mcpServers: { spacie: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2);

/** How to connect each supported client. Copy only; the URL comes from the server. */
const GUIDES: readonly Omit<ClientGuide, "logo">[] = [
  {
    id: "claude",
    name: "Claude",
    initial: "C",
    via: "claude.ai, Desktop and mobile · MCP connector",
    auth: "oauth",
    steps: [
      "In Claude, open Settings, then Connectors.",
      "Add a custom connector and paste the URL below.",
      "Sign in to Spacie and choose the projects it may use.",
    ],
    codeLabel: "Connector URL",
    code: (url) => url,
  },
  {
    id: "claudecode",
    name: "Claude Code",
    initial: "CC",
    via: "Terminal, VS Code, JetBrains",
    auth: "oauth",
    steps: [
      "Run this command in your terminal.",
      "Type /mcp in Claude Code and pick spacie to sign in.",
      "Approve its access in the Spacie window.",
    ],
    codeLabel: "Terminal",
    code: (url) => `claude mcp add --transport http spacie ${url}`,
  },
  {
    id: "codex",
    name: "Codex",
    initial: "Cx",
    via: "CLI and IDE · config.toml",
    auth: "oauth",
    steps: [
      "Add this block to ~/.codex/config.toml.",
      "Restart Codex and sign in when it asks.",
      "Approve its access in the Spacie window.",
    ],
    codeLabel: "~/.codex/config.toml",
    code: (url) => `[mcp_servers.spacie]\nurl = "${url}"`,
  },
  {
    id: "hermes",
    name: "Hermes",
    initial: "H",
    via: "Your agent on a server · agent token",
    auth: "token",
    steps: [
      "Generate an agent token below. It is shown only once.",
      "Add the MCP server to Hermes' configuration.",
      "Restart the agent. It joins the team under its own name.",
    ],
    codeLabel: "MCP config (JSON)",
    code: jsonConfig,
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    initial: "OC",
    via: "Managed agent · agent token",
    auth: "token",
    steps: [
      "Generate an agent token below.",
      "Paste the URL and token into OpenClaw's MCP integrations.",
      "The agent joins the team under its own name.",
    ],
    codeLabel: "MCP config (JSON)",
    code: jsonConfig,
  },
  {
    id: "other",
    name: "Other agent",
    initial: "+",
    via: "Any MCP client",
    auth: "token",
    steps: [
      "Generate an agent token and give the agent a name.",
      "Point your MCP client at the URL below.",
      "Send the token as a Bearer Authorization header.",
    ],
    codeLabel: "MCP server",
    code: (url, token = TOKEN_PLACEHOLDER) => `${url}\nAuthorization: Bearer ${token}`,
  },
];

export const CLIENTS: readonly ClientGuide[] = GUIDES.map((g) => ({ ...g, logo: CLIENT_LOGOS[g.id] }));

export const clientById = (id: ClientId) => CLIENTS.find((c) => c.id === id)!;

/** Provider stored for agents created from a token guide. */
export const providerFor = (id: ClientId) => (id === "other" ? "Custom" : clientById(id).name);
