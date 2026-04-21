#!/usr/bin/env node
// Clawd Desktop Pet — Claude Code Hook Script
// Usage: node clawd-hook.js <event_name>
// Reads stdin JSON from Claude Code for session_id

const fs = require("fs");
const { postStateToRunningServer, readHostPrefix } = require("./server-config");
const { createPidResolver, readStdinJson, getPlatformConfig } = require("./shared-process");

const TRANSCRIPT_TAIL_BYTES = 262144; // 256 KB
const SESSION_TITLE_CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]+/g;
const SESSION_TITLE_MAX = 80;

// Claude Model Pricing (USD per 1M tokens, as of 2026-04-21)
// Source: https://www.anthropic.com/pricing
const MODEL_PRICING = {
  // Claude 4.6 (Opus)
  "claude-opus-4-6": {
    input: 15.0,
    output: 75.0,
    cache_write: 18.75,
    cache_read: 1.5,
  },
  // Claude 4.6 (Sonnet)
  "claude-sonnet-4-6": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
  // Claude 4.5 (Sonnet) - with date variants
  "claude-sonnet-4-5": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
  "claude-sonnet-4-5-20250929": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
  // Claude 4.5 (Haiku)
  "claude-haiku-4-5": {
    input: 0.8,
    output: 4.0,
    cache_write: 1.0,
    cache_read: 0.08,
  },
  "claude-haiku-4-5-20251001": {
    input: 0.8,
    output: 4.0,
    cache_write: 1.0,
    cache_read: 0.08,
  },
  // Legacy models
  "claude-3-5-sonnet-20241022": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
  "claude-3-5-sonnet-20240620": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
  "claude-3-opus-20240229": {
    input: 15.0,
    output: 75.0,
    cache_write: 18.75,
    cache_read: 1.5,
  },
  "claude-3-sonnet-20240229": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
  "claude-3-haiku-20240307": {
    input: 0.25,
    output: 1.25,
    cache_write: 0.3,
    cache_read: 0.03,
  },
};

// Calculate cost in USD based on token usage and model
function calculateCost(tokenUsage, modelId) {
  if (!modelId || !MODEL_PRICING[modelId]) return null;

  const pricing = MODEL_PRICING[modelId];
  let totalCost = 0;

  // Input tokens
  if (tokenUsage.input_tokens) {
    totalCost += (tokenUsage.input_tokens / 1000000) * pricing.input;
  }

  // Output tokens
  if (tokenUsage.output_tokens) {
    totalCost += (tokenUsage.output_tokens / 1000000) * pricing.output;
  }

  // Cache write tokens
  if (tokenUsage.cache_creation_tokens) {
    totalCost += (tokenUsage.cache_creation_tokens / 1000000) * pricing.cache_write;
  }

  // Cache read tokens
  if (tokenUsage.cache_read_tokens) {
    totalCost += (tokenUsage.cache_read_tokens / 1000000) * pricing.cache_read;
  }

  return totalCost > 0 ? totalCost : null;
}

function normalizeTitle(value) {
  if (typeof value !== "string") return null;
  const collapsed = value
    .replace(SESSION_TITLE_CONTROL_RE, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return null;
  return collapsed.length > SESSION_TITLE_MAX
    ? `${collapsed.slice(0, SESSION_TITLE_MAX - 1)}\u2026`
    : collapsed;
}

// Read the tail of a Claude Code transcript JSONL and return the most recent
// user-set session title (custom-title / agent-name events). Returns null if
// the file is missing/unreadable or no title events are found.
function extractSessionTitleFromTranscript(transcriptPath) {
  if (typeof transcriptPath !== "string" || !transcriptPath) return null;

  let data;
  let truncated = false;
  let fd = null;
  try {
    const stat = fs.statSync(transcriptPath);
    fd = fs.openSync(transcriptPath, "r");
    const readLen = Math.min(stat.size, TRANSCRIPT_TAIL_BYTES);
    truncated = stat.size > readLen;
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, Math.max(0, stat.size - readLen));
    data = buf.toString("utf8");
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }

  const lines = data.split("\n");
  // If we read a tail of a larger file, the first line is likely a truncated
  // JSON fragment — drop it so JSON.parse doesn't fail noisily on it.
  if (truncated && lines.length > 1) lines.shift();

  let latest = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (!obj || typeof obj !== "object") continue;
    const type = typeof obj.type === "string" ? obj.type : "";
    if (type !== "custom-title" && type !== "agent-name") continue;
    latest =
      normalizeTitle(obj.customTitle) ||
      normalizeTitle(obj.title) ||
      normalizeTitle(obj.custom_title) ||
      normalizeTitle(obj.agentName) ||
      normalizeTitle(obj.agent_name) ||
      latest;
  }
  return latest;
}

