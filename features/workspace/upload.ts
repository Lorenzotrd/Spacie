/** Uploads one file into a project folder; returns the file's version after upload. */
export async function uploadOne(
  file: File,
  place: { projectId: string; folderId: string | null },
  directUploads: boolean,
): Promise<number> {
  if (!directUploads) {
    const form = new FormData();
    form.append("file", file);
    form.append("projectId", place.projectId);
    if (place.folderId) form.append("folderId", place.folderId);
    const response = await fetch("/api/assets", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result.version ?? 1;
  }
  const prepared = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...place, name: file.name, mime: file.type, size: file.size }),
  });
  const info = await prepared.json();
  if (!prepared.ok) throw new Error(info.error);
  const uploaded = await fetch(info.url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  if (!uploaded.ok) throw new Error("Storage upload failed. Please try again.");
  const finished = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket: info.ticket }),
  });
  const result = await finished.json();
  if (!finished.ok) throw new Error(result.error);
  return result.version ?? 1;
}

export function uploadNotice(total: number, newVersions: number) {
  if (newVersions === total) return newVersions === 1 ? "Uploaded as a new version" : "Uploaded as new versions";
  return newVersions ? `Upload complete · ${newVersions} added as new versions` : "Upload complete";
}
