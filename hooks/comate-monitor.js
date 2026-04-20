#!/usr/bin/env node
// Clawd Desktop Pet — Comate Session Monitor
// Monitors ~/.comate-engine/store/chat_session_* files for Comate IDE/Plugin activity.
// Only sends state changes to Clawd (animation + sound), no permission bubbles.

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const { exec } = require("child_process");

// Configuration
const STORE_DIR = path.join(os.homedir(), ".comate-engine", "store");
const POLL_INTERVAL_MS = 1000;
const CLAWD_PORT = 23333;
const TOP_N_FILES = 5;
const PROCESS_CHECK_INTERVAL_MS = 5000;  // 每5秒检查一次进程是否存活
const SESSION_IDLE_TIMEOUT_MS = 120000;  // 2分钟：文件未更新时重新解析确认状态

// Diagnostic mode - set to true to enable detailed logging
const DIAGNOSTIC_MODE = process.env.COMATE_DIAGNOSTIC === "1";

// Status values that indicate "running" state
const RUNNING_STATUSES = new Set([
  "inProgress", "in_progress", "running",
  "RUNNING", "generating", "analyzing",
  "thinking", "processing", "pending",
  "streaming", "typing", "working"
]);

// State tracking
let lastState = null;
let lastPendingToolKey = null;
let fileCache = new Map();
let knownFiles = new Set();  // 跟踪已知的会话文件
let permissionReminderTimer = null;  // 权限提醒定时器
let permissionReminderCount = 0;     // 提醒次数
const PERMISSION_REMINDER_INTERVAL = 60000;  // 60秒提醒一次

// Process monitoring
let lastProcessCheckTime = 0;
let comateProcessAlive = true;  // 假设启动时 Comate 进程存在

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

// Diagnostic logging - only when DIAGNOSTIC_MODE is enabled
function diagnosticLog(label, data) {
  if (!DIAGNOSTIC_MODE) return;
  const ts = new Date().toISOString();
  console.log(`[${ts}] [DIAGNOSTIC] ${label}`);
  console.log(JSON.stringify(data, null, 2));
  console.log("─".repeat(80));
}

function postStateToClawdSync(state, event) {
  const body = JSON.stringify({
    state,
    event,
    session_id: "comate-monitor",
    agent_id: "comate",
  });

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

// 检测 Comate 进程是否存活
function checkComateProcess(callback) {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: 使用 wmic 查找 comate.exe 或 node.exe with comate
    exec(
      'wmic process where "(Name=\'comate.exe\' or (Name=\'node.exe\' and CommandLine like \'%comate%\'))" get ProcessId /format:csv',
      { encoding: "utf8", timeout: 3000, windowsHide: true },
      (err, stdout) => {
        if (err) {
          callback(false);
          return;
        }
        // 检查输出是否包含有效的 PID
        const hasProcess = /\d+/.test(stdout);
        callback(hasProcess);
      }
    );
  } else {
    // macOS/Linux: 使用 pgrep 查找 comate 进程
    exec("pgrep -f comate", { timeout: 3000 }, (err, stdout) => {
      if (err) {
        callback(false);
        return;
      }
      // pgrep 返回 PIDs，如果有输出说明进程存在
      const hasProcess = stdout.trim().length > 0;
      callback(hasProcess);
    });
  }
}

// 格式化工具参数用于日志
function formatToolInfo(pendingTool) {
  const { toolName, params } = pendingTool;
  let detail = "";
  
  if (toolName === "run_command" && params.command) {
    detail = params.command;
  } else if (toolName === "edit_file" && params.file_path) {
    detail = params.file_path;
  } else if (toolName === "write_file" && params.path) {
    detail = params.path;
  } else if (toolName === "read_file" && params.target_file) {
    detail = params.target_file;
  } else if (toolName === "delete_file" && params.file_path) {
    detail = params.file_path;
  } else {
    detail = JSON.stringify(params).slice(0, 80);
  }
  
  return { toolName, detail };
}

function parseSessionFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);
    
    if (!data.messages || !Array.isArray(data.messages)) {
      return { state: "idle", summary: null, pendingTool: null };
    }

    const recentMessages = data.messages.slice(-5);
    let pendingTool = null;
    
    for (const msg of recentMessages.reverse()) {
      if (msg.role === "assistant") {
        if (RUNNING_STATUSES.has(msg.status)) {
          let hasPendingTool = false;
          let hasWorkingTool = false;

          // 检查工具状态
          // Comate 的权限请求：toolState === "executing" && result.metadata.state === "pending"
          // Comate 的执行中：toolState === "executing" && 没有 pending
          // Comate 的已完成：toolState === "executed"
          let toolStates = []; // For diagnostic logging
          if (msg.elements && Array.isArray(msg.elements)) {
            for (const el of msg.elements) {
              if (el.children && Array.isArray(el.children)) {
                for (const child of el.children) {
                  if (child.type === "TOOL") {
                    toolStates.push({
                      toolName: child.toolName,
                      toolState: child.toolState,
                      isPending: child.result?.metadata?.state === "pending",
                    });

                    // 检查是否是权限请求
                    if (child.toolState === "executing" &&
                        child.result?.metadata?.state === "pending") {
                      hasPendingTool = true;
                      pendingTool = {
                        toolName: child.toolName,
                        params: child.params || {},
                      };
                      break;
                    }
                    // 检查是否有正在执行的工具（非 pending）
                    if (child.toolState === "executing") {
                      hasWorkingTool = true;
                    }
                  }
                }
              }
              if (hasPendingTool) break;
            }
          }

          // Diagnostic logging
          diagnosticLog("parseSessionFile result", {
            filePath: path.basename(filePath),
            msgStatus: msg.status,
            hasPendingTool,
            hasWorkingTool,
            toolStates,
            decidedState: hasPendingTool ? "notification" : "working",
            reasoning: hasPendingTool
              ? "Has pending tool (permission needed) - sending notification for audio alert"
              : "msg.status is inProgress - treating as working",
          });

          // 有 pending 工具 = 需要权限（Comate 在 IDE 里处理，发送 notification 触发音效）
          if (hasPendingTool) {
            return {
              state: "notification",
              summary: msg.summary || data.summary || null,
              pendingTool,
            };
          }

          // msg.status 是 inProgress = 正在工作（思考、生成文本、或执行工具）
          // 信任 msg.status，因为当任务完成时 Comate 会更新这个字段
          return {
            state: "working",
            summary: msg.summary || data.summary || null,
            pendingTool: null,
          };
        }
      }
    }

    return { state: "idle", summary: data.summary || null, pendingTool: null };
  } catch (err) {
    return { state: "idle", summary: null, pendingTool: null };
  }
}

