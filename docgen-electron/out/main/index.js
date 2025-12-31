"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const spawn = require("cross-spawn");
const fs = require("fs");
const buffer = require("buffer");
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
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
      return reject(`写入配置文件失败: ${err}`);
    }
    const scriptPath = path.join(process.cwd(), "main3.py");
    if (!fs.existsSync(scriptPath)) {
      return reject(`找不到 Python 脚本: ${scriptPath}`);
    }
    const pythonProcess = spawn(
      "python",
      ["-X", "utf8", "-E", "main3.py", "--mode", mode, "--config", filePath],
      {
        cwd: process.cwd(),
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          LANG: "C.UTF-8"
        }
      }
    );
    let output = "";
    let errorOutput = "";
    pythonProcess.stdout.setEncoding("utf8");
    pythonProcess.stderr.setEncoding("utf8");
    pythonProcess.stdout.on("data", (data2) => {
      output += data2;
      console.log("Python Output:", data2);
    });
    pythonProcess.stderr.on("data", (data2) => {
      errorOutput += data2;
      console.error("Python Error:", data2);
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
      reject(`启动 Python 进程失败: ${err}`);
    });
  });
});
function saveToHistory(data) {
  const historyFile = path.join(process.cwd(), "history.json");
  console.log(`Saving history to: ${historyFile}`);
  let history = [];
  try {
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    }
  } catch (e) {
    console.error("读取历史记录失败:", e);
  }
  if (history.length > 0) {
    const lastData = history[0].data;
    if (JSON.stringify(lastData) === JSON.stringify(data)) {
      console.log("历史记录内容相同，跳过保存");
      return;
    }
  }
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }),
    data
  };
  history.unshift(entry);
  if (history.length > 10) {
    history = history.slice(0, 10);
  }
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), "utf-8");
    console.log("History saved successfully");
  } catch (e) {
    console.error("保存历史记录失败:", e);
  }
}
electron.ipcMain.handle("get-history", async () => {
  try {
    const historyFile = path.join(process.cwd(), "history.json");
    console.log(`Loading history from: ${historyFile}`);
    if (fs.existsSync(historyFile)) {
      return JSON.parse(fs.readFileSync(historyFile, "utf-8"));
    }
    return [];
  } catch (e) {
    console.error("获取历史记录失败:", e);
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
    console.error(`读取文件失败 ${path$1}:`, err);
    return null;
  }
});
electron.ipcMain.handle("save-file", async (_event, { filename, data }) => {
  try {
    const filePath = path.join(process.cwd(), filename);
    console.log(`Saving file to: ${filePath}`);
    const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, "utf-8");
    console.log(`File saved successfully: ${filename}`);
    return true;
  } catch (err) {
    console.error(`保存文件失败 ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("write-file", async (_event, { path: path$1, data }) => {
  try {
    const fullPath = path.join(process.cwd(), path$1);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  } catch (err) {
    console.error(`写入文件失败 ${path$1}:`, err);
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
        date: stats.mtime.toLocaleString("zh-CN").split(" ")[0],
        size
      };
    });
  } catch (err) {
    console.error(`列出文件失败 ${subDir}:`, err);
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
    console.error(`打开文件失败 ${filename}:`, err);
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
    console.error(`读取文件内容失败 ${filename}:`, err);
    return null;
  }
});
electron.ipcMain.handle("write-file-content", async (_event, folder, filename, content) => {
  try {
    const fullPath = path.join(process.cwd(), folder, filename);
    fs.writeFileSync(fullPath, content, "utf-8");
    return true;
  } catch (err) {
    console.error(`写入文件内容失败 ${filename}:`, err);
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
    console.error(`删除文件失败 ${filename}:`, err);
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
    console.error(`上传文件失败 ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("restore-file", async (_event, folder, filename) => {
  try {
    console.log(`恢复文件: ${folder}/${filename}`);
    return true;
  } catch (err) {
    console.error(`恢复文件失败 ${filename}:`, err);
    return false;
  }
});
electron.ipcMain.handle("load-env", async () => {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) {
      return { success: false, message: ".env 文件不存在", data: {} };
    }
    const envContent = fs.readFileSync(envPath, "utf-8");
    const envVars = {};
    envContent.split("\n").forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return;
      const [key, ...valueParts] = line.split("=");
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join("=").trim();
      }
    });
    return { success: true, data: envVars };
  } catch (error) {
    console.error("读取 .env 失败:", error);
    return { success: false, message: error.message, data: {} };
  }
});
electron.ipcMain.handle("save-env", async (_event, envVars) => {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envContent = Object.entries(envVars).map(([key, value]) => `${key}=${value}`).join("\n");
    fs.writeFileSync(envPath, envContent, "utf-8");
    return { success: true, message: ".env 文件保存成功" };
  } catch (error) {
    console.error("保存 .env 失败:", error);
    return { success: false, message: error.message };
  }
});
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.docgen.electron");
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
