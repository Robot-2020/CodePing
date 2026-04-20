#!/bin/bash
# Test Comate state transitions

PORT=23333
DELAY=${1:-5}

echo "Testing Comate state transitions (each state $DELAY seconds)"
echo "Make sure Clawd is running first!"
echo ""

function send_state() {
  curl -X POST http://127.0.0.1:$PORT/state \
    -H "Content-Type: application/json" \
    -d "{\"state\":\"$1\",\"event\":\"$2\",\"session_id\":\"test-comate\",\"agent_id\":\"comate\"}" \
    -s -o /dev/null
  echo "[$(date +%H:%M:%S)] Sent: state=$1, event=$2"
}

echo "1. SessionStart → idle"
send_state "idle" "SessionStart"
sleep $DELAY

echo "2. UserPromptSubmit → thinking"
send_state "thinking" "UserPromptSubmit"
sleep $DELAY

echo "3. PreToolUse → working"
send_state "working" "PreToolUse"
sleep $DELAY

echo "4. Stop → attention (should show happy animation, then auto-return to idle)"
send_state "attention" "Stop"
sleep $(($DELAY + 2))

echo "5. Another work cycle"
send_state "thinking" "UserPromptSubmit"
sleep 2
send_state "working" "PreToolUse"
sleep $DELAY

echo "6. Stop → attention (complete)"
send_state "attention" "Stop"
sleep $(($DELAY + 2))

echo ""
echo "Done! The pet should now be in idle state."
