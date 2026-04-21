/**
 * ComateMonitor - 轮询 Comate API 获取配额使用情况
 * 在后台定时调用 /api/mine/all_info 获取用户的配额数据
 */

const https = require("https");
const http = require("http");

class ComateMonitor {
  constructor(config, onQuotaChanged) {
    this._config = config;              // { enabled, apiUrl, username, pollIntervalMs, cookies }
    this._onQuotaChanged = onQuotaChanged; // 数据变化回调
    this._interval = null;              // 轮询定时器
    this._lastData = null;              // 缓存的上一次数据
    this._isPolling = false;            // 是否正在轮询中
    this._failureCount = 0;             // 连续失败次数（用于指数退避）
    this._maxFailures = 5;              // 最多重试 5 次后停止
    this._cookies = {};                 // 保存的 Cookie 信息

    // 如果配置中有 cookies，加载到内存
    if (config.cookies) {
      this._cookies = { ...config.cookies };
    }

    // 确保轮询间隔至少 1000ms
    const interval = config.pollIntervalMs || 5000;
    this._pollIntervalMs = Math.max(1000, interval);
  }

  /**
   * 设置 Cookie（用于认证）
   */
  setCookies(cookieDict) {
    this._cookies = { ...cookieDict };
    console.log("[ComateMonitor] Cookies updated");
  }

  /**
   * 获取当前 Cookie
   */
  getCookies() {
    return { ...this._cookies };
  }

  /**
   * 从 Set-Cookie 头解析 Cookie
   */
  _parseCookieFromHeader(setCookieHeader) {
    // Set-Cookie 格式: "name=value; Path=/; Domain=...; Secure; HttpOnly"
    if (!setCookieHeader) return null;
    const parts = setCookieHeader.split(";");
    if (parts.length === 0) return null;

    const [nameValue] = parts[0].trim().split("=");
    return nameValue ? parts[0].trim() : null;
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
   * 单次轮询
   */
  _poll() {
    if (this._isPolling || !this._config.enabled || !this._config.apiUrl || !this._config.username) {
      return;
    }

    this._isPolling = true;

    this._fetchQuotaData()
      .then(data => {
        this._failureCount = 0;
        this._handleQuotaData(data);
      })
      .catch(err => {
        this._failureCount++;
        console.error(`[ComateMonitor] 获取配额数据失败 (${this._failureCount}/${this._maxFailures}):`, err.message);

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
  _fetchQuotaData() {
    return new Promise((resolve, reject) => {
      const { apiUrl, username } = this._config;

      // 构建 URL
      const url = new URL(apiUrl);
      url.pathname = "/api/mine/all_info";
      url.searchParams.set("username", username);
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
        headers: {},
      };

      // 如果有 Cookie，添加到请求头
      if (Object.keys(this._cookies).length > 0) {
        const cookieString = Object.entries(this._cookies)
          .map(([name, value]) => `${name}=${value}`)
          .join("; ");
        options.headers["Cookie"] = cookieString;
      }

      const req = protocol.get(urlString, options, (res) => {
        clearTimeout(timeoutHandle);

        // 如果返回 302 或其他重定向，可能需要更新 Cookie
        if (res.statusCode === 302 || res.statusCode === 301) {
          // 尝试从响应头获取 Set-Cookie（虽然 302 通常不会包含数据）
          if (res.headers["set-cookie"]) {
            res.headers["set-cookie"].forEach(setCookie => {
              const cookiePart = this._parseCookieFromHeader(setCookie);
              if (cookiePart) {
                const [name, value] = cookiePart.split("=");
                if (name && value !== undefined) {
                  this._cookies[name] = value;
                }
              }
            });
            console.warn("[ComateMonitor] Got 302, updated cookies from response");
          }
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