function poll() {
  const now = Date.now();

  // 定期检查 Comate 进程是否存活（每5秒检查一次）
  if (now - lastProcessCheckTime >= PROCESS_CHECK_INTERVAL_MS) {
    lastProcessCheckTime = now;
    checkComateProcess((alive) => {
      const wasAlive = comateProcessAlive;
      comateProcessAlive = alive;

      // 如果进程从存活变为退出，且当前状态不是 idle
      if (wasAlive && !alive && lastState !== "idle") {
        log("Comate process exited, forcing session end");
        // 清除权限提醒定时器
        if (permissionReminderTimer) {
          clearInterval(permissionReminderTimer);
          permissionReminderTimer = null;
          permissionReminderCount = 0;
        }
        // 强制发送完成动画 + 回到 idle
        postStateToClawdSync("attention", "Stop");
        lastState = "idle";
        lastPendingToolKey = null;
        // 清空文件缓存，下次 Comate 启动时重新开始
        fileCache.clear();
        knownFiles.clear();
      }
    });
  }

  if (!fs.existsSync(STORE_DIR)) {
    updateState("idle", null);
    return;
  }

  let files;
  try {
    files = fs.readdirSync(STORE_DIR)
      .filter(name => name.startsWith("chat_session_"))
      .map(name => {
        const fullPath = path.join(STORE_DIR, name);
        try {
          const stat = fs.statSync(fullPath);
          return { path: fullPath, mtime: stat.mtime, size: stat.size };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, TOP_N_FILES);
  } catch (err) {
    updateState("idle", null);
    return;
  }

  let detectedState = "idle";
  let detectedPendingTool = null;

  // 检测是否有新的会话文件创建
  const currentFiles = new Set(files.map(f => f.path));
  let hasNewFile = false;
  for (const filePath of currentFiles) {
    if (!knownFiles.has(filePath)) {
      hasNewFile = true;
      log(`New session file detected: ${path.basename(filePath)}`);
    }
  }
  
  // 如果有新文件，清除缓存强制重新解析所有文件
  if (hasNewFile) {
    log("Clearing cache due to new session file");
    fileCache.clear();
  }
  
  // 更新已知文件列表
  knownFiles = currentFiles;

  for (const file of files) {
    const fileAge = now - file.mtime.getTime();
    const cached = fileCache.get(file.path);

    // 文件未变化 → 使用缓存的状态（避免重复解析）
    if (cached && cached.mtime.getTime() === file.mtime.getTime() && cached.size === file.size) {
      // **超时检测**：如果文件超过 2 分钟没有更新，且缓存状态是 working/notification
      // 重新解析文件确认任务是否真的还在执行
      if (fileAge > SESSION_IDLE_TIMEOUT_MS &&
          (cached.state === "working" || cached.state === "notification")) {
        log(`File stale (${Math.round(fileAge / 1000)}s), re-parsing: ${path.basename(file.path)}`);
        const result = parseSessionFile(file.path);
        fileCache.set(file.path, {
          mtime: file.mtime,
          size: file.size,
          state: result.state,
          pendingTool: result.pendingTool,
        });

        // 使用重新解析后的真实状态
        if (result.state === "notification") {
          detectedState = "notification";
          detectedPendingTool = result.pendingTool;
          break;
        } else if (result.state === "working" && detectedState !== "notification") {
          detectedState = "working";
        }
        continue;
      }

      // 文件未超时，使用缓存
      if (cached.state === "notification") {
        detectedState = "notification";
        detectedPendingTool = cached.pendingTool;
        break;
      } else if (cached.state === "working" && detectedState !== "notification") {
        detectedState = "working";
      }
      continue;
    }

    // 文件有变化 → 重新解析，获取当前真实状态
    const result = parseSessionFile(file.path);
    fileCache.set(file.path, {
      mtime: file.mtime,
      size: file.size,
      state: result.state,
      pendingTool: result.pendingTool,
    });

    if (DIAGNOSTIC_MODE) {
      diagnosticLog("File parsed", {
        path: path.basename(file.path),
        fileAge: Math.round(fileAge / 1000) + "s",
        detectedState: result.state,
        hasPendingTool: !!result.pendingTool,
      });
    }

    if (result.state === "notification") {
      detectedState = "notification";
      detectedPendingTool = result.pendingTool;
      break;
    } else if (result.state === "working" && detectedState !== "notification") {
      detectedState = "working";
    }
  }

  updateState(detectedState, detectedPendingTool);
}

function updateState(newState, pendingTool) {
  // 处理 notification 状态（需要权限确认）- 只发送动画，不弹窗
  if (newState === "notification" && pendingTool) {
    const toolKey = JSON.stringify(pendingTool);

    // 新的工具请求，发送 notification 状态触发动画
    if (lastPendingToolKey !== toolKey) {
      lastPendingToolKey = toolKey;

      const { toolName, detail } = formatToolInfo(pendingTool);
      log(`Permission needed: ${toolName} - ${detail}`);

      // 发送 notification 状态（触发 confirm 音效）
      postStateToClawdSync("notification", "PermissionRequest");
      lastState = "notification";

      // 启动定时提醒（每 60 秒提醒一次）
      if (permissionReminderTimer) {
        clearInterval(permissionReminderTimer);
      }
      permissionReminderCount = 0;

      permissionReminderTimer = setInterval(() => {
        permissionReminderCount++;
        log(`Permission reminder #${permissionReminderCount}: ${toolName}`);

        // 重新发送 notification 提醒
        postStateToClawdSync("notification", "PermissionRequest");

        // 短暂延迟后切回 working 状态
        setTimeout(() => {
          postStateToClawdSync("working", "PreToolUse");
        }, 2000);  // 2秒后切回 working
      }, PERMISSION_REMINDER_INTERVAL);
    }
    // 保持 notification 状态，等待用户在 IDE 中确认/忽略
    return;
  }

  // 非 notification 状态时清理定时器
  if (newState !== "notification") {
    lastPendingToolKey = null;
    if (permissionReminderTimer) {
      clearInterval(permissionReminderTimer);
      permissionReminderTimer = null;
      permissionReminderCount = 0;
      log("Permission reminder stopped");
    }
  }
  
  // 状态变化处理
  if (newState !== lastState) {
    // Diagnostic logging on state change
    diagnosticLog("State transition", {
      from: lastState,
      to: newState,
      timestamp: new Date().toISOString(),
      reason: newState === "working"
        ? "Detected working state from session file"
        : newState === "idle" && (lastState === "working" || lastState === "notification")
        ? "No active sessions detected, transitioning to idle (will send attention/Stop for completion animation)"
        : "State changed",
    });

    if (newState === "working") {
      log(`State changed: ${lastState} -> working`);
      postStateToClawdSync("working", "PreToolUse");
      lastState = "working";
    } else if (newState === "idle") {
      // 如果从工作状态或注意状态变为空闲，发送 attention 状态
      // attention 是单次性状态，会自动播放"完成"动画并回退到 idle
      if (lastState === "working" || lastState === "notification") {
        log(`State changed: ${lastState} -> attention (task completed, will auto-return to idle)`);
        postStateToClawdSync("attention", "Stop");
        lastState = "idle";  // 直接设为 idle，因为 attention 会自动回退
      } else {
        log(`State changed: ${lastState} -> idle`);
        postStateToClawdSync("idle", "SessionEnd");
        lastState = "idle";
      }
    }
  }
}

function main() {
  log("Comate Monitor started (animation only, no bubbles)");
  log(`Watching: ${STORE_DIR}`);
  log(`Poll interval: ${POLL_INTERVAL_MS}ms`);
  log(`Clawd port: ${CLAWD_PORT}`);

  if (DIAGNOSTIC_MODE) {
    log("🔍 DIAGNOSTIC MODE ENABLED - Detailed logging is active");
    log("This will show file parsing details and state transitions");
  } else {
    log("ℹ️  Tip: Set COMATE_DIAGNOSTIC=1 to enable detailed diagnostic logging");
  }

  if (!fs.existsSync(STORE_DIR)) {
    log(`Warning: Store directory does not exist: ${STORE_DIR}`);
    log("Will start monitoring when directory is created.");
  }

  poll();
  setInterval(poll, POLL_INTERVAL_MS);

  const cleanup = () => {
    if (permissionReminderTimer) {
      clearInterval(permissionReminderTimer);
    }
    if (lastState !== "idle") {
      postStateToClawdSync("idle", "SessionEnd");
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  log("Monitoring... Press Ctrl+C to stop.");
}

main();
