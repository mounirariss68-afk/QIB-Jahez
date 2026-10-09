// Connection-only launcher: give Expo Go a separate HTTPS host on port 443.
// Uses the tunnel library already shipped with the installed Expo SDK.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startGateway } from './expo-gateway.mjs';

const mobileDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'mobile');
const require = createRequire(join(mobileDir, 'node_modules', 'expo', 'package.json'));
const { startAsync, stopAsync } = require('@expo/ws-tunnel');
const session = `qib-${createHash('sha256')
  .update(process.env.REPLIT_DEV_DOMAIN || mobileDir)
  .digest('hex').slice(0, 20)}`;

let metro;
let gateway;
let closing = false;
let exitTimer;
const startupTimer = setTimeout(() => {
  console.error('Expo connection failed: the HTTPS tunnel did not open within 30 seconds.');
  void shutdown(1);
}, 30_000);

async function shutdown(code) {
  if (closing) return;
  closing = true;
  clearTimeout(startupTimer);
  exitTimer = setTimeout(() => process.exit(code), 5_000);
  metro?.kill('SIGTERM');
  await stopAsync();
  gateway?.close();
  if (!metro || metro.exitCode !== null || metro.signalCode !== null) {
    clearTimeout(exitTimer);
    process.exit(code);
  }
}

process.on('SIGTERM', () => void shutdown(0));
process.on('SIGINT', () => void shutdown(0));

try {
  gateway = await startGateway();
  const url = await startAsync({
    session,
    targetUrl: gateway.url,
    onStatusChange(status) {
      if (status === 'disconnected' && !closing) {
        console.error('Expo HTTPS tunnel disconnected. Restart QIB Mobile (Expo Go) to reconnect.');
        void shutdown(1);
      }
    },
  });
  clearTimeout(startupTimer);
  process.env.EXPO_PACKAGER_PROXY_URL = url.href;
  process.env.EXPO_PUBLIC_API_URL = url.href.replace(/\/$/, '');
  console.log(`Mobile customer API: ${process.env.EXPO_PUBLIC_API_URL}/api/mobile`);
  console.log(`Expo HTTPS manifest: ${url.href}`);
  console.log(`Secure Expo Go URL: ${url.href.replace(/^https:/, 'exps:')}`);
  console.log('Use the secure QR supplied in chat rather than Metro\'s plain exp:// QR.');
  metro = spawn(process.execPath, [
    join(mobileDir, 'node_modules', 'expo', 'bin', 'cli'),
    'start', '--go', '--port', '3000', '--clear',
  ], { cwd: mobileDir, env: process.env, stdio: 'inherit' });
  metro.on('error', (error) => {
    console.error(`Expo failed to start: ${error.message}`);
    void shutdown(1);
  });
  metro.on('exit', (code, signal) => {
    if (closing) {
      clearTimeout(exitTimer);
      process.exit(signal ? 0 : code ?? 0);
    }
    void shutdown(code ?? 1);
  });
} catch (error) {
  console.error(`Expo connection failed: ${error.message}`);
  await shutdown(1);
}
