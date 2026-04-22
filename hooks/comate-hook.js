#!/usr/bin/env node
// Clawd Desktop Pet — Comate Hook Script
// Usage: node comate-hook.js <event_name>
//
// Comate's command-hook protocol is identical to Claude Code's, so we delegate
// all the logic to clawd-hook.js and just override the agent identity and
// process-detection names.

const { runHook } = require("./clawd-hook.js");

if (require.main === module) {
  runHook({
    agentId: "comate",
    agentNames: {
      win: new Set(["comate.exe", "node.exe"]),
      mac: new Set(["comate", "node"]),
    },
    agentCmdlineCheck: (cmd) => cmd.includes("comate"),
  });
}

module.exports = { runHook };
