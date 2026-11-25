import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ExportFileRequest, FilePayload, SaveFileResult } from '../shared/types';
import type { DshSendRequest } from '../shared/dshBridge';
import { extractMermaidBlocksFromMarkdown } from '../shared/mermaid/markdown';
import { AppUpdateController } from './updater';
import { getDshStatus, readImageFiles, resolveOutputPath, sendToDsh } from './dshBridge';

let mainWindow: BrowserWindow | null = null;
let pendingOpenPaths: string[] = [];
const updateController = new AppUpdateController(() => mainWindow);

const RECENT_FILE_LIMIT = 10;

function getRecentStorePath(): string {
  return path.join(app.getPath('userData'), 'recent-files.json');
}

function readRecentFiles(): string[] {
  try {
    const raw = fs.readFileSync(getRecentStorePath(), 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p): p is string => typeof p === 'string' && fs.existsSync(p));
    }
  } catch {
    // ignore missing or corrupt recent file store
  }
  return [];
}

function writeRecentFiles(files: string[]): void {
  try {
    fs.mkdirSync(path.dirname(getRecentStorePath()), { recursive: true });
    fs.writeFileSync(getRecentStorePath(), JSON.stringify(files.slice(0, RECENT_FILE_LIMIT), null, 2));
  } catch {
    // ignore
  }
}

function addRecentFile(filePath: string): string[] {
  const existing = readRecentFiles().filter((p) => p !== filePath);
  const next = [filePath, ...existing].slice(0, RECENT_FILE_LIMIT);
  writeRecentFiles(next);
  buildAppMenu();
  return next;
}

function readFilePayload(filePath: string): FilePayload | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const name = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.md' || ext === '.markdown') {
      const blocks = extractMermaidBlocksFromMarkdown(content);
      return {
        filePath,
        name,
        content: blocks[0] ?? content,
        fromMarkdown: true,
        markdownBlocks: blocks,
      };
    }
    return { filePath, name, content };
  } catch {
    return null;
  }
}

