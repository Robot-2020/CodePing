# Comate Monitor 配置指南 - 快速开始

## 🔄 重启应用

首先需要重新启动应用以加载新的 Settings 面板：

```bash
# 关闭现有的应用（按 Cmd+Q 或强制关闭进程）
pkill -f "Electron.app/Contents/MacOS/Electron"

# 重新启动
npm start
```

## ⚙️ 完整配置步骤

### 1️⃣ 打开 Settings
右键点击屏幕右下角的桌宠 → 看到菜单 → 点击 "Settings"

### 2️⃣ 在 General 标签找到 "Comate Monitor" 部分

你会看到以下配置项：

**Enable Comate Quota Tracking**（复选框）
- [ ] 先不勾选，先填写其他信息

**API URL**（文本输入框）
- 输入：`https://oneapi-comate.baidu-int.com`

**Username**（文本输入框）
- 输入：你的用户名（例如 `wuzhiao`）

**Poll Interval (ms)**（数字输入框）
- 输入：`5000`（表示每 5 秒更新一次）
- 最小值：`1000`

**Test Connection**（按钮）
- 点击这个按钮验证 API 是否可以访问

### 3️⃣ 测试连接

填写完 API URL 和 Username 后：
1. 点击 "Test Connection" 按钮
2. 等待 5 秒以内看到结果
3. 如果成功，你会看到：✓ Connected successfully. Username: wuzhiao
4. 如果失败，会看到错误信息

### 4️⃣ 启用 Comate Monitor

连接测试成功后：
1. 勾选 "Enable Comate Quota Tracking" 复选框
2. 应用会自动开始后台轮询
3. 等待 5 秒（第一次轮询间隔）

### 5️⃣ 查看配额信息

关闭 Settings 窗口后：
1. 右键点击桌宠
2. 选择 "Token Stats"
3. 浮窗会弹出，显示：
   - Claude token 信息（Input/Output/Total/Cost）
   - **Comate 配额信息**（Username/Monthly Used/Permanent Quota）
   - **各 Agent 成本**（ducc/zulu/iCode/others）

## 🔍 配置文件位置

所有配置会自动保存到：

**macOS:**
```
~/.clawd/clawd-prefs.json
```

你可以在这个文件中看到 comateMonitor 配置：
```json
{
  "comateMonitor": {
    "enabled": true,
    "apiUrl": "https://oneapi-comate.baidu-int.com",
    "username": "wuzhiao",
    "pollIntervalMs": 5000
  }
}
```

## ❓ 常见问题

### Q: 配置后没有看到 Comate 数据？

A: 检查以下几点：
1. ✓ Settings 中 "Enable Comate Quota Tracking" 是否勾选
2. ✓ "Test Connection" 是否显示成功
3. ✓ 等待至少 5 秒（轮询间隔）
4. ✓ 关闭再打开 "Token Stats" 浮窗
5. ✓ 检查 API URL 是否正确（没有多余空格）
6. ✓ 检查用户名拼写是否正确

### Q: API 连接超时？

A:
- 检查网络连接是否正常
- 验证 API URL 可以手动访问：
  ```bash
  curl "https://oneapi-comate.baidu-int.com/api/mine/all_info?username=wuzhiao"
  ```

### Q: Settings 中看不到 Comate Monitor 部分？

A:
- 确保已重新启动应用（npm start）
- 检查应用是否真的关闭了（之前的进程是否还在运行）

### Q: 修改了轮询间隔后没有生效？

A:
- 修改后会自动保存
- 新的间隔会在下一次轮询时应用
- 不需要重启应用

## 💡 测试配置

如果你想验证 Claude token 数据是否工作：

```bash
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "idle",
    "session_id": "test-123",
    "event": "SessionStart",
    "token_usage": {
      "input_tokens": 2500,
      "output_tokens": 1200,
      "cache_creation_tokens": 500,
      "cache_read_tokens": 5000,
      "cost_usd": 0.0850
    }
  }'
```

然后右键菜单 → "Token Stats" 应该能看到数据。

---

**祝你配置顺利！如有问题可查看 COMATE_GUIDE.md**
