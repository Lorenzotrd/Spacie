/**
 * Marketing copy and demo content for the public landing page. Unlike the app, the
 * landing shows illustrative data on purpose: nothing here comes from a workspace.
 */

export type AgentName = "Claude" | "Claude Code" | "Codex" | "OpenClaw" | "Hermes" | "Muse" | "Grok Bot" | "Any MCP client";

/** Logo and its size in a 40px tile (each logo carries its own padding). */
export const AGENTS: Record<AgentName, { logo: string; size: number }> = {
  Claude: { logo: "/agents/claude.webp", size: 22 },
  "Claude Code": { logo: "/agents/claude-code.png", size: 26 },
  Codex: { logo: "/agents/codex.png", size: 26 },
  OpenClaw: { logo: "/agents/openclaw.svg", size: 34 },
  Hermes: { logo: "/agents/hermes.png", size: 34 },
  Muse: { logo: "/agents/muse.png", size: 30 },
  "Grok Bot": { logo: "/agents/grok-bot.png", size: 36 },
  "Any MCP client": { logo: "/agents/mcp.png", size: 28 },
};
export const MARQUEE = Object.keys(AGENTS) as AgentName[];
export const HERO_ROTATION: AgentName[] = ["Claude", "Codex", "Hermes", "Grok Bot", "Muse", "OpenClaw"];

/** Floating tiles around the hero title (desktop): x, y in px from the section's corners, rotation, delay. */
export const HERO_TILES: { name: AgentName; side: "left" | "right"; x: number; y: number; r: number; d: number }[] = [
  { name: "Claude", side: "left", x: 120, y: 60, r: -8, d: 0 },
  { name: "Codex", side: "left", x: 56, y: 250, r: 6, d: 1.2 },
  { name: "Hermes", side: "left", x: 190, y: 400, r: -4, d: 0.6 },
  { name: "Grok Bot", side: "right", x: 126, y: 50, r: 7, d: 0.9 },
  { name: "Muse", side: "right", x: 60, y: 240, r: -6, d: 0.3 },
  { name: "OpenClaw", side: "right", x: 196, y: 400, r: 5, d: 1.5 },
];

/** Demo people: photo avatars for the fake team. */
export const PEOPLE: Record<string, string | null> = {
  Emma: "/landing/avatar-emma.jpg",
  Tom: "/landing/avatar-tom.jpg",
  Investor: null,
};

export type Who = { name: string; ai: boolean };
const ai = (name: AgentName): Who => ({ name, ai: true });
const human = (name: string): Who => ({ name, ai: false });

export const TEAM: Who[] = [human("Emma"), human("Tom"), ai("Claude"), ai("Codex"), ai("Hermes")];

export type FileKind = "slides" | "doc" | "pdf" | "image" | "code";
export const FILES: { name: string; kind: FileKind; v: string; by: Who; hot?: boolean }[] = [
  { name: "Launch deck.pptx", kind: "slides", v: "v3", by: ai("Claude"), hot: true },
  { name: "Product brief.docx", kind: "doc", v: "v2", by: human("Emma") },
  { name: "SEO plan.pdf", kind: "pdf", v: "v1", by: ai("Hermes") },
  { name: "pricing.json", kind: "code", v: "v4", by: ai("Codex") },
  { name: "Brand moodboard.png", kind: "image", v: "v1", by: human("Tom") },
];

export const EVENTS: (Who & { what: string; target: string })[] = [
  { ...ai("Claude"), what: "published v3 of", target: "Launch deck.pptx" },
  { ...human("Emma"), what: "commented", target: "“Perfect, let’s send it”" },
  { ...ai("Codex"), what: "updated", target: "pricing.json" },
  { ...human("Investor"), what: "opened your link", target: "Launch deck v3" },
  { ...ai("Hermes"), what: "added", target: "SEO plan.pdf" },
  { ...human("Tom"), what: "restored v2 of", target: "Product brief.docx" },
];
export const EVENT_AGES = ["2 min ago", "5 min ago", "11 min ago"];

