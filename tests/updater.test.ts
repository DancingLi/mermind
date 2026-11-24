import { describe, expect, it } from 'vitest';
import { compareSemver, formatBytes, isNewerVersion, selectReleaseAsset } from '@shared/updaterUtils';

describe('updaterUtils', () => {
  it('compares semver versions accurately with optional v prefix and prereleases', () => {
    expect(compareSemver('v0.1.2', '0.1.1')).toBeGreaterThan(0);
    expect(compareSemver('0.2.0', '0.1.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('v0.1.2', '0.1.2')).toBe(0);
    expect(compareSemver('0.1.1', 'v0.1.2')).toBeLessThan(0);
    expect(compareSemver('0.1.2', '0.1.2-beta.1')).toBeGreaterThan(0);
    expect(isNewerVersion('v0.1.2', '0.1.1')).toBe(true);
    expect(isNewerVersion('v0.1.1', '0.1.1')).toBe(false);
  });

  it('selects the matching installer asset for macOS arm64, macOS x64, Windows setup, and Windows portable', () => {
    const assets = [
      { name: 'Mermind-0.1.2-mac-arm64.dmg', browser_download_url: 'https://example.com/arm64.dmg' },
      { name: 'Mermind-0.1.2-mac-x64.dmg', browser_download_url: 'https://example.com/x64.dmg' },
      { name: 'Mermind-0.1.2-win-x64-Setup.exe', browser_download_url: 'https://example.com/setup.exe' },
      { name: 'Mermind-0.1.2-win-x64-Portable.exe', browser_download_url: 'https://example.com/portable.exe' },
      { name: 'latest.yml', browser_download_url: 'https://example.com/latest.yml' },
    ];

    expect(selectReleaseAsset(assets, 'darwin', 'arm64')?.name).toBe('Mermind-0.1.2-mac-arm64.dmg');
    expect(selectReleaseAsset(assets, 'darwin', 'x64')?.name).toBe('Mermind-0.1.2-mac-x64.dmg');
    expect(selectReleaseAsset(assets, 'win32', 'x64', false)?.name).toBe('Mermind-0.1.2-win-x64-Setup.exe');
    expect(selectReleaseAsset(assets, 'win32', 'x64', true)?.name).toBe('Mermind-0.1.2-win-x64-Portable.exe');
  });

  it('formats byte counts readably', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576 * 12.5)).toBe('12.5 MB');
  });
});
