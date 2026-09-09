const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('evidenceLan', {
  startSession: (snapshot, selectedAddress) => ipcRenderer.invoke('lan:start-session', snapshot, selectedAddress),
  stopSession: () => ipcRenderer.invoke('lan:stop-session'),
  updateSession: (snapshot) => ipcRenderer.invoke('lan:update-session', snapshot),
  getStatus: () => ipcRenderer.invoke('lan:get-status'),
  onImage: (listener) => {
    const wrappedListener = (_event, payload) => listener(payload);
    ipcRenderer.on('lan:image', wrappedListener);
    return () => ipcRenderer.removeListener('lan:image', wrappedListener);
  },
  confirmImageSaved: (requestId, outcome) => ipcRenderer.send('lan:image-saved', requestId, outcome),
});

// 未完成写入计数同步给主进程：Electron 下浏览器级 beforeunload 不弹确认框，必须由主进程拦截 close。
contextBridge.exposeInMainWorld('evidenceWrites', {
  setPendingWrites: (pending) => ipcRenderer.send('writes:pending', pending),
});

contextBridge.exposeInMainWorld('evidenceData', {
  getLocation: () => ipcRenderer.invoke('data:get-location'),
  chooseLocation: () => ipcRenderer.invoke('data:choose-location'),
  resetLocation: () => ipcRenderer.invoke('data:reset-location'),
  deleteBackup: () => ipcRenderer.invoke('data:delete-backup'),
  relaunch: () => ipcRenderer.invoke('data:relaunch'),
});