export const HISTORY: (Who & { what: string; when: string; v: string })[] = [
  { ...ai("Claude"), what: "published the final version", when: "Today, 10:42 AM", v: "v3" },
  { ...human("Emma"), what: "fixed slide 4", when: "Yesterday, 6:10 PM", v: "v2" },
  { ...ai("Claude"), what: "created the deck", when: "Monday, 9:15 AM", v: "v1" },
];

export const STEPS = [
  { title: "Connect your agent", text: "One command or one connector, and your AI joins the team under its own name." },
  { title: "It works in your projects", text: "It reads, creates and updates your docs, decks and PDFs. Right where they belong." },
  { title: "You stay in control", text: "Every action is tracked. Restore any version in one click." },
];
export const STEP_CHIPS: AgentName[] = ["Claude", "Claude Code", "Codex", "Hermes", "OpenClaw", "Muse", "Grok Bot"];
export const WORK_ROWS: { name: string; meta: string; tag: string; agent: AgentName }[] = [
  { name: "Landing copy.md", meta: "Claude Code · just now", tag: "Created", agent: "Claude Code" },
  { name: "Hero visuals.pdf", meta: "Claude · just now", tag: "v2", agent: "Claude" },
  { name: "budget.xlsx", meta: "Codex · just now", tag: "Edited", agent: "Codex" },
];
export const STEP_VERSIONS: (Who & { label: string; meta: string; current: boolean })[] = [
  { ...ai("Claude"), label: "Version 3", meta: "Claude · 4 min ago", current: true },
  { ...human("Emma"), label: "Version 2", meta: "Emma · yesterday", current: false },
  { ...ai("Claude"), label: "Version 1", meta: "Claude · Monday", current: false },
];

export const TIMELINE: (Who & { v: string })[] = [
  { ...ai("Claude"), v: "v1" },
  { ...human("Emma"), v: "v2" },
  { ...ai("Codex"), v: "v3" },
  { ...human("Tom"), v: "v4" },
  { ...ai("Claude"), v: "v5" },
];

export const FORMATS = [
  { ext: "PDF", bg: "#fbe9e7", fg: "#a1342a" },
  { ext: "PPTX", bg: "#fbede1", fg: "#9a4a12" },
  { ext: "DOCX", bg: "#eaeffc", fg: "#1e44b0" },
  { ext: "XLSX", bg: "#e3f3ea", fg: "#1d6b45" },
] as const;

export const PLANS = [
  {
    name: "Free",
    desc: "Try it with your first agent.",
    monthly: 0,
    yearly: 0,
    cta: "Get started",
    featured: false,
    features: ["5 GB storage", "2 people", "2 AI agents", "3 active client links", "Version history"],
  },
  {
    name: "Solo",
    desc: "For freelancers working with several AIs.",
    monthly: 9,
    yearly: 7,
    cta: "Try Solo",
    featured: true,
    features: ["50 GB storage", "5 people", "Unlimited agents", "Unlimited password protected client links", "Full history"],
  },
  {
    name: "Studio",
    desc: "For agencies delivering client work with AI.",
    monthly: 29,
    yearly: 24,
    cta: "Try Studio",
    featured: false,
    features: ["200 GB storage", "Unlimited people", "Fine grained agent permissions", "Client spaces with your logo", "Client comments on links"],
  },
] as const;
/** Studio add-on: $5 a month per extra 100 GB. */
export const EXTRA_STORAGE = { price: 5, stepGb: 100, max: 20, baseGb: 200 };

export const FAQ = [
  {
    q: "Does Spacie pay for my AI?",
    a: "No. Your agents use their own subscription (Claude, ChatGPT, etc.). Spacie simply gives them access to your files, with the permissions you choose.",
  },
  {
    q: "Which AIs work with Spacie?",
    a: "Claude, Claude Code, Codex, Hermes, OpenClaw, Muse, Grok Bot, and any MCP compatible client. Each agent shows up in your team under its own name.",
  },
  {
    q: "Where are my files stored?",
    a: "On our servers in Germany, with our own database and no third parties. Everything is backed up every night and kept for 14 days.",
  },
  {
    q: "Does my client need an account?",
    a: "No. Send them a link, with a password and expiry if you want. See how many times they opened it, and turn it off whenever you like.",
  },
  {
    q: "Can I revoke an AI’s access?",
    a: "Yes, in one click. It loses access instantly, and everything it did stays in the history.",
  },
];
