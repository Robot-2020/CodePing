# Comate Monitor 状态管理重写

## 问题描述

当前 `hooks/comate-monitor.js` 的状态管理存在严重问题：

1. **提问无感知**：用户在 Comate 中输入问题后，桌宠没有进入 thinking/working 状态，只有在权限请求（permission pending）场景下才能触发状态变化
2. **状态不归位**：对话结束后桌宠仍停留在 working 状态，无法正确回到 idle
3. **缺少完成动画**：由于 working 检测不准确，`attention`（完成动画）几乎不会触发
4. **缺少 thinking 状态**：没有区分"用户提问后等待 AI 思考"和"AI 正在执行工具"两个阶段
5. **状态流转混乱**：仅靠 `msg.status === "inProgress"` 判断工作状态不可靠，Comate 的 status 字段更新时机不确定

## Comate Session 文件实际数据结构（基于真实日志分析）

通过读取 `~/.comate-engine/store/chat_session_*` 文件，得到以下真实的数据结构：

### 顶层字段

```json
{
  "source": "AgentConversation" | "SpecConversation",
  "sessionUuid": "uuid-string",
  "specSessionId": "timestamp-random",
  "messages": [...],
  "title": "对话标题",
  "ctime": 1776681321003,  // 创建时间 (ms)
  "utime": 1776681645247,  // 更新时间 (ms)
  "workspaceDirectory": "/path/to/project",
  "summary": "摘要文本",
  "fileCache": [...]
}
```

### 消息状态 (`message.status`) — 仅 3 个值

| 值 | 含义 | 出现时机 |
|---|------|---------|
| `inProgress` | AI 正在生成回复 | assistant 消息正在执行中 |
| `success` | 消息完成 | user 消息始终是 success；assistant 正常完成时变为 success |
| `cancelled` | 消息被取消 | 用户手动取消了 AI 回复 |

### 工具状态 (`element.child.toolState`) — 6 个值

| 值 | 含义 | 是否终态 |
|---|------|---------|
| `pending` | 工具已排队，尚未开始执行 | 否（非终态） |
| `executing` | 工具正在执行（或等待权限批准） | 否（非终态） |
| `executed` | 工具执行完毕 | 是（终态） |
| `failed` | 工具执行失败 | 是（终态） |
| `cancelled` | 工具被取消 | 是（终态） |
| `skipped` | 工具被跳过 | 是（终态） |

### 工具元数据状态 (`result.metadata.state`) — 8 个值

| 值 | 含义 | 对应桌宠状态 |
|---|------|-------------|
| `pending` | 等待用户批准权限 | **notification**（权限请求音效） |
| `running` | 工具正在运行 | **working** |
| `completed` | 工具成功完成 | working（继续）或 idle（最后一个工具完成） |
| `success` | 工具成功完成（同 completed） | 同上 |
| `aborted` | 工具被中止 | error |
| `interrupted` | 工具被中断 | error |
| `cancelled` | 工具被取消 | idle |
| `rejected` | 用户拒绝了权限 | idle（取消操作） |

### 工具 child 节点字段

```json
{
  "type": "TOOL",
  "toolName": "run_command" | "read_file" | "edit_file" | "write_file" | "glob_path" | ...,
  "toolState": "executing" | "executed" | "failed" | "cancelled" | "skipped",
  "params": { ... },
  "accepted": true | null,
  "startTime": timestamp,
  "lastModifiedTime": timestamp,
  "result": {
    "metadata": {
      "state": "pending" | "running" | "completed" | ...,
      "autoRun": false,
      "success": true | false,
      "output": "...",
      "taskId": "...",
      ...
    }
  }
}
```

### 其他 child 类型

- `REASON` — AI 思考过程
- `TEXT` — 文本回复内容

## 核心设计思路

参考 `clawd-hook.js`（Claude Code hook）的事件驱动模型，monitor 需要从 session 文件的 **消息序列变化** 中推断出等效的事件流：

| 推断事件 | 对应 clawd-hook 事件 | 触发条件（基于实际字段） |
|---------|---------------------|---------|
| 新会话出现 | SessionStart | 发现新的 session 文件 |
| 用户发送消息 | UserPromptSubmit | 消息数量增加，且最新消息 role=user |
| AI 开始响应 | PreToolUse | 最新 assistant 消息 status=`inProgress` |
| 工具正在执行 | PostToolUse | toolState=`executing` + metadata.state=`running` |
| 工具等待权限 | PermissionRequest | toolState=`executing` + metadata.state=`pending` |
| 工具执行失败 | PostToolUseFailure | toolState=`failed` 或 metadata.state=`aborted`/`interrupted` |
| AI 回复完成 | Stop | assistant status 从 `inProgress` 变为 `success` |
| 用户取消回复 | Stop | assistant status 变为 `cancelled` |
| 会话超时 | SessionEnd | 文件长时间无更新 |

