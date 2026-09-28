/** Demo mode is explicit and can never be active in a production build. */
export const demo = () =>
  process.env.SPACIE_DEMO_MODE === "true" &&
  process.env.NODE_ENV !== "production";

/** Object storage is used when a bucket is configured; otherwise files go to local disk. */
export const objectStorage = () =>
  !!process.env.R2_ENDPOINT && !!process.env.R2_BUCKET;

/** Shown against usage when SPACIE_STORAGE_QUOTA_GB is unset. Display only: uploads are never blocked. */
const DEFAULT_STORAGE_QUOTA_GB = 10;

/** The workspace's storage allowance in bytes. */
export function storageQuotaBytes(): number {
  const gb = Number(process.env.SPACIE_STORAGE_QUOTA_GB);
  return Math.round((Number.isFinite(gb) && gb > 0 ? gb : DEFAULT_STORAGE_QUOTA_GB) * 1024 ** 3);
}

/** Where local state lives: the demo database and locally stored assets. */
export const dataDir = () =>
  process.env.SPACIE_DATA_DIR ?? `${process.cwd()}/data`;
