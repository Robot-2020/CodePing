#!/bin/bash
# 快速替换 complete 音效为轻柔的系统音效

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🎵 快速替换 complete 音效"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 推荐的轻柔音效
echo "请选择你喜欢的音效："
echo ""
echo "1. Glass   - 玻璃音（最轻柔、清脆）⭐ 推荐"
echo "2. Tink    - 轻敲（简短、柔和）"
echo "3. Purr    - 柔和振动（温柔、低调）"
echo "4. Pop     - 轻柔弹出（简洁）"
echo "5. Bottle  - 瓶子音（独特、轻快）"
echo "6. 取消"
echo ""
read -p "输入选项 (1-6): " choice

case $choice in
  1)
    SOUND_FILE="Glass.aiff"
    SOUND_NAME="Glass"
    ;;
  2)
    SOUND_FILE="Tink.aiff"
    SOUND_NAME="Tink"
    ;;
  3)
    SOUND_FILE="Purr.aiff"
    SOUND_NAME="Purr"
    ;;
  4)
    SOUND_FILE="Pop.aiff"
    SOUND_NAME="Pop"
    ;;
  5)
    SOUND_FILE="Bottle.aiff"
    SOUND_NAME="Bottle"
    ;;
  6)
    echo "已取消"
    exit 0
    ;;
  *)
    echo "无效选项"
    exit 1
    ;;
esac

SYSTEM_SOUND="/System/Library/Sounds/$SOUND_FILE"
TARGET_DIR="assets/sounds"
BACKUP_FILE="$TARGET_DIR/complete-original.mp3"
TARGET_FILE="$TARGET_DIR/complete.mp3"

# 检查系统音效是否存在
if [ ! -f "$SYSTEM_SOUND" ]; then
  echo "❌ 找不到系统音效：$SYSTEM_SOUND"
  exit 1
fi

echo ""
echo "▶️  试听音效：$SOUND_NAME"
afplay "$SYSTEM_SOUND"
echo ""

read -p "确认使用这个音效替换 complete.mp3? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "已取消"
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "开始替换..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. 备份原音效
if [ -f "$TARGET_FILE" ] && [ ! -f "$BACKUP_FILE" ]; then
  echo "1️⃣  备份原音效..."
  cp "$TARGET_FILE" "$BACKUP_FILE"
  echo "   ✅ 已备份到：$BACKUP_FILE"
else
  echo "1️⃣  跳过备份（已存在）"
fi

# 2. 转换音效
echo ""
echo "2️⃣  转换音效格式（AIFF → MP3）..."
TEMP_MP3="/tmp/complete-temp.mp3"
afconvert -f mp4f -d aac "$SYSTEM_SOUND" "$TEMP_MP3" 2>/dev/null

if [ $? -ne 0 ]; then
  echo "   ❌ 转换失败"
  exit 1
fi
echo "   ✅ 转换成功"

# 3. 替换文件
echo ""
echo "3️⃣  替换音效文件..."
mv "$TEMP_MP3" "$TARGET_FILE"
echo "   ✅ 已替换：$TARGET_FILE"

# 4. 验证
echo ""
echo "4️⃣  验证新音效..."
echo "   ▶️  播放新音效："
afplay "$TARGET_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ 替换完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 下一步："
echo "   1. 重启 Clawd 桌宠"
echo "   2. 测试新音效"
echo ""
echo "💡 恢复原音效："
echo "   cp $BACKUP_FILE $TARGET_FILE"
echo ""
