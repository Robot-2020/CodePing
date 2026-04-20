#!/bin/bash
# Real-time Comate monitor watcher

LOG_FILE="/tmp/comate-monitor.log"

echo "=== Comate Monitor Watcher ==="
echo "Watching: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo ""

# Show last 5 lines initially
tail -5 "$LOG_FILE"
echo "---"

# Follow new lines
tail -f "$LOG_FILE" | while read -r line; do
  # Highlight state changes
  if echo "$line" | grep -q "State changed"; then
    echo -e "\033[1;32m$line\033[0m"  # Green
  elif echo "$line" | grep -q "Permission needed"; then
    echo -e "\033[1;33m$line\033[0m"  # Yellow
  else
    echo "$line"
  fi
done
