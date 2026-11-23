'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const { StringDecoder } = require('string_decoder');
const { createEngine, psEncode, IS_WIN } = require('./engine');
const { getShells, isAdmin } = require('./shells');

/** @type {BrowserWindow | null} */
let win = null;
let tray = null;
let quitting = false;

const TEMP_ROOT = path.join(os.tmpdir(), 'cmd-manager');

// ---------------------------------------------------------------------------
// Gửi về renderer (log gom theo lô)
// ---------------------------------------------------------------------------
const pendingLogs = new Map();
let flushTimer = null;

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}
function pushLog(cmdId, type, text, t) {
  let arr = pendingLogs.get(cmdId);
  if (!arr) pendingLogs.set(cmdId, (arr = []));
  arr.push({ t: t || Date.now(), type, text });
  if (!flushTimer) flushTimer = setTimeout(flushLogs, 40);
}
function flushLogs() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  for (const [cmdId, lines] of pendingLogs) send('run:log', { cmdId, lines });
  pendingLogs.clear();
}
function sendStatus(snap) {
  flushLogs();
  send('run:status', snap);
  updateTray();
}
function simpleStatus(cmdId, status, extra = {}) {
  const now = Date.now();
  sendStatus({ cmdId, status, steps: [], codes: [], pid: null, startedAt: now, endedAt: status === 'running' ? null : now, ...extra });
}

// Chạy trực tiếp (không cần quyền admin, hoặc app đã chạy bằng admin)
const engine = createEngine({ onLog: pushLog, onStatus: sendStatus });

// ---------------------------------------------------------------------------
// Chạy với quyền Administrator: mở lại chính app ở chế độ runner qua UAC
// ---------------------------------------------------------------------------
/** @type {Map<string, {stop: () => void, kill: () => void}>} */
const elevated = new Map();

function psPath() {
  const p = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return fs.existsSync(p) ? p : 'powershell.exe';
}
const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

function newTempDir() {
  const dir = path.join(TEMP_ROOT, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function startElevated(job) {
  const { cmdId } = job;
  const dir = newTempDir();
  const jobPath = path.join(dir, 'job.json');
  const logPath = path.join(dir, 'log.jsonl');
  const stopPath = path.join(dir, 'stop');
  fs.writeFileSync(jobPath, JSON.stringify(job));
  fs.writeFileSync(logPath, '');

  const steps = job.steps.map(() => 'pending');
  pushLog(cmdId, 'system', 'Đang yêu cầu quyền Administrator (UAC)…');
  sendStatus({ cmdId, status: 'running', steps, codes: [], pid: null, startedAt: Date.now(), endedAt: null });

  const runnerArgs = app.isPackaged ? ['--cmdm-runner', jobPath] : [app.getAppPath(), '--cmdm-runner', jobPath];
  const argStr = runnerArgs.map((a) => `"${a}"`).join(' ');
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `try { $p = Start-Process -FilePath ${psQuote(process.execPath)} -ArgumentList ${psQuote(argStr)} -Verb RunAs -WindowStyle Hidden -PassThru } catch { exit 1223 }`,
    '$p.WaitForExit()',
    'exit $p.ExitCode'
  ].join('\n');

  const helper = spawn(psPath(), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', psEncode(script)], {
    windowsHide: true,
    stdio: 'ignore'
  });

  // Đọc log.jsonl do runner ghi ra
  let offset = 0;
  let partial = '';
  let finalSeen = false;
  const decoder = new StringDecoder('utf8');
  const read = () => {
    let size;
    try { size = fs.statSync(logPath).size; } catch { return; }
    if (size <= offset) return;
    const buf = Buffer.alloc(size - offset);
    const fd = fs.openSync(logPath, 'r');
    try { fs.readSync(fd, buf, 0, buf.length, offset); } finally { fs.closeSync(fd); }
    offset = size;
    partial += decoder.write(buf);
    const lines = partial.split('\n');
    partial = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      let m;
      try { m = JSON.parse(line); } catch { continue; }
      if (m.k === 'log') pushLog(cmdId, m.type, m.text, m.t);
      else if (m.k === 'status') {
        if (m.s.status !== 'running') finalSeen = true;
        sendStatus({ ...m.s, cmdId });
      }
    }
  };
  const timer = setInterval(read, 150);

  const end = (code) => {
    read();
    clearInterval(timer);
    elevated.delete(cmdId);
    if (!finalSeen) {
      if (code === 1223) {
        pushLog(cmdId, 'error', 'Đã huỷ yêu cầu quyền Administrator (UAC).');
        simpleStatus(cmdId, 'failed', { steps });
      } else {
        pushLog(cmdId, 'error', `Tiến trình Administrator kết thúc bất thường (exit ${code}).`);
        simpleStatus(cmdId, 'failed', { steps });
      }
    }
    setTimeout(() => fs.rm(dir, { recursive: true, force: true }, () => {}), 2000);
  };
  helper.on('close', (code) => end(code == null ? -1 : code));
  helper.on('error', (e) => {
    pushLog(cmdId, 'error', `Không mở được PowerShell để xin quyền: ${e.message}`);
    end(-1);
  });

  const stop = () => {
    try { fs.writeFileSync(stopPath, '1'); } catch { /* bỏ qua */ }
    pushLog(cmdId, 'system', 'Đã gửi yêu cầu dừng tới tiến trình Administrator…');
  };
  elevated.set(cmdId, { stop, kill: stop });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Windows Terminal: mở cửa sổ ngoài, chạy script .cmd (không có log trong app)
