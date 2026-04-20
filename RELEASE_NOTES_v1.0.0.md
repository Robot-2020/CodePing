# CodePing v1.0.0 Release Notes

**Release Date**: April 20, 2026
**Milestone**: First Major Release 🎉

The ultimate desktop companion for AI coding sessions. Ping stays on, so you don't have to.

---

## 📥 Download

Choose the version for your platform:

| Platform | Download | Size |
|----------|----------|------|
| **macOS Apple Silicon** | [CodePing-1.0.0-arm64.dmg](https://github.com/Robot-2020/CodePing/releases/download/v1.0.0/CodePing-1.0.0-arm64.dmg) | 138 MB |
| **macOS Intel** | [CodePing-1.0.0.dmg](https://github.com/Robot-2020/CodePing/releases/download/v1.0.0/CodePing-1.0.0.dmg) | 142 MB |
| **Windows** | [CodePing-Setup-1.0.0.exe](https://github.com/Robot-2020/CodePing/releases/download/v1.0.0/CodePing-Setup-1.0.0.exe) | 118 MB |
| **Linux AppImage** | [CodePing-1.0.0.AppImage](https://github.com/Robot-2020/CodePing/releases/download/v1.0.0/CodePing-1.0.0.AppImage) | 143 MB |
| **Linux Debian** | [codeping_1.0.0_amd64.deb](https://github.com/Robot-2020/CodePing/releases/download/v1.0.0/codeping_1.0.0_amd64.deb) | 111 MB |

**System Requirements**:
- macOS 10.15+ / Windows 7+ / Linux (glibc 2.17+)

---

## ✨ What's New in v1.0.0

### 🎯 Major Achievements

#### Comate State Sync Optimization (Critical Fix)
- **Completion confirmation window**: 2-second lock prevents cache reuse after task completion
- **File cache cleanup**: Forces fresh detection on state transitions
- **Latency improvement**: Eliminates 4-8 second delay when sessions end
- **Impact**: Comate sessions now show accurate "done" state immediately

#### New Theme System
- **Sunset (Ellen Swallow)**: Cute round character with warm colors (default)
- **Calico**: Playful tri-color cat companion
- **Lucy**: Elegant modern design
- All themes with rich animations and eye-tracking support

#### Cross-Platform Parity
- ✅ Native builds for Windows, macOS (x64 + arm64), Linux
- ✅ Unified icon system from theme assets
- ✅ Consistent experience across all platforms

#### Enhanced Language Support
- English (en)
- 简体中文 (zh)
- 한국어 (ko)

### 🔄 Full Agent Support

| Agent | Status | Features |
|-------|--------|----------|
| Claude Code | ✅ Full | Hooks + Permissions + Terminal Focus |
| Comate | ✅ Optimized | Real-time sync with latency fix |
| Codex CLI | ✅ Supported | Log polling |
| Copilot CLI | ✅ Supported | Basic state tracking |
| Cursor Agent | ✅ Supported | Display hints + permissions |
| Gemini CLI | ✅ Supported | Session polling |
| Kiro CLI | ✅ Supported | Per-agent hooks |
| CodeBuddy | ✅ Supported | Claude-compatible hooks |
| opencode | ✅ Supported | In-process plugin system |

---

## 🎨 Features

### Core Functionality

- 🎭 **Real-time status sync** - Thinks, types, works, completes
- 🔔 **Permission bubbles** - Important decisions on your desktop
- 🎨 **Theme system** - 3 built-in themes + custom support
- 🌐 **Multilingual** - 3 languages (en/zh/ko)
- 😴 **Smart sleep** - Auto idle after 20s, deep sleep after 10min
- 📏 **Mini mode** - Compact edge-snapping view
- 🖱️ **Interactions** - Click reactions, drag responses
- 🔌 **Plugin system** - Custom themes via user directory
- ⚙️ **Settings panel** - Comprehensive preferences UI

### Advanced Features

- **Multi-session tracking** - Supports simultaneous coding sessions
- **Terminal focus integration** - Jump to session's terminal with one click
- **Eye tracking** - Animations follow cursor movement
- **Permission suggestions** - Smart suggestions from AI agents
- **Session dashboard** - View all active sessions and their status
- **Auto-update** - Built-in update checking
- **Tray integration** - Minimize to system tray

---

## 📋 Technical Improvements

### Performance
- Optimized file polling with debouncing
- Smart cache invalidation
- Reduced CPU usage in idle mode
- Fast theme switching

### Reliability
- Robust process detection across platforms
- Graceful error handling for missing agents
- Session recovery on application restart
- File corruption protection

### Code Quality
- Comprehensive unit tests
- Multi-platform CI/CD pipeline
- TypeScript-ready architecture
- Well-documented codebase

---

## 🚀 Installation

### Quick Start (macOS)

1. Download the DMG for your Mac
2. Drag CodePing to Applications
3. Right-click CodePing.app → "Open" (first launch only)
4. That's it! 🎉

### Windows

1. Download and run CodePing-Setup-1.0.0.exe
2. Follow the installer
3. Launch from Start Menu or desktop shortcut

### Linux

**AppImage** (Universal):
```bash
chmod +x CodePing-1.0.0.AppImage
./CodePing-1.0.0.AppImage
```

**Debian/Ubuntu**:
```bash
sudo dpkg -i codeping_1.0.0_amd64.deb
codeping
```

---

## 🔄 Upgrading from v0.6.0

Simply install the v1.0.0 package for your platform:
- Your settings and preferences are preserved
- Themes are automatically migrated
- No manual cleanup needed

---

## 📚 Documentation

- 📖 [Installation Guide](docs/guides/setup-guide.md)
- 🎨 [Theme Creation](docs/guides/guide-theme-creation.md)
- 📊 [State Mapping Reference](docs/guides/state-mapping.md)
- 🔧 [Development Setup](CLAUDE.md)
- 📡 [Multi-Agent Architecture](docs/project/project-architecture.md)

---

## 🐛 Known Limitations

1. **First-time macOS launch** requires right-click (ad-hoc signing)
2. **Terminal focus** on Windows has edge cases with multiple terminals
3. **Codex CLI** has ~1.5s monitoring latency (log-based detection)
4. **Gemini CLI** requires explicit hook registration

---

## 🔜 Future Roadmap (v1.1+)

- Full Apple code signing + notarization
- Windows code signing
- Additional agent support (Aider, Continue.dev)
- Voice notifications
- Custom animation creation UI
- Cloud preferences sync

---

## 🙏 Acknowledgments

Special thanks to:
- All AI coding agent teams for documentation
- Beta testers for feedback and bug reports
- Open source community for Electron and libraries

---

## 📞 Support & Feedback

- 🐛 [Report Issues](https://github.com/Robot-2020/CodePing/issues)
- 💬 [Discussions](https://github.com/Robot-2020/CodePing/discussions)
- 🌟 Star us on GitHub!

---

### Full Changelog (v0.6.0 → v1.0.0)

**Added**:
- Comate state sync latency fix (2s confirmation window)
- Cross-platform builds (Windows + Linux)
- New Sunset/Lucy themes with animations
- Korean language support
- Icon generation from theme assets
- Multi-size icon support

**Fixed**:
- Comate sessions delayed after completion
- Cache reuse race condition
- File timeout detection

**Changed**:
- Improved UI responsiveness
- Enhanced documentation
- Better error messages

**Improved**:
- Asset management pipeline
- Build configuration
- Code organization

---

**🎉 CodePing v1.0.0 — Ready for Production!**

Thank you for using CodePing. Happy coding! 🚀

