// Comate agent configuration
// Comate's hook protocol is identical to Claude Code — only the config file
// path differs (~/.comate/hooks.json vs ~/.claude/settings.json). Event map,
// capabilities and pid fields mirror Claude Code 1:1.

module.exports = {
  id: "comate",
  name: "Zulu / Comate",
  processNames: { win: ["comate.exe", "node.exe"], mac: ["comate", "node"], linux: ["comate", "node"] },
  eventSource: "hook",
  // PascalCase event names — matches Claude Code / Comate hook protocol
  eventMap: {
    SessionStart: "idle",
    SessionEnd: "sleeping",
    UserPromptSubmit: "thinking",
    PreToolUse: "working",
    PostToolUse: "working",
    PostToolUseFailure: "error",
    Stop: "attention",
    StopFailure: "error",
    SubagentStart: "juggling",
    SubagentStop: "working",
    PreCompact: "sweeping",
    PostCompact: "attention",
    Notification: "notification",
    Elicitation: "notification",
  },
  capabilities: {
    httpHook: true,
    permissionApproval: true,  // 与 Claude 一致：通过 HTTP hook 接收 PermissionRequest
    sessionEnd: true,
    subagent: true,
  },
  pidField: "agent_pid",
};
