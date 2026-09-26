export type Action =
  | "read"
  | "write"
  | "create"
  | "upload"
  | "comment"
  | "rename"
  | "move"
  | "delete"
  | "restore"
  | "create_folder"
  | "publish"
  | "manage_members";
export const actions: Action[] = [
  "read",
  "write",
  "create",
  "upload",
  "comment",
  "rename",
  "move",
  "delete",
  "restore",
  "create_folder",
  "publish",
  "manage_members",
];
export type Principal = {
  id: string;
  workspaceId: string;
  type: "human" | "agent";
  name: string;
  initials: string;
  color: string;
  provider?: string;
  status: "online" | "working" | "idle" | "offline";
  role?: "owner" | "admin" | "member" | "viewer";
};
export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
};
export type Folder = {
  id: string;
  workspaceId: string;
  projectId: string;
  parentId: string | null;
  name: string;
};
export type FileRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  folderId: string | null;
  name: string;
  mime: string;
  size: number;
  updatedBy: string;
  updatedAt: string;
  version: number;
  deleted: boolean;
  storageKey?: string;
  /** PDF rendition state for office files: none, pending, processing, ready, failed. */
  previewStatus?: "none" | "pending" | "processing" | "ready" | "failed";
  content: string;
};
export type Version = {
  id: string;
  fileId: string;
  number: number;
  content: string;
  storageKey?: string;
  /** Size and type of this version's bytes; null for versions saved before they were tracked. */
  size?: number | null;
  mime?: string | null;
  actorId: string;
  createdAt: string;
  message: string;
};
export type Comment = {
  id: string;
  fileId: string;
  parentId: string | null;
  actorId: string;
  content: string;
  createdAt: string;
  resolved: boolean;
  reactions: string[];
};
export type Activity = {
  id: string;
  actorId: string;
  projectId: string | null;
  fileId: string | null;
  action: string;
  name: string;
  createdAt: string;
};
export type Grant = {
  id: string;
  principalId: string;
  resourceType: "workspace" | "project" | "folder";
  resourceId: string;
  allow: Action[];
  fullAccess: boolean;
};
export type AgentToken = {
  id: string;
  principalId: string;
  hash: string;
  expiresAt: string;
  revokedAt: string | null;
};
/** Full workspace contents: the seed and the legacy JSON demo store use this shape. */
export type WorkspaceState = {
  workspace: { id: string; name: string; slug: string };
  principals: Principal[];
  projects: Project[];
  folders: Folder[];
  files: FileRecord[];
  versions: Version[];
  comments: Comment[];
  activity: Activity[];
  grants: Grant[];
  tokens: AgentToken[];
  revision: number;
};
/** File listing entry: everything except the document body. */
export type FileMeta = Omit<FileRecord, "content">;
export type VersionMeta = Omit<Version, "content">;
/** What a principal may see of a workspace. Bodies are loaded per file. */
export type PublicState = {
  workspace: WorkspaceState["workspace"];
  revision: number;
  currentPrincipalId: string;
  demo: boolean;
  /** Browser uploads go straight to object storage when it is configured. */
  directUploads: boolean;
  /** Public MCP endpoint agents connect to; set by the HTTP route from SPACIE_ORIGIN. */
  mcpUrl?: string;
  principals: Principal[];
  projects: Project[];
  folders: Folder[];
  files: FileMeta[];
  activity: Activity[];
  grants: Grant[];
};
export type FileDetail = {
  file: FileRecord;
  comments: Comment[];
  versions: VersionMeta[];
};
