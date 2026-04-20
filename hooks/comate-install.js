#!/usr/bin/env node
// Clawd Desktop Pet — Comate Hook Installer
// Safely merges hook commands into ~/.comate/hooks.json (append-only, idempotent)

const fs = require("fs");
const path = require("path");
const os = require("os");
const { resolveNodeBin } = require("./server-config");
const { writeJsonAtomic, asarUnpackedPath, extractExistingNodeBin } = require("./json-utils");

const MARKER = "comate-hook.js";

// Comate 支持的事件（基于文档）
const COMATE_HOOK_EVENTS = [
  "SessionStart",
  "SessionEnd",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "Stop",
];

/**
 * Extract existing node binary path from Comate hooks config
 */
function extractComateNodeBin(settings, marker) {
  if (!settings || !settings.hooks) return null;
  for (const entries of Object.values(settings.hooks)) {
    if (!Array.isArray(entries)) continue;
    for (const group of entries) {
      if (!group || typeof group !== "object") continue;
      if (!Array.isArray(group.hooks)) continue;
      for (const hook of group.hooks) {
        if (!hook || hook.type !== "command" || typeof hook.command !== "string") continue;
        if (!hook.command.includes(marker)) continue;
        // 提取第一个引号中的路径
        const qi = hook.command.indexOf('"');
        if (qi === -1) continue;
        const qe = hook.command.indexOf('"', qi + 1);
        if (qe === -1) continue;
        const firstQuoted = hook.command.substring(qi + 1, qe);
        if (firstQuoted.includes(marker)) continue;
        if (firstQuoted.startsWith("/") || firstQuoted.match(/^[A-Za-z]:\\/)) return firstQuoted;
      }
    }
  }
  return null;
}

/**
 * Register Clawd hooks into ~/.comate/hooks.json
 * @param {object} [options]
 * @param {boolean} [options.silent] - suppress console output
 * @param {string} [options.hooksPath] - override hooks.json path
 * @param {string} [options.nodeBin] - override node binary path
 * @returns {{ added: number, skipped: number, updated: number }}
 */
function registerComateHooks(options = {}) {
  const hooksPath = options.hooksPath || path.join(os.homedir(), ".comate", "hooks.json");

  // 如果 ~/.comate/ 不存在则创建
  const comateDir = path.dirname(hooksPath);
  try {
    if (!fs.existsSync(comateDir)) {
      fs.mkdirSync(comateDir, { recursive: true });
    }
  } catch (err) {
    if (!options.silent) console.error(`Failed to create ~/.comate/: ${err.message}`);
    return { added: 0, skipped: 0, updated: 0 };
  }

  const hookScript = asarUnpackedPath(path.resolve(__dirname, "comate-hook.js").replace(/\\/g, "/"));

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(hooksPath, "utf-8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw new Error(`Failed to read hooks.json: ${err.message}`);
    }
  }

  // 解析 node 路径
  const resolved = options.nodeBin !== undefined ? options.nodeBin : resolveNodeBin();
  const nodeBin = resolved
    || extractComateNodeBin(settings, MARKER)
    || "node";

  if (!settings.hooks || typeof settings.hooks !== "object") settings.hooks = {};

  let added = 0;
  let skipped = 0;
  let updated = 0;
  let changed = false;

  for (const event of COMATE_HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
      changed = true;
    }

    const arr = settings.hooks[event];
    const desiredCommand = `"${nodeBin}" "${hookScript}" ${event}`;

    // 查找现有的 Clawd hook
    let found = false;
    let stalePath = false;

    for (const group of arr) {
      if (!group || typeof group !== "object") continue;
      if (!Array.isArray(group.hooks)) continue;

      for (const hook of group.hooks) {
        if (!hook || hook.type !== "command" || typeof hook.command !== "string") continue;
        if (!hook.command.includes(MARKER)) continue;

        found = true;
        if (hook.command !== desiredCommand) {
          hook.command = desiredCommand;
          stalePath = true;
        }
        break;
      }
      if (found) break;
    }

    if (found) {
      if (stalePath) {
        updated++;
        changed = true;
      } else {
        skipped++;
      }
      continue;
    }

    // 添加新的 hook（Comate 格式：matcher + hooks 数组）
    arr.push({
      matcher: "",
      hooks: [
        {
          type: "command",
          command: desiredCommand,
          timeout: 5,
        },
      ],
    });
    added++;
    changed = true;
  }

  if (added > 0 || changed) {
    writeJsonAtomic(hooksPath, settings);
  }

  if (!options.silent) {
    console.log(`Clawd Comate hooks → ${hooksPath}`);
    console.log(`  Added: ${added}, updated: ${updated}, skipped: ${skipped}`);
    console.log(`  Events: ${COMATE_HOOK_EVENTS.join(", ")}`);
  }

  return { added, skipped, updated };
}

/**
 * Unregister Clawd hooks from ~/.comate/hooks.json
 * @param {object} [options]
 * @param {string} [options.hooksPath] - override hooks.json path
 * @returns {{ removed: number, changed: boolean }}
 */
function unregisterComateHooks(options = {}) {
  const hooksPath = options.hooksPath || path.join(os.homedir(), ".comate", "hooks.json");

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(hooksPath, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return { removed: 0, changed: false };
    throw new Error(`Failed to read hooks.json: ${err.message}`);
  }

  if (!settings.hooks || typeof settings.hooks !== "object") {
    return { removed: 0, changed: false };
  }

  let removed = 0;
  let changed = false;

  for (const [event, groups] of Object.entries(settings.hooks)) {
    if (!Array.isArray(groups)) continue;

    const nextGroups = [];
    for (const group of groups) {
      if (!group || typeof group !== "object") {
        nextGroups.push(group);
        continue;
      }

      if (!Array.isArray(group.hooks)) {
        nextGroups.push(group);
        continue;
      }

      const nextHooks = group.hooks.filter((hook) => {
        if (!hook || hook.type !== "command" || typeof hook.command !== "string") return true;
        if (!hook.command.includes(MARKER)) return true;
        removed++;
        changed = true;
        return false;
      });

      if (nextHooks.length > 0) {
        nextGroups.push({ ...group, hooks: nextHooks });
      }
    }

    if (nextGroups.length > 0) {
      settings.hooks[event] = nextGroups;
    } else {
      delete settings.hooks[event];
    }
  }

  if (changed) {
    writeJsonAtomic(hooksPath, settings);
  }

  return { removed, changed };
}

module.exports = { registerComateHooks, unregisterComateHooks, COMATE_HOOK_EVENTS };

// CLI: node hooks/comate-install.js [--uninstall]
if (require.main === module) {
  try {
    if (process.argv.includes("--uninstall")) {
      const result = unregisterComateHooks({});
      console.log(`Removed ${result.removed} Clawd Comate hooks`);
    } else {
      registerComateHooks({});
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
