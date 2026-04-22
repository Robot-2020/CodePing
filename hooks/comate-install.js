#!/usr/bin/env node
// Clawd Desktop Pet — Comate Hook Installer
//
// Comate's command-hook spec is identical to Claude Code's — only the config
// file path differs (~/.comate/hooks.json instead of ~/.claude/settings.json).
// This file is therefore a thin wrapper over hooks/install.js.

const path = require("path");
const os = require("os");
const { registerHooks, unregisterHooks } = require("./install.js");

const MARKER = "comate-hook.js";
const DEFAULT_HOOKS_PATH = () => path.join(os.homedir(), ".comate", "hooks.json");

const COMATE_REGISTER_DEFAULTS = {
  marker: MARKER,
  hookScript: path.resolve(__dirname, "comate-hook.js"),
  // Comate has no Claude-style version gating — register all supported events
  skipVersionDetection: true,
  // Comate has no auto-start.sh legacy; nothing to clean up
  deprecatedCoreHooks: [],
  agentLabel: "Comate",
  // Comate supports the same HTTP PermissionRequest hook as Claude —
  // inherit install.js's default httpHooks.
};

function registerComateHooks(options = {}) {
  return registerHooks({
    ...COMATE_REGISTER_DEFAULTS,
    ...options,
    settingsPath: options.hooksPath || options.settingsPath || DEFAULT_HOOKS_PATH(),
    // Comate does not need the auto-start hook (no CLI launcher)
    autoStart: false,
  });
}

function unregisterComateHooks(options = {}) {
  return unregisterHooks({
    marker: MARKER,
    removeAutoStart: false,
    removeHttpHooks: true,
    ...options,
    settingsPath: options.hooksPath || options.settingsPath || DEFAULT_HOOKS_PATH(),
  });
}

module.exports = { registerComateHooks, unregisterComateHooks };

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
