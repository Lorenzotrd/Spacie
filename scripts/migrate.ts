/** Applies pending migrations to DATABASE_URL: `npm run db:migrate`. The app also migrates on boot. */
import { db } from "../lib/db/client";

db()
  .then(() => {
    console.info("[db] migrations applied");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[db] migration failed", error);
    process.exit(1);
  });
