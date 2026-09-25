import { createHash, randomBytes } from "node:crypto";
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () =>
  `spc_agent_${randomBytes(32).toString("base64url")}`;
/** Agent credentials are valid for 90 days. */
export const TOKEN_TTL_MS = 90 * 86_400_000;
