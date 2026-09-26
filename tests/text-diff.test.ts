import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines } from "../features/file/text-diff";

test("diffLines marks added and removed lines around unchanged ones", () => {
  assert.deepEqual(diffLines(["a", "b", "c"], ["a", "c", "d"]), [
    { text: "a", change: "same" },
    { text: "b", change: "removed" },
    { text: "c", change: "same" },
    { text: "d", change: "added" },
  ]);
  assert.deepEqual(diffLines([], ["x"]), [{ text: "x", change: "added" }]);
  assert.deepEqual(diffLines(["x"], []), [{ text: "x", change: "removed" }]);
});
