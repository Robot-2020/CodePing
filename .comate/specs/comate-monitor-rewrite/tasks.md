# Comate Monitor 状态管理重写

- [x] Task 1: 重写 comate-monitor.js 核心框架和数据结构
    - 1.1: 保留配置常量（STORE_DIR、POLL_INTERVAL_MS、CLAWD_PORT 等），新增 COMPLETION_GRACE_MS=15000、SESSION_IDLE_TIMEOUT_MS=300000、PROCESS_CHECK_INTERVAL_MS=10000
    - 1.2: 定义终态工具状态集合 TERMINAL_TOOL_STATES = new Set(["executed", "failed", "cancelled", "skipped"])
    - 1.3: 实现 trackedSessions Map 数据结构，存储每个 session 的快照（sessionId, lastMtime, messageCount, lastAssistantStatus, lastToolSnapshot, inferredState, lastActiveAt, cwd, title 等）
    - 1.4: 重写 postState(state, event, sessionId, extra) 函数，支持传递 session_id/event/cwd/session_title/agent_id 字段
    - 1.5: 保留 log() 函数和 DIAGNOSTIC_MODE 诊断日志

- [x] Task 2: 重写 parseSessionFile 函数，返回结构化快照
    - 2.1: 解析 sessionUuid、title、workspaceDirectory 顶层字段
    - 2.2: 统计 messageCount，找到最后一条 user 和 assistant 消息
    - 2.3: 提取最后一条 assistant 消息的 status（inProgress/success/cancelled）
    - 2.4: 遍历最后一条 assistant 消息的 elements.children，检测所有 TOOL 类型子节点
    - 2.5: 识别权限请求工具：toolState=executing + result.metadata.state=pending → pendingTool
    - 2.6: 识别执行中工具：toolState=executing + result.metadata.state=running，或 toolState=pending → hasNonTerminalTool
    - 2.7: 识别失败工具：toolState=failed → hasFailedTool
    - 2.8: 计算 allToolsTerminal：所有 TOOL 的 toolState 是否都在 TERMINAL_TOOL_STATES 中
    - 2.9: 返回完整快照对象 { sessionUuid, title, cwd, messageCount, lastMsgRole, lastAssistantStatus, pendingTool, hasNonTerminalTool, hasFailedTool, allToolsTerminal, summary }

- [x] Task 3: 实现 inferState 状态推断函数
    - 3.1: 优先级 1 — 权限请求：pendingTool 存在 → return { state: "notification", event: "PermissionRequest" }
    - 3.2: 优先级 2 — 工具失败：hasFailedTool → return { state: "error", event: "PostToolUseFailure" }
    - 3.3: 优先级 3 — status=inProgress + hasNonTerminalTool → return { state: "working", event: "PreToolUse" }
    - 3.4: 优先级 4 — status=inProgress + allToolsTerminal（无非终态工具）→ AI 正在生成文本，对比前一快照判断：如果 prev 是 idle 或消息数增加 → return { state: "thinking", event: "UserPromptSubmit" }；否则维持 working/thinking
    - 3.5: 优先级 5 — status=success/cancelled → 如果 prev 是 working/thinking/notification → return { state: "attention", event: "Stop" }；否则 return { state: "idle", event: null }
    - 3.6: 默认 — return { state: "idle", event: null }

- [x] Task 4: 重写 poll 主循环
    - 4.1: 扫描 STORE_DIR 下 chat_session_* 文件，按 mtime 降序取 TOP_N 个
    - 4.2: 检测新出现的 session 文件 → postState("idle", "SessionStart", sessionId, { cwd, session_title })
    - 4.3: 检测已消失的 session 文件 → postState("sleeping", "SessionEnd", sessionId)，从 trackedSessions 中删除
    - 4.4: 对每个文件：比较 mtime/size 判断是否有变化
    - 4.5: 文件有变化 → parseSessionFile → inferState(prev, parsed) → 如果状态/事件改变则 postState
    - 4.6: 文件无变化 + prev.inferredState 是 working/thinking + 文件 age > COMPLETION_GRACE_MS → 推断完成，发送 attention/Stop
    - 4.7: 文件无变化 + prev.inferredState 是 idle + 文件 age > SESSION_IDLE_TIMEOUT_MS → 发送 sleeping/SessionEnd，清理 trackedSession
    - 4.8: status=inProgress + allToolsTerminal + 文件无变化 → 立即推断完成（不等待 COMPLETION_GRACE_MS）

- [x] Task 5: 实现进程检测和清理逻辑
    - 5.1: 保留 checkComateProcess 函数（pgrep/wmic），间隔 PROCESS_CHECK_INTERVAL_MS 调用
    - 5.2: 进程退出时遍历所有 trackedSessions，发送 sleeping/SessionEnd 并清空
    - 5.3: 实现 cleanup 函数：SIGINT/SIGTERM 时遍历所有活跃 session 发送 SessionEnd
    - 5.4: 实现 main 函数：启动轮询、注册信号处理、输出启动日志

- [x] Task 6: 端到端验证
    - 6.1: 用当前活跃的 session 文件验证 parseSessionFile 能正确解析
    - 6.2: 用已完成（status=success）的 session 验证正确返回 idle
    - 6.3: 用卡住（status=inProgress + allToolsTerminal）的 session 验证推断为完成
    - 6.4: 语法检查，确保无运行时错误
