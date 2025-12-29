import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
    runDocGen: (mode: string, data: any): Promise<any> => ipcRenderer.invoke('run-docgen', { mode, data }),
    readConfig: (path: string): Promise<any> => ipcRenderer.invoke('read-file', path),
    writeConfig: (path: string, data: any): Promise<{ success: boolean; error?: string }> => 
        ipcRenderer.invoke('write-file', { path, data }),
    openFolder: (path: string): Promise<boolean> => ipcRenderer.invoke('open-folder', path),
    listFiles: (path: string): Promise<any[]> => ipcRenderer.invoke('list-files', path),
    saveFile: (filename: string, data: any): Promise<boolean> => ipcRenderer.invoke('save-file', { filename, data }),
    getHistory: (): Promise<any[]> => ipcRenderer.invoke('get-history'),
    openFile: (folder: string, filename: string): Promise<boolean> => 
        ipcRenderer.invoke('open-file', folder, filename),
    readFileContent: (folder: string, filename: string): Promise<string | null> => 
        ipcRenderer.invoke('read-file-content', folder, filename),
    writeFileContent: (folder: string, filename: string, content: string): Promise<boolean> => 
        ipcRenderer.invoke('write-file-content', folder, filename, content),
    deleteFile: (folder: string, filename: string): Promise<boolean> => 
        ipcRenderer.invoke('delete-file', folder, filename),
    uploadFile: (folder: string, filename: string, content: ArrayBuffer): Promise<boolean> => 
        ipcRenderer.invoke('upload-file', { folder, filename, content })
}

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