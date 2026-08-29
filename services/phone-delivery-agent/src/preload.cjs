const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smallPhoneDelivery', {
  state: () => ipcRenderer.invoke('delivery:state'),
  pair: code => ipcRenderer.invoke('delivery:pair', code),
  openLogin: () => ipcRenderer.invoke('delivery:open-login'),
  checkUpdate: () => ipcRenderer.invoke('delivery:check-update'),
  openSmallPhone: () => ipcRenderer.invoke('delivery:open-small-phone'),
  forgetLocal: () => ipcRenderer.invoke('delivery:forget-local'),
  purgeLocal: () => ipcRenderer.invoke('delivery:purge-local'),
  onState: callback => ipcRenderer.on('delivery:state-changed', (_event, value) => callback(value)),
});
