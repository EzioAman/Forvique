// The only bridge between the UI and the machine: named calls, no Node access in the page.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("harness", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  pickWorkspace: () => ipcRenderer.invoke("workspace:pick"),
  read: (rel) => ipcRenderer.invoke("workspace:read", rel),
  current: (rel) => ipcRenderer.invoke("workspace:current", rel),
  write: (rel, content) => ipcRenderer.invoke("workspace:write", rel, content),
  searchDocs: (query, k) => ipcRenderer.invoke("docs:search", query, k),
});
