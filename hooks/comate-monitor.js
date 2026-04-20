#!/usr/bin/env node
// Clawd Desktop Pet — Comate Session Monitor (v2)
// Monitors ~/.comate-engine/store/chat_session_* files for Comate IDE/Plugin activity.
// Infers events from session file changes and posts state updates to Clawd server.

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { exec } = require("child_process");

// ─── Configuration ───────────────────────────────────────────────────────────

const STORE_DIR = path.join(os.homedir(), ".comate-engine", "store");
const POLL_INTERVAL_MS = 1000;
const CLAWD_PORT = 23333;
const TOP_N_FILES = 5;
const COMPLETION_GRACE_MS = 15000;        // 15s: inProgress + file stale → infer completion
const SESSION_IDLE_TIMEOUT_MS = 300000;   // 5min: idle session → send SessionEnd
const PROCESS_CHECK_INTERVAL_MS = 10000;  // 10s: check if Comate process is alive
const PERMISSION_REMINDER_INTERVAL_MS = 60000; // 60s: re-send notification for pending permission

// Terminal tool states — tool is done (no further updates expected)
const TERMINAL_TOOL_STATES = new Set(["executed", "failed", "cancelled", "skipped"]);

// Diagnostic mode
const DIAGNOSTIC_MODE = process.env.COMATE_DIAGNOSTIC === "1";

// ─── State Tracking ──────────────────────────────────────────────────────────

// Map<filePath, TrackedSession>
// TrackedSession: {
//   sessionId: string,
//   lastMtime: number,
//   lastSize: number,
//   messageCount: number,
//   lastAssistantStatus: string|null,
//   inferredState: string,       // idle/thinking/working/notification
//   lastActiveAt: number,        // timestamp when file last changed
//   cwd: string|null,
//   title: string|null,
//   lastPendingToolKey: string|null,  // JSON key of last notified pending tool
//   permissionSentAt: number,         // timestamp of last permission notification
//   lastReportedFailedTools: Set,     // tool indices already reported as error
//   allToolsTerminal: boolean,        // cached from last parse
//   lastParsed: object|null,          // last parseSessionFile result
// }
const trackedSessions = new Map();

// Sessions we've already timed out — don't re-add them as "new"
// Cleared when a dismissed file's mtime changes (meaning new activity)
const dismissedSessions = new Map(); // Map<filePath, lastKnownMtime>

let isFirstPoll = true;
let lastProcessCheckTime = 0;
let comateProcessAlive = true;

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function diagnosticLog(label, data) {
  if (!DIAGNOSTIC_MODE) return;
  const ts = new Date().toISOString();
  console.log(`[${ts}] [DIAG] ${label}`);
  console.log(JSON.stringify(data, null, 2));
  console.log("\u2500".repeat(80));
}

// ─── POST /state ─────────────────────────────────────────────────────────────

function postState(state, event, sessionId, extra = {}) {
  const body = JSON.stringify({
    state,
    event,
    session_id: sessionId || "comate-monitor",
    agent_id: "comate",
    ...extra,
  });

  diagnosticLog("postState", { state, event, sessionId, extra });

  const req = http.request({
    hostname: "127.0.0.1",
    port: CLAWD_PORT,
    path: "/state",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    timeout: 500,
  });

  req.on("error", () => {});
  req.write(body);
  req.end();
}

// ─── Process Detection ───────────────────────────────────────────────────────

function checkComateProcess(callback) {
  if (process.platform === "win32") {
    exec(
      'wmic process where "(Name=\'comate.exe\' or (Name=\'node.exe\' and CommandLine like \'%comate%\'))" get ProcessId /format:csv',
      { encoding: "utf8", timeout: 3000, windowsHide: true },
      (err, stdout) => {
        callback(!err && /\d+/.test(stdout));
      }
    );
  } else {
    exec("pgrep -f comate", { timeout: 3000 }, (err, stdout) => {
      callback(!err && stdout.trim().length > 0);
    });
  }
}

// ─── parseSessionFile ────────────────────────────────────────────────────────
// Returns a structured snapshot of the session file, no state inference here.

function parseSessionFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);

    if (!data.messages || !Array.isArray(data.messages)) {
      return null;
    }

    const sessionUuid = data.sessionUuid || path.basename(filePath).replace("chat_session_", "");
    const title = data.title || null;
    const cwd = data.workspaceDirectory || null;
    const messageCount = data.messages.length;

    // Find last user and last assistant message
    let lastMsgRole = null;
    let lastAssistantMsg = null;
    let lastAssistantIndex = -1;

    for (let i = data.messages.length - 1; i >= 0; i--) {
      const msg = data.messages[i];
      if (!lastMsgRole) lastMsgRole = msg.role;
      if (msg.role === "assistant" && !lastAssistantMsg) {
        lastAssistantMsg = msg;
        lastAssistantIndex = i;
        break;
      }
    }

    const lastAssistantStatus = lastAssistantMsg ? (lastAssistantMsg.status || null) : null;

    // Scan tools in the last assistant message
    let pendingTool = null;
    let hasNonTerminalTool = false;
    let allToolsTerminal = true;
    let hasAnyTool = false;
    const failedToolIndices = [];

    if (lastAssistantMsg && lastAssistantMsg.elements) {
      let toolIndex = 0;
      for (const el of lastAssistantMsg.elements) {
        if (!el.children || !Array.isArray(el.children)) continue;
        for (const child of el.children) {
          if (child.type !== "TOOL") continue;
          hasAnyTool = true;
          const ts = child.toolState;
          const metaState = child.result?.metadata?.state;

          // Permission request: executing + metadata pending
          if (ts === "executing" && metaState === "pending") {
            pendingTool = {
              toolName: child.toolName,
              params: child.params || {},
              index: toolIndex,
            };
          }

          // Non-terminal tool: executing (non-pending) or pending
          if (ts === "executing" && metaState !== "pending") {
            hasNonTerminalTool = true;
          }
          if (ts === "pending") {
            hasNonTerminalTool = true;
          }

          // Terminal check
          if (!TERMINAL_TOOL_STATES.has(ts)) {
            allToolsTerminal = false;
          }

          // Failed tools
          if (ts === "failed") {
            failedToolIndices.push(toolIndex);
          }

          toolIndex++;
        }
      }
    }

    // If no tools, allToolsTerminal is true (vacuously)
    if (!hasAnyTool) allToolsTerminal = true;

    const summary = lastAssistantMsg?.summary || data.summary || null;

    return {
      sessionUuid,
      title,
      cwd,
      messageCount,
      lastMsgRole,
      lastAssistantStatus,
      pendingTool,
      hasNonTerminalTool,
      failedToolIndices,
      allToolsTerminal,
      hasAnyTool,
      summary,
    };
  } catch (err) {
    diagnosticLog("parseSessionFile error", { filePath: path.basename(filePath), error: err.message });
    return null;
  }
}

// ─── inferState ──────────────────────────────────────────────────────────────
// Compare previous tracked state with new parsed snapshot to infer CodePing state.

function inferState(tracked, parsed) {
  if (!parsed) {
    return { state: tracked ? tracked.inferredState : "idle", event: null };
  }

  const { lastAssistantStatus, pendingTool, hasNonTerminalTool, failedToolIndices, allToolsTerminal, hasAnyTool, messageCount } = parsed;
  const prevState = tracked ? tracked.inferredState : "idle";
  const prevMessageCount = tracked ? tracked.messageCount : 0;
  const prevReportedFailed = tracked ? tracked.lastReportedFailedTools : new Set();

  // Priority 1: Permission request
  if (pendingTool) {
    return { state: "notification", event: "PermissionRequest", pendingTool };
  }

  // Priority 2: New failed tool (not previously reported)
  const newFailed = failedToolIndices.filter(i => !prevReportedFailed.has(i));
  if (newFailed.length > 0) {
    return { state: "error", event: "PostToolUseFailure", newFailedIndices: newFailed };
  }

  // Priority 3: status=inProgress + has non-terminal tools (executing/pending)
  if (lastAssistantStatus === "inProgress" && hasNonTerminalTool) {
    return { state: "working", event: "PreToolUse" };
  }

  // Priority 4: status=inProgress + all tools terminal + has tools
  // AI is generating text between tool calls, or preparing next tool
  if (lastAssistantStatus === "inProgress" && allToolsTerminal && hasAnyTool) {
    return { state: "working", event: null };
  }

  // Priority 5: status=inProgress + no tools (pure text generation / AI thinking)
  if (lastAssistantStatus === "inProgress" && !hasAnyTool) {
    // New question: message count increased or prev was idle
    if (prevState === "idle" || messageCount > prevMessageCount) {
      return { state: "thinking", event: "UserPromptSubmit" };
    }
    // Maintain current state (thinking stays thinking, working stays working)
    return { state: prevState === "idle" ? "thinking" : prevState, event: null };
  }

  // Priority 6: Completed or cancelled
  if (lastAssistantStatus === "success" || lastAssistantStatus === "cancelled") {
    if (prevState === "working" || prevState === "thinking" || prevState === "notification") {
      return { state: "attention", event: "Stop" };
    }
    return { state: "idle", event: null };
  }

  // Default: idle
  return { state: "idle", event: null };
}

