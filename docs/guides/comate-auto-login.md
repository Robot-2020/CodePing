# Comate API 自动登录指南

## 🎯 功能概述

Clawd 现已支持 **Comate API 自动登录**功能，无需手动复制 Cookie。只需点击一个按钮，Clawd 会自动打开浏览器、等待您完成登录、并自动提取认证 Cookie。

## 📝 快速开始

### 前置条件
- ✅ Clawd 已启动
- ✅ Settings 面板可访问（右键菜单 → Settings）
- ✅ 您的 Comate API URL 已配置（如 `https://oneapi-comate.baidu-int.com`）

### 3 步完成自动登录

#### 1️⃣ 打开 Settings → Comate Monitor 部分
在 Clawd 的 Settings 面板中找到 **Comate Monitor** 配置区域。

#### 2️⃣ 输入 API URL
在 "API URL" 字段中输入您的 Comate API 地址（例如 `https://oneapi-comate.baidu-int.com`）

#### 3️⃣ 点击 "Auto Login" 按钮
- 浏览器会自动打开
- 您将看到 UUAP 登录页面
- **在浏览器中完成登录**（输入用户名和密码）
- 登录成功后，浏览器窗口会自动关闭
- **Cookie 字段会自动填充**
- 系统会自动验证连接并提示成功

## 🔄 工作流程详解

```
点击 "Auto Login"
    ↓
Puppeteer 启动浏览器
    ↓
自动导航到 API 登录页面
    ↓
您在浏览器中输入 UUAP 凭证
    ↓
系统检测到登录成功（HTTP 200）
    ↓
自动提取所有 Cookie
    ↓
关闭浏览器窗口
    ↓
自动填充 Settings 中的 Cookie 字段
    ↓
✅ 连接已验证
```

## 💡 三种认证方式对比

| 方式 | 手动复制 Cookie | 自动登录（推荐）| API Token |
|------|-----------------|-----------------|-----------|
| 复杂度 | ⚠️ 复杂（5步） | ✅ 简单（3步） | 🔮 待支持 |
| 时间 | ~2 分钟 | ~30 秒 | TBD |
| 用户干预 | 多步手动操作 | 仅浏览器登录 | 一次配置 |
| Cookie 过期处理 | 需要重复手动操作 | 可点击按钮重新登录 | 长期有效 |
| 当前状态 | ✅ 可用 | ✅ 已实现 | ⏳ 计划中 |

## 🔐 安全性考量

### Auto Login 如何工作
1. **不存储密码** — 只在浏览器中输入，Node.js 进程永远看不到密码
2. **自动提取 Cookie** — 从浏览器的 HTTP Cookie 存储中读取
3. **本地存储** — Cookie 仅保存在 `clawd-prefs.json` 中（您的计算机本地）
4. **可随时更新** — 点击 "Auto Login" 按钮可随时更新 Cookie

### Cookie 过期怎么办？
如果 Comate 的 Cookie 过期了（通常几天到几周），只需：
1. 再次点击 "Auto Login" 按钮
2. 在浏览器中重新登录
3. Cookie 会自动更新

## ⚙️ 配置选项

| 选项 | 说明 |
|------|------|
| **API URL** | Comate API 地址（必填） |
| **Username** | 用于测试连接的用户名（可选） |
| **Cookie** | 自动提取或手动输入的认证 Cookie（可选） |
| **Poll Interval** | 后台轮询数据更新间隔（默认 5 秒） |
| **Enable Monitor** | 是否启用 Comate 配额监控（勾选启用） |

## 🆘 故障排除

### 问题：Auto Login 按钮不可点击
**解决方案**：
- 确保 API URL 已填写且有效
- 确保应用有互联网连接

### 问题：浏览器打开后立即关闭
**解决方案**：
- 检查 Node.js 控制台日志（F12 → Console 或 terminal）
- 可能是网络连接问题或 API URL 错误
- 尝试手动打开 API URL 确认服务可访问

### 问题：登录后浏览器未关闭
**解决方案**：
- 给系统 120 秒的时间检测登录完成
- 如果超过 120 秒，会自动超时并关闭
- 手动关闭浏览器后重试

### 问题：Auto Login 成功但 Cookie 字段未填充
**解决方案**：
- 这不应该发生，但如果发生了：
  1. 检查浏览器控制台是否有错误
  2. 尝试手动刷新 Settings 页面
  3. 重启 Clawd 应用

### 问题：Test 测试仍然返回 HTTP 302
**解决方案**：
- 您的 Cookie 可能已过期
- 点击 "Auto Login" 按钮重新登录以更新 Cookie
- 或手动粘贴新的 Cookie（从浏览器 F12 复制）

## 📚 备选方案：手动 Cookie 输入

如果 Auto Login 不适用于您的环境，可以使用手动 Cookie 输入：

### 步骤
1. 打开 Comate 官网并登录（使用您的浏览器）
2. 打开浏览器 F12（开发者工具）
3. 转到 **Application → Cookies**
4. 找到 `SECURE_ZT_GW_TOKEN` Cookie
5. 复制其值
6. 在 Settings 中的 "Cookie (Optional)" 字段粘贴
7. 点击 "Test" 验证连接

## 🔗 相关链接

- [Comate 官方文档](https://comate.baidu.com)
- [CLAUDE.md - 项目配置说明](../CLAUDE.md)

## 📞 需要帮助？

如果遇到问题：
1. 查看此指南的故障排除部分
2. 检查应用日志（通常在 `~/.clawd/logs/` 目录下）
3. 在项目 GitHub Issues 中提交问题

---

**更新于**: 2026-04-21
**Auto Login 实现**: ✅ Puppeteer 自动化
**测试状态**: ✅ 所有单元测试通过