// Extract token usage statistics from transcript JSONL file.
// Aggregates all usage entries and returns the cumulative totals.
function extractTokenUsageFromTranscript(transcriptPath) {
  if (typeof transcriptPath !== "string" || !transcriptPath) return null;

  let data;
  let truncated = false;
  let fd = null;
  try {
    const stat = fs.statSync(transcriptPath);
    fd = fs.openSync(transcriptPath, "r");
    // Read more for token stats - they accumulate throughout the session
    const readLen = Math.min(stat.size, TRANSCRIPT_TAIL_BYTES * 2);
    truncated = stat.size > readLen;
    const buf = Buffer.alloc(readLen);
    fs.readSync(fd, buf, 0, readLen, Math.max(0, stat.size - readLen));
    data = buf.toString("utf8");
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch {}
    }
  }

  const lines = data.split("\n");
  if (truncated && lines.length > 1) lines.shift();

  // Aggregate token usage from all messages
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let cacheCreationTokens = 0;
  let cacheReadTokens = 0;
  let messageCount = 0;
  let lastCostUsd = null;
  let modelId = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (!obj || typeof obj !== "object") continue;

    // Extract model ID from message or response (try multiple paths)
    if (!modelId) {
      modelId = obj.model_id || obj.model ||
                obj.message?.model || obj.response?.model ||
                obj.data?.model || null;
    }

    // Look for usage in various places Claude Code might put it
    const usage = obj.usage || obj.message?.usage || obj.response?.usage;
    if (usage && typeof usage === "object") {
      if (typeof usage.input_tokens === "number") {
        totalInputTokens += usage.input_tokens;
      }
      if (typeof usage.output_tokens === "number") {
        totalOutputTokens += usage.output_tokens;
      }
      if (typeof usage.cache_creation_input_tokens === "number") {
        cacheCreationTokens += usage.cache_creation_input_tokens;
      }
      // Also check cache_creation object for ephemeral tokens
      if (usage.cache_creation && typeof usage.cache_creation === "object") {
        const cacheCreation = usage.cache_creation;
        if (typeof cacheCreation.ephemeral_1h_input_tokens === "number") {
          cacheCreationTokens += cacheCreation.ephemeral_1h_input_tokens;
        }
        if (typeof cacheCreation.ephemeral_5m_input_tokens === "number") {
          cacheCreationTokens += cacheCreation.ephemeral_5m_input_tokens;
        }
      }
      if (typeof usage.cache_read_input_tokens === "number") {
        cacheReadTokens += usage.cache_read_input_tokens;
      }
      messageCount++;
    }

    // Check for cost information
    if (typeof obj.costUsd === "number") {
      lastCostUsd = obj.costUsd;
    } else if (typeof obj.cost_usd === "number") {
      lastCostUsd = obj.cost_usd;
    }
  }

  if (messageCount === 0) return null;

  return {
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    total_tokens: totalInputTokens + totalOutputTokens,
    cache_creation_tokens: cacheCreationTokens,
    cache_read_tokens: cacheReadTokens,
    message_count: messageCount,
    cost_usd: lastCostUsd,
    model_id: modelId,
  };
}

const EVENT_TO_STATE = {
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
  // PermissionRequest is handled by HTTP hook (blocking) — not command hook
  Elicitation: "notification",
  WorktreeCreate: "carrying",
};

