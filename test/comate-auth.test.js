const { test } = require("node:test");
const assert = require("node:assert");

/**
 * 单元测试：ComateAuthHelper
 *
 * 测试 Puppeteer 自动化登录模块的核心逻辑
 */

// 由于 Puppeteer 需要真实浏览器实例，这里进行集成测试而不是单元测试
// 为了使测试能在 CI 环境运行，我们仅测试模块的导入和基本初始化

test("ComateAuthHelper - 模块导入", () => {
  const ComateAuthHelper = require("../src/comate-auth");
  assert.ok(ComateAuthHelper, "应该能导入 ComateAuthHelper 模块");
});

test("ComateAuthHelper - 类实例化", () => {
  const ComateAuthHelper = require("../src/comate-auth");
  const helper = new ComateAuthHelper();

  assert.ok(helper, "应该能创建 ComateAuthHelper 实例");
  assert.strictEqual(helper.browser, null, "初始化时 browser 应为 null");
  assert.strictEqual(helper.page, null, "初始化时 page 应为 null");
  assert.ok(typeof helper.login === "function", "应该有 login 方法");
});

test("ComateAuthHelper - login 参数验证", async () => {
  const ComateAuthHelper = require("../src/comate-auth");
  const helper = new ComateAuthHelper();

  // 无效的 URL
  const result1 = await helper.login(null);
  assert.strictEqual(result1.error, "Invalid API URL", "无效的 URL 应返回错误");

  const result2 = await helper.login("");
  assert.strictEqual(result2.error, "Invalid API URL", "空 URL 应返回错误");

  const result3 = await helper.login(123);
  assert.strictEqual(result3.error, "Invalid API URL", "非字符串 URL 应返回错误");
});

test("ComateAuthHelper - cleanup 方法存在", () => {
  const ComateAuthHelper = require("../src/comate-auth");
  const helper = new ComateAuthHelper();

  assert.ok(typeof helper.cleanup === "function", "应该有 cleanup 方法");
});
