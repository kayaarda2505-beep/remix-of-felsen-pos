const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("printerBridge", {
  isAvailable: () => true,
  print: (printer, payload) =>
    ipcRenderer.invoke("printer:print", { printer, payload }),
  test: (printer) => ipcRenderer.invoke("printer:test", printer),
  discover: (opts) => ipcRenderer.invoke("printer:discover", opts),
});
