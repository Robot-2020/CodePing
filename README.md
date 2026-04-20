<p align="center">
  <svg viewBox="0 0 36 36" fill="none" role="img" xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><clipPath id="bodyClip"><circle cx="18" cy="18" r="14"/></clipPath></defs><g clip-path="url(#bodyClip)"><circle cx="2" cy="12" r="22" fill="#ff7d10"/><circle cx="27" cy="23" r="19" fill="#0a0310"/></g><g fill="#FFFFFF"><circle cx="15" cy="16" r="1.2"/><circle cx="21" cy="16" r="1.2"/></g><path d="M 16 21 Q 18 23 20 21" stroke="#FFFFFF" stroke-width="0.8" fill="none" stroke-linecap="round"/></svg>
</p>

<h1 align="center">CodePing</h1>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a>
</p>

<p align="center"><strong>Ping stays on, so you don't have to.</strong></p>

CodePing is a desktop companion for AI coding workflows. It lives on your desktop, follows agent activity in real time, and lets you stop staring at the terminal while long-running work finishes.

## ✨ Features

- 🎭 **Real-time status sync** - Shows live states (thinking, typing, working, done)
- 🔔 **Permission prompts** - Surfaces important decisions on your desktop
- 🎨 **Theme system** - Multiple built-in themes + custom support
- 🌐 **Multilingual** - English / 中文
- 😴 **Smart sleep** - Automatic idle animations
- 📏 **Mini mode** - Edge-snapping compact view

### Supported AI Coding Agents

- ✅ Claude Code - Full support (hooks + permission bubbles)
- ✅ Comate - State sync + process monitoring
- ✅ Codex CLI, Copilot CLI, Cursor Agent
- ✅ Gemini CLI, Kiro CLI, CodeBuddy, opencode

## 📥 Installation

### For macOS Users (Recommended)

**Latest Release: v0.6.0** 🎉

Download the appropriate version for your Mac:

| Platform | Download | Size |
|----------|----------|------|
| **Apple Silicon (M1/M2/M3)** | [CodePing-0.6.0-arm64.dmg](https://github.com/Robot-2020/codeping/releases/latest) | 138 MB |
| **Intel Mac** | [CodePing-0.6.0.dmg](https://github.com/Robot-2020/codeping/releases/latest) | 142 MB |

**System Requirements**: macOS 10.15+

#### Installation Steps

1. Download the DMG file for your Mac
2. Open the DMG and drag CodePing to Applications
3. **Right-click** CodePing.app → **"Open"** → Confirm

> ⚠️ **First launch requires right-click** - This build uses ad-hoc signing. Right-clicking bypasses macOS Gatekeeper. Future launches work normally.

**Alternative** (if needed):
```bash
xattr -cr /Applications/CodePing.app
```

📖 **Detailed Guide**: See [Installation Guide](docs/guides/installation-guide.md)

### For Developers (Build from Source)

```bash
# Clone repository
git clone https://github.com/Robot-2020/codeping.git
cd codeping

# Install dependencies
npm install

# Run in development
npm start

# Build for macOS
npm run build:mac
```

## Stack

- Electron - Desktop application framework
- Node.js - Runtime environment
- Local hooks for AI coding agents
- SVG/APNG animations

## 📚 Documentation

- [Installation Guide](docs/guides/installation-guide.md) - Step-by-step setup instructions
- [Code Signing Guide](docs/guides/macos-code-signing.md) - For developers
- [Release Notes](RELEASE_NOTES_v0.6.0.md) - What's new in v0.6.0

## 🙏 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

---

**Happy Coding!** 🦀✨
