import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
    // 运行文档生成
    runDocGen: (mode: string, data: any): Promise<any> => 
        ipcRenderer.invoke('run-docgen', { mode, data }),
    
    // 读取配置文件
    readConfig: (path: string): Promise<any> => 
        ipcRenderer.invoke('read-file', path),
    
    // 写入配置文件
    writeConfig: (path: string, data: any): Promise<{ success: boolean; error?: string }> => 
        ipcRenderer.invoke('write-file', { path, data }),
    
    // 打开文件夹
    openFolder: (path: string): Promise<boolean> => 
        ipcRenderer.invoke('open-folder', path),
    
    // 列出文件
    listFiles: (path: string): Promise<any[]> => 
        ipcRenderer.invoke('list-files', path),
    
    // 保存文件
    saveFile: (filename: string, data: any): Promise<boolean> => 
        ipcRenderer.invoke('save-file', { filename, data }),
    
    // 获取历史记录
    getHistory: (): Promise<any[]> => 
        ipcRenderer.invoke('get-history'),
    
    // 打开文件（用系统默认程序）
    openFile: (folder: string, filename: string): Promise<boolean> => 
        ipcRenderer.invoke('open-file', folder, filename),
    
    // 读取文件内容
    readFileContent: (folder: string, filename: string): Promise<string | null> => 
        ipcRenderer.invoke('read-file-content', folder, filename),
    
    // 写入文件内容
    writeFileContent: (folder: string, filename: string, content: string): Promise<boolean> => 
        ipcRenderer.invoke('write-file-content', folder, filename, content),
    
    // 删除文件
    deleteFile: (folder: string, filename: string): Promise<boolean> => 
        ipcRenderer.invoke('delete-file', folder, filename),
    
    // 上传文件
    uploadFile: (folder: string, filename: string, content: ArrayBuffer): Promise<boolean> => 
        ipcRenderer.invoke('upload-file', { folder, filename, content }),
    
    // 恢复文件（从回收站）
    restoreFile: (folder: string, filename: string): Promise<boolean> => 
        ipcRenderer.invoke('restore-file', folder, filename),
    
    // 🆕 读取 .env 文件
    loadEnv: (): Promise<{ success: boolean; data: Record<string, string>; message?: string }> => 
        ipcRenderer.invoke('load-env'),
    
    // 🆕 保存 .env 文件
    saveEnv: (envVars: Record<string, string>): Promise<{ success: boolean; message: string }> => 
        ipcRenderer.invoke('save-env', envVars)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}