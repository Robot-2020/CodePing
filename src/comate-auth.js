/**
 * Comate Authentication Helper
 *
 * 使用 Electron 自带的 BrowserWindow 打开登录页，等待用户完成 UUAP 登录，
 * 再通过 session.cookies API 读取 Cookie。
 *
 * 历史实现使用 puppeteer，但 puppeteer 会依赖用户本地缓存的 Chromium
 * （~/.cache/puppeteer），打包后分发给其他用户时不会自动下载，
 * 导致报错 "Could not find Chrome (ver. XXX)"。改用 Electron 内置 Chromium 即可彻底解决。
 */

const { BrowserWindow, session: electronSession } = require("electron");

class ComateAuthHelper {
  constructor() {
    this.window = null;
  }

  /**
   * 自动化登录流程
   *
   * @param {string} apiUrl - API 地址（例如 https://oneapi-comate.baidu-int.com）
   * @param {number} timeoutMs - 等待登录超时（默认 120000ms）
   * @returns {Promise<{cookies: string, username: string, expires_in: number} | {error: string}>}
   */
  async login(apiUrl, timeoutMs = 120000) {
    try {
      if (!apiUrl || typeof apiUrl !== "string") {
        return { error: "Invalid API URL" };
      }

      // 使用独立的 session partition，避免污染默认 session；
      // persist: 前缀可让下一次打开保留登录态（UUAP 需要）
      const sess = electronSession.fromPartition("persist:comate-auth");

      this.window = new BrowserWindow({
        width: 960,
        height: 720,
        title: "Comate 登录",
        autoHideMenuBar: true,
        webPreferences: {
          session: sess,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
        },
      });

      // 监听用户手动关闭窗口
      let windowClosed = false;
      this.window.on("closed", () => {
        windowClosed = true;
        this.window = null;
      });

      const url = new URL(apiUrl);
      url.pathname = "/api/mine/all_info";
      url.searchParams.set("username", "test");

      console.log(`[ComateAuth] Navigating to ${url.toString()}`);
      try {
        await this.window.loadURL(url.toString());
      } catch (err) {
        // 302 重定向常常使 loadURL 以 ERR_ABORTED reject，属于正常现象，继续等待登录
        console.log("[ComateAuth] loadURL returned:", err.message);
      }

      const apiData = await this._waitForLoginCompletion(
        apiUrl,
        timeoutMs,
        () => windowClosed,
      );

      // 读取 cookie
      const cookies = await sess.cookies.get({ url: apiUrl });
      console.log(`[ComateAuth] Raw cookies count: ${cookies.length}`);
      console.log(`[ComateAuth] Cookie names: ${cookies.map(c => c.name).join(", ")}`);

      const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

      const expiresIn = cookies.length > 0
        ? Math.min(...cookies.map((c) => (typeof c.expirationDate === "number" ? c.expirationDate : Infinity))) - Math.floor(Date.now() / 1000)
        : 0;

      // 从 JWT 中解析 username（优先使用 API 返回值）
      let username = apiData.username || "";
      if (!username) {
        const ztToken = cookies.find((c) => c.name === "SECURE_ZT_GW_TOKEN");
        if (ztToken) {
          try {
            const payload = ztToken.value.split(".")[1];
            const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
            username = decoded.username || "";
          } catch (_) { /* ignore */ }
        }
      }

      return {
        cookies: cookieString,
        username,
        expires_in: Math.max(0, expiresIn),
      };
    } catch (err) {
      console.error("[ComateAuth] Login failed:", err && err.message);
      return { error: err && err.message };
    } finally {
      this._close();
    }
  }

  /**
   * 在登录窗口内轮询 /api/mine/all_info，返回 200 即视为登录完成
   */
  async _waitForLoginCompletion(apiUrl, timeoutMs, isClosed) {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      if (isClosed && isClosed()) {
        throw new Error("Browser closed by user");
      }
      if (!this.window || this.window.isDestroyed()) {
        throw new Error("Browser closed by user");
      }

      try {
        const script = `
          (async () => {
            try {
              const res = await fetch(${JSON.stringify(apiUrl)} + "/api/mine/all_info?username=test", {
                method: "GET",
                credentials: "include",
              });
              if (res.ok) {
                const data = await res.json().catch(() => ({}));
                return { status: res.status, ok: true, data };
              }
              return { status: res.status, ok: false };
            } catch (e) {
              return { error: e && e.message };
            }
          })();
        `;
        const response = await this.window.webContents.executeJavaScript(script, true);

        if (response && response.ok) {
          const username = response.data?.username || response.data?.data?.username || "";
          console.log("[ComateAuth] Login completed, username:", username);
          return { username };
        }
      } catch (err) {
        if (isClosed && isClosed()) {
          throw new Error("Browser closed by user");
        }
        // 页面正在重定向时 executeJavaScript 可能暂时失败，忽略继续轮询
        console.warn("[ComateAuth] Poll check error:", err && err.message);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(
      `Login timeout after ${timeoutMs}ms. User may not have completed UUAP authentication.`,
    );
  }

  _close() {
    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.close();
      } catch (_) { /* ignore */ }
    }
    this.window = null;
  }
}

module.exports = ComateAuthHelper;
