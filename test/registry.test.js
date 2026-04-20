const { describe, it } = require("node:test");
const assert = require("node:assert");
const registry = require("../agents/registry");

describe("Agent Registry", () => {
  it("returns only Claude Code and Comate", () => {
    const agents = registry.getAllAgents();
    assert.strictEqual(agents.length, 2);
    assert.deepStrictEqual(
      agents.map((agent) => agent.id),
      ["claude-code", "comate"]
    );
  });

  it("looks up supported agents by ID", () => {
    assert.strictEqual(registry.getAgent("claude-code").name, "Claude Code");
    assert.strictEqual(registry.getAgent("comate").name, "Comate");
    assert.strictEqual(registry.getAgent("nonexistent"), undefined);
  });

  it("keeps the expected process names", () => {
    const claude = registry.getAgent("claude-code");
    assert.deepStrictEqual(claude.processNames.win, ["claude.exe"]);
    assert.deepStrictEqual(claude.processNames.mac, ["claude"]);
    assert.deepStrictEqual(claude.processNames.linux, ["claude"]);

    const comate = registry.getAgent("comate");
    assert.deepStrictEqual(comate.processNames.win, ["comate.exe", "node.exe"]);
    assert.deepStrictEqual(comate.processNames.mac, ["comate", "node"]);
    assert.deepStrictEqual(comate.processNames.linux, ["comate", "node"]);
  });

  it("aggregates process names for the active registry", () => {
    const all = registry.getAllProcessNames();
    const agentIds = [...new Set(all.map((entry) => entry.agentId))];
    assert.deepStrictEqual(agentIds.sort(), ["claude-code", "comate"]);
  });

  it("exposes capabilities for both supported agents", () => {
    const claude = registry.getAgent("claude-code");
    assert.strictEqual(claude.capabilities.httpHook, true);
    assert.strictEqual(claude.capabilities.permissionApproval, true);
    assert.strictEqual(claude.capabilities.sessionEnd, true);
    assert.strictEqual(claude.capabilities.subagent, true);

    const comate = registry.getAgent("comate");
    assert.strictEqual(comate.capabilities.httpHook, true);
    assert.strictEqual(comate.capabilities.permissionApproval, false);
    assert.strictEqual(comate.capabilities.sessionEnd, true);
    assert.strictEqual(comate.capabilities.subagent, false);
  });

  it("keeps hook event maps for both supported agents", () => {
    const claude = registry.getAgent("claude-code");
    assert.strictEqual(claude.eventMap.SessionStart, "idle");
    assert.strictEqual(claude.eventMap.PreToolUse, "working");
    assert.strictEqual(claude.eventMap.Stop, "attention");

    const comate = registry.getAgent("comate");
    assert.strictEqual(comate.eventMap.SessionStart, "idle");
    assert.strictEqual(comate.eventMap.PreToolUse, "working");
    assert.strictEqual(comate.eventMap.Stop, "attention");
  });
});
