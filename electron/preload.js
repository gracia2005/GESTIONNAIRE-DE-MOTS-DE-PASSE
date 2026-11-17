const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('secureVaultDesktop', {
  isDesktop: true,
  platform: process.platform,
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  openDataFolder: () => ipcRenderer.invoke('desktop:open-data-folder'),
});

ipcRenderer.on('securevault:system-lock', () => {
  window.dispatchEvent(new CustomEvent('securevault:lock'));
});
