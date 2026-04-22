/**
 * ComateMonitor - 轮询 Comate API 获取配额使用情况
 * 在后台定时调用 /api/mine/all_info 获取用户的配额数据
 */

const https = require("https");
const http = require("http");
const fs = require("fs");

const COMATE_API_URL = "https://oneapi-comate.baidu-int.com";

class ComateMonitor {
  constructor(config, onQuotaChanged, options = {}) {
    this._config = config;              // { enabled, pollIntervalMs }
    this._onQuotaChanged = onQuotaChanged; // 数据变化回调
    this._onNeedLogin = options.onNeedLogin || null; // cookie 为空时的回调
    this._cookieFile = options.cookieFile || null;    // cookie 文件路径
    this._interval = null;              // 轮询定时器
    this._lastData = null;              // 缓存的上一次数据
    this._isPolling = false;            // 是否正在轮询中
    this._failureCount = 0;             // 连续失败次数（用于指数退避）
    this._maxFailures = 5;              // 最多重试 5 次后停止
    this._loginTriggered = false;       // 是否已触发过自动登录（避免重复触发）

    // 确保轮询间隔至少 1000ms
    const interval = config.pollIntervalMs || 10000;
    this._pollIntervalMs = Math.max(1000, interval);
  }

  /**
   * 启动轮询
   */
  start() {
    if (this._interval) {
      console.warn("ComateMonitor already started");
      return;
    }

    // 立即执行一次
    this._poll();

    // 启动定时轮询
    this._interval = setInterval(() => {
      this._poll();
    }, this._pollIntervalMs);
  }

