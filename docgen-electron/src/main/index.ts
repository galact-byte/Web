import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, resolve as resolvePath, relative, isAbsolute, sep } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import spawn from 'cross-spawn'
import fs from 'fs'
import { Buffer } from 'buffer'


// 将渲染进程传入的路径逐级解析并限制在 base 之内，拒绝 .. 与绝对路径越界（不处理符号链接）
function resolveInside(base: string, ...segments: string[]): string {
    let current = resolvePath(base)
    for (const segment of segments) {
        if (typeof segment !== 'string') {
            throw new Error('路径参数无效')
        }
        const next = resolvePath(current, segment)
        const rel = relative(current, next)
        if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
            throw new Error(`路径超出允许范围: ${segment}`)
        }
        current = next
    }
    return current
}

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        autoHideMenuBar: true,
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

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
}

// 🔧 IPC Handler - 运行 Python 文档生成
ipcMain.handle('run-docgen', async (_event, { mode, data }) => {
    return new Promise((resolve, reject) => {
        const fileName = mode === '1' ? 'information.json' : 'projects.json'
        const filePath = join(process.cwd(), fileName)

        // 写入配置文件
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')

            // 单项目模式时保存到历史记录
            if (mode === '1') {
                saveToHistory(data)
            }
        } catch (err) {
            return reject(`写入配置文件失败: ${err}`)
        }

        // Determine execution mode (Binary vs Python Script)
        let command = ''
        let args: string[] = []
        let cwd = process.cwd()

        const exePath = join(process.resourcesPath, 'bin', 'main3.exe')
        const scriptPath = join(process.cwd(), 'main3.py')

        // Priority 1: Check for packaged executable (Production)
        if (fs.existsSync(exePath)) {
            console.log('Found executable at:', exePath)
            command = exePath
            args = ['--mode', mode, '--config', filePath]
            cwd = process.resourcesPath
        }
        // Priority 2: Check for python script (Development)
        else if (fs.existsSync(scriptPath)) {
            console.log('Found python script at:', scriptPath)
            command = 'python' // Assumes python is in PATH
            args = ['-X', 'utf8', '-E', 'main3.py', '--mode', mode, '--config', filePath]
        }
        // Error: Neither found
        else {
            return reject(`无法找到文档生成程序。\n已尝试路径:\n1. executable: ${exePath}\n2. script: ${scriptPath}`)
        }

        const pythonProcess = spawn(command, args, {
            cwd,
            windowsHide: true,
            env: {
                ...process.env,
                PYTHONUTF8: '1',
                LANG: 'C.UTF-8'
            }
        })

        let output = ''
        let errorOutput = ''



        pythonProcess.stdout.setEncoding('utf8')
        pythonProcess.stderr.setEncoding('utf8')

        pythonProcess.stdout.on('data', (data: string) => {
            output += data
            console.log('Python Output:', data)
        })

        pythonProcess.stderr.on('data', (data: string) => {
            errorOutput += data
            console.error('Python Error:', data)
        })

        pythonProcess.on('close', (code: number) => {
            if (code === 0) {
                resolve({ success: true, output })
            } else {
                resolve({ success: false, output, error: errorOutput })
            }
        })

        pythonProcess.on('error', (err: Error) => {
            reject(`启动 Python 进程失败: ${err}`)
        })
    })
})

// 💾 保存历史记录（仅更新单项目历史，保留多项目历史记录）
function saveToHistory(data: any) {
    // 验证数据有效性
    if (!data || !data['项目名称'] || !String(data['项目名称']).trim()) {
        console.log('项目名称为空，跳过保存历史记录')
        return
    }

    const historyFile = join(process.cwd(), 'history.json')
    console.log(`Saving history to: ${historyFile}`)

    let rawHistory: any[] = []

    try {
        if (fs.existsSync(historyFile)) {
            const parsed = JSON.parse(fs.readFileSync(historyFile, 'utf-8'))
            if (Array.isArray(parsed)) rawHistory = parsed
        }
    } catch (e) {
        console.error('读取历史记录失败:', e)
    }

    const isMultiEntry = (item: any) => item?.mode === 'multi' || Array.isArray(item?.data?.projects)
    const singleHistory = rawHistory.filter((item) => !isMultiEntry(item))
    const multiHistory = rawHistory.filter((item) => isMultiEntry(item))

    // 检查是否与最近一条单项目历史记录内容相同（去重）
    if (singleHistory.length > 0) {
        const lastData = singleHistory[0].data
        if (JSON.stringify(lastData) === JSON.stringify(data)) {
            console.log('历史记录内容相同，跳过保存')
            return
        }
    }

    const entry = {
        mode: 'single',
        timestamp: new Date().toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }),
        data: data
    }

    singleHistory.unshift(entry)
    const cappedSingle = singleHistory.slice(0, 10)

    try {
        fs.writeFileSync(historyFile, JSON.stringify([...cappedSingle, ...multiHistory], null, 2), 'utf-8')
        console.log('History saved successfully')
    } catch (e) {
        console.error('保存历史记录失败:', e)
    }
}

