# Comate API 认证指南

## 问题现象

在配置 Comate Monitor 时，API 连接测试返回 `HTTP 302`，这是因为 Comate API 需要用户认证（使用百度内网 UUAP 登录系统）。

## 解决方案：三步认证流程

### 🔐 步骤 1：打开登录页面

在 Settings 中的 "Comate Monitor" 部分，点击 **"Login"** 按钮：

```
┌─────────────────────────────────┐
│ Test Connection                 │
│ 验证 API 是否可访问              │
├─────────────────────────────────┤
│ [Login] [Test]                  │
└─────────────────────────────────┘
```

**Login 按钮功能：**
- 自动打开浏览器访问 Comate API 首页
- 浏览器会自动跳转到 UUAP 登录系统
- 此过程会在浏览器中设置 Cookie

### 📱 步骤 2：完成 UUAP 登录

浏览器打开后：

1. 使用你的百度内网账号登录（工号 + 密码 或 SSO）
2. 登录成功后，浏览器会跳转回 Comate 页面
3. **不要关闭浏览器窗口** —— Cookie 需要在浏览器中保存
4. 返回 Clawd 应用

**重要：** 登录后的 Cookie 是 **HttpOnly** 的，只能在浏览器的 HTTP 请求中使用，不能通过 JavaScript 直接读取。

### ✅ 步骤 3：验证连接

返回 Clawd Settings，点击 **"Test"** 按钮验证连接。

**预期结果：**
- 如果连接成功，显示：`✓ Connected successfully. Username: wuzhiao`
- 如果仍失败，尝试以下操作：
  1. 重启浏览器（确保 Cookie 已保存）
  2. 重新运行 Login 流程
  3. 检查网络连接

## 🍪 Cookie 工作原理

### 在浏览器中

```
用户浏览器发起请求
  ↓
浏览器自动附加 Cookie: SECURE_ZT_GW_TOKEN=xxx
  ↓
API 服务器验证 Cookie
  ↓
返回用户数据（HTTP 200）
```

### 在 Clawd 应用中

由于 Clawd 是 Node.js/Electron 应用（不是浏览器），它无法直接访问浏览器的 Cookie。

**当前的工作流：**

1. **登录流程（手动）**
   - 用户在浏览器中登录 → Cookie 保存在浏览器
   - 浏览器 Cookie 存储区域与 Clawd 应用隔离

2. **轮询流程（自动）**
   - Clawd 使用 Node.js HTTP 客户端轮询 API
   - 每次请求不带 Cookie → 返回 302 重定向
   - 后续版本需要实现 Cookie 跨应用传递机制

## 🔄 改进方案（长期）

### 方案 A：浏览器自动化（推荐）
- 使用 Puppeteer 或 Playwright 自动化浏览器登录
- 从浏览器的 Cookie 存储读取 Cookie
- 将 Cookie 传递给 Node.js HTTP 客户端

**优点：** 完全自动化，用户无感知
**缺点：** 增加依赖，可能有性能开销

### 方案 B：本地 Cookie 存储
- Settings 中添加一个"获取并保存 Cookie"的步骤
- 用户登录后，手动复制 Cookie 值
- 将 Cookie 持久化到 `~/.clawd/clawd-prefs.json`

**优点：** 无需新依赖
**缺点：** 需要用户手动操作，Cookie 可能过期

### 方案 C：直接 Token 认证
- 与 Comate 团队沟通，获取 API Token 而非 Cookie 认证
- 使用 Bearer Token 或类似的认证方式

**优点：** 最简洁，符合现代 API 设计
**缺点：** 需要团队支持

## 📝 当前状态

| 项目 | 状态 | 说明 |
|------|------|------|
| **UI 实现** | ✅ 完成 | Settings 中已有 Login + Test 按钮 |
| **浏览器登录** | ✅ 完成 | Login 按钮打开浏览器自动跳转 |
| **Cookie 读取** | ❌ 不支持 | 浏览器 Cookie 无法跨进程访问 |
| **后端轮询** | ⚠️ 有限支持 | 轮询时无 Cookie，返回 302 |
| **错误处理** | ✅ 完成 | 302 时自动停止轮询，提示用户 |

## 🎯 推荐使用流程（当前版本）

**如果你能访问浏览器中的 Cookie：**

1. 点击 Login 按钮，浏览器中完成登录
2. 在浏览器开发者工具中（F12 → Application → Cookies）
3. 找到 `oneapi-comate.baidu-int.com` 的 Cookie
4. 复制完整的 Cookie 字符串（例如：`SECURE_ZT_GW_TOKEN=xxx123...`）
5. Settings 中会有一个高级选项来设置 Cookie（开发中）
6. 粘贴 Cookie 并保存

**长期解决方案等待中：**

Clawd 团队正在开发自动 Cookie 提取功能，敬请期待！

## 🔗 相关文件

- `src/comate-monitor.js` - 轮询引擎（已支持 Cookie 参数）
- `src/settings-renderer.js` - Settings UI（已有 Login 按钮）
- `src/settings-actions.js` - 命令处理（已有 openComateAuthUrl）

## 💡 故障排除

### Q: Login 按钮打开了浏览器，但登录后仍显示 302？

A: 这是正常现象。浏览器中的 Cookie 无法自动传递到 Clawd 应用。
   需要等待后续版本支持自动 Cookie 提取。

### Q: 我想立即使用 Comate 配额监控怎么办？

A: 可以尝试以下方法：
   1. 在浏览器中打开 API 端点（已登录）获取数据
   2. 复制 JSON 响应
   3. 等待 Clawd 支持 Token 或自动 Cookie 机制

### Q: Cookie 会过期吗？

A: 是的。UUAP 的 Cookie 通常有有效期。
   重新点击 Login 按钮重新登录即可。

## 📞 获取帮助

如有问题，请查看：
- `COMATE_GUIDE.md` - 基本使用指南
- `COMATE_CONFIG.md` - 快速配置
- `IMPLEMENTATION_REPORT.md` - 技术细节
