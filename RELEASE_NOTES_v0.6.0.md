# CodePing v0.6.0 Release Notes

**Release Date**: April 20, 2026
**Codename**: Process Guardian 🦀

A desktop companion for AI coding sessions that stays on, so you don't have to.

---

## 📥 Download

Choose the version for your Mac:

| Platform | Download | Size | SHA-256 |
|----------|----------|------|---------|
| **Apple Silicon (M1/M2/M3)** | [CodePing-0.6.0-arm64.dmg](https://github.com/YOUR_USERNAME/codeping/releases/download/v0.6.0/CodePing-0.6.0-arm64.dmg) | 138 MB | `f33a7d5...` |
| **Intel Mac** | [CodePing-0.6.0.dmg](https://github.com/YOUR_USERNAME/codeping/releases/download/v0.6.0/CodePing-0.6.0.dmg) | 142 MB | `ca7aacb...` |

**System Requirements**: macOS 10.15 (Catalina) or later

📄 **Full SHA-256 Checksums**: [CHECKSUMS.txt](https://github.com/YOUR_USERNAME/codeping/releases/download/v0.6.0/CHECKSUMS.txt)

---

## ✨ What's New

### 🆕 Features

#### Comate Process Monitoring (Critical Fix)
- **Intelligent process detection**: Checks Comate process health every 5 seconds
- **Automatic session cleanup**: Sends completion event when Comate exits
- **File timeout re-parsing**: Re-validates session state after 2 minutes of inactivity
- **Long-running task protection**: Preserves working state for extended operations

**Impact**: Fixes the issue where CodePing showed "running" status even after Comate conversations ended.

#### Improved Session Management
- Enhanced file caching mechanism
- Better state change logging
- Diagnostic mode improvements

### 🐛 Bug Fixes

- **Fixed**: Comate sessions stuck in "running" state after completion ([#XXX](https://github.com/YOUR_USERNAME/codeping/issues/XXX))
- **Root cause**: Session files retained `inProgress` status without updates
- **Solution**: Combined process monitoring + file timeout detection

### 🔧 Improvements

- Optimized session file parsing
- Enhanced diagnostic logging
- Reduced false positives for long-running tasks

---

## 🚀 Installation

### First-Time Setup

1. **Download** the appropriate DMG for your Mac
2. **Open** the DMG file
3. **Drag** CodePing to Applications folder
4. **Right-click** CodePing.app → **"Open"** → Confirm ⚠️

> **Why right-click?** This build uses ad-hoc signing (free developer certificate). Right-clicking bypasses macOS Gatekeeper on first launch. Future launches work normally.

**Alternative** (if right-click doesn't work):
```bash
xattr -cr /Applications/CodePing.app
```

📖 **Full Installation Guide**: [docs/guides/installation-guide.md](https://github.com/YOUR_USERNAME/codeping/blob/main/docs/guides/installation-guide.md)

---

## 🎨 Features

### Supported AI Coding Agents

- ✅ **Claude Code** - Full support (hooks + permission bubbles)
- ✅ **Comate** - State sync + process monitoring
- ✅ **Codex CLI** - Log polling
- ✅ **Copilot CLI** - Basic support
- ✅ **Cursor Agent** - State sync
- ✅ **Gemini CLI** - Log polling
- ✅ **Kiro CLI** - Hooks support
- ✅ **CodeBuddy** - Claude-compatible
- ✅ **opencode** - In-process plugin

### Key Features

- 🎭 **Real-time status sync** - Animations match agent activity
- 🎨 **Theme system** - Multiple built-in themes + custom support
- 🌐 **Multilingual** - English / 中文 / 한국어
- 🖱️ **Interactive** - Click and drag reactions
- 😴 **Smart sleep** - Automatic idle animations
- 📏 **Mini mode** - Edge-snapping compact view

---

## 📋 Known Issues

### Installation

1. **"CodePing is damaged" error**
   - **Cause**: macOS download quarantine attribute
   - **Fix**: Run `xattr -cr /Applications/CodePing.app`

2. **First launch requires right-click**
   - **Cause**: Ad-hoc signing (not notarized)
   - **Impact**: One-time setup step

### Functionality

1. **Comate file state persistence**
   - **Issue**: Session files may retain `inProgress` after completion
   - **Mitigation**: Process monitoring forces cleanup on exit
   - **Upstream**: Comate client behavior, not CodePing

---

## 🔄 Upgrading from Previous Versions

1. Quit the old version
2. Install the new DMG (overwrites previous installation)
3. Right-click to open (if prompted)
4. Your preferences are preserved

---

## 🛠️ For Developers

### Code Signing

This release uses **ad-hoc signing** (free). For production deployment with automatic installation:

1. Apply for [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Follow our [Code Signing Guide](https://github.com/YOUR_USERNAME/codeping/blob/main/docs/guides/macos-code-signing.md)
3. Enable notarization for seamless user experience

### Building from Source

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/codeping.git
cd codeping

# Install dependencies
npm install

# Run in development
npm start

# Build for macOS
npm run build:mac
```

---

## 📚 Documentation

- 📖 [Installation Guide](https://github.com/YOUR_USERNAME/codeping/blob/main/docs/guides/installation-guide.md)
- 🔐 [Code Signing Guide](https://github.com/YOUR_USERNAME/codeping/blob/main/docs/guides/macos-code-signing.md)
- 🔧 [Comate Monitoring Fix Details](https://github.com/YOUR_USERNAME/codeping/blob/main/docs/investigations/comate-process-monitoring-fix.md)
- 📋 [Full Release Summary](https://github.com/YOUR_USERNAME/codeping/blob/main/docs/releases/release-0.6.0-summary.md)

---

## 🙏 Acknowledgments

Thanks to all users who reported issues and provided feedback!

---

## 📞 Support

- 🐛 [Report Issues](https://github.com/YOUR_USERNAME/codeping/issues)
- 💬 [Discussions](https://github.com/YOUR_USERNAME/codeping/discussions)
- 📧 Email: [your-email@example.com]

---

## 🔜 What's Next (v0.7.0)

- Full Apple code signing + notarization
- Additional agent support (Aider, Continue.dev)
- Performance optimizations
- Enhanced testing coverage

---

**Happy Coding!** 🦀✨

---

### Full Changelog

**Added**:
- Comate process monitoring (5s interval)
- File timeout re-parsing (2min idle detection)
- Installation guide documentation
- Code signing guide documentation

**Fixed**:
- Comate sessions stuck in "running" state

**Changed**:
- Improved session state management
- Enhanced diagnostic logging

**Removed**:
- Deprecated test scripts

---

_For detailed technical changes, see [CHANGELOG.md](https://github.com/YOUR_USERNAME/codeping/blob/main/CHANGELOG.md)_
