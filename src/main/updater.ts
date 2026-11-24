import { app, ipcMain, shell, type BrowserWindow } from 'electron';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { autoUpdater } from 'electron-updater';
import type { UpdateMode, UpdateState } from '../shared/types';
import { isNewerVersion, selectReleaseAsset, type GitHubReleaseAsset } from '../shared/updaterUtils';

const GITHUB_OWNER = 'DancingLi';
const GITHUB_REPO = 'mermind';
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

interface GitHubReleaseResponse {
  tag_name?: string;
  name?: string;
  body?: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

function normalizeReleaseNotes(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(raw)) {
    const joined = raw
      .map((item) => (typeof item === 'string' ? item : (item as { note?: string })?.note ?? ''))
      .filter(Boolean)
      .join('\n\n')
      .trim();
    return joined || undefined;
  }
  return undefined;
}

export class AppUpdateController {
  private getWindow: () => BrowserWindow | null;
  private mode: UpdateMode;
  private state: UpdateState;
  private initializedWinUpdater = false;
  private downloading = false;

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;
    const isWinInstalled =
      process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_DIR && app.isPackaged;
    this.mode = isWinInstalled ? 'auto-win' : 'download-installer';
    this.state = {
      mode: this.mode,
      status: 'idle',
      currentVersion: app.getVersion(),
      releaseUrl: RELEASES_PAGE_URL,
    };
  }

  public getState(): UpdateState {
    return { ...this.state };
  }

  private updateState(patch: Partial<UpdateState>): UpdateState {
    this.state = {
      ...this.state,
      ...patch,
      mode: this.mode,
      currentVersion: app.getVersion(),
    };
    const win = this.getWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('mermind:update-status', this.state);
    }
    return this.getState();
  }

  public registerIpcHandlers(): void {
    if (this.mode === 'auto-win') {
      this.setupWinAutoUpdater();
    }

    ipcMain.handle('mermind:update-get-state', () => this.getState());
    ipcMain.handle('mermind:update-check', (_event, manual?: boolean) =>
      this.checkForUpdates(Boolean(manual)),
    );
    ipcMain.handle('mermind:update-download', () => this.downloadUpdate());
    ipcMain.handle('mermind:update-install', () => this.installUpdate());
    ipcMain.handle('mermind:update-open-release', async () => {
      await shell.openExternal(this.state.releaseUrl || RELEASES_PAGE_URL);
    });
  }

  public scheduleStartupCheck(): void {
    if (!app.isPackaged) return;
    setTimeout(() => {
      void this.checkForUpdates(false);
    }, 4500);
  }

  private setupWinAutoUpdater(): void {
    if (this.initializedWinUpdater) return;
    this.initializedWinUpdater = true;

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.disableWebInstaller = true;

    autoUpdater.on('checking-for-update', () => {
      this.updateState({ status: 'checking', errorMessage: undefined });
    });

    autoUpdater.on('update-available', (info) => {
      const latestVersion = info.version.replace(/^v/i, '');
      this.updateState({
        status: 'available',
        latestVersion,
        releaseName: info.releaseName ?? `Mermind v${latestVersion}`,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes),
        releaseUrl: `${RELEASES_PAGE_URL}/tag/v${latestVersion}`,
        percent: 0,
        errorMessage: undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this.updateState({
        status: 'up-to-date',
        latestVersion: app.getVersion(),
        errorMessage: undefined,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this.updateState({
        status: 'downloading',
        percent: Math.round(progress.percent),
        transferredBytes: progress.transferred,
        totalBytes: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      const latestVersion = info.version.replace(/^v/i, '');
      this.updateState({
        status: 'downloaded',
        latestVersion,
        releaseName: info.releaseName ?? `Mermind v${latestVersion}`,
        releaseNotes: normalizeReleaseNotes(info.releaseNotes) ?? this.state.releaseNotes,
        releaseUrl: `${RELEASES_PAGE_URL}/tag/v${latestVersion}`,
        percent: 100,
        errorMessage: undefined,
      });
    });

    autoUpdater.on('error', (err) => {
      this.updateState({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
  }

  public async checkForUpdates(manual = false): Promise<UpdateState> {
    if (
      this.state.status === 'downloading' ||
      (this.state.status === 'downloaded' && this.mode === 'auto-win')
    ) {
      return this.updateState({ manual });
    }

    this.updateState({
      status: 'checking',
      manual,
      errorMessage: undefined,
    });

    if (this.mode === 'auto-win') {
      try {
        await autoUpdater.checkForUpdates();
        return this.getState();
      } catch (err) {
        return this.updateState({
          status: 'error',
          manual,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // macOS / Windows Portable / Linux: check GitHub Latest Release API
    try {
      const res = await fetch(LATEST_RELEASE_API, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Mermind/${app.getVersion()}`,
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`GitHub API HTTP ${res.status}`);
      }

      const data = (await res.json()) as GitHubReleaseResponse;
      const rawTag = data.tag_name ?? '';
      const latestVersion = rawTag.replace(/^v/i, '');
      const currentVersion = app.getVersion();

      if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) {
        return this.updateState({
          status: 'up-to-date',
          latestVersion: latestVersion || currentVersion,
          releaseUrl: data.html_url || RELEASES_PAGE_URL,
          manual,
        });
      }

      const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
      const matched = selectReleaseAsset(
        data.assets ?? [],
        process.platform,
        process.arch,
        isPortable,
      );

      return this.updateState({
        status: 'available',
        latestVersion,
        releaseName: data.name || `Mermind v${latestVersion}`,
        releaseNotes: normalizeReleaseNotes(data.body),
        releaseUrl: data.html_url || `${RELEASES_PAGE_URL}/tag/v${latestVersion}`,
        assetName: matched?.name,
        assetUrl: matched?.browser_download_url,
        totalBytes: matched?.size,
        downloadedPath: undefined,
        percent: 0,
        manual,
      });
    } catch (err) {
      return this.updateState({
        status: 'error',
        manual,
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  public async downloadUpdate(): Promise<void> {
    if (this.mode === 'auto-win') {
      if (this.state.status === 'available') {
        await autoUpdater.downloadUpdate();
      }
      return;
    }

    if (this.downloading) return;
    const { assetUrl, assetName } = this.state;
    if (!assetUrl || !assetName) {
      await shell.openExternal(this.state.releaseUrl || RELEASES_PAGE_URL);
      return;
    }

    this.downloading = true;
    const downloadsDir = app.getPath('downloads');
    const finalPath = path.join(downloadsDir, assetName);
    const partPath = `${finalPath}.part`;

    try {
      this.updateState({
        status: 'downloading',
        percent: 0,
        transferredBytes: 0,
        errorMessage: undefined,
      });

      const res = await fetch(assetUrl, {
        headers: { 'User-Agent': `Mermind/${app.getVersion()}` },
        redirect: 'follow',
      });

      if (!res.ok || !res.body) {
        throw new Error(`Download failed (HTTP ${res.status})`);
      }

      const headerLen = Number(res.headers.get('content-length') || 0);
      const totalBytes = headerLen > 0 ? headerLen : this.state.totalBytes ?? 0;

      const fileStream = createWriteStream(partPath);
      const nodeStream = Readable.fromWeb(res.body as unknown as import('node:stream/web').ReadableStream);

      let transferred = 0;
      let lastEmit = 0;

      await new Promise<void>((resolve, reject) => {
        nodeStream.on('data', (chunk: Buffer) => {
          transferred += chunk.length;
          const now = Date.now();
          if (now - lastEmit >= 120) {
            lastEmit = now;
            const percent = totalBytes > 0 ? Math.min(99, Math.round((transferred / totalBytes) * 100)) : 0;
            this.updateState({
              status: 'downloading',
              percent,
              transferredBytes: transferred,
              totalBytes: totalBytes || undefined,
            });
          }
        });
        nodeStream.on('error', reject);
        fileStream.on('error', reject);
        fileStream.on('finish', resolve);
        nodeStream.pipe(fileStream);
      });

      await fs.rm(finalPath, { force: true }).catch(() => undefined);
      await fs.rename(partPath, finalPath);

      this.updateState({
        status: 'downloaded',
        downloadedPath: finalPath,
        percent: 100,
        transferredBytes: transferred,
        totalBytes: totalBytes || transferred,
        errorMessage: undefined,
      });

      // Automatically open the downloaded DMG (mounts installer on macOS) or EXE
      const openErr = await shell.openPath(finalPath);
      if (openErr) {
        shell.showItemInFolder(finalPath);
      }
    } catch (err) {
      await fs.rm(partPath, { force: true }).catch(() => undefined);
      this.updateState({
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.downloading = false;
    }
  }

  public async installUpdate(): Promise<void> {
    if (this.mode === 'auto-win') {
      autoUpdater.quitAndInstall(false, true);
      return;
    }

    if (this.state.downloadedPath) {
      const openErr = await shell.openPath(this.state.downloadedPath);
      if (openErr) {
        shell.showItemInFolder(this.state.downloadedPath);
      }
    } else {
      await shell.openExternal(this.state.releaseUrl || RELEASES_PAGE_URL);
    }
  }
}
