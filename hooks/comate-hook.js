#!/usr/bin/env node
// Clawd Desktop Pet — Comate Hook Script
// Usage: node comate-hook.js <event_name>
// Reads stdin JSON from Comate for session_id

const { postStateToRunningServer, readHostPrefix } = require("./server-config");
const { createPidResolver, readStdinJson, getPlatformConfig } = require("./shared-process");

// Comate 事件 → Clawd 状态映射
const EVENT_TO_STATE = {
  SessionStart: "idle",
  SessionEnd: "sleeping",
  UserPromptSubmit: "thinking",
  PreToolUse: "working",
  PostToolUse: "working",
  PostToolUseFailure: "error",
  Stop: "attention",
};

function buildStateBody(event, payload, resolve) {
  const state = EVENT_TO_STATE[event];
  if (!state) return null;

  // Comate 字段兼容处理
  const sessionId = payload.session_id || payload.sessionId || "default";
  const cwd = payload.cwd || process.env.WORKSPACE_DIR || "";
  const source = payload.source || payload.reason || "";

  // /clear 触发 SessionEnd → SessionStart，显示 sweeping 而非 sleeping
  const resolvedState = (event === "SessionEnd" && source === "clear") ? "sweeping" : state;

  const body = {
    state: resolvedState,
    session_id: sessionId,
    event,
    agent_id: "comate",
  };

  if (cwd) body.cwd = cwd;

  if (process.env.CLAWD_REMOTE) {
    body.host = readHostPrefix();
  } else {
    try {
      const { stablePid, agentPid, detectedEditor, pidChain } = resolve();
      body.source_pid = stablePid;
      if (detectedEditor) body.editor = detectedEditor;
      if (agentPid) body.agent_pid = agentPid;
      if (pidChain.length) body.pid_chain = pidChain;
    } catch {}
  }

  return body;
}

function outputJson(obj) {
  // Comate 期望 stdout 返回 JSON
  console.log(JSON.stringify(obj || {}));
}

async function main() {
  const event = process.argv[2];
  if (!EVENT_TO_STATE[event]) {
    outputJson({});
    process.exit(0);
  }

  const config = getPlatformConfig();
  const resolve = createPidResolver({
    agentNames: { win: new Set(["comate.exe", "node.exe"]), mac: new Set(["comate", "node"]) },
    agentCmdlineCheck: (cmd) => cmd.includes("comate"),
    platformConfig: config,
  });

  // SessionStart 时预先解析 PID
  if (event === "SessionStart" && !process.env.CLAWD_REMOTE) resolve();

  let payload = {};
  try {
    payload = await readStdinJson() || {};
  } catch {}

  const body = buildStateBody(event, payload, resolve);

  if (!body) {
    outputJson({});
    process.exit(0);
  }

  postStateToRunningServer(
    JSON.stringify(body),
    { timeoutMs: 100 },
    () => {
      outputJson({});
      process.exit(0);
    }
  );
}

main().catch(() => {
  outputJson({});
  process.exit(0);
});

module.exports = { buildStateBody, EVENT_TO_STATE };
