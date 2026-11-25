// Runs the API server (with --watch) and the Vite dev server together. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const procs = [
  spawn('node', ['--disable-warning=ExperimentalWarning', '--watch', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: process.env.PORT || '3000' } }),
  spawn('npx', ['vite'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill('SIGTERM'); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) stop(); });