// ─── Format tool info for logging ────────────────────────────────────────────

function formatToolInfo(pendingTool) {
  const { toolName, params } = pendingTool;
  let detail = "";
  if (toolName === "run_command" && params.command) detail = params.command;
  else if (toolName === "edit_file" && params.file_path) detail = params.file_path;
  else if (toolName === "write_file" && params.path) detail = params.path;
  else if (toolName === "read_file" && params.target_file) detail = params.target_file;
  else if (toolName === "delete_file" && params.file_path) detail = params.file_path;
  else detail = JSON.stringify(params).slice(0, 80);
  return { toolName, detail };
}

// ─── Handle state transition for a single session ────────────────────────────

function handleSessionUpdate(filePath, tracked, inferred, parsed) {
  const sessionId = tracked.sessionId;
  const prevState = tracked.inferredState;
  const extra = {};
  if (tracked.cwd) extra.cwd = tracked.cwd;
  if (tracked.title) extra.session_title = tracked.title;

  // --- notification (permission request) ---
  if (inferred.state === "notification" && inferred.pendingTool) {
    const toolKey = `${inferred.pendingTool.toolName}:${inferred.pendingTool.index}`;
    const now = Date.now();

    // Ensure session exists as "working" before sending PermissionRequest
    if (prevState !== "working" && prevState !== "thinking") {
      postState("working", "PreToolUse", sessionId, extra);
    }

    // Check if this is a new pending tool or a reminder is due
    if (tracked.lastPendingToolKey !== toolKey) {
      // New pending tool → send notification
      const { toolName, detail } = formatToolInfo(inferred.pendingTool);
      log(`Permission needed: ${toolName} - ${detail}`);
      postState("notification", "PermissionRequest", sessionId, extra);
      tracked.lastPendingToolKey = toolKey;
      tracked.permissionSentAt = now;
    } else if (now - tracked.permissionSentAt >= PERMISSION_REMINDER_INTERVAL_MS) {
      // Same pending tool but reminder interval elapsed → re-send
      log(`Permission reminder: ${inferred.pendingTool.toolName}`);
      postState("notification", "PermissionRequest", sessionId, extra);
      tracked.permissionSentAt = now;
    }
    // else: same tool, within reminder interval → do nothing

    tracked.inferredState = "notification";
    return;
  }

  // Clear permission tracking when no longer in notification
  if (inferred.state !== "notification") {
    tracked.lastPendingToolKey = null;
    tracked.permissionSentAt = 0;
  }

  // --- error (tool failure) ---
  if (inferred.state === "error") {
    log(`Tool failed in session ${sessionId}`);
    postState("error", "PostToolUseFailure", sessionId, extra);
    // Record reported failed tools
    if (inferred.newFailedIndices) {
      for (const idx of inferred.newFailedIndices) {
        tracked.lastReportedFailedTools.add(idx);
      }
    }
    // Don't change inferredState to error — it's oneshot, server handles auto-return
    // Keep tracked state as working so we can detect completion later
    return;
  }

  // --- attention (completion) ---
  if (inferred.state === "attention") {
    if (prevState !== "idle") {
      log(`Completed: ${prevState} -> attention (session ${sessionId})`);
      postState("attention", "Stop", sessionId, extra);
    }
    tracked.inferredState = "idle";
    tracked.lastReportedFailedTools.clear();
    return;
  }

  // --- thinking ---
  if (inferred.state === "thinking" && prevState !== "thinking") {
    log(`State: ${prevState} -> thinking (session ${sessionId})`);
    postState("thinking", "UserPromptSubmit", sessionId, extra);
    tracked.inferredState = "thinking";
    return;
  }

  // --- working ---
  if (inferred.state === "working" && prevState !== "working") {
    log(`State: ${prevState} -> working (session ${sessionId})`);
    postState("working", "PreToolUse", sessionId, extra);
    tracked.inferredState = "working";
    return;
  }

  // --- idle (from non-idle) ---
  if (inferred.state === "idle" && prevState !== "idle") {
    log(`State: ${prevState} -> idle (session ${sessionId})`);
    postState("idle", null, sessionId, extra);
    tracked.inferredState = "idle";
    tracked.lastReportedFailedTools.clear();
    return;
  }

  // No state change — just update inferredState silently
  tracked.inferredState = inferred.state;
}

