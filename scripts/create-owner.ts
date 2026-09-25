/**
 * Creates a workspace and prints the one-time link its owner opens to create their account:
 *   DATABASE_URL=… SPACIE_ORIGIN=https://… npm run create-owner -- "Workspace name"
 */
import { db } from "../lib/db/client";
import { createWorkspaceWithOwnerInvite } from "../lib/accounts";

const name = process.argv[2]?.trim();
if (!name) {
  console.error('Usage: npm run create-owner -- "Workspace name"');
  process.exit(1);
}
const origin = process.env.SPACIE_ORIGIN;
if (!origin) {
  console.error("Set SPACIE_ORIGIN to the public https origin.");
  process.exit(1);
}
db()
  .then((database) => createWorkspaceWithOwnerInvite(database, name))
  .then(({ token, expiresAt }) => {
    console.info(`Workspace "${name}" created. Owner link (single use, expires ${expiresAt}):`);
    console.info(`${origin}/join?token=${token}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("[create-owner] failed", error);
    process.exit(1);
  });