## 技术方案

### 1. 基于消息快照对比的变化检测

为每个 session 文件维护一个快照（snapshot），每次轮询时与新快照对比推断事件：

```javascript
const trackedSession = {
  filePath: string,
  sessionId: string,         // sessionUuid 从文件名提取
  lastMtime: number,         // 文件修改时间
  lastSize: number,          // 文件大小
  messageCount: number,      // 消息总数
  lastAssistantStatus: string | null,  // 最后 assistant 消息的 status
  lastToolSnapshot: string,  // 最后 assistant 消息中所有工具状态的摘要
  inferredState: string,     // 当前推断状态: idle/thinking/working/notification
  lastActiveAt: number,      // 最后活跃时间（文件有实际变化的时间）
  completionSentAt: number,  // 发送完成事件的时间（防重复）
};
```

### 2. 状态推断逻辑（核心改动）

```javascript
function inferState(prev, parsed) {
  const { messageCount, lastMsg, lastAssistantStatus, pendingTool, hasExecutingTool, hasFailedTool } = parsed;

  // === 优先级 1: 权限请求 ===
  // toolState=executing + metadata.state=pending → 需要用户批准
  if (pendingTool) {
    return { state: "notification", event: "PermissionRequest" };
  }

  // === 优先级 2: 工具执行失败 ===
  if (hasFailedTool) {
    return { state: "error", event: "PostToolUseFailure" };
  }

  // === 优先级 3: 正在执行 ===
  if (lastAssistantStatus === "inProgress") {
    // 有正在执行的工具 → working
    if (hasExecutingTool) {
      return { state: "working", event: "PreToolUse" };
    }
    // 没有执行中的工具但 status=inProgress → AI 在思考/生成文本
    // 如果之前是 idle/thinking 且消息数增加 → 新的提问触发的思考
    if (!prev || prev.inferredState === "idle" || messageCount > (prev ? prev.messageCount : 0)) {
      return { state: "thinking", event: "UserPromptSubmit" };
    }
    // 否则继续当前的 working/thinking
    return { state: prev.inferredState === "thinking" ? "thinking" : "working", event: null };
  }

  // === 优先级 4: 完成/取消 ===
  if (lastAssistantStatus === "success" || lastAssistantStatus === "cancelled") {
    // 从工作状态转入 → 发送完成事件
    if (prev && (prev.inferredState === "working" || prev.inferredState === "thinking" || prev.inferredState === "notification")) {
      return { state: "idle", event: "Stop" };
    }
    return { state: "idle", event: null };
  }

  // === 默认: 空闲 ===
  return { state: "idle", event: null };
}
```

### 3. 正确使用 updateSession API

当前代码直接调用 `postStateToClawdSync("working", "PreToolUse")` 绕过了服务端的 session 管理。重写后将正确传递 event 和 session_id，让 `src/state.js` 的 `updateSession()` 处理状态优先级、oneshot 动画、stale 清理等逻辑。

关键改动：
- `session_id` 使用 session 的 UUID（如 `f4b7a702-acd9-4b7b-9b2d-dad54b268f69`）而非固定的 `"comate-monitor"`，支持多会话追踪
- 正确传递 `event` 字段，让 state.js 知道这是 UserPromptSubmit/PreToolUse/Stop/SessionEnd 等
- 完成时发送 `state: "attention", event: "Stop"` 触发完成动画
- 会话结束时发送 `state: "sleeping", event: "SessionEnd"` 
- 传递 `cwd`（从 `workspaceDirectory` 字段获取）提升 session dashboard 展示
- 传递 `session_title`（从 `title` 字段获取）

### 4. 状态流转设计

完整映射到 clawd-hook.js 的 EVENT_TO_STATE：

```
新 session 文件出现
  → idle (SessionStart)
    → thinking (UserPromptSubmit, 新 user 消息出现，assistant status 变为 inProgress)
      → working (PreToolUse, 检测到 toolState=executing + metadata.state=running)
        → notification (PermissionRequest, toolState=executing + metadata.state=pending)
          → working (权限通过后 metadata.state 变为 running/completed)
        → error (PostToolUseFailure, toolState=failed) [oneshot, 自动回 working/idle]
        → attention (Stop, status 从 inProgress 变为 success) [oneshot, 自动回 idle]
          → idle (等待下一次交互)
            → thinking (新一轮提问)
              → ...
      → attention (Stop, 纯文本回复完成) [oneshot, 自动回 idle]

用户取消 (status 变为 cancelled)
  → attention (Stop, 自动回 idle)

文件超时无更新 (SESSION_IDLE_TIMEOUT_MS)
  → sleeping (SessionEnd)

inProgress 状态但文件停止更新超过 COMPLETION_GRACE_MS
  → attention (Stop, 推断完成)
```

