"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  // 运行文档生成
  runDocGen: (mode, data) => electron.ipcRenderer.invoke("run-docgen", { mode, data }),
  // 读取配置文件
  readConfig: (path) => electron.ipcRenderer.invoke("read-file", path),
  // 写入配置文件
  writeConfig: (path, data) => electron.ipcRenderer.invoke("write-file", { path, data }),
  // 打开文件夹
  openFolder: (path) => electron.ipcRenderer.invoke("open-folder", path),
  // 列出文件
  listFiles: (path) => electron.ipcRenderer.invoke("list-files", path),
  // 保存文件
  saveFile: (filename, data) => electron.ipcRenderer.invoke("save-file", { filename, data }),
  // 获取历史记录
  getHistory: () => electron.ipcRenderer.invoke("get-history"),
  // 打开文件（用系统默认程序）
  openFile: (folder, filename) => electron.ipcRenderer.invoke("open-file", folder, filename),
  // 读取文件内容
  readFileContent: (folder, filename) => electron.ipcRenderer.invoke("read-file-content", folder, filename),
  // 写入文件内容
  writeFileContent: (folder, filename, content) => electron.ipcRenderer.invoke("write-file-content", folder, filename, content),
  // 删除文件
  deleteFile: (folder, filename) => electron.ipcRenderer.invoke("delete-file", folder, filename),
  // 上传文件
  uploadFile: (folder, filename, content) => electron.ipcRenderer.invoke("upload-file", { folder, filename, content }),
  // 恢复文件（从回收站）
  restoreFile: (folder, filename) => electron.ipcRenderer.invoke("restore-file", folder, filename),
  // 🆕 读取 .env 文件
  loadEnv: () => electron.ipcRenderer.invoke("load-env"),
  // 🆕 保存 .env 文件
  saveEnv: (envVars) => electron.ipcRenderer.invoke("save-env", envVars)
};
if (process.contextIsolated) {
  try {
    electron.contextBridge.exposeInMainWorld("electron", preload.electronAPI);
    electron.contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