function sendMenuAction(action: string, payload?: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mermind:menu-action', action, payload);
  }
}

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';
  const recentFiles = readRecentFiles();

  const recentSubmenu: Electron.MenuItemConstructorOptions[] =
    recentFiles.length > 0
      ? [
          ...recentFiles.map((fp) => ({
            label: path.basename(fp),
            sublabel: fp,
            click: () => sendMenuAction('open-path', fp),
          })),
          { type: 'separator' },
          {
            label: 'Clear Recent',
            click: () => {
              writeRecentFiles([]);
              buildAppMenu();
            },
          },
        ]
      : [{ label: '(Empty)', enabled: false }];

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              {
                label: 'Check for Updates...',
                click: () => sendMenuAction('check-updates'),
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Mindmap',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new-mindmap'),
        },
        {
          label: 'New Flowchart',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => sendMenuAction('new-flowchart'),
        },
        {
          label: 'New from Template...',
          click: () => sendMenuAction('open-templates'),
        },
        { type: 'separator' },
        {
          label: 'Open Mermaid File...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendMenuAction('open-file'),
        },
        {
          label: 'Import from Markdown...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => sendMenuAction('import-markdown'),
        },
        {
          label: 'Open Recent',
          submenu: recentSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save-file'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('save-file-as'),
        },
        { type: 'separator' },
        {
          label: 'Export...',
          accelerator: 'CmdOrCtrl+E',
          click: () => sendMenuAction('open-export'),
        },
        { type: 'separator' },
        {
          label: 'Send to DSH',
          accelerator: 'CmdOrCtrl+Shift+Enter',
          click: () => sendMenuAction('send-to-dsh'),
        },
        {
          label: 'Attach Images...',
          click: () => sendMenuAction('attach-images'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendMenuAction('undo'),
        },
        {
          label: 'Redo',
          accelerator: isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y',
          click: () => sendMenuAction('redo'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Code Editor',
          accelerator: 'CmdOrCtrl+\\',
          click: () => sendMenuAction('toggle-code-pane'),
        },
        {
          label: 'Toggle Native Mermaid Preview',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => sendMenuAction('toggle-view-mode'),
        },
        {
          label: 'Fit Canvas to View',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendMenuAction('fit-view'),
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'CmdOrCtrl+/',
          click: () => sendMenuAction('open-shortcuts'),
        },
        {
          label: 'Check for Updates...',
          click: () => sendMenuAction('check-updates'),
        },
        {
          label: 'Mermind on GitHub',
          click: () => {
            void shell.openExternal('https://github.com/DancingLi/mermind');
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  const isMac = process.platform === 'darwin';
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Mermind',
    backgroundColor: '#0f172a',
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isMac ? { x: 14, y: 12 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPaths.length > 0) {
      const queue = [...pendingOpenPaths];
      pendingOpenPaths = [];
      for (const fp of queue) {
        sendMenuAction('open-path', fp);
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers(): void {
  ipcMain.handle('mermind:open-file', async (): Promise<FilePayload | null> => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Open Mermaid File',
      properties: ['openFile'],
      filters: [
        { name: 'Mermaid Diagrams', extensions: ['mmd', 'mermaid'] },
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    const payload = readFilePayload(filePath);
    if (payload && !payload.fromMarkdown) addRecentFile(filePath);
    return payload;
  });

  ipcMain.handle('mermind:open-markdown', async (): Promise<FilePayload | null> => {
    if (!mainWindow) return null;
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Import Mermaid from Markdown',
      properties: ['openFile'],
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return readFilePayload(res.filePaths[0]);
  });

  ipcMain.handle('mermind:read-path', async (_e, filePath: string): Promise<FilePayload | null> => {
    const payload = readFilePayload(filePath);
    if (payload && !payload.fromMarkdown) addRecentFile(filePath);
    return payload;
  });

  ipcMain.handle(
    'mermind:save-file',
    async (
      _e,
      args: { filePath?: string; defaultName: string; content: string },
    ): Promise<SaveFileResult> => {
      if (args.filePath) {
        fs.writeFileSync(args.filePath, args.content, 'utf-8');
        addRecentFile(args.filePath);
        return { canceled: false, filePath: args.filePath, name: path.basename(args.filePath) };
      }
      if (!mainWindow) return { canceled: true };
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Mermaid Diagram',
        defaultPath: args.defaultName.endsWith('.mmd') || args.defaultName.endsWith('.mermaid')
          ? args.defaultName
          : `${args.defaultName}.mmd`,
        filters: [
          { name: 'Mermaid File (.mmd)', extensions: ['mmd'] },
          { name: 'Mermaid File (.mermaid)', extensions: ['mermaid'] },
        ],
      });
      if (res.canceled || !res.filePath) return { canceled: true };
      fs.writeFileSync(res.filePath, args.content, 'utf-8');
      addRecentFile(res.filePath);
      return { canceled: false, filePath: res.filePath, name: path.basename(res.filePath) };
    },
  );

  ipcMain.handle(
    'mermind:save-file-as',
    async (_e, args: { defaultName: string; content: string }): Promise<SaveFileResult> => {
      if (!mainWindow) return { canceled: true };
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Save As',
        defaultPath: args.defaultName.endsWith('.mmd') || args.defaultName.endsWith('.mermaid')
          ? args.defaultName
          : `${args.defaultName}.mmd`,
        filters: [
          { name: 'Mermaid File (.mmd)', extensions: ['mmd'] },
          { name: 'Mermaid File (.mermaid)', extensions: ['mermaid'] },
        ],
      });
      if (res.canceled || !res.filePath) return { canceled: true };
      fs.writeFileSync(res.filePath, args.content, 'utf-8');
      addRecentFile(res.filePath);
      return { canceled: false, filePath: res.filePath, name: path.basename(res.filePath) };
    },
  );

  ipcMain.handle(
    'mermind:export-file',
    async (_e, args: ExportFileRequest): Promise<SaveFileResult> => {
      if (!mainWindow) return { canceled: true };
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Diagram',
        defaultPath: args.defaultName,
        filters: args.filters,
      });
      if (res.canceled || !res.filePath) return { canceled: true };
      if (args.contentBase64 !== undefined) {
        fs.writeFileSync(res.filePath, Buffer.from(args.contentBase64, 'base64'));
      } else if (args.contentText !== undefined) {
        fs.writeFileSync(res.filePath, args.contentText, 'utf-8');
      }
      return { canceled: false, filePath: res.filePath, name: path.basename(res.filePath) };
    },
  );

  ipcMain.handle(
    'mermind:export-pdf',
    async (_e, args: { html: string; defaultName: string }): Promise<SaveFileResult> => {
      if (!mainWindow) return { canceled: true };
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Export PDF',
        defaultPath: args.defaultName.endsWith('.pdf') ? args.defaultName : `${args.defaultName}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (res.canceled || !res.filePath) return { canceled: true };

      const printWin = new BrowserWindow({
        show: false,
        width: 1400,
        height: 980,
        webPreferences: {
          offscreen: true,
        },
      });

      try {
        await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(args.html)}`);
        await new Promise((r) => setTimeout(r, 250));
        const pdfBuffer = await printWin.webContents.printToPDF({
          printBackground: true,
          landscape: true,
          pageSize: 'A4',
          margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
        });
        fs.writeFileSync(res.filePath, pdfBuffer);
        return { canceled: false, filePath: res.filePath, name: path.basename(res.filePath) };
      } finally {
        printWin.destroy();
      }
    },
  );

  ipcMain.handle('mermind:dsh-status', () => getDshStatus());
  ipcMain.handle('mermind:dsh-send', (_e, request: DshSendRequest) => sendToDsh(request));
  ipcMain.handle('mermind:dsh-pick-images', async () => {
    if (!mainWindow) return { images: [], rejected: [] };
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Attach Images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (res.canceled) return { images: [], rejected: [] };
    return readImageFiles(res.filePaths);
  });
  ipcMain.handle(
    'mermind:dsh-open-output',
    async (_e, args: { outputFile: string | null; outputDir: string | null }): Promise<boolean> => {
      const target = resolveOutputPath(args.outputFile, args.outputDir);
      if (!target) return false;
      return (await shell.openPath(target)) === '';
    },
  );

  ipcMain.handle('mermind:recent-get', () => readRecentFiles());
  ipcMain.handle('mermind:recent-add', (_e, fp: string) => addRecentFile(fp));
  ipcMain.handle('mermind:recent-clear', () => {
    writeRecentFiles([]);
    buildAppMenu();
  });

  ipcMain.on('mermind:get-version', (event) => {
    event.returnValue = app.getVersion();
  });
  ipcMain.on('mermind:win-minimize', () => mainWindow?.minimize());
  ipcMain.on('mermind:win-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('mermind:win-close', () => mainWindow?.close());
  updateController.registerIpcHandlers();
}

// Handle macOS Finder double-click file association
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && !mainWindow.isDestroyed()) {
    sendMenuAction('open-path', filePath);
  } else {
    pendingOpenPaths.push(filePath);
  }
});

// Handle Windows/Linux file path passed via argv
for (const arg of process.argv.slice(1)) {
  if ((arg.endsWith('.mmd') || arg.endsWith('.mermaid') || arg.endsWith('.md')) && fs.existsSync(arg)) {
    pendingOpenPaths.push(arg);
  }
}

app.whenReady().then(() => {
  registerIpcHandlers();
  buildAppMenu();
  createWindow();
  updateController.scheduleStartupCheck();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
