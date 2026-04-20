#!/bin/bash
# 测试 macOS 系统音效，找到最适合的轻柔音效

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔊 macOS 系统音效试听"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "推荐的轻柔音效："
echo ""

SOUNDS_DIR="/System/Library/Sounds"

# 推荐的轻柔音效列表
GENTLE_SOUNDS=(
  "Glass.aiff:玻璃音（轻柔、清脆）"
  "Tink.aiff:轻敲（柔和、简短）"
  "Purr.aiff:柔和振动（温柔、低调）"
  "Pop.aiff:轻柔弹出（简洁）"
  "Bottle.aiff:瓶子音（独特、轻快）"
  "Morse.aiff:莫尔斯码（极简）"
)

for sound in "${GENTLE_SOUNDS[@]}"; do
  IFS=':' read -r file desc <<< "$sound"

  if [ -f "$SOUNDS_DIR/$file" ]; then
    echo "▶️  $desc"
    echo "   文件：$file"
    afplay "$SOUNDS_DIR/$file"
    echo ""
    sleep 1
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 如果你喜欢某个音效，可以这样转换并替换："
echo ""
echo "# 1. 转换音效（以 Glass 为例）"
echo "afconvert -f mp4f -d aac /System/Library/Sounds/Glass.aiff ~/Downloads/complete-gentle.mp3"
echo ""
echo "# 2. 替换音效"
echo "cp ~/Downloads/complete-gentle.mp3 assets/sounds/complete.mp3"
echo ""
echo "# 3. 重启桌宠生效"
echo ""
