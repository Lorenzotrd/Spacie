/** Demo mode is explicit and can never be active in a production build. */
export const demo = () =>
  process.env.SPACIE_DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production";

/** Object storage is used when a bucket is configured; otherwise files go to local disk. */
export const objectStorage = () =>
  !!process.env.R2_ENDPOINT && !!process.env.R2_BUCKET;

/** Where local state lives: the demo database and locally stored assets. */
export const dataDir = () =>
  process.env.SPACIE_DATA_DIR ?? `${process.cwd()}/data`;
