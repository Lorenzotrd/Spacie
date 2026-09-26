export type DiffLine = { text: string; change: "same" | "added" | "removed" };

/**
 * Line diff by longest common subsequence. Documents are a few hundred
 * paragraphs at most, so the O(n·m) table stays small.
 */
export function diffLines(before: readonly string[], after: readonly string[]): DiffLine[] {
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ text: before[i], change: "same" });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ text: before[i++], change: "removed" });
    else out.push({ text: after[j++], change: "added" });
  }
  while (i < n) out.push({ text: before[i++], change: "removed" });
  while (j < m) out.push({ text: after[j++], change: "added" });
  return out;
}

/** Visible text of a document's HTML, one entry per block, never interpreted as markup. */
export function htmlToLines(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(doc.body.querySelectorAll("p, h1, h2, h3, h4, li, blockquote, pre"));
  const texts = blocks.length ? blocks.map((b) => b.textContent ?? "") : [doc.body.textContent ?? ""];
  return texts.map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
}
