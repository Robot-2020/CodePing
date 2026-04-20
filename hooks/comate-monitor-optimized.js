#!/usr/bin/env node
// Clawd Desktop Pet — Comate Session Monitor (Optimized)
// 混合监听模式：fs.watch + 轮询兜底，延迟 ~100ms

const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

// Configuration
const STORE_DIR = path.join(os.homedir(), ".comate-engine", "store");
const POLL_INTERVAL_MS = 5000;      // 轮询兜底（5秒）
const WATCH_DEBOUNCE_MS = 150;      // 文件监听防抖（150ms）
const ACTIVE_TIMEOUT_MS = 30000;    // 文件超时（30秒）
const COMPLETION_CONFIRMATION_MS = 2000;  // 会话完成推迟确认（2秒）
const CLAWD_PORT = 23333;
const TOP_N_FILES = 5;

// Status values that indicate "running" state
const RUNNING_STATUSES = new Set([
  "inProgress", "in_progress", "running",
  "RUNNING", "generating", "analyzing"
]);

// State tracking
let lastState = null;
let lastPendingToolKey = null;
let fileCache = new Map();
let hasBeenActive = false;
let permissionReminderTimer = null;  // 权限提醒定时器
let permissionReminderCount = 0;     // 提醒次数
let completionLockTimer = null;      // 会话完成锁定（防止缓存复用导致状态反复）
const PERMISSION_REMINDER_INTERVAL = 60000;  // 60秒提醒一次

// Watch state
let watchDebounceTimer = null;
let watcher = null;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
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
          if (msg.elements && Array.isArray(msg.elements)) {
            for (const el of msg.elements) {
              if (el.children && Array.isArray(el.children)) {
                for (const child of el.children) {
                  if (child.type === "TOOL") {
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
                    // 检查是否有正在执行的工具
                    if (child.toolState === "executing") {
                      hasWorkingTool = true;
                    }
                  }
                }
              }
              if (hasPendingTool) break;
            }
          }

          // 有 pending 工具 = 需要权限
          if (hasPendingTool) {
            return {
              state: "notification",  // 权限请求用 notification 状态
              summary: msg.summary || data.summary || null,
              pendingTool,
            };
          }

          // 有正在执行的工具或 status 是 inProgress = 工作中
          if (hasWorkingTool || RUNNING_STATUSES.has(msg.status)) {
            return {
              state: "working",
              summary: msg.summary || data.summary || null,
              pendingTool: null,
            };
          }

          // 否则返回 idle
          return { state: "idle", summary: msg.summary || data.summary || null, pendingTool: null };
        }
      }
    }

    return { state: "idle", summary: data.summary || null, pendingTool: null };
  } catch (err) {
    return { state: "idle", summary: null, pendingTool: null };
  }
}

function poll() {
  // 在完成确认窗口内，跳过轮询（防止缓存复用导致状态反复）
  if (completionLockTimer) {
    return;
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

  const now = Date.now();
  let detectedState = "idle";
  let detectedPendingTool = null;

  for (const file of files) {
    if (now - file.mtime.getTime() > ACTIVE_TIMEOUT_MS) {
      continue;
    }

    const cached = fileCache.get(file.path);
    if (cached && cached.mtime.getTime() === file.mtime.getTime() && cached.size === file.size) {
      if (cached.state === "notification") {
        detectedState = "notification";
        detectedPendingTool = cached.pendingTool;
        break;
      } else if (cached.state === "working" && detectedState !== "notification") {
        detectedState = "working";
      }
      continue;
    }

    const result = parseSessionFile(file.path);
    fileCache.set(file.path, {
      mtime: file.mtime,
      size: file.size,
      state: result.state,
      pendingTool: result.pendingTool,
    });

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
    if (newState === "working") {
      log(`State changed: ${lastState} -> working`);
      postStateToClawdSync("working", "PreToolUse");
      lastState = "working";
    } else if (newState === "idle") {
      // 如果从工作状态或通知状态变为空闲，发送 attention 状态
      // attention 是单次性状态，会自动播放"完成"动画并回退到 idle
      if (lastState === "working" || lastState === "notification") {
        log(`State changed: ${lastState} -> attention (task completed, will auto-return to idle)`);
        postStateToClawdSync("attention", "Stop");
        lastState = "idle";

        // 启动完成确认窗口：2 秒内不再轮询，防止缓存复用导致状态反复
        // （类似 Gemini 的 4s 完成延迟窗口机制）
        if (completionLockTimer) {
          clearTimeout(completionLockTimer);
        }
        completionLockTimer = setTimeout(() => {
          completionLockTimer = null;
          log("Completion confirmation window closed, monitoring resumed");
        }, COMPLETION_CONFIRMATION_MS);

        // 完成后也清空文件缓存，强制下次重新读取（防止卡在旧状态）
        fileCache.clear();
        return;
      } else {
        log(`State changed: ${lastState} -> idle`);
        postStateToClawdSync("idle", "SessionEnd");
        lastState = "idle";
      }
    }
  }
}

// 文件监听处理（防抖）
function onFileChange(eventType, filename) {
  // 只关心 chat_session_ 文件
  if (!filename || !filename.startsWith("chat_session_")) {
    return;
  }

  // 防抖：150ms 内的多次变化只触发一次
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer);
  }

  watchDebounceTimer = setTimeout(() => {
    poll();
  }, WATCH_DEBOUNCE_MS);
}

function startWatcher() {
  if (!fs.existsSync(STORE_DIR)) {
    log(`Warning: Store directory does not exist: ${STORE_DIR}`);
    log("Will start monitoring when directory is created.");
    return;
  }

  try {
    // 监听目录变化
    watcher = fs.watch(STORE_DIR, { persistent: true }, onFileChange);

    watcher.on("error", (err) => {
      log(`Watch error: ${err.message}`);
      log("Falling back to polling mode only");
      if (watcher) {
        watcher.close();
        watcher = null;
      }
    });

    log("✓ File watcher started (real-time monitoring)");
  } catch (err) {
    log(`Failed to start watcher: ${err.message}`);
    log("Using polling mode only");
  }
}

function main() {
  log("Comate Monitor started (OPTIMIZED - watch + poll hybrid)");
  log(`Watching: ${STORE_DIR}`);
  log(`Watch debounce: ${WATCH_DEBOUNCE_MS}ms`);
  log(`Poll interval: ${POLL_INTERVAL_MS}ms (fallback)`);
  log(`Clawd port: ${CLAWD_PORT}`);

  // 初始轮询
  poll();

  // 启动文件监听（主要）
  startWatcher();

  // 启动定时轮询（兜底）
  setInterval(poll, POLL_INTERVAL_MS);

  const cleanup = () => {
    if (watcher) {
      watcher.close();
    }
    if (watchDebounceTimer) {
      clearTimeout(watchDebounceTimer);
    }
    if (completionLockTimer) {
      clearTimeout(completionLockTimer);
    }
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
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  log("📊 Monitoring mode:");
  log("  • Primary: fs.watch (real-time, ~100ms latency)");
  log("  • Fallback: polling (every 5s)");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main();
