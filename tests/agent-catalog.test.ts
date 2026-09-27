import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENTS, clientById, clientOf, providerFor, TOKEN_PLACEHOLDER } from "../features/settings/agents/catalog";

test("every guide has three steps and builds its code from the given URL", () => {
  const url = "https://spacie.example.com/api/mcp";
  for (const c of CLIENTS) {
    assert.equal(c.steps.length, 3, c.id);
    assert.ok(c.code(url).includes(url), c.id);
  }
  assert.equal(clientById("claudecode").code(url), `claude mcp add --transport http spacie ${url}`);
  assert.ok(clientById("hermes").code(url).includes(TOKEN_PLACEHOLDER));
  assert.ok(clientById("hermes").code(url, "tok_123").includes("Bearer tok_123"));
  assert.doesNotThrow(() => JSON.parse(clientById("openclaw").code(url, "t")));
});

test("clientOf maps existing agents to their guide", () => {
  assert.equal(clientOf({ provider: "Anthropic", name: "Claude Code" }), "claudecode");
  assert.equal(clientOf({ provider: "Claude", name: "Claude (Lorenzo)" }), "claude");
  assert.equal(clientOf({ provider: "OpenAI", name: "Codex" }), "codex");
  assert.equal(clientOf({ provider: "Hermes", name: "Ops bot" }), "hermes");
  assert.equal(clientOf({ provider: "Custom", name: "OpenClaw" }), "openclaw");
  assert.equal(clientOf({ provider: "Custom", name: "Cursor" }), "other");
  assert.equal(providerFor("other"), "Custom");
  assert.equal(providerFor("hermes"), "Hermes");
});