  /**
   * 停止轮询
   */
  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._isPolling = false;
    this._failureCount = 0;
  }

  /**
   * 从 cookie 文件读取 cookie 和 username
   */
  _readCookieFromFile() {
    if (!this._cookieFile) return { cookie: "", username: "" };
    try {
      const content = fs.readFileSync(this._cookieFile, "utf-8").trim();
      if (!content) return { cookie: "", username: "" };
      let username = "";
      const jwtMatch = content.match(/SECURE_ZT_GW_TOKEN=([^;]+)/);
      if (jwtMatch) {
        try {
          const payload = JSON.parse(Buffer.from(jwtMatch[1].split(".")[1], "base64").toString());
          if (payload.username) username = payload.username;
        } catch (_) { /* ignore */ }
      }
      return { cookie: content, username };
    } catch (_) {
      return { cookie: "", username: "" };
    }
  }

  /**
   * 单次轮询
   */
  _poll() {
    if (this._isPolling || !this._config.enabled) {
      return;
    }

    // 从文件读取 cookie
    const { cookie, username } = this._readCookieFromFile();

    // cookie 为空时，触发自动登录（仅一次）
    if (!cookie && !this._loginTriggered && this._onNeedLogin) {
      this._loginTriggered = true;
      console.log("[ComateMonitor] No cookie found, triggering auto login...");
      this._onNeedLogin();
      return; // 等下次轮询再尝试
    }

    if (!cookie) {
      return; // 没有 cookie，跳过本次轮询
    }

    // 有 cookie，重置登录触发标志（cookie 过期后可再次触发）
    this._loginTriggered = false;
    this._isPolling = true;

    this._fetchQuotaData(cookie, username)
      .then(data => {
        this._failureCount = 0;
        this._handleQuotaData(data);
      })
      .catch(err => {
        this._failureCount++;
        console.error(`[ComateMonitor] 获取配额数据失败 (${this._failureCount}/${this._maxFailures}):`, err.message);

        // 302 表示 cookie 过期，触发重新登录
        if (err.message.includes("302") && !this._loginTriggered && this._onNeedLogin) {
          this._loginTriggered = true;
          console.log("[ComateMonitor] Cookie expired (302), triggering auto login...");
          this._onNeedLogin();
        }

        // 失败超过阈值时停止轮询
        if (this._failureCount >= this._maxFailures) {
          console.warn("[ComateMonitor] 连续失败超过阈值，停止轮询");
          this.stop();
        }
      })
      .finally(() => {
        this._isPolling = false;
      });
  }

  /**
   * 获取配额数据（支持 Cookie 认证）
   */
  _fetchQuotaData(cookie, username) {
    return new Promise((resolve, reject) => {
      // 构建 URL (使用硬编码的 API 地址)
      const url = new URL(COMATE_API_URL);
      url.pathname = "/api/mine/all_info";
      if (username) {
        url.searchParams.set("username", username);
      }
      const urlString = url.toString();

      // 选择 http 或 https
      const protocol = urlString.startsWith("https") ? https : http;

      const timeoutMs = 5000; // 5 秒超时
      const timeoutHandle = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, timeoutMs);

      // 构建请求选项，支持 Cookie
      const options = {
        timeout: timeoutMs,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Language": "zh-CN,zh;q=0.9",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      };

      // 如果有 Cookie，添加到请求头
      if (cookie && typeof cookie === "string") {
        options.headers["Cookie"] = cookie;
      }

      const req = protocol.get(urlString, options, (res) => {
        clearTimeout(timeoutHandle);

        // 302 表示需要认证（cookie 过期或无效）
        if (res.statusCode === 302 || res.statusCode === 301) {
          reject(new Error(`HTTP ${res.statusCode} - Need authentication`));
          res.resume();
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }

        let body = "";
        res.on("data", (chunk) => {
          body += chunk.toString();
        });

        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            resolve(json);
          } catch (err) {
            reject(new Error(`JSON parse error: ${err.message}`));
          }
        });

        res.on("error", (err) => {
          clearTimeout(timeoutHandle);
          reject(err);
        });
      });

      req.on("error", (err) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });

      req.end();
    });
  }

  /**
   * 处理获取到的配额数据
   */
  _handleQuotaData(responseJson) {
    if (!responseJson || typeof responseJson !== "object") {
      throw new Error("Invalid response format");
    }

    // 提取数据（处理各种可能的响应结构）
    const data = responseJson.data || responseJson;

    const quotaData = {
      username: data.username || null,
      monthly_used_quota: this._parseNumber(data.monthly_used_quota),
      permanent_quota: this._parseNumber(data.permanent_quota),
      agent_costs: {}, // source_usage 中各 agent 的成本
    };

    // 从 source_usage 提取各 agent 的成本
    if (data.source_usage && typeof data.source_usage === "object") {
      for (const [agentName, cost] of Object.entries(data.source_usage)) {
        const numCost = this._parseNumber(cost);
        if (numCost !== null) {
          quotaData.agent_costs[agentName] = numCost;
        }
      }
    }

    // 对比上一次数据，仅在有变化时回调
    if (!this._dataEqual(this._lastData, quotaData)) {
      this._lastData = JSON.parse(JSON.stringify(quotaData)); // 深拷贝缓存
      if (typeof this._onQuotaChanged === "function") {
        this._onQuotaChanged(quotaData);
      }
    }
  }

  /**
   * 数值解析（处理字符串或数字）
   */
  _parseNumber(value) {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }
    return null;
  }

  /**
   * 比较两个配额数据是否相等（避免不必要的 IPC 更新）
   */
  _dataEqual(a, b) {
    if (!a || !b) return false;

    return (
      a.username === b.username &&
      a.monthly_used_quota === b.monthly_used_quota &&
      a.permanent_quota === b.permanent_quota &&
      JSON.stringify(a.agent_costs) === JSON.stringify(b.agent_costs)
    );
  }

  /**
   * 获取当前缓存的数据
   */
  getLastData() {
    return this._lastData ? JSON.parse(JSON.stringify(this._lastData)) : null;
  }

  /**
   * 获取轮询状态
   */
  isRunning() {
    return this._interval !== null;
  }
}

module.exports = ComateMonitor;
