import { contextBridge, ipcRenderer } from 'electron';
import type { ExportFileRequest, MermindAPI, UpdateState } from '../shared/types';

const appVersion = ipcRenderer.sendSync('mermind:get-version') as string;

const api: MermindAPI = {
  platform: process.platform,
  appVersion,
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
  updater: {
    getState: () => ipcRenderer.invoke('mermind:update-get-state'),
    checkForUpdates: (manual?: boolean) => ipcRenderer.invoke('mermind:update-check', manual),
    downloadUpdate: () => ipcRenderer.invoke('mermind:update-download'),
    installUpdate: () => ipcRenderer.invoke('mermind:update-install'),
    openReleasePage: () => ipcRenderer.invoke('mermind:update-open-release'),
    onStatusChange: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) => {
        callback(state);
      };
      ipcRenderer.on('mermind:update-status', listener);
      return () => {
        ipcRenderer.removeListener('mermind:update-status', listener);
      };
    },
  },
  windowControls: {
    minimize: () => ipcRenderer.send('mermind:win-minimize'),
    maximizeToggle: () => ipcRenderer.send('mermind:win-maximize'),
    close: () => ipcRenderer.send('mermind:win-close'),
  },
};

contextBridge.exposeInMainWorld('mermindAPI', api);
