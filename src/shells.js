'use strict';

/**
 * Quét các môi trường thực thi có trên máy:
 * cmd, Windows PowerShell, PowerShell 7+, Git Bash, MSYS2, Cygwin, các distro WSL, Windows Terminal.
 *
 * LƯU Ý: mọi lệnh con ở đây đều chạy BẤT ĐỒNG BỘ. Chạy đồng bộ (spawnSync) trên
 * main process sẽ làm treo cả cửa sổ (không bấm được gì) trong lúc chờ.
 */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const IS_WIN = process.platform === 'win32';

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}
function existsAny(p) {
  try { fs.lstatSync(p); return true; } catch { return false; }
}
function subdirs(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return []; }
}

/** Chạy 1 lệnh, có timeout, không bao giờ reject */
function exec(file, args, { timeout = 4000, buffer = false } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = execFile(
        file,
        args,
        { windowsHide: true, timeout, encoding: buffer ? 'buffer' : 'utf8', maxBuffer: 4 * 1024 * 1024 },
        (err, stdout) => resolve({ ok: !err, stdout: stdout || (buffer ? Buffer.alloc(0) : '') })
      );
      // đóng stdin để lệnh nào chờ nhập phím cũng thoát ngay
      if (child.stdin) child.stdin.end();
    } catch {
      resolve({ ok: false, stdout: buffer ? Buffer.alloc(0) : '' });
    }
  });
}

async function where(name) {
  const r = await exec('where.exe', [name]);
  if (!r.ok) return [];
  return String(r.stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

async function wslDistros(wslExe) {
  const r = await exec(wslExe, ['-l', '-q'], { timeout: 5000, buffer: true });
  if (!r.ok || !r.stdout.length) return [];
  const raw = r.stdout.includes(0) ? r.stdout.toString('utf16le') : r.stdout.toString('utf8');
  return raw
    .replace(/\0/g, '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((d) => d && !/^docker-desktop/i.test(d));
}

async function detectShells() {
  if (!IS_WIN) {
    return [{ id: 'cmd', name: 'Shell mặc định (sh)', kind: 'cmd', exe: process.env.SHELL || 'sh' }];
  }

  const sysRoot = process.env.SystemRoot || 'C:\\Windows';
  const pf = process.env.ProgramFiles || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const wslExe = path.join(sysRoot, 'System32', 'wsl.exe');

  // Các lệnh tra cứu chạy song song
  const [pwshWhere, gitWhere, wtWhere, distros] = await Promise.all([
    where('pwsh.exe'),
    where('git.exe'),
    where('wt.exe'),
    isFile(wslExe) ? wslDistros(wslExe) : Promise.resolve([])
  ]);

  const list = [];
  const seen = new Set();
  const add = (s) => {
    const key = s.id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(s);
  };

  // 1. Command Prompt
  add({ id: 'cmd', name: 'Command Prompt (cmd)', kind: 'cmd', exe: process.env.ComSpec || path.join(sysRoot, 'System32', 'cmd.exe') });

  // 2. Windows PowerShell 5.1
  const ps5 = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  if (isFile(ps5)) add({ id: 'powershell', name: 'Windows PowerShell 5.1', kind: 'powershell', exe: ps5 });

  // 3. PowerShell 7+
  const pwsh = [];
  for (const base of [path.join(pf, 'PowerShell'), path.join(pf86, 'PowerShell')]) {
    for (const ver of subdirs(base)) {
      const exe = path.join(base, ver, 'pwsh.exe');
      if (isFile(exe)) pwsh.push({ exe, ver });
    }
  }
  for (const exe of pwshWhere) {
    if (!pwsh.some((p) => p.exe.toLowerCase() === exe.toLowerCase())) {
      const ver = /WindowsApps/i.test(exe) ? 'Store' : path.basename(path.dirname(exe));
      pwsh.push({ exe, ver });
    }
  }
  pwsh.forEach(({ exe, ver }, i) => {
    const label = /^\d/.test(ver) ? `PowerShell ${ver}` : ver === 'Store' ? 'PowerShell (Microsoft Store)' : 'PowerShell 7+';
    add({ id: i === 0 ? 'pwsh' : `pwsh:${ver}`, name: label, kind: 'powershell', exe });
  });

  // 4. Git Bash
  const gitBash = [
    path.join(pf, 'Git', 'bin', 'bash.exe'),
    path.join(pf86, 'Git', 'bin', 'bash.exe'),
    local && path.join(local, 'Programs', 'Git', 'bin', 'bash.exe'),
    ...gitWhere.map((g) => path.resolve(path.dirname(g), '..', 'bin', 'bash.exe'))
  ].filter(Boolean).find(isFile);
  if (gitBash) add({ id: 'gitbash', name: 'Git Bash', kind: 'bash', exe: gitBash });

  // 5. MSYS2
  const msys = ['C:\\msys64\\usr\\bin\\bash.exe', 'C:\\msys32\\usr\\bin\\bash.exe'].find(isFile);
  if (msys) add({ id: 'msys2', name: 'MSYS2 (UCRT64)', kind: 'bash', exe: msys, msystem: 'UCRT64' });

  // 6. Cygwin
  const cyg = ['C:\\cygwin64\\bin\\bash.exe', 'C:\\cygwin\\bin\\bash.exe'].find(isFile);
  if (cyg) add({ id: 'cygwin', name: 'Cygwin', kind: 'bash', exe: cyg });

  // 7. WSL – mỗi distro một mục
  distros.forEach((d) => add({ id: `wsl:${d}`, name: `WSL · ${d}`, kind: 'wsl', exe: wslExe, distro: d }));

  // 8. Windows Terminal (cửa sổ ngoài)
  const wt = [...wtWhere, local && path.join(local, 'Microsoft', 'WindowsApps', 'wt.exe')].filter(Boolean).find(existsAny);
  if (wt) add({ id: 'wt', name: 'Windows Terminal (cửa sổ ngoài)', kind: 'wt', exe: wt, external: true });

  return list;
}

/** Danh sách cmd tối thiểu, dùng khi quét lỗi */
function fallback() {
  return [{ id: 'cmd', name: 'Command Prompt (cmd)', kind: 'cmd', exe: process.env.ComSpec || 'cmd.exe' }];
}

let shellsPromise = null;
function getShells(refresh) {
  if (!shellsPromise || refresh) {
    shellsPromise = detectShells().catch(() => fallback());
  }
  return shellsPromise;
}

let adminPromise = null;
function isAdmin() {
  if (!adminPromise) {
    if (!IS_WIN) {
      adminPromise = Promise.resolve(typeof process.getuid === 'function' && process.getuid() === 0);
    } else {
      adminPromise = exec('net', ['session'], { timeout: 5000 }).then((r) => r.ok);
    }
  }
  return adminPromise;
}

module.exports = { getShells, isAdmin };
