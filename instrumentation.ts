/** Runs once per server start: launches the background preview worker. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.SPACIE_PREVIEWS === "off") return;
  const [{ db }, { startPreviewWorker }] = await Promise.all([
    import("./lib/db/client"),
    import("./lib/previews"),
  ]);
  // Do not hold up startup: the database connects in the background.
  db().then(startPreviewWorker, (error) => console.error("[previews] not started", error));
}
