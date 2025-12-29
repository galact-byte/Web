"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const api = {
  runDocGen: (mode, data) => electron.ipcRenderer.invoke("run-docgen", { mode, data }),
  readConfig: (path) => electron.ipcRenderer.invoke("read-file", path),
  writeConfig: (path, data) => electron.ipcRenderer.invoke("write-file", { path, data }),
  openFolder: (path) => electron.ipcRenderer.invoke("open-folder", path),
  listFiles: (path) => electron.ipcRenderer.invoke("list-files", path),
  saveFile: (filename, data) => electron.ipcRenderer.invoke("save-file", { filename, data }),
  getHistory: () => electron.ipcRenderer.invoke("get-history"),
  openFile: (folder, filename) => electron.ipcRenderer.invoke("open-file", folder, filename),
  readFileContent: (folder, filename) => electron.ipcRenderer.invoke("read-file-content", folder, filename),
  writeFileContent: (folder, filename, content) => electron.ipcRenderer.invoke("write-file-content", folder, filename, content),
  deleteFile: (folder, filename) => electron.ipcRenderer.invoke("delete-file", folder, filename),
  uploadFile: (folder, filename, content) => electron.ipcRenderer.invoke("upload-file", { folder, filename, content })
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
