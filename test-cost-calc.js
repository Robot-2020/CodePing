#!/usr/bin/env node
// Test cost calculation with actual transcript data

const MODEL_PRICING = {
  "claude-sonnet-4-5-20250929": {
    input: 3.0,
    output: 15.0,
    cache_write: 3.75,
    cache_read: 0.3,
  },
};

function calculateCost(tokenUsage, modelId) {
  if (!modelId || !MODEL_PRICING[modelId]) return null;

  const pricing = MODEL_PRICING[modelId];
  let totalCost = 0;

  if (tokenUsage.input_tokens) {
    totalCost += (tokenUsage.input_tokens / 1000000) * pricing.input;
  }

  if (tokenUsage.output_tokens) {
    totalCost += (tokenUsage.output_tokens / 1000000) * pricing.output;
  }

  if (tokenUsage.cache_creation_tokens) {
    totalCost += (tokenUsage.cache_creation_tokens / 1000000) * pricing.cache_write;
  }

  if (tokenUsage.cache_read_tokens) {
    totalCost += (tokenUsage.cache_read_tokens / 1000000) * pricing.cache_read;
  }

  return totalCost > 0 ? totalCost : null;
}

// Example from transcript
const usage = {
  input_tokens: 2,
  output_tokens: 440,
  cache_creation_tokens: 992,
  cache_read_tokens: 55842,
};

const cost = calculateCost(usage, "claude-sonnet-4-5-20250929");

console.log("Token Usage:");
console.log(`  Input: ${usage.input_tokens}`);
console.log(`  Output: ${usage.output_tokens}`);
console.log(`  Cache Write: ${usage.cache_creation_tokens}`);
console.log(`  Cache Read: ${usage.cache_read_tokens}`);
console.log("");
console.log("Calculated Cost: $" + (cost ? cost.toFixed(4) : "0.0000"));
console.log("");
console.log("Breakdown:");
console.log(`  Input:       ${usage.input_tokens} × $3/1M     = $${((usage.input_tokens / 1000000) * 3).toFixed(6)}`);
console.log(`  Output:      ${usage.output_tokens} × $15/1M    = $${((usage.output_tokens / 1000000) * 15).toFixed(6)}`);
console.log(`  Cache Write: ${usage.cache_creation_tokens} × $3.75/1M = $${((usage.cache_creation_tokens / 1000000) * 3.75).toFixed(6)}`);
console.log(`  Cache Read:  ${usage.cache_read_tokens} × $0.3/1M  = $${((usage.cache_read_tokens / 1000000) * 0.3).toFixed(6)}`);