// ---------------------------------------------------------------------------
const echoEsc = (s) => s.replace(/([\^&|<>()%])/g, '^$1');

function openInWindowsTerminal(job, wt, asAdmin, appIsAdmin) {
  const { cmdId, cwd, name } = job;
  const steps = job.steps;
  try {
    if (!fs.statSync(cwd).isDirectory()) throw new Error();
  } catch {
    pushLog(cmdId, 'error', `Thư mục không tồn tại: ${cwd}`);
    simpleStatus(cmdId, 'failed');
    return { ok: true };
  }

  const dir = newTempDir();
  const script = path.join(dir, 'run.cmd');
  const lines = ['@echo off', 'chcp 65001>nul', `cd /d "${cwd}"`];
  steps.forEach((s, i) => {
    lines.push('echo.', `echo ^> [${i + 1}/${steps.length}] ${echoEsc(s)}`, `call ${s}`);
    if (job.stopOnError !== false) {
      lines.push(`if errorlevel 1 (echo. & echo [CMD Manager] Buoc ${i + 1} loi - dung chuoi lenh. & goto :eof)`);
    }
  });
  lines.push('echo.', 'echo [CMD Manager] Hoan tat.');
  fs.writeFileSync(script, lines.join('\r\n') + '\r\n');

  const title = String(name || 'CMD Manager').replace(/[;"]/g, ' ');
  const args = ['-d', cwd, '--title', title, 'cmd', '/k', script];

  try {
    if (asAdmin && !appIsAdmin) {
      const argStr = args.map((a) => `"${a}"`).join(' ');
      const ps = `try { Start-Process -FilePath ${psQuote(wt.exe)} -ArgumentList ${psQuote(argStr)} -Verb RunAs } catch { exit 1223 }`;
      const p = spawn(psPath(), ['-NoProfile', '-NonInteractive', '-EncodedCommand', psEncode(ps)], { windowsHide: true, stdio: 'ignore' });
      p.on('close', (code) => {
        if (code === 1223) {
          pushLog(cmdId, 'error', 'Đã huỷ yêu cầu quyền Administrator (UAC).');
          simpleStatus(cmdId, 'failed');
        } else {
          pushLog(cmdId, 'ok', 'Đã mở trong Windows Terminal (Administrator). Log hiển thị trong cửa sổ đó.');
          simpleStatus(cmdId, 'opened');
        }
      });
      pushLog(cmdId, 'system', 'Đang yêu cầu quyền Administrator (UAC)…');
      simpleStatus(cmdId, 'running');
    } else {
      spawn(wt.exe, args, { detached: true, stdio: 'ignore' }).unref();
      pushLog(cmdId, 'system', `wt -d "${cwd}" cmd /k run.cmd`);
      pushLog(cmdId, 'ok', 'Đã mở trong Windows Terminal. Log hiển thị trong cửa sổ đó.');
      simpleStatus(cmdId, 'opened');
    }
  } catch (e) {
    pushLog(cmdId, 'error', `Không mở được Windows Terminal: ${e.message}`);
    simpleStatus(cmdId, 'failed');
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
const starting = new Set();

ipcMain.handle('window:hide', () => {
  if (win && !win.isDestroyed()) win.hide();
});

ipcMain.handle('run:start', async (_e, p) => {
  p = p || {};
  const { cmdId } = p;
  if (engine.isRunning(cmdId) || elevated.has(cmdId) || starting.has(cmdId)) return { ok: false, error: 'Lệnh này đang chạy' };
  starting.add(cmdId);
  try {
    return await startCommand(p);
  } finally {
    starting.delete(cmdId);
  }
});

async function startCommand(p) {
  const { cmdId } = p;
  const shells = await getShells();
  const sh = shells.find((s) => s.id === (p.shellId || 'cmd'));
  if (!sh) {
    pushLog(cmdId, 'error', `Không tìm thấy môi trường "${p.shellId}" trên máy này. Hãy sửa lệnh và chọn môi trường khác.`);
    simpleStatus(cmdId, 'failed');
    return { ok: true };
  }

  const job = {
    cmdId,
    name: p.name,
    cwd: p.cwd,
    steps: (p.steps || []).map((s) => String(s).trim()).filter(Boolean),
    stopOnError: p.stopOnError !== false,
    shell: sh
  };

  const appIsAdmin = await isAdmin();
  if (sh.kind === 'wt') return openInWindowsTerminal(job, sh, !!p.admin, appIsAdmin);
  if (p.admin && IS_WIN && !appIsAdmin) return startElevated(job);
  return engine.start(job);
}

ipcMain.handle('run:stop', (_e, cmdId) => {
  const el = elevated.get(cmdId);
  if (el) {
    el.stop();
    return { ok: true };
  }
  return engine.stop(cmdId);
});

ipcMain.handle('env:shells', (_e, refresh) => getShells(!!refresh));
ipcMain.handle('env:isAdmin', () => isAdmin());

ipcMain.handle('dialog:pickFolder', async (_e, defaultPath) => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Chọn thư mục mở cmd',
    properties: ['openDirectory'],
    defaultPath: defaultPath || undefined
  });
  return res.canceled || !res.filePaths.length ? null : res.filePaths[0];
});

ipcMain.handle('fs:dirExists', (_e, p) => {
  try { return !!p && fs.statSync(p).isDirectory(); } catch { return false; }
});

ipcMain.handle('clipboard:write', (_e, text) => {
  clipboard.writeText(String(text ?? ''));
  return true;
});

ipcMain.handle('shell:openFolder', async (_e, p) => {
  const err = await shell.openPath(p || os.homedir());
  return !err;
});

// Mở một cửa sổ cmd thật tại thư mục (detached → có console riêng)
ipcMain.handle('shell:openTerminal', (_e, p) => {
  let dir = os.homedir();
  try { if (p && fs.statSync(p).isDirectory()) dir = p; } catch { /* dùng home */ }
  try {
    const child = IS_WIN
      ? spawn('cmd.exe', [], { cwd: dir, detached: true, stdio: 'ignore' })
      : spawn(process.env.SHELL || 'sh', [], { cwd: dir, detached: true, stdio: 'ignore' });
    child.unref();
    return true;
  } catch {
    return false;
  }
});

// Sao lưu: xuất / nhập file JSON
ipcMain.handle('data:export', async (_e, json, suggestedName) => {
  const res = await dialog.showSaveDialog(win, {
    title: 'Xuất dữ liệu CMD Manager',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'cmd-manager-backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    await fs.promises.writeFile(res.filePath, String(json), 'utf8');
    return { ok: true, path: res.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('data:import', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Nhập dữ liệu CMD Manager',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }, { name: 'Tất cả', extensions: ['*'] }]
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
  try {
    const text = await fs.promises.readFile(res.filePaths[0], 'utf8');
    return { ok: true, path: res.filePaths[0], text: text.replace(/^\uFEFF/, '') };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// ---------------------------------------------------------------------------
// Cửa sổ & vòng đời
// ---------------------------------------------------------------------------
function runningCount() {
  return engine.runningCount() + elevated.size;
}
function killAll() {
  engine.killAll();
  for (const el of elevated.values()) el.kill();
}

function showWindow() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

const TRAY_IDLE = path.join(__dirname, 'assets', 'tray.png');
const TRAY_RUNNING = path.join(__dirname, 'assets', 'tray-running.png');
let trayRunning = null;

// Đổi icon khay khi có / hết lệnh đang chạy
function updateTray() {
  if (!tray) return;
  let n = 0;
  try { n = runningCount(); } catch { return; }
  const running = n > 0;
  tray.setToolTip(running ? `CMD Manager · ${n} lệnh đang chạy` : 'CMD Manager');
  if (running === trayRunning) return;
  trayRunning = running;
  tray.setImage(running ? TRAY_RUNNING : TRAY_IDLE);
}

function createTray() {
  tray = new Tray(TRAY_IDLE);
  tray.setToolTip('CMD Manager');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Mở CMD Manager', click: showWindow },
    { type: 'separator' },
    { label: 'Thoát', click: () => app.quit() }
  ]));
  tray.on('click', showWindow);
}

function cleanOldTemp() {
  fs.readdir(TEMP_ROOT, (err, names) => {
    if (err) return;
    const limit = Date.now() - 24 * 3600 * 1000;
    for (const n of names) {
      const ts = parseInt(n, 10);
      if (ts && ts < limit) fs.rm(path.join(TEMP_ROOT, n), { recursive: true, force: true }, () => {});
    }
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 560,
    backgroundColor: '#0F1115',
    title: 'CMD Manager',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    // Gộp thanh tiêu đề Windows vào topbar (nút cửa sổ vẽ bằng overlay gốc)
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#13161C', symbolColor: '#C9D1D9', height: 44 },
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    createWindow();
    createTray();
    cleanOldTemp();
    // quét sẵn ở nền, không chặn giao diện
    getShells();
    isAdmin();
  });
  app.on('before-quit', () => {
    quitting = true;
    killAll();
  });
  app.on('will-quit', () => {
    if (tray) tray.destroy();
    tray = null;
  });
  app.on('window-all-closed', () => {
    killAll();
    app.quit();
  });
}
