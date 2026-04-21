// Preload script for token-bubble.html
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("tokenBubbleAPI", {
  onTokenUpdate: (cb) => ipcRenderer.on("token-update", (_, data) => cb(data)),
  onHide: (cb) => ipcRenderer.on("token-hide", () => cb()),
  onLangChange: (cb) => ipcRenderer.on("token-lang", (_, texts) => cb(texts)),
  reportHeight: (h) => ipcRenderer.send("token-bubble-height", h),
});
