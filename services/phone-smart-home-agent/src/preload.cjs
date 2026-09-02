const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smallPhoneSmartHome', {
  state: () => ipcRenderer.invoke('smarthome:state'),
  pairStart: code => ipcRenderer.invoke('smarthome:pair-start', code),
  pairConfirm: () => ipcRenderer.invoke('smarthome:pair-confirm'),
  pairCancel: () => ipcRenderer.invoke('smarthome:pair-cancel'),
  test: () => ipcRenderer.invoke('smarthome:test'),
  openSmallPhone: () => ipcRenderer.invoke('smarthome:open-small-phone'),
  openGuide: () => ipcRenderer.invoke('smarthome:open-guide'),
  forget: () => ipcRenderer.invoke('smarthome:forget'),
  onState: callback => ipcRenderer.on('smarthome:state-changed', (_event, value) => callback(value)),
});
