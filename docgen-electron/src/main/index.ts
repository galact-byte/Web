import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import spawn from 'cross-spawn'
import fs from 'fs'
import { TextDecoder } from 'util'

// Commented out icon to prevent build error if missing
// import icon from '../../resources/icon.png?asset'

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        // ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            preload: join(__dirname, '../preload/index.js'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// IPC Handler
ipcMain.handle('run-docgen', async (_event, { mode, data }) => {
    return new Promise((resolve, reject) => {
        const fileName = mode === '1' ? 'information.json' : 'projects.json';
        const filePath = join(process.cwd(), fileName); // or app.getPath('userData') for production

        // Write data to file
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        } catch (err) {
            return reject(`Failed to write config file: ${err}`);
        }

        const scriptPath = join(process.cwd(), 'main3.py'); // Adjust for prod if needed
        // Assuming python is in PATH. In prod, might need to bundle python or configure path.

        // ... existing imports ...

        // ... existing imports ...

        // ... inside ipcMain.handle ...
        const pythonProcess = spawn('python', [scriptPath, '--mode', mode, '--config', filePath]);

        let output = '';
        let errorOutput = '';

        // Use correct encoding for Windows (GBK) vs others (UTF-8)
        const encoding = process.platform === 'win32' ? 'gbk' : 'utf-8';
        const outDecoder = new TextDecoder(encoding);
        const errDecoder = new TextDecoder(encoding);

        pythonProcess.stdout?.on('data', (data) => {
            const str = outDecoder.decode(data, { stream: true });
            output += str;
            if (process.platform === 'win32') {
                process.stdout.write(`Python stdout: `);
                process.stdout.write(data);
                // process.stdout.write('\n'); // Optional: data usually contains newline
            } else {
                console.log(`Python stdout: ${str}`);
            }
        });

        pythonProcess.stderr?.on('data', (data) => {
            const str = errDecoder.decode(data, { stream: true });
            errorOutput += str;
            if (process.platform === 'win32') {
                process.stderr.write(`Python stderr: `);
                process.stderr.write(data);
            } else {
                console.error(`Python stderr: ${str}`);
            }
        });

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                if (mode === '1') {
                    saveToHistory(data);
                }
                resolve({ success: true, output });
            } else {
                resolve({ success: false, output, error: errorOutput });
            }
        });

        pythonProcess.on('error', (err) => {
            reject(`Failed to spawn python process: ${err}`);
        });
    });
});

// Helper to save history
function saveToHistory(data: any) {
    const historyFile = join(process.cwd(), 'history.json');
    let history: any[] = [];
    try {
        if (fs.existsSync(historyFile)) {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to read history:', e);
    }

    const entry = {
        timestamp: new Date().toLocaleString(),
        data: data
    };

    history.unshift(entry);
    if (history.length > 10) {
        history = history.slice(0, 10);
    }

    try {
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to save history:', e);
    }
}

import { Buffer } from 'buffer'

ipcMain.handle('get-history', async () => {
    try {
        const historyFile = join(process.cwd(), 'history.json');
        if (fs.existsSync(historyFile)) {
            return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        }
        return [];
    } catch (e) {
        console.error('Failed to get history:', e);
        return [];
    }
});

ipcMain.handle('read-file', async (_event, path) => {
    try {
        const fullPath = join(process.cwd(), path);
        if (fs.existsSync(fullPath)) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        }
        return null;
    } catch (err) {
        console.error(`Error reading file ${path}:`, err);
        return null;
    }
});

ipcMain.handle('save-file', async (_event, { filename, data }) => {
    try {
        const filePath = join(process.cwd(), filename);
        // Ensure data is stringified if it's an object
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        fs.writeFileSync(filePath, content, 'utf-8');
        return true;
    } catch (err) {
        console.error(`Error saving file ${filename}:`, err);
        return false;
    }
});

ipcMain.handle('write-file', async (_event, { path, data }) => {
    try {
        const fullPath = join(process.cwd(), path);
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
        return { success: true };
    } catch (err: any) {
        console.error(`Error writing file ${path}:`, err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('open-folder', async (_event, path) => {
    const fullPath = join(process.cwd(), path);
    if (fs.existsSync(fullPath)) {
        await shell.openPath(fullPath);
        return true;
    }
    return false;
});

ipcMain.handle('list-files', async (_event, subDir) => {
    try {
        const dirPath = join(process.cwd(), subDir);
        if (!fs.existsSync(dirPath)) {
            return [];
        }
        const files = fs.readdirSync(dirPath);
        return files.map(file => {
            const stats = fs.statSync(join(dirPath, file));
            const size = stats.size < 1024
                ? `${stats.size} B`
                : `${(stats.size / 1024).toFixed(0)} KB`;
            return {
                name: file,
                date: stats.mtime.toISOString().split('T')[0],
                size: size
            };
        });
    } catch (err) {
        console.error(`Error listing files in ${subDir}:`, err);
        return [];
    }
});

// 打开文件（用系统默认程序）
ipcMain.handle('open-file', async (_event, folder, filename) => {
    try {
        const fullPath = join(process.cwd(), folder, filename)
        if (fs.existsSync(fullPath)) {
            await shell.openPath(fullPath)
            return true
        }
        return false
    } catch (err) {
        console.error(`Error opening file ${filename}:`, err)
        return false
    }
})

// 读取文件内容
ipcMain.handle('read-file-content', async (_event, folder, filename) => {
    try {
        const fullPath = join(process.cwd(), folder, filename)
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, 'utf-8')
        }
        return null
    } catch (err) {
        console.error(`Error reading file ${filename}:`, err)
        return null
    }
})

// 写入文件内容
ipcMain.handle('write-file-content', async (_event, folder, filename, content) => {
    try {
        const fullPath = join(process.cwd(), folder, filename)
        fs.writeFileSync(fullPath, content, 'utf-8')
        return true
    } catch (err) {
        console.error(`Error writing file ${filename}:`, err)
        return false
    }
})

// 删除文件
ipcMain.handle('delete-file', async (_event, folder, filename) => {
    try {
        const fullPath = join(process.cwd(), folder, filename)
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath)
            return true
        }
        return false
    } catch (err) {
        console.error(`Error deleting file ${filename}:`, err)
        return false
    }
})

ipcMain.handle('upload-file', async (_event, { folder, filename, content }) => {
    try {
        const dirPath = join(process.cwd(), folder);
        // 确保文件夹存在，不存在则创建
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        const filePath = join(dirPath, filename);
        // 将 ArrayBuffer 转为 Buffer 并写入
        fs.writeFileSync(filePath, Buffer.from(content));
        return true;
    } catch (err) {
        console.error(`Error uploading file ${filename}:`, err);
        return false;
    }
});

app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
