export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

function parseSemverParts(raw: string): { core: [number, number, number]; prerelease: string } {
  const cleaned = raw.trim().replace(/^v/i, '');
  const [coreStr, ...preParts] = cleaned.split('-');
  const nums = coreStr.split('.').map((n) => {
    const parsed = Number.parseInt(n, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  });
  return {
    core: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0],
    prerelease: preParts.join('-'),
  };
}

/**
 * Compare two semver version strings (accepts optional leading "v").
 * Returns >0 if a > b, <0 if a < b, 0 if equal.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);

  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) {
      return pa.core[i] - pb.core[i];
    }
  }

  // Stable release is newer than prerelease of same core version
  if (!pa.prerelease && pb.prerelease) return 1;
  if (pa.prerelease && !pb.prerelease) return -1;
  return pa.prerelease.localeCompare(pb.prerelease);
}

export function isNewerVersion(latest: string, current: string): boolean {
  return compareSemver(latest, current) > 0;
}

/**
 * Pick the best installer asset from a GitHub Release for the current OS & CPU architecture.
 */
export function selectReleaseAsset(
  assets: GitHubReleaseAsset[],
  platform: string,
  arch: string,
  isPortable = false,
): GitHubReleaseAsset | undefined {
  if (assets.length === 0) return undefined;

  if (platform === 'darwin') {
    const archTag = arch === 'arm64' ? 'arm64' : 'x64';
    return (
      assets.find((a) => a.name.endsWith('.dmg') && a.name.toLowerCase().includes(archTag)) ??
      assets.find((a) => a.name.endsWith('.dmg'))
    );
  }

  if (platform === 'win32') {
    if (isPortable) {
      return (
        assets.find((a) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('portable')) ??
        assets.find((a) => a.name.endsWith('.exe'))
      );
    }
    return (
      assets.find((a) => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup')) ??
      assets.find((a) => a.name.endsWith('.exe'))
    );
  }

  return assets.find((a) => /\.(AppImage|deb|rpm|tar\.gz)$/i.test(a.name)) ?? assets[0];
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}
