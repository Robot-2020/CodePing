<p align="center">
  <svg viewBox="0 0 36 36" fill="none" role="img" xmlns="http://www.w3.org/2000/svg" width="80" height="80"><defs><clipPath id="bodyClip"><circle cx="18" cy="18" r="14"/></clipPath></defs><g clip-path="url(#bodyClip)"><circle cx="2" cy="12" r="22" fill="#ff7d10"/><circle cx="27" cy="23" r="19" fill="#0a0310"/></g><g fill="#FFFFFF"><circle cx="15" cy="16" r="1.2"/><circle cx="21" cy="16" r="1.2"/></g><path d="M 16 21 Q 18 23 20 21" stroke="#FFFFFF" stroke-width="0.8" fill="none" stroke-linecap="round"/></svg>
</p>

<h1 align="center">CodePing</h1>

<p align="center">
  <a href="README.md">English</a>
</p>

<p align="center"><strong>Ping 在，你就不用盯着。</strong></p>

CodePing 是一个面向 AI 编程场景的桌面陪伴应用。它常驻桌面，实时感知 agent 的工作状态，让你在长任务执行时不必一直盯着终端。

## ✨ 功能特性

- 🎭 **实时状态同步** - 思考、打字、执行、完成等状态实时显示（Comate 延迟已优化）
- 🔔 **权限提示气泡** - 在桌面上弹出重要决策提示
- 🎨 **主题系统** - 3 个内置主题（Sunset、Calico、Lucy）+ 自定义支持
- 🌐 **多语言支持** - 英文 / 中文 / 韩文
- 😴 **智能休眠** - 20 秒无操作自动 idle，10 分钟深度睡眠
- 📏 **极简模式** - 紧凑的边缘吸附视图
- 🖱️ **交互反应** - 点击和拖拽动画反应
- 🔌 **插件系统** - 用户自定义主题支持
- ⚙️ **设置面板** - 全面的偏好设置界面

## 🤖 支持的 AI Coding Agent

| Agent | 状态 | 功能 |
|-------|------|------|
| Claude Code | ✅ 完全支持 | Hooks + 权限气泡 + 终端聚焦 |
| Comate | ✅ 已优化 | 实时同步（延迟修复） |
| Codex CLI | ✅ 支持 | 日志轮询 |
| Copilot CLI | ✅ 支持 | 基础状态追踪 |
| Cursor Agent | ✅ 支持 | 显示提示 + 权限 |
| Gemini CLI | ✅ 支持 | 会话轮询 |
| Kiro CLI | ✅ 支持 | Per-agent hooks |
| CodeBuddy | ✅ 支持 | Claude 兼容 hooks |
| opencode | ✅ 支持 | In-process 插件 |

## 📥 安装

### macOS（推荐）

**最新版本: v1.0.0** 🎉

根据您的 Mac 选择合适的版本：

| 平台 | 下载 | 大小 |
|------|------|------|
| **Apple Silicon (M1/M2/M3)** | [CodePing-1.0.0-arm64.dmg](https://github.com/Robot-2020/CodePing/releases/latest) | 138 MB |
| **Intel Mac** | [CodePing-1.0.0.dmg](https://github.com/Robot-2020/CodePing/releases/latest) | 142 MB |

**系统要求**: macOS 10.15+

#### 安装步骤

1. 下载对应 Mac 的 DMG 文件
2. 打开 DMG，将 CodePing 拖到应用程序文件夹
3. **右键**点击 CodePing.app → **"打开"** → 确认

> ⚠️ **首次启动需要右键** - 此版本使用临时签名。右键可绕过 macOS Gatekeeper。之后启动正常。

**替代方案**（如需要）：
```bash
xattr -cr /Applications/CodePing.app
```

### Windows

下载 [CodePing-Setup-1.0.0.exe](https://github.com/Robot-2020/CodePing/releases/latest) (118 MB)

1. 下载并运行安装程序
2. 按照安装向导进行
3. 从开始菜单或桌面快捷方式启动

### Linux

**AppImage**:
```bash
chmod +x CodePing-1.0.0.AppImage
./CodePing-1.0.0.AppImage
```

**Debian/Ubuntu**:
```bash
sudo dpkg -i codeping_1.0.0_amd64.deb
codeping
```

## 🚀 从源代码构建

```bash
# 克隆仓库
git clone https://github.com/Robot-2020/CodePing.git
cd CodePing

# 安装依赖
npm install

# 开发模式运行
npm start

# 构建 macOS
npm run build:mac

# 构建 Windows
npm run build

# 构建 Linux
npm run build:linux
```

## 📚 文档

- 📖 [安装指南](docs/guides/setup-guide.md)
- 🎨 [主题创建指南](docs/guides/guide-theme-creation.md)
- 📊 [状态映射参考](docs/guides/state-mapping.md)
- 🔧 [开发文档](CLAUDE.md)
- 📡 [多 Agent 架构](docs/project/project-architecture.md)

## 🛠️ 技术栈

- **Electron** - 桌面应用框架
- **Node.js** - 运行时环境
- **本地 Hooks** - AI coding agent 集成
- **SVG/APNG** - 动画资源

## 🐛 已知限制

1. **macOS 首次启动** 需要右键打开（临时签名）
2. **Windows 终端聚焦** 在多终端场景下可能有边界情况
3. **Codex CLI** 有约 1.5 秒的监控延迟（日志检测）
4. **Gemini CLI** 需要显式注册 hook

## 🔜 未来规划（v1.1+）

- 完整的 Apple 代码签名 + 公证
- Windows 代码签名
- 更多 agent 支持（Aider、Continue.dev）
- 语音通知
- 自定义动画创建 UI
- 云同步偏好设置

## 🙏 致谢

特别感谢：
- 所有 AI coding agent 团队的文档支持
- Beta 测试者的反馈
- Electron 和开源社区

## 📞 支持与反馈

- 🐛 [报告问题](https://github.com/Robot-2020/CodePing/issues)
- 💬 [讨论](https://github.com/Robot-2020/CodePing/discussions)
- 🌟 在 GitHub 上给个 Star！

## 📄 许可证

MIT

---

**🎉 CodePing v1.0.0 — 生产就绪！**

感谢使用 CodePing。祝你编码愉快！🚀
