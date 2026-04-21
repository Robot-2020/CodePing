# Comate 配额展示功能 - 使用指南

## 功能简介

Clawd 的 token 面板现已支持显示 Comate API 的配额使用情况，包括：
- 用户名
- 本月已用配额
- 永久配额
- 各个 agent 的成本分布（ducc、zulu 等）

## 启动应用

```bash
npm start
```

应用启动后会显示桌宠在屏幕右下角。

## 启用 Token 面板

1. **右键点击桌宠** → 看到右键菜单
2. **选择 "Token Stats"** → 浮窗弹出，显示 Claude token 使用情况

## 配置 Comate 监控

### 方式 1：通过 Settings 面板（推荐）

1. **打开 Settings** → 右键菜单 → Settings（或快捷键）
2. **找到 "Comate Monitor" 配置部分**
3. **填写以下信息**：
   - ✅ **Enable Comate Quota Tracking** — 勾选启用
   - 🔗 **API URL** — `https://oneapi-comate.baidu-int.com`
   - 👤 **Username** — 你的用户名（如 `wuzhiao`）
   - ⏱️ **Poll Interval** — 轮询间隔，默认 5000ms（5 秒）

4. **点击 "Test Connection"** → 验证 API 可用性
5. **如果连接成功** → 应用会立即开始轮询，token 面板自动更新为显示配额信息

### 方式 2：手动测试（开发者）

```bash
# 发送测试数据到 Claude hook
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "idle",
    "session_id": "test-123",
    "event": "SessionStart",
    "token_usage": {
      "input_tokens": 2500,
      "output_tokens": 1200,
      "cost_usd": 0.0850
    }
  }'
```

运行测试脚本：
```bash
bash test-comate.sh
```

## Token 面板显示内容

### Claude Token 部分（上）
```
Input:     2.5K
Output:    1.2K
---
Total:     3.7K
Cost:      $0.09
Context:   25% [===   ]
```

### Comate 配额部分（下）
```
User:                  wuzhiao
Monthly Used:          $4,210.98
Permanent Quota:       $6,000.00

ducc:                  $1,095.62
zulu:                  $3,111.97
iCode:                 $1.44
others:                $1.95
```

## 工作流程

```
1. Settings 中配置 API URL 和 username
   ↓
2. 启用 "Comate Monitor" 复选框
   ↓
3. 验证连接（可选）
   ↓
4. 应用自动启动后台轮询
   ↓
5. 每 5 秒（可配置）刷新一次配额数据
   ↓
6. 右键菜单启用 "Token Stats" 时显示在气泡上
   ↓
7. 鼠标 hover 气泡时亮度增加（opacity 80% → 100%）
```

## 故障排除

### 配额面板不显示
- ✅ 确保在 Settings 中启用了 "Enable Comate Quota Tracking"
- ✅ 检查 API URL 格式是否正确
- ✅ 检查用户名是否有拼写错误
- ✅ 点击 "Test Connection" 验证 API 可访问

### Token 面板显示但配额为空
- 可能是轮询还未完成（第一次请求可能需要 1-5 秒）
- 等待几秒后刷新菜单再看一遍
- 检查浏览器开发者工具 Console 是否有错误日志

### 连接测试失败
- 检查网络连接
- 验证 API URL 是否可访问：`curl https://oneapi-comate.baidu-int.com/api/mine/all_info?username=yourname`
- 确保用户名存在且拼写正确

## 性能考虑

- **轮询间隔** — 默认 5 秒，可在 Settings 中调整
- **最小间隔** — 1000ms（1 秒）
- **后台运行** — 即使气泡隐藏也继续轮询
- **故障停止** — 连续失败 5 次后自动停止，防止资源浪费
- **缓存对比** — 仅当数据变化时发送 IPC 更新

## 快捷键

- 💚 **右键菜单** — 访问所有选项
- 🎨 **Settings** — 快捷键可在菜单中查看（通常 Ctrl+, 或 Cmd+,）

## 编码细节

若要为应用集成其他数据源或自定义显示，核心文件包括：

| 文件 | 用途 |
|------|------|
| `src/comate-monitor.js` | 轮询器（可复制为其他服务） |
| `src/token-bubble.html` | UI 面板（扩展时修改此文件） |
| `src/main.js` | 主进程集成逻辑 |
| `src/settings-actions.js` | Settings 命令处理 |

## 常见问题

**Q: 能否同时显示多个用户的配额？**
A: 当前版本仅支持单个用户名。多用户切换可通过重新配置 Settings 后重启轮询实现。

**Q: 能否自定义轮询间隔？**
A: 可以。在 Settings 中的 "Poll Interval (ms)" 字段修改，默认 5000ms。

**Q: 关闭应用时会清理什么？**
A: 停止轮询线程，清理缓存的配额数据。重启应用时会根据 Settings 重新初始化。

**Q: 能否导出配额数据历史？**
A: 当前版本不支持历史记录。配额数据仅实时显示，未持久化存储。

---

**更多问题？** 查看项目文档：
- [comate-integration.md](memory/comate-integration.md) — 技术实现细节
- [token-panel-architecture.md](memory/token-panel-architecture.md) — token 面板架构