### 5. 完成检测改进

当前最大的问题是"如何检测 AI 回答完成"。通过分析实际日志，发现：
- Comate **会**将 `msg.status` 从 `inProgress` 更新为 `success` 或 `cancelled`
- 但 `msg.status` 更新可能延迟或在极端情况下不更新

**多信号融合判断**：
1. **status 变化**（最可靠）：status 从 `inProgress` 变为 `success`/`cancelled` → 确认完成
2. **文件停止更新** + **status 仍是 inProgress**：文件 mtime 超过 `COMPLETION_GRACE_MS`（15秒）没有变化 → 推断完成
3. **新 user 消息出现**：在 working 状态下出现新 user 消息 → 上一轮已结束，进入新一轮 thinking

### 6. 超时和清理

- `COMPLETION_GRACE_MS = 15000`：status=inProgress 但文件停止更新的宽限期（15秒）
- `SESSION_IDLE_TIMEOUT_MS = 300000`：会话空闲超时（5分钟），发送 SessionEnd
- `POLL_INTERVAL_MS = 1000`：轮询间隔保持 1 秒
- 进程检测保留，间隔 10 秒

## 受影响文件

| 文件 | 修改类型 | 说明 |
|-----|---------|-----|
| `hooks/comate-monitor.js` | **重写** | 核心文件，完全重写状态推断和事件映射逻辑 |

其他文件不需要修改。`src/state.js` 和 `src/server.js` 已有完善的 session 管理和状态机，monitor 只需正确调用 POST /state API 即可。

## 详细实现

### postState 函数

```javascript
function postState(state, event, sessionId, extra = {}) {
  const body = JSON.stringify({
    state,
    event,
    session_id: sessionId,
    agent_id: "comate",
    ...extra,
  });
  // POST to 127.0.0.1:CLAWD_PORT/state
}
```

### parseSessionFile 函数

返回结构化的会话快照，不做状态判断：

```javascript
function parseSessionFile(filePath) {
  // 返回 snapshot:
  // {
  //   sessionUuid: string,
  //   title: string | null,
  //   cwd: string | null,
  //   messageCount: number,
  //   lastMsgRole: "user" | "assistant" | null,
  //   lastAssistantStatus: "inProgress" | "success" | "cancelled" | null,
  //   pendingTool: { toolName, params } | null,     // toolState=executing + meta.state=pending
  //   hasExecutingTool: boolean,                     // toolState=executing + meta.state=running
  //   hasFailedTool: boolean,                        // toolState=failed
  //   summary: string | null,
  // }
}
```

### poll 主循环

```javascript
function poll() {
  // 1. 扫描 TOP_N 最新文件
  // 2. 检测新文件 → postState("idle", "SessionStart", sessionId)
  // 3. 检测消失的文件 → postState("sleeping", "SessionEnd", sessionId)
  // 4. 对每个文件：
  //    a. 文件未变化且无超时 → 跳过
  //    b. 文件未变化但超过宽限期（working 状态下）→ 推断完成
  //    c. 文件未变化但超过空闲超时 → 发送 SessionEnd
  //    d. 文件有变化 → parseSessionFile → inferState → postState
}
```

## 边界条件和异常处理

1. **文件读取/JSON 解析失败**：保持上一次的状态，不做状态变更
2. **服务端未启动**：HTTP 请求静默失败
3. **多个活跃 session**：每个 session 独立跟踪，使用各自的 sessionUuid
4. **Comate 进程退出**：通过 pgrep 检测，强制所有活跃 session 发送 SessionEnd
5. **Monitor 被 kill**：cleanup handler 发送所有活跃 session 的 SessionEnd
6. **文件权限变化/损坏**：同 1，静默跳过

## 预期效果

修复后的状态流转：
- 用户提问 → 桌宠立即进入 thinking 动画
- AI 开始执行工具 → 桌宠切换到 working 动画
- AI 需要权限 → 桌宠播放 notification 动画+音效
- 工具执行失败 → 桌宠播放 error 动画
- AI 完成回答 → 桌宠播放 attention（完成）动画，然后回到 idle
- 用户取消 → 同完成流程
- 长时间无交互 → 桌宠进入 sleeping 状态