// 📋 获取历史记录
ipcMain.handle('get-history', async () => {
    try {
        const historyFile = join(process.cwd(), 'history.json')
        console.log(`Loading history from: ${historyFile}`)
        if (fs.existsSync(historyFile)) {
            return JSON.parse(fs.readFileSync(historyFile, 'utf-8'))
        }
        return []
    } catch (e) {
        console.error('获取历史记录失败:', e)
        return []
    }
})

// 📄 读取配置文件
ipcMain.handle('read-file', async (_event, path) => {
    try {
        const fullPath = resolveInside(process.cwd(), path)
        if (fs.existsSync(fullPath)) {
            return JSON.parse(fs.readFileSync(fullPath, 'utf-8'))
        }
        return null
    } catch (err) {
        console.error(`读取文件失败 ${path}:`, err)
        return null
    }
})

// 💾 保存文件
ipcMain.handle('save-file', async (_event, { filename, data }) => {
    try {
        const filePath = resolveInside(process.cwd(), filename)
        console.log(`Saving file to: ${filePath}`)

        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
        fs.writeFileSync(filePath, content, 'utf-8')
        console.log(`File saved successfully: ${filename}`)
        return true
    } catch (err) {
        console.error(`保存文件失败 ${filename}:`, err)
        return false
    }
})

// ✍️ 写入文件
ipcMain.handle('write-file', async (_event, { path, data }) => {
    try {
        const fullPath = resolveInside(process.cwd(), path)
        fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8')
        return { success: true }
    } catch (err: any) {
        console.error(`写入文件失败 ${path}:`, err)
        return { success: false, error: err.message }
    }
})

// 📂 打开文件夹
ipcMain.handle('open-folder', async (_event, path) => {
    // Try cwd first (Development / Portable)
    let fullPath: string
    try {
        fullPath = resolveInside(process.cwd(), path)
    } catch (err) {
        console.error(`拒绝打开路径 ${path}:`, err)
        return false
    }

    if (!fs.existsSync(fullPath)) {
        // Try resources path (Packaged Production)
        const resourcesPath = join(process.resourcesPath, path)
        if (fs.existsSync(resourcesPath)) {
            fullPath = resourcesPath
        } else {
            console.error(`Folder not found: ${path} (Checked: ${fullPath}, ${resourcesPath})`)
            return false
        }
    }

    console.log(`Opening folder: ${fullPath}`)
    await shell.openPath(fullPath)
    return true
})

// 📋 列出文件
ipcMain.handle('list-files', async (_event, subDir) => {
    try {
        const basePath = getBasePath()
        const dirPath = resolveInside(basePath, subDir)
        console.log(`[DEBUG] list-files: subDir=${subDir}, base=${basePath}, full=${dirPath}`)

        if (!fs.existsSync(dirPath)) {
            console.log(`[DEBUG] list-files: Path not found!`)
            return []
        }

        const files = fs.readdirSync(dirPath)
        const result: any[] = []

        for (const file of files) {
            try {
                const filePath = join(dirPath, file)
                const stats = fs.statSync(filePath)
                if (!stats.isFile()) continue
                const size = stats.size < 1024
                    ? `${stats.size} B`
                    : `${(stats.size / 1024).toFixed(0)} KB`
                const mtime = stats.mtime.toLocaleString('zh-CN')

                result.push({
                    name: file,
                    date: mtime.split(' ')[0],
                    mtime,
                    size: size
                })
            } catch (fileErr) {
                console.error(`[DEBUG] Error stating file ${file}:`, fileErr)
                // Skip problematic file
            }
        }
        console.log(`[DEBUG] list-files returning ${result.length} files`)
        return result
    } catch (err) {
        console.error(`列出文件失败 ${subDir}:`, err)
        console.error(err)
        return []
    }
})

const getBasePath = () => {
    // Debug logging
    console.log('[DEBUG] getBasePath check:')
    console.log('  cwd:', process.cwd())
    console.log('  resourcesPath:', process.resourcesPath)
    console.log('  app.isPackaged:', app.isPackaged)

    // Priority: Check if 'templates' or 'rules' exist in resourcesPath (Production with files)
    if (fs.existsSync(join(process.resourcesPath, 'templates')) || fs.existsSync(join(process.resourcesPath, 'rules'))) {
        console.log('  -> MATCH: Found data in resourcesPath')
        return process.resourcesPath
    }

    // Fallback: If Packaged flag is true, assume we want resources (e.g. fresh install, empty folders)
    if (app.isPackaged) {
        console.log('  -> MATCH: app.isPackaged is true')
        return process.resourcesPath
    }

    // Default: Development / Portable CWD
    console.log('  -> MATCH: Defaulting to CWD')
    return process.cwd()
}

