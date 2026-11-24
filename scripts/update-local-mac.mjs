import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') {
  console.error('update:local is only intended for macOS.');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const unpackedApp = path.join(
  rootDir,
  'release',
  arch === 'arm64' ? 'mac-arm64' : 'mac',
  'Mermind.app',
);
const targetApp = '/Applications/Mermind.app';

console.log(`Building Mermind (${arch})...`);
execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
execSync(`CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir --${arch} --publish never`, {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});

if (!fs.existsSync(unpackedApp)) {
  console.error(`Built app not found at ${unpackedApp}`);
  process.exit(1);
}

console.log(`Updating ${targetApp}...`);
try {
  execSync('osascript -e \'tell application "Mermind" to quit\'', { stdio: 'ignore' });
} catch {
  // App may not be running
}

fs.rmSync(targetApp, { recursive: true, force: true });
execSync(`cp -R "${unpackedApp}" "${targetApp}"`, { stdio: 'inherit' });
console.log('Launching updated Mermind...');
execSync(`open "${targetApp}"`);
