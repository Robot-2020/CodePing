/**
 * Comate Authentication Helper - 使用 Puppeteer 自动化登录并提取 Cookie
 *
 * 功能：
 * 1. 打开浏览器，导航到 Comate API URL
 * 2. 等待用户完成 UUAP 登录（带超时）
 * 3. 自动提取登录后的 Cookie
 * 4. 关闭浏览器，返回 Cookie 字符串
 */

const puppeteer = require("puppeteer");

class ComateAuthHelper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  /**
   * 自动化登录流程，返回 Promise<cookieString>
   *
   * @param {string} apiUrl - API 地址（例如 https://oneapi-comate.baidu-int.com）
   * @param {number} timeoutMs - 等待登录超时（默认 60000ms = 60秒）
   * @returns {Promise<{cookies: string, expires_in: number} | {error: string}>}
   */
  async login(apiUrl, timeoutMs = 60000) {
    try {
      if (!apiUrl || typeof apiUrl !== "string") {
        return { error: "Invalid API URL" };
      }

      // 启动浏览器
      this.browser = await puppeteer.launch({
        headless: false, // 用户需要看到浏览器完成登录
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-web-resources", // 防止加载外部资源，加快速度
        ],
      });

      this.page = await this.browser.newPage();

      // 设置超时
      this.page.setDefaultTimeout(timeoutMs);

      // 导航到 API URL
      const url = new URL(apiUrl);
      url.pathname = "/api/mine/all_info";
      url.searchParams.set("username", "test"); // 占位符，触发重定向到登录

      console.log(`[ComateAuth] Navigating to ${url.toString()}`);

      // 使用 waitForNavigation 监听重定向
      // UUAP 会返回 302 重定向到登录页面
      try {
        await Promise.race([
          this.page.goto(url.toString(), { waitUntil: "networkidle2" }),
          this._waitForSuccessfulRedirect(timeoutMs),
        ]);
      } catch (navErr) {
        // goto 可能失败（因为重定向），但登录可能成功，继续
        console.log("[ComateAuth] Navigation error (expected for redirects):", navErr.message);
      }

      // 等待用户完成登录 — 检测是否返回到 API 端点（不再是 302）
      await this._waitForLoginCompletion(apiUrl, timeoutMs);

      // 提取 Cookie
      const cookies = await this.page.cookies();
      const cookieString = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      console.log(`[ComateAuth] Login successful, extracted ${cookies.length} cookies`);

      // 计算 Cookie 过期时间（距离现在还剩多少秒）
      const expiresIn = cookies.length > 0
        ? Math.min(...cookies.map((c) => c.expires || Infinity)) - Math.floor(Date.now() / 1000)
        : 0;

      return { cookies: cookieString, expires_in: Math.max(0, expiresIn) };
    } catch (err) {
      console.error("[ComateAuth] Login failed:", err.message);
      return { error: err.message };
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 等待用户完成登录 — 轮询检测 API 响应状态
   * 登录成功后，/api/mine/all_info 不再返回 302，而是返回 200 + JSON 数据
   */
  async _waitForLoginCompletion(apiUrl, timeoutMs) {
    const startTime = Date.now();
    const pollInterval = 2000; // 每 2 秒检查一次

    while (Date.now() - startTime < timeoutMs) {
      try {
        // 在当前页面上执行 fetch 请求，检查 API 是否返回 200
        const response = await this.page.evaluate(async (url, username) => {
          try {
            const res = await fetch(`${url}/api/mine/all_info?username=${encodeURIComponent(username)}`, {
              method: "GET",
              credentials: "include", // 包含 Cookie
            });
            return { status: res.status, ok: res.ok };
          } catch (e) {
            return { error: e.message };
          }
        }, apiUrl, "test");

        if (response.status === 200 || response.ok) {
          console.log("[ComateAuth] Login completed - API returning 200");
          return true;
        }

        if (response.status === 302) {
          console.log("[ComateAuth] Still redirecting (302), waiting for login...");
        }

        // 等待再检查
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (err) {
        console.warn("[ComateAuth] Poll check error:", err.message);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(
      `Login timeout after ${timeoutMs}ms. User may not have completed UUAP authentication.`
    );
  }

  /**
   * 等待成功的重定向（用于检测登录后的重定向）
   */
  async _waitForSuccessfulRedirect(timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Redirect timeout"));
      }, timeoutMs);

      this.page.on("response", (response) => {
        const status = response.status();
        if (status === 200) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  /**
   * 清理资源
   */
  async cleanup() {
    if (this.page) {
      try {
        await this.page.close();
      } catch (e) {
        console.warn("[ComateAuth] Error closing page:", e.message);
      }
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        console.warn("[ComateAuth] Error closing browser:", e.message);
      }
    }
  }
}

module.exports = ComateAuthHelper;