function buildStateBody(event, payload, resolve) {
  const state = EVENT_TO_STATE[event];
  if (!state) return null;

  const sessionId = payload.session_id || "default";
  const cwd = payload.cwd || "";
  const source = payload.source || payload.reason || "";

  // /clear triggers SessionEnd → SessionStart in quick succession;
  // show sweeping (clearing context) instead of sleeping
  const resolvedState = (event === "SessionEnd" && source === "clear") ? "sweeping" : state;

  const body = { state: resolvedState, session_id: sessionId, event };
  body.agent_id = "claude-code";
  if (cwd) body.cwd = cwd;
  // Session title: prefer payload field, fall back to scanning the transcript
  // tail for user-set custom-title / agent-name events
  const sessionTitle =
    normalizeTitle(payload.session_title) ||
    extractSessionTitleFromTranscript(payload.transcript_path);
  if (sessionTitle) body.session_title = sessionTitle;

  // Extract token usage - prefer native stdin data from Claude Code (more accurate),
  // fall back to transcript parsing
  if (["PostToolUse", "Stop", "UserPromptSubmit", "PreToolUse"].includes(event)) {
    let tokenUsage = null;

    // Extract model ID from payload - try multiple possible fields
    const modelId = payload.model_id || payload.model || payload.model_name || null;

    // Always log for debugging (write to temp file)
    try {
      const debugData = {
        event,
        modelId: modelId || "NOT FOUND",
        payloadKeys: Object.keys(payload),
        hasContextWindow: !!payload.context_window,
        hasCost: !!payload.cost,
      };
      fs.appendFileSync("/tmp/clawd-hook-debug.log", JSON.stringify(debugData, null, 2) + "\n---\n");
    } catch {}

    // Native token data from Claude Code stdin (claude-hud approach)
    const ctxWindow = payload.context_window;
    const nativeCost = payload.cost;
    if (ctxWindow && ctxWindow.current_usage) {
      const usage = ctxWindow.current_usage;
      tokenUsage = {
        input_tokens: usage.input_tokens || 0,
        output_tokens: usage.output_tokens || 0,
        total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
        cache_creation_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_tokens: usage.cache_read_input_tokens || 0,
        context_window_size: ctxWindow.context_window_size || null,
        used_percentage: ctxWindow.used_percentage || null,
        source: "native",
      };

      // Add model ID if available
      if (modelId) {
        tokenUsage.model_id = modelId;
      }

      // Calculate cost: prefer native cost from Claude Code, fall back to our calculation
      if (nativeCost && typeof nativeCost.total_cost_usd === "number") {
        tokenUsage.cost_usd = nativeCost.total_cost_usd;
      } else {
        const calculatedCost = calculateCost(tokenUsage, modelId);
        if (calculatedCost !== null) {
          tokenUsage.cost_usd = calculatedCost;
        }
      }
    }

    // Fallback to transcript parsing if native data unavailable
    if (!tokenUsage && payload.transcript_path) {
      tokenUsage = extractTokenUsageFromTranscript(payload.transcript_path);
      if (tokenUsage) {
        tokenUsage.source = "transcript";
        // Use model_id from transcript if available, otherwise use from payload
        const finalModelId = tokenUsage.model_id || modelId;
        if (finalModelId) {
          tokenUsage.model_id = finalModelId;
        }
        // Calculate cost if we have a model ID and no existing cost
        if (finalModelId && !tokenUsage.cost_usd) {
          const calculatedCost = calculateCost(tokenUsage, finalModelId);
          if (calculatedCost !== null) {
            tokenUsage.cost_usd = calculatedCost;
          }
        }
      }
    }

    if (tokenUsage) {
      body.token_usage = tokenUsage;
    }
  }

  if (process.env.CLAWD_REMOTE) {
    body.host = readHostPrefix();
  } else {
    const { stablePid, agentPid, detectedEditor, pidChain } = resolve();
    body.source_pid = stablePid;
    if (detectedEditor) body.editor = detectedEditor;
    if (agentPid) {
      body.agent_pid = agentPid;
      body.claude_pid = agentPid; // backward compat with older Clawd versions
      // Check if claude process is running in non-interactive (-p/--print) mode
      try {
        const { execSync } = require("child_process");
        const isWin = process.platform === "win32";
        const cmdOut = isWin
          ? execSync(
              `wmic process where "ProcessId=${agentPid}" get CommandLine /format:csv`,
              { encoding: "utf8", timeout: 500, windowsHide: true }
            )
          : execSync(`ps -o command= -p ${agentPid}`, { encoding: "utf8", timeout: 500 });
        if (/\s(-p|--print)(\s|$)/.test(cmdOut)) body.headless = true;
      } catch {}
    }
    if (pidChain.length) body.pid_chain = pidChain;
  }

  return body;
}

function main() {
  const event = process.argv[2];
  if (!EVENT_TO_STATE[event]) process.exit(0);

  const config = getPlatformConfig();
  const resolve = createPidResolver({
    agentNames: { win: new Set(["claude.exe"]), mac: new Set(["claude"]) },
    agentCmdlineCheck: (cmd) => cmd.includes("claude-code") || cmd.includes("@anthropic-ai"),
    platformConfig: config,
  });

  // Pre-resolve on SessionStart (runs during stdin buffering, not after)
  // Remote mode: skip PID collection — remote PIDs are meaningless on the local machine
  if (event === "SessionStart" && !process.env.CLAWD_REMOTE) resolve();

  readStdinJson().then((payload) => {
    const body = buildStateBody(event, payload || {}, resolve);
    if (!body) process.exit(0);
    postStateToRunningServer(
      JSON.stringify(body),
      { timeoutMs: 100 },
      () => process.exit(0)
    );
  });
}

if (require.main === module) main();

module.exports = { buildStateBody, extractSessionTitleFromTranscript, extractTokenUsageFromTranscript };