// ─── Poll Loop ───────────────────────────────────────────────────────────────

function poll() {
  const now = Date.now();

  // Process check
  if (now - lastProcessCheckTime >= PROCESS_CHECK_INTERVAL_MS) {
    lastProcessCheckTime = now;
    checkComateProcess((alive) => {
      const wasAlive = comateProcessAlive;
      comateProcessAlive = alive;
      if (wasAlive && !alive) {
        log("Comate process exited, ending all sessions");
        for (const [fp, tracked] of trackedSessions) {
          if (tracked.inferredState !== "idle") {
            postState("sleeping", "SessionEnd", tracked.sessionId);
          }
        }
        trackedSessions.clear();
        dismissedSessions.clear();
      }
    });
  }

  if (!fs.existsSync(STORE_DIR)) return;

  // Scan session files, sorted by mtime descending
  let files;
  try {
    files = fs.readdirSync(STORE_DIR)
      .filter(name => name.startsWith("chat_session_"))
      .map(name => {
        const fullPath = path.join(STORE_DIR, name);
        try {
          const stat = fs.statSync(fullPath);
          return { path: fullPath, mtime: stat.mtime.getTime(), size: stat.size };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, TOP_N_FILES);
  } catch { return; }

  const currentPaths = new Set(files.map(f => f.path));

  // Detect disappeared sessions
  for (const [fp, tracked] of trackedSessions) {
    if (!currentPaths.has(fp)) {
      if (tracked.inferredState !== "idle") {
        log(`Session file disappeared: ${path.basename(fp)}`);
        postState("sleeping", "SessionEnd", tracked.sessionId);
      }
      trackedSessions.delete(fp);
    }
  }

  // Process each file
  for (const file of files) {
    const tracked = trackedSessions.get(file.path);

    // ── New session file ──
    if (!tracked) {
      // Check if this was previously dismissed (timed out)
      const dismissedMtime = dismissedSessions.get(file.path);
      if (dismissedMtime !== undefined) {
        if (file.mtime === dismissedMtime) {
          // File hasn't changed since dismissal — skip
          continue;
        }
        // File has new activity — un-dismiss it
        dismissedSessions.delete(file.path);
      }

      const parsed = parseSessionFile(file.path);
      if (!parsed) continue;

      const sessionId = parsed.sessionUuid;
      const newTracked = {
        sessionId,
        lastMtime: file.mtime,
        lastSize: file.size,
        messageCount: parsed.messageCount,
        lastAssistantStatus: parsed.lastAssistantStatus,
        inferredState: "idle",
        lastActiveAt: now,
        cwd: parsed.cwd,
        title: parsed.title,
        lastPendingToolKey: null,
        permissionSentAt: 0,
        lastReportedFailedTools: new Set(),
        allToolsTerminal: parsed.allToolsTerminal,
        lastParsed: parsed,
      };

      trackedSessions.set(file.path, newTracked);

      // First poll: initialize only, don't send events
      // Skip already-idle old sessions to avoid tracking stale files
      if (isFirstPoll) {
        const inferred = inferState(null, parsed);
        if (inferred.state !== "idle") {
          // Active session — track it with inferred state (but don't post)
          newTracked.inferredState = inferred.state;
          log(`Init: ${sessionId} -> ${inferred.state} (${path.basename(file.path)})`);
        } else {
          const fileAge = now - file.mtime;
          if (fileAge > SESSION_IDLE_TIMEOUT_MS) {
            // Old idle session — dismiss immediately
            trackedSessions.delete(file.path);
            dismissedSessions.set(file.path, file.mtime);
          }
        }
        continue;
      }

      // Send SessionStart
      const extra = {};
      if (parsed.cwd) extra.cwd = parsed.cwd;
      if (parsed.title) extra.session_title = parsed.title;
      log(`New session: ${sessionId} (${path.basename(file.path)})`);
      postState("idle", "SessionStart", sessionId, extra);

      // Immediately infer current state
      const inferred = inferState(null, parsed);
      if (inferred.state !== "idle") {
        handleSessionUpdate(file.path, newTracked, inferred, parsed);
      }
      continue;
    }

    // ── Existing session: check for changes ──
    const fileChanged = file.mtime !== tracked.lastMtime || file.size !== tracked.lastSize;

    if (fileChanged) {
      // File changed → parse and infer
      const parsed = parseSessionFile(file.path);
      if (!parsed) continue;

      tracked.lastMtime = file.mtime;
      tracked.lastSize = file.size;
      tracked.lastActiveAt = now;
      tracked.cwd = parsed.cwd || tracked.cwd;
      tracked.title = parsed.title || tracked.title;
      tracked.allToolsTerminal = parsed.allToolsTerminal;
      tracked.lastParsed = parsed;

      const inferred = inferState(tracked, parsed);

      diagnosticLog("poll:fileChanged", {
        file: path.basename(file.path),
        prevState: tracked.inferredState,
        inferredState: inferred.state,
        inferredEvent: inferred.event,
        lastAssistantStatus: parsed.lastAssistantStatus,
        hasNonTerminalTool: parsed.hasNonTerminalTool,
        allToolsTerminal: parsed.allToolsTerminal,
        pendingTool: !!parsed.pendingTool,
      });

      handleSessionUpdate(file.path, tracked, inferred, parsed);

      // Update tracked snapshot fields
      tracked.messageCount = parsed.messageCount;
      tracked.lastAssistantStatus = parsed.lastAssistantStatus;

    } else {
      // File not changed
      const fileAge = now - tracked.lastMtime;

      // Working/thinking + file stale → infer completion
      if ((tracked.inferredState === "working" || tracked.inferredState === "thinking") &&
          fileAge > COMPLETION_GRACE_MS) {
        log(`File stale ${Math.round(fileAge / 1000)}s, inferring completion: ${path.basename(file.path)}`);
        const extra = {};
        if (tracked.cwd) extra.cwd = tracked.cwd;
        if (tracked.title) extra.session_title = tracked.title;
        postState("attention", "Stop", tracked.sessionId, extra);
        tracked.inferredState = "idle";
        tracked.lastReportedFailedTools.clear();
        continue;
      }

      // Notification + reminder interval elapsed → re-send permission notification
      if (tracked.inferredState === "notification" &&
          tracked.lastPendingToolKey &&
          now - tracked.permissionSentAt >= PERMISSION_REMINDER_INTERVAL_MS) {
        log(`Permission reminder: session ${tracked.sessionId}`);
        const extra = {};
        if (tracked.cwd) extra.cwd = tracked.cwd;
        if (tracked.title) extra.session_title = tracked.title;
        postState("notification", "PermissionRequest", tracked.sessionId, extra);
        tracked.permissionSentAt = now;
        continue;
      }

      // Idle + long inactive → SessionEnd
      const idleAge = now - tracked.lastActiveAt;
      if (tracked.inferredState === "idle" && idleAge > SESSION_IDLE_TIMEOUT_MS) {
        log(`Session idle timeout (${Math.round(idleAge / 1000)}s inactive): ${path.basename(file.path)}`);
        postState("sleeping", "SessionEnd", tracked.sessionId);
        dismissedSessions.set(file.path, tracked.lastMtime);
        trackedSessions.delete(file.path);
        continue;
      }
    }
  }

  // First poll done
  if (isFirstPoll) {
    isFirstPoll = false;
    log(`Initialized with ${trackedSessions.size} tracked session(s)`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  log("Comate Monitor v2 started");
  log(`Watching: ${STORE_DIR}`);
  log(`Poll: ${POLL_INTERVAL_MS}ms | Grace: ${COMPLETION_GRACE_MS / 1000}s | Idle timeout: ${SESSION_IDLE_TIMEOUT_MS / 1000}s`);

  if (DIAGNOSTIC_MODE) {
    log("DIAGNOSTIC MODE ENABLED");
  }

  if (!fs.existsSync(STORE_DIR)) {
    log(`Warning: ${STORE_DIR} does not exist yet`);
  }

  // Initial poll
  poll();
  setInterval(poll, POLL_INTERVAL_MS);

  // Cleanup on exit
  const cleanup = () => {
    for (const [fp, tracked] of trackedSessions) {
      if (tracked.inferredState !== "idle") {
        postState("sleeping", "SessionEnd", tracked.sessionId);
      }
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  log("Monitoring... Press Ctrl+C to stop.");
}

main();