// 📖 打开文件（用系统默认程序）
ipcMain.handle('open-file', async (_event, folder, filename) => {
    try {
        const fullPath = resolveInside(getBasePath(), folder, filename)
        if (fs.existsSync(fullPath)) {
            await shell.openPath(fullPath)
            return true
        }
        return false
    } catch (err) {
        console.error(`打开文件失败 ${filename}:`, err)
        return false
    }
})

// 📄 读取文件内容
ipcMain.handle('read-file-content', async (_event, folder, filename) => {
    try {
        const fullPath = resolveInside(getBasePath(), folder, filename)
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, 'utf-8')
        }
        return null
    } catch (err) {
        console.error(`读取文件内容失败 ${filename}:`, err)
        return null
    }
})

// ✍️ 写入文件内容
ipcMain.handle('write-file-content', async (_event, folder, filename, content) => {
    try {
        const fullPath = resolveInside(getBasePath(), folder, filename)
        fs.writeFileSync(fullPath, content, 'utf-8')
        return true
    } catch (err) {
        console.error(`写入文件内容失败 ${filename}:`, err)
        return false
    }
})

// 🗑️ 删除文件（移到回收站）
ipcMain.handle('delete-file', async (_event, folder, filename) => {
    try {
        const basePath = getBasePath()
        const srcPath = resolveInside(basePath, folder, filename)
        const trashDir = resolveInside(basePath, '.trash', folder)
        const destPath = resolveInside(trashDir, filename)

        if (!fs.existsSync(srcPath)) {
            return false
        }

        if (!fs.existsSync(trashDir)) {
            fs.mkdirSync(trashDir, { recursive: true })
        }

        fs.renameSync(srcPath, destPath)
        console.log(`Moved to trash: ${filename}`)
        return true
    } catch (err) {
        console.error(`删除文件失败 ${filename}:`, err)
        return false
    }
})

// 📤 上传文件
ipcMain.handle('upload-file', async (_event, { folder, filename, content }) => {
    try {
        const dirPath = resolveInside(getBasePath(), folder)
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }

        const filePath = resolveInside(dirPath, filename)
        fs.writeFileSync(filePath, Buffer.from(content))
        return true
    } catch (err) {
        console.error(`上传文件失败 ${filename}:`, err)
        return false
    }
})

// 🔄 恢复文件（从回收站）
ipcMain.handle('restore-file', async (_event, folder, filename) => {
    try {
        const basePath = getBasePath()
        const srcPath = resolveInside(basePath, '.trash', folder, filename)
        const destDir = resolveInside(basePath, folder)
        const destPath = resolveInside(destDir, filename)

        if (!fs.existsSync(srcPath)) {
            console.error(`Trash file not found: ${srcPath}`)
            return false
        }

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true })
        }

        fs.renameSync(srcPath, destPath)
        console.log(`Restored file: ${filename}`)
        return true
    } catch (err) {
        console.error(`恢复文件失败 ${filename}:`, err)
        return false
    }
})

// ❌ 彻底删除文件
ipcMain.handle('permanent-delete-file', async (_event, folder, filename) => {
    try {
        const basePath = getBasePath()
        const filePath = resolveInside(basePath, '.trash', folder, filename)

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            return true
        }
        return false
    } catch (err) {
        console.error(`彻底删除文件失败 ${filename}:`, err)
        return false
    }
})

// 🔧 读取 .env 文件
ipcMain.handle('load-env', async () => {
    try {
        const envPath = join(process.cwd(), '.env')

        if (!fs.existsSync(envPath)) {
            return { success: false, message: '.env 文件不存在', data: {} }
        }

        const envContent = fs.readFileSync(envPath, 'utf-8')
        const envVars: Record<string, string> = {}

        envContent.split('\n').forEach(line => {
            line = line.trim()
            if (!line || line.startsWith('#')) return

            const [key, ...valueParts] = line.split('=')
            if (key && valueParts.length > 0) {
                envVars[key.trim()] = valueParts.join('=').trim()
            }
        })

        return { success: true, data: envVars }
    } catch (error: any) {
        console.error('读取 .env 失败:', error)
        return { success: false, message: error.message, data: {} }
    }
})

// 💾 保存 .env 文件
ipcMain.handle('save-env', async (_event, envVars) => {
    try {
        const envPath = join(process.cwd(), '.env')

        const envContent = Object.entries(envVars)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n')

        fs.writeFileSync(envPath, envContent, 'utf-8')

        return { success: true, message: '.env 文件保存成功' }
    } catch (error: any) {
        console.error('保存 .env 失败:', error)
        return { success: false, message: error.message }
    }
})

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.docgen.electron')

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