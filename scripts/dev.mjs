import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const vite = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite'], {
  cwd: rootDir,
  stdio: 'inherit',
});

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

try {
  await new Promise((resolve, reject) => {
    const build = spawn(process.execPath, [path.join(__dirname, 'build-electron.mjs')], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`build failed: ${code}`))));
  });

  await waitForServer('http://localhost:5173');

  const electronBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const electron = spawn(electronBin, ['electron', '.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: 'http://localhost:5173',
    },
  });

  electron.on('exit', () => {
    vite.kill();
    process.exit(0);
  });
} catch (err) {
  console.error(err);
  vite.kill();
  process.exit(1);
}
