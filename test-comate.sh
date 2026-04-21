#!/bin/bash
# 测试脚本：向 token bubble 发送模拟的 Comate 配额数据

# 测试数据
TEST_DATA=$(cat <<'EOF'
{
  "state": "idle",
  "session_id": "test-session-123",
  "event": "SessionStart",
  "token_usage": {
    "input_tokens": 2500,
    "output_tokens": 1200,
    "cache_creation_tokens": 500,
    "cache_read_tokens": 5000,
    "cost_usd": 0.0850
  }
}
EOF
)

# 模拟 Comate 配额数据
COMATE_DATA=$(cat <<'EOF'
{
  "state": "idle",
  "session_id": "test-session-123",
  "event": "StateUpdate",
  "comate_quota": {
    "username": "wuzhiao",
    "monthly_used_quota": 4210.98,
    "permanent_quota": 6000,
    "agent_costs": {
      "ducc": 1095.62,
      "zulu": 3111.97,
      "iCode": 1.44,
      "others": 1.95
    }
  }
}
EOF
)

echo "📤 发送 Claude token 数据..."
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d "$TEST_DATA" 2>/dev/null && echo "✓ 成功"

sleep 2

echo ""
echo "💡 提示："
echo "  1. 确保应用已启动 (npm start)"
echo "  2. 右键菜单开启 'Token Stats' 显示 token 面板"
echo "  3. 查看浮窗是否显示 Claude token 数据"
echo ""
echo "📝 注意："
echo "  - Comate 数据通过 settings-actions.js 的 testComateConnection 命令测试"
echo "  - 或在 Settings 面板中配置 API URL 和 username 后自动轮询"
echo ""
