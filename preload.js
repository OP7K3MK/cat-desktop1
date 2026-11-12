const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  ignore: v => ipcRenderer.send('ignore', v),
  menu: () => ipcRenderer.send('menu'),
  chat: t => ipcRenderer.invoke('chat', t),
  stt: a => ipcRenderer.invoke('stt', a),
  on: (c, f) => ipcRenderer.on(c, (e, d) => f(d))
});
