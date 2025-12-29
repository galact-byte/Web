/// <reference types="vite/client" />

export interface IElectronAPI {
    loadPreferences: () => Promise<void>
}

declare global {
    interface Window {
        electron: any
        api: {
            runDocGen: (mode: string, data: any) => Promise<any>
            readConfig: (path: string) => Promise<any>
            openFolder: (path: string) => Promise<boolean>
            listFiles: (path: string) => Promise<any[]>
            saveFile: (filename: string, data: any) => Promise<boolean>
            getHistory: () => Promise<any[]>
        }
    }
}

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types
    const component: DefineComponent<{}, {}, any>
    export default component
}
