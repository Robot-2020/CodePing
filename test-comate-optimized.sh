#!/bin/bash
# 性能测试：对比原版 vs 优化版的响应延迟

LOG_DIR="/tmp"
ORIGINAL_LOG="$LOG_DIR/comate-monitor-original.log"
OPTIMIZED_LOG="$LOG_DIR/comate-monitor-optimized.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Comate Monitor 性能对比测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 停止所有现有的 monitor
echo "1. 清理现有进程..."
pkill -f comate-monitor 2>/dev/null
sleep 1

# 启动优化版
echo "2. 启动优化版 monitor..."
nohup node hooks/comate-monitor-optimized.js > "$OPTIMIZED_LOG" 2>&1 &
OPTIMIZED_PID=$!
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  测试说明"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ 优化版已启动（PID: $OPTIMIZED_PID）"
echo ""
echo "现在请在 Comate 中："
echo "  1. 发送一个新问题"
echo "  2. 观察桌宠响应速度"
echo "  3. 注意日志时间戳"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  实时日志监控（按 Ctrl+C 停止）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 监控日志
tail -f "$OPTIMIZED_LOG" | while read -r line; do
  if echo "$line" | grep -q "State changed"; then
    echo -e "\033[1;32m$line\033[0m"  # 绿色
  elif echo "$line" | grep -q "Permission needed"; then
    echo -e "\033[1;33m$line\033[0m"  # 黄色
  elif echo "$line" | grep -q "Monitoring mode"; then
    echo -e "\033[1;36m$line\033[0m"  # 青色
  else
    echo "$line"
  fi
done
