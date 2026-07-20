const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('evidenceLan', {
  startSession: (snapshot, selectedAddress) => ipcRenderer.invoke('lan:start-session', snapshot, selectedAddress),
  stopSession: () => ipcRenderer.invoke('lan:stop-session'),
  getStatus: () => ipcRenderer.invoke('lan:get-status'),
  onImage: (listener) => {
    const wrappedListener = (_event, payload) => listener(payload);
    ipcRenderer.on('lan:image', wrappedListener);
    return () => ipcRenderer.removeListener('lan:image', wrappedListener);
  },
  confirmImageSaved: (requestId, outcome) => ipcRenderer.send('lan:image-saved', requestId, outcome),
});
