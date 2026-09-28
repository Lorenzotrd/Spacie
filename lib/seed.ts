import type { WorkspaceState, Principal } from "./types";
export const ids = {
  workspace: "10000000-0000-4000-8000-000000000001",
  lorenzo: "20000000-0000-4000-8000-000000000001",
  sarah: "20000000-0000-4000-8000-000000000002",
  sofia: "20000000-0000-4000-8000-000000000003",
  claude: "20000000-0000-4000-8000-000000000004",
  codex: "20000000-0000-4000-8000-000000000005",
  claw: "20000000-0000-4000-8000-000000000006",
  rebond: "30000000-0000-4000-8000-000000000001",
};
const uid = (n: number) =>
  `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function seed(): WorkspaceState {
  const now = Date.now(),
    ago = (m: number) => new Date(now - m * 60000).toISOString();
  const principals: Principal[] = [
    {
      id: ids.lorenzo,
      name: "Lorenzo",
      initials: "LT",
      color: "#738e79",
      type: "human",
      status: "online",
      role: "owner",
    },
    {
      id: ids.sarah,
      name: "Sarah",
      initials: "SK",
      color: "#c18c72",
      type: "human",
      status: "online",
      role: "member",
    },
    {
      id: ids.sofia,
      name: "Sofia",
      initials: "SM",
      color: "#8a8cb3",
      type: "human",
      status: "offline",
      role: "member",
    },
    {
      id: ids.claude,
      name: "Claude Code",
      initials: "✳",
      color: "#c58264",
      type: "agent",
      provider: "Anthropic",
      status: "idle",
    },
    {
      id: ids.codex,
      name: "Codex",
      initials: "◈",
      color: "#5d8377",
      type: "agent",
      provider: "OpenAI",
      status: "idle",
    },
    {
      id: ids.claw,
      name: "OpenClaw",
      initials: "⌘",
      color: "#8d7cbc",
      type: "agent",
      provider: "Custom",
      status: "offline",
    },
  ].map((p) => ({ ...p, workspaceId: ids.workspace })) as Principal[];
  const projects = [
    {
      id: ids.rebond,
      name: "Rebond",
      description: "A fresh perspective. A stronger brand.",
      instructions:
        "Rebond is a rebrand for a client. Write in English, keep every claim sourced in the brief, and never overwrite a version without saying why.",
      color: "#8a73d5",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      name: "OwlAgent",
      description: "A little more intelligence, everywhere.",
      color: "#d59a53",
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      name: "Rouge",
      description: "Make something worth noticing.",
      color: "#c76c78",
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      name: "Internal",
      description: "How we work, together.",
      color: "#7a96af",
    },
  ].map((p) => ({ instructions: "", ...p, workspaceId: ids.workspace }));
  const folders = [
    "Briefs",
    "Campaigns",
    "Website",
    "Branding",
    "Research",
  ].map((name, i) => ({
    id: uid(i + 1),
    name,
    workspaceId: ids.workspace,
    projectId: ids.rebond,
    parentId: null,
  }));
  const content =
    "<h1>A new chapter for Rebond</h1><p>We’re building a brand that helps ambitious teams find their next chapter. This is our shared direction for the autumn launch.</p><h2>The opportunity</h2><p>Good work deserves to be seen. Our audience is ready for a more considered approach — one that puts clarity, craft, and real connection first.</p><blockquote>Less noise. More meaning. A brand you can feel.</blockquote><h2>What we’re here to do</h2><ul><li>Make the value unmistakable in the first five seconds.</li><li>Build a consistent story across every touchpoint.</li><li>Give people a reason to come back.</li></ul><h2>Our audience</h2><p>Independent founders and small, ambitious teams. They care about the details, move with intention, and want partners who do the same.</p><h2>Next steps</h2><p>Align on the messaging pillars, explore three creative directions, and bring the strongest idea into the campaign brief.</p>";
  const files = [
    "Strategy.md",
    "Landing-page-v3",
    "Campaign-Brief",
    "Brand-guide.pdf",
    "Meta-Ad-v4.png",
    "Product-video.mp4",
  ].map((name, i) => ({
    id: uid(20 + i),
    workspaceId: ids.workspace,
    projectId: ids.rebond,
    folderId: null,
    name,
    mime:
      i < 3
        ? "application/x-spacie-doc"
        : i === 3
          ? "application/pdf"
          : i === 4
            ? "image/png"
            : "video/mp4",
    size: [2400, 1800, 4200, 2800000, 1400000, 18400000][i],
    updatedBy: [
      ids.claude,
      ids.codex,
      ids.sarah,
      ids.lorenzo,
      ids.sofia,
      ids.sarah,
    ][i],
    updatedAt: ago([2, 12, 35, 120, 180, 1440][i]),
    version: i === 0 ? 4 : 1,
    deleted: false,
    content:
      i === 0
        ? content
        : i < 3
          ? `<h1>${name.replaceAll("-", " ")}</h1><p>Rebond · Autumn launch</p><h2>Make your next move matter.</h2><p>A thoughtful foundation for a stronger brand. Work in progress — add your ideas and feedback here.</p>`
          : "",
    storageKey: undefined,
  }));
  return {
    workspace: { id: ids.workspace, name: "SHYFT", slug: "shyft" },
    principals,
    projects,
    folders,
    files,
    versions: files.flatMap((f) =>
      Array.from({ length: f.version }, (_, i) => ({
        id: uid(100 + files.indexOf(f) * 10 + i),
        fileId: f.id,
        number: i + 1,
        content:
          i === f.version - 1
            ? f.content
            : f.content.replace(
                "A new chapter for Rebond",
                `Rebond strategy — draft ${i + 1}`,
              ),
        actorId: i % 2 ? ids.claude : ids.sarah,
        createdAt: ago((f.version - i) * 20),
        message:
          i === f.version - 1
            ? "Refined positioning and launch direction"
            : "Updated messaging",
      })),
    ),
    comments: [
      {
        id: uid(200),
        fileId: files[0].id,
        parentId: null,
        actorId: ids.sarah,
        content:
          "The direction is feeling really strong. Can we make the audience section a little more specific?",
        createdAt: ago(18),
        resolved: false,
        reactions: [],
      },
      {
        id: uid(201),
        fileId: files[0].id,
        parentId: uid(200),
        actorId: ids.claude,
        content:
          "Updated the audience and added a clearer set of next steps in version 4. Ready for your review.",
        createdAt: ago(2),
        resolved: false,
        reactions: [ids.lorenzo],
      },
    ],
    activity: files.map((f, i) => ({
      id: uid(300 + i),
      actorId: f.updatedBy,
      projectId: f.projectId,
      fileId: f.id,
      action: i < 2 ? "edited" : i === 2 ? "created" : "uploaded",
      name: f.name,
      createdAt: f.updatedAt,
    })),
    grants: principals
      .filter((p) => p.type === "agent")
      .map((p, i) => ({
        id: uid(400 + i),
        principalId: p.id,
        resourceType: "project",
        resourceId: ids.rebond,
        allow: [
          "read",
          "write",
          "create",
          "upload",
          "comment",
          "rename",
          "move",
          "create_folder",
        ],
        fullAccess: false,
      })),
    tokens: [],
    revision: 1,
  };
}
