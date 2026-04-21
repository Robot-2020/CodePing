#!/bin/bash
# Test token cost calculation with different models

echo "🧪 Testing Token Cost Calculation"
echo "================================"
echo ""

# Test with Claude Sonnet 4.5 (common model)
echo "📊 Test 1: Claude Sonnet 4.5"
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "working",
    "session_id": "test-session-1",
    "event": "PostToolUse",
    "agent_id": "claude-code",
    "token_usage": {
      "input_tokens": 1500,
      "output_tokens": 800,
      "cache_creation_tokens": 5000,
      "cache_read_tokens": 10000,
      "model_id": "claude-sonnet-4-5"
    }
  }'
echo -e "\n✅ Expected cost: ~$0.0428 (Input: $0.0045 + Output: $0.012 + Cache Write: $0.01875 + Cache Read: $0.003)"
echo ""
sleep 2

# Test with Claude Opus 4.6 (expensive model)
echo "📊 Test 2: Claude Opus 4.6"
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "thinking",
    "session_id": "test-session-2",
    "event": "PostToolUse",
    "agent_id": "claude-code",
    "token_usage": {
      "input_tokens": 2000,
      "output_tokens": 1000,
      "cache_creation_tokens": 3000,
      "cache_read_tokens": 5000,
      "model_id": "claude-opus-4-6"
    }
  }'
echo -e "\n✅ Expected cost: ~$0.1388 (Input: $0.03 + Output: $0.075 + Cache Write: $0.05625 + Cache Read: $0.0075)"
echo ""
sleep 2

# Test with Claude Haiku 4.5 (cheap model)
echo "📊 Test 3: Claude Haiku 4.5"
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "working",
    "session_id": "test-session-3",
    "event": "Stop",
    "agent_id": "claude-code",
    "token_usage": {
      "input_tokens": 5000,
      "output_tokens": 2000,
      "cache_creation_tokens": 10000,
      "cache_read_tokens": 20000,
      "model_id": "claude-haiku-4-5"
    }
  }'
echo -e "\n✅ Expected cost: ~$0.0256 (Input: $0.004 + Output: $0.008 + Cache Write: $0.01 + Cache Read: $0.0016)"
echo ""
sleep 2

# Test with unknown model (should not show cost)
echo "📊 Test 4: Unknown Model (no cost)"
curl -X POST http://127.0.0.1:23333/state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "idle",
    "session_id": "test-session-4",
    "event": "Stop",
    "agent_id": "claude-code",
    "token_usage": {
      "input_tokens": 1000,
      "output_tokens": 500,
      "model_id": "unknown-model-xyz"
    }
  }'
echo -e "\n✅ Expected: Cost should NOT be displayed (unknown model)"
echo ""

echo "================================"
echo "✨ Tests completed!"
echo "Check the token bubble next to your desktop pet."
echo ""
echo "💡 Hover over the cost value to see it brighten up!"
