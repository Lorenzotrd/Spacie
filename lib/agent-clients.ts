import type { Principal } from "./types";

/** The AI clients Spacie knows how to connect, and how to recognise their agents. */
export type ClientId = "claude" | "claudecode" | "codex" | "hermes" | "openclaw" | "other";

/** Logo in /public/agents, and its size in a 40px tile (logos carry different padding). */
export const CLIENT_LOGOS: Record<ClientId, { src: string; size: number }> = {
  claude: { src: "/agents/claude.webp", size: 22 },
  claudecode: { src: "/agents/claude-code.png", size: 26 },
  codex: { src: "/agents/codex.png", size: 26 },
  hermes: { src: "/agents/hermes.png", size: 34 },
  openclaw: { src: "/agents/openclaw.svg", size: 34 },
  other: { src: "/agents/mcp.png", size: 26 },
};

/** Which client an agent belongs to, from its provider and name. */
export function clientOf(agent: Pick<Principal, "provider" | "name">): ClientId {
  const text = `${agent.provider ?? ""} ${agent.name}`.toLowerCase();
  if (/claude[\s_-]*code/.test(text)) return "claudecode";
  if (/codex|openai/.test(text)) return "codex";
  if (/hermes/.test(text)) return "hermes";
  if (/openclaw/.test(text)) return "openclaw";
  if (/claude|anthropic/.test(text)) return "claude";
  return "other";
}
