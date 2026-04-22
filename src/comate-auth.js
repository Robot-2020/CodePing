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
        ],
      });

      // 监听浏览器断开（用户关闭浏览器窗口）
      let browserDisconnected = false;
      this.browser.on("disconnected", () => {
        browserDisconnected = true;
      });

      // 复用默认页面，避免多开空白标签
      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

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
      const apiData = await this._waitForLoginCompletion(apiUrl, timeoutMs, () => browserDisconnected);

      // 提取 Cookie
      const cookies = await this.page.cookies();
      console.log(`[ComateAuth] Raw cookies count: ${cookies.length}`);
      console.log(`[ComateAuth] Cookie names: ${cookies.map(c => c.name).join(", ")}`);

      const cookieString = cookies
        .map((c) => `${c.name}=${c.value}`)
        .join("; ");

      console.log(`[ComateAuth] Cookie string length: ${cookieString.length}`);
      console.log(`[ComateAuth] Cookie string preview: ${cookieString.substring(0, 100)}...`);
      console.log(`[ComateAuth] Login successful, extracted ${cookies.length} cookies`);

      // 计算 Cookie 过期时间（距离现在还剩多少秒）
      const expiresIn = cookies.length > 0
        ? Math.min(...cookies.map((c) => c.expires || Infinity)) - Math.floor(Date.now() / 1000)
        : 0;

      // 尝试从 JWT token 解码 username（备选方案）
      let username = apiData.username || "";
      if (!username) {
        const ztToken = cookies.find(c => c.name === "SECURE_ZT_GW_TOKEN");
        if (ztToken) {
          try {
            const payload = ztToken.value.split(".")[1];
            const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
            username = decoded.username || "";
            console.log(`[ComateAuth] Extracted username from JWT: ${username}`);
          } catch (err) {
            console.warn(`[ComateAuth] Failed to decode JWT:`, err.message);
          }
        }
      }

      // 返回 cookies 和 username（从 API 响应中提取）
      return {
        cookies: cookieString,
        username,
        expires_in: Math.max(0, expiresIn),
      };
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
   * @returns {Promise<{username: string}>} API 返回的用户数据
   */
  async _waitForLoginCompletion(apiUrl, timeoutMs, isClosed) {
    const startTime = Date.now();
    const pollInterval = 2000; // 每 2 秒检查一次

    while (Date.now() - startTime < timeoutMs) {
      // 浏览器被用户关闭
      if (isClosed && isClosed()) {
        throw new Error("Browser closed by user");
      }

      try {
        // 在当前页面上执行 fetch 请求，检查 API 是否返回 200
        const response = await this.page.evaluate(async (url, username) => {
          try {
            const res = await fetch(`${url}/api/mine/all_info?username=${encodeURIComponent(username)}`, {
              method: "GET",
              credentials: "include", // 包含 Cookie
            });
            if (res.ok) {
              const data = await res.json();
              return { status: res.status, ok: res.ok, data };
            }
            return { status: res.status, ok: res.ok };
          } catch (e) {
            return { error: e.message };
          }
        }, apiUrl, "test");

        if (response.status === 200 || response.ok) {
          console.log("[ComateAuth] Login completed - API returning 200");
          console.log("[ComateAuth] API response data:", JSON.stringify(response.data || {}).substring(0, 200));
          // 从 API 响应提取 username
          const username = response.data?.username || response.data?.data?.username || "";
          console.log("[ComateAuth] Extracted username:", username);
          return { username };
        }

        if (response.status === 302) {
          console.log("[ComateAuth] Still redirecting (302), waiting for login...");
        }

        // 等待再检查
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (err) {
        // 浏览器被关闭导致的错误，立即退出
        if ((isClosed && isClosed()) || err.message.includes("Target closed") || err.message.includes("Session closed")) {
          throw new Error("Browser closed by user");
        }
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
