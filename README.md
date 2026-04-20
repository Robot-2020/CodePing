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

- 🎭 **Real-time status sync** - Shows live states (thinking, typing, working, done) with improved Comate latency
- 🔔 **Permission prompts** - Surfaces important decisions on your desktop
- 🎨 **Theme system** - Multiple built-in themes (Sunset, Calico, Lucy) + custom support
- 🌐 **Multilingual** - English / 中文
- 😴 **Smart sleep** - Automatic idle animations with smart sleep sequences
- 📏 **Mini mode** - Edge-snapping compact view with smooth animations

### Supported AI Coding Agents

- ✅ Claude Code - Full support (hooks + permission bubbles)
- ✅ Comate - Optimized state sync with latency fix
- ✅ Codex CLI, Copilot CLI, Cursor Agent
- ✅ Gemini CLI, Kiro CLI, CodeBuddy, opencode

## 📥 Installation

### For macOS Users (Recommended)

**Latest Release: v1.0.0** 🎉

Download the appropriate version for your Mac:

| Platform | Download | Size |
|----------|----------|------|
| **Apple Silicon (M1/M2/M3)** | [CodePing-1.0.0-arm64.dmg](https://github.com/Robot-2020/CodePing/releases/latest) | 138 MB |
| **Intel Mac** | [CodePing-1.0.0.dmg](https://github.com/Robot-2020/CodePing/releases/latest) | 142 MB |

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

📖 **Detailed Guide**: See [Installation Guide](docs/guides/setup-guide.md)

### For Windows & Linux Users

| Platform | Download | Size |
|----------|----------|------|
| **Windows** | [CodePing-Setup-1.0.0.exe](https://github.com/Robot-2020/CodePing/releases/latest) | 118 MB |
| **Linux AppImage** | [CodePing-1.0.0.AppImage](https://github.com/Robot-2020/CodePing/releases/latest) | 143 MB |
| **Linux Debian** | [codeping_1.0.0_amd64.deb](https://github.com/Robot-2020/CodePing/releases/latest) | 111 MB |

### For Developers (Build from Source)

```bash
# Clone repository
git clone https://github.com/Robot-2020/CodePing.git
cd CodePing

# Install dependencies
npm install

# Run in development
npm start

# Build for all platforms
npm run build:all
```

## Stack

- Electron - Desktop application framework
- Node.js - Runtime environment
- Local hooks for AI coding agents
- SVG/APNG animations

## 📚 Documentation

- [Installation Guide](docs/guides/setup-guide.md) - Step-by-step setup instructions
- [Theme Creation Guide](docs/guides/guide-theme-creation.md) - Create custom themes
- [State Mapping](docs/guides/state-mapping.md) - Animation states reference
- [Release Notes](RELEASE_NOTES_v1.0.0.md) - What's new in v1.0.0

## 🙏 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

---

**Happy Coding!** 🦀✨
