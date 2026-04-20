#!/bin/bash
# Comate Permission Request Monitor
# Usage: 运行此脚本，然后在 Comate 里发起需要权限的命令，观察输出

LOG_FILE="/tmp/comate-monitor.log"
CHECK_INTERVAL=0.5  # 500ms 检查一次

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Comate 权限请求监控器"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 监控内容："
echo "  • Comate session 文件变化"
echo "  • 权限请求检测（pending tools）"
echo "  • Monitor 日志输出"
echo ""
echo "⏳ 开始监控..."
echo "   请在 Comate 中发起需要权限的命令（如 echo、ls 等）"
echo "   按 Ctrl+C 停止监控"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

STORE_DIR="$HOME/.comate-engine/store"
LAST_CHECK=""
LAST_LOG_LINE=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)

while true; do
  # 检查最新的 session 文件
  LATEST_FILE=$(ls -t "$STORE_DIR"/chat_session_* 2>/dev/null | head -1)

  if [ -n "$LATEST_FILE" ]; then
    # 检查文件修改时间
    CURRENT_CHECK=$(stat -f "%m" "$LATEST_FILE" 2>/dev/null || echo "")

    if [ "$CURRENT_CHECK" != "$LAST_CHECK" ]; then
      LAST_CHECK="$CURRENT_CHECK"

      # 检查是否有 pending tool
      HAS_PENDING=$(cat "$LATEST_FILE" | jq -r '[.messages[-1].elements[]?.children[]? | select(.type == "TOOL" and .toolState == "executing" and .result.metadata.state == "pending")] | length' 2>/dev/null)

      if [ "$HAS_PENDING" != "0" ] && [ -n "$HAS_PENDING" ]; then
        TOOL_INFO=$(cat "$LATEST_FILE" | jq -r '.messages[-1].elements[].children[] | select(.type == "TOOL" and .result.metadata.state == "pending") | "\(.toolName): \(.params.command // .params | tostring)"' 2>/dev/null | head -1)

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "🔔 检测到权限请求！"
        echo "   时间: $(date '+%H:%M:%S')"
        echo "   工具: $TOOL_INFO"
        echo "   文件: $(basename "$LATEST_FILE")"
        echo ""
        echo "   ⏳ 桌宠应该："
        echo "      1. 播放 attention 动画（螃蟹举手/猫咪惊讶）"
        echo "      2. 播放 confirm 音效"
        echo ""
        echo "   如果没有，请检查："
        echo "      • Clawd 桌宠是否在运行"
        echo "      • comate-monitor 是否在运行"
        echo "      • 端口 23333 是否可用"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
      fi
    fi
  fi

  # 检查 monitor 日志的新输出
  CURRENT_LOG_LINE=$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$CURRENT_LOG_LINE" -gt "$LAST_LOG_LINE" ]; then
    NEW_LINES=$((CURRENT_LOG_LINE - LAST_LOG_LINE))
    tail -$NEW_LINES "$LOG_FILE" | while read -r line; do
      if echo "$line" | grep -q "Permission needed"; then
        echo "✅ Monitor: $(echo "$line" | sed 's/.*] //')"
      elif echo "$line" | grep -q "State changed"; then
        echo "📊 Monitor: $(echo "$line" | sed 's/.*] //')"
      fi
    done
    LAST_LOG_LINE=$CURRENT_LOG_LINE
  fi

  sleep $CHECK_INTERVAL
done
