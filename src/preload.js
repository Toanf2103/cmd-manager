'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  hideWindow: () => ipcRenderer.invoke('window:hide'),
  start: (payload) => ipcRenderer.invoke('run:start', payload),
  stop: (cmdId) => ipcRenderer.invoke('run:stop', cmdId),
  listShells: (refresh) => ipcRenderer.invoke('env:shells', refresh),
  isAdmin: () => ipcRenderer.invoke('env:isAdmin'),
  exportData: (json, suggestedName) => ipcRenderer.invoke('data:export', json, suggestedName),
  importData: () => ipcRenderer.invoke('data:import'),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pickFolder', defaultPath),
  dirExists: (p) => ipcRenderer.invoke('fs:dirExists', p),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  openFolder: (p) => ipcRenderer.invoke('shell:openFolder', p),
  openTerminal: (p) => ipcRenderer.invoke('shell:openTerminal', p),
  onLog: (cb) => ipcRenderer.on('run:log', (_e, data) => cb(data)),
  onStatus: (cb) => ipcRenderer.on('run:status', (_e, data) => cb(data))
});
