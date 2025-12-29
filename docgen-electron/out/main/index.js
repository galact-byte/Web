"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const spawn = require("cross-spawn");
const fs = require("fs");
const util = require("util");
const buffer = require("buffer");
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    // ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.ipcMain.handle("run-docgen", async (_event, { mode, data }) => {
  return new Promise((resolve, reject) => {
    const fileName = mode === "1" ? "information.json" : "projects.json";
    const filePath = path.join(process.cwd(), fileName);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      return reject(`Failed to write config file: ${err}`);
    }
    const scriptPath = path.join(process.cwd(), "main3.py");
    const pythonProcess = spawn("python", [scriptPath, "--mode", mode, "--config", filePath]);
    let output = "";
    let errorOutput = "";
    const encoding = process.platform === "win32" ? "gbk" : "utf-8";
    const outDecoder = new util.TextDecoder(encoding);
    const errDecoder = new util.TextDecoder(encoding);
    pythonProcess.stdout?.on("data", (data2) => {
      const str = outDecoder.decode(data2, { stream: true });
      output += str;
      if (process.platform === "win32") {
        process.stdout.write(`Python stdout: `);
        process.stdout.write(data2);
      } else {
        console.log(`Python stdout: ${str}`);
      }
    });
    pythonProcess.stderr?.on("data", (data2) => {
      const str = errDecoder.decode(data2, { stream: true });
      errorOutput += str;
      if (process.platform === "win32") {
        process.stderr.write(`Python stderr: `);
        process.stderr.write(data2);
      } else {
        console.error(`Python stderr: ${str}`);
      }
    });
    pythonProcess.on("close", (code) => {
      if (code === 0) {
        if (mode === "1") {
          saveToHistory(data);
        }
        resolve({ success: true, output });
      } else {
        resolve({ success: false, output, error: errorOutput });
      }
    });
    pythonProcess.on("error", (err) => {
      reject(`Failed to spawn python process: ${err}`);
    });
  });
});
function saveToHistory(data) {
  const historyFile = path.join(process.cwd(), "history.json");
  let history = [];
  try {
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    }
  } catch (e) {
    console.error("Failed to read history:", e);
  }
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toLocaleString(),
    data
  };
  history.unshift(entry);
  if (history.length > 10) {
    history = history.slice(0, 10);
  }
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save history:", e);
  }
}
electron.ipcMain.handle("get-history", async () => {
  try {
    const historyFile = path.join(process.cwd(), "history.json");
    if (fs.existsSync(historyFile)) {
      return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    }
    return [];
  } catch (e) {
    console.error("Failed to get history:", e);
    return [];
  }
});
electron.ipcMain.handle("read-file", async (_event, path$1) => {
  try {
    const fullPath = path.join(process.cwd(), path$1);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    }
    return null;
  } catch (err) {
    console.error(`Error reading file ${path$1}:`, err);
    return null;
  }
});
electron.ipcMain.handle("save-file", async (_event, { filename, data }) => {
  try {
    const filePath = path.join(process.cwd(), filename);
    const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch (err) {
    console.error(`Error saving file ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("write-file", async (_event, { path: path$1, data }) => {
  try {
    const fullPath = path.join(process.cwd(), path$1);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    console.error(`Error writing file ${path$1}:`, err);
    return { success: false, error: err.message };
  }
});
electron.ipcMain.handle("open-folder", async (_event, path$1) => {
  const fullPath = path.join(process.cwd(), path$1);
  if (fs.existsSync(fullPath)) {
    await electron.shell.openPath(fullPath);
    return true;
  }
  return false;
});
electron.ipcMain.handle("list-files", async (_event, subDir) => {
  try {
    const dirPath = path.join(process.cwd(), subDir);
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(dirPath);
    return files.map((file) => {
      const stats = fs.statSync(path.join(dirPath, file));
      const size = stats.size < 1024 ? `${stats.size} B` : `${(stats.size / 1024).toFixed(0)} KB`;
      return {
        name: file,
        date: stats.mtime.toISOString().split("T")[0],
        size
      };
    });
  } catch (err) {
    console.error(`Error listing files in ${subDir}:`, err);
    return [];
  }
});
electron.ipcMain.handle("open-file", async (_event, folder, filename) => {
  try {
    const fullPath = path.join(process.cwd(), folder, filename);
    if (fs.existsSync(fullPath)) {
      await electron.shell.openPath(fullPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error opening file ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("read-file-content", async (_event, folder, filename) => {
  try {
    const fullPath = path.join(process.cwd(), folder, filename);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, "utf-8");
    }
    return null;
  } catch (err) {
    console.error(`Error reading file ${filename}:`, err);
    return null;
  }
});
electron.ipcMain.handle("write-file-content", async (_event, folder, filename, content) => {
  try {
    const fullPath = path.join(process.cwd(), folder, filename);
    fs.writeFileSync(fullPath, content, "utf-8");
    return true;
  } catch (err) {
    console.error(`Error writing file ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("delete-file", async (_event, folder, filename) => {
  try {
    const fullPath = path.join(process.cwd(), folder, filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error deleting file ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("upload-file", async (_event, { folder, filename, content }) => {
  try {
    const dirPath = path.join(process.cwd(), folder);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    const filePath = path.join(dirPath, filename);
    fs.writeFileSync(filePath, buffer.Buffer.from(content));
    return true;
  } catch (err) {
    console.error(`Error uploading file ${filename}:`, err);
    return false;
  }
});
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
