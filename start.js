const { spawn } = require('child_process');
const path = require('path');

console.log('================================================================');
console.log('  ExamSecure — Enterprise Online Examination Platform');
console.log('  Unified Startup Orchestrator (FastAPI + React Vite)');
console.log('================================================================\n');

const isWindows = process.platform === 'win32';
const pythonCmd = 'python';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

// 1. Launch FastAPI Backend
console.log('[STARTUP] Starting Python FastAPI Backend on port 8000...');
const backendProcess = spawn(pythonCmd, ['run.py'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit',
  shell: true
});

const fs = require('fs');

// 2. Launch Vite Frontend Dev Server
console.log('[STARTUP] Starting React Vite Frontend (Frontend) on port 5173...\n');
const frontendProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'Frontend'),
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
  console.log('\n[SHUTDOWN] Terminating ExamSecure development servers...');
  try {
    if (backendProcess && !backendProcess.killed) backendProcess.kill();
  } catch (e) {}
  try {
    if (frontendProcess && !frontendProcess.killed) frontendProcess.kill();
  } catch (e) {}
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
