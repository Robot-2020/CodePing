#!/bin/bash
# Test cost display with complete data including model ID

echo "🧪 Testing Cost Display (Updated Version)"
echo "======================================="
echo ""

# Test 1: With model ID (should show cost)
echo "📊 Test 1: Claude Sonnet 4.5 with cost calculation"
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "working",
    "session_id": "test-session-cost-1",
    "event": "PostToolUse",
    "agent_id": "claude-code",
    "token_usage": {
      "input_tokens": 2000,
      "output_tokens": 1000,
      "cache_creation_tokens": 5000,
      "cache_read_tokens": 10000,
      "model_id": "claude-sonnet-4-5"
    }
  }'
echo -e "\n✅ Expected cost: ~$0.0368"
echo "   - Input: 2000 × $3/1M = $0.006"
echo "   - Output: 1000 × $15/1M = $0.015"
echo "   - Cache Write: 5000 × $3.75/1M = $0.01875"
echo "   - Cache Read: 10000 × $0.3/1M = $0.003"
echo ""
sleep 3

# Test 2: Without model ID (should show $0.0000)
echo "📊 Test 2: No model ID (should show $0.0000)"
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "thinking",
    "session_id": "test-session-cost-2",
    "event": "Stop",
    "agent_id": "claude-code",
    "token_usage": {
      "input_tokens": 1000,
      "output_tokens": 500
    }
  }'
echo -e "\n✅ Expected: Cost = $0.0000 (no model ID)"
echo ""

echo "======================================="
echo "✨ Tests completed!"
echo ""
echo "🔍 Check the token bubble:"
echo "   - Should be on the LEFT side of the pet"
echo "   - Cost row should be visible (50% opacity)"
echo "   - Hover over cost to see 100% opacity"
echo ""
