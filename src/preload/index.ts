import { contextBridge, ipcRenderer } from 'electron';
import type { ExportFileRequest, MermindAPI } from '../shared/types';

const api: MermindAPI = {
  platform: process.platform,
  openFileDialog: () => ipcRenderer.invoke('mermind:open-file'),
  openMarkdownDialog: () => ipcRenderer.invoke('mermind:open-markdown'),
  readFileByPath: (filePath: string) => ipcRenderer.invoke('mermind:read-path', filePath),
  saveFile: (args) => ipcRenderer.invoke('mermind:save-file', args),
  saveFileAs: (args) => ipcRenderer.invoke('mermind:save-file-as', args),
  exportBinaryOrText: (args: ExportFileRequest) => ipcRenderer.invoke('mermind:export-file', args),
  exportPdfFromHtml: (args) => ipcRenderer.invoke('mermind:export-pdf', args),
  getRecentFiles: () => ipcRenderer.invoke('mermind:recent-get'),
  addRecentFile: (filePath: string) => ipcRenderer.invoke('mermind:recent-add', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('mermind:recent-clear'),
  onMenuAction: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, action: string, payload?: string) => {
      callback(action, payload);
    };
    ipcRenderer.on('mermind:menu-action', listener);
    return () => {
      ipcRenderer.removeListener('mermind:menu-action', listener);
    };
  },
  windowControls: {
    minimize: () => ipcRenderer.send('mermind:win-minimize'),
    maximizeToggle: () => ipcRenderer.send('mermind:win-maximize'),
    close: () => ipcRenderer.send('mermind:win-close'),
  },
};

contextBridge.exposeInMainWorld('mermindAPI', api);
