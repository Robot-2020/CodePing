// Comate agent configuration
// Adapted from Claude Code agent config for Baidu Comate integration

module.exports = {
  id: "comate",
  name: "Comate",
  processNames: { win: ["comate.exe", "node.exe"], mac: ["comate", "node"], linux: ["comate", "node"] },
  eventSource: "hook",
  // PascalCase event names — matches Comate hook system
  eventMap: {
    SessionStart: "idle",
    SessionEnd: "sleeping",
    UserPromptSubmit: "thinking",
    PreToolUse: "working",
    PostToolUse: "working",
    PostToolUseFailure: "error",
    Stop: "attention",
    // Comate 暂不支持以下事件（保留备用）
    // StopFailure: "error",
    // SubagentStart: "juggling",
    // SubagentStop: "working",
    // PreCompact: "sweeping",
    // PostCompact: "attention",
  },
  capabilities: {
    httpHook: true,        // Comate 支持 HTTP hooks
    permissionApproval: false,  // Comate 使用不同的权限机制
    sessionEnd: true,
    subagent: false,       // 待确认 Comate 是否支持 subagent
  },
  pidField: "agent_pid",
};
