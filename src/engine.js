'use strict';

/**
 * Bộ máy chạy chuỗi lệnh. Dùng chung cho:
 *  - app chính (log gửi về giao diện qua IPC)
 *  - runner chạy quyền Administrator (log ghi ra file để app chính đọc)
 */

const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const { StringDecoder } = require('string_decoder');

const IS_WIN = process.platform === 'win32';

function fmtDur(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`;
}

const psEncode = (script) => Buffer.from(script, 'utf16le').toString('base64');

/** Đọc stream theo từng dòng, xử lý \r của thanh tiến trình */
function lineReader(onLine) {
  const decoder = new StringDecoder('utf8');
  let buf = '';
  const emit = (line) => {
    if (line.includes('\r')) {
      const segs = line.split('\r').filter((s) => s.length);
      line = segs.length ? segs[segs.length - 1] : '';
    }
    onLine(line);
  };
  return {
    write(chunk) {
      buf += decoder.write(chunk);
      const parts = buf.split('\n');
      buf = parts.pop();
      parts.forEach(emit);
    },
    end() {
      buf += decoder.end();
      if (buf.length) emit(buf);
      buf = '';
    }
  };
}

/** Cách gọi 1 lệnh theo từng môi trường thực thi */
function buildSpawn(shell, cmd, cwd) {
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' };
  if (!IS_WIN) return { file: cmd, args: [], opts: { shell: true, env } };

  switch (shell.kind) {
    case 'powershell': {
      const script = [
        "$ErrorActionPreference = 'Continue'",
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        '$OutputEncoding = [System.Text.Encoding]::UTF8',
        '$global:LASTEXITCODE = 0',
        cmd,
        'if (-not $?) { if ($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 } }',
        'exit $LASTEXITCODE'
      ].join('\n');
      return {
        file: shell.exe,
        args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', psEncode(script)],
        opts: { env }
      };
    }
    case 'bash':
      return {
        file: shell.exe,
        args: ['-lc', cmd],
        opts: { env: { ...env, CHERE_INVOKING: '1', ...(shell.msystem ? { MSYSTEM: shell.msystem } : {}) } }
      };
    case 'wsl':
      return {
        file: shell.exe,
        args: ['-d', shell.distro, '--cd', cwd, '--', 'bash', '-lc', cmd],
        opts: { env: { ...env, WSL_UTF8: '1' } }
      };
    default: // cmd
      return {
        file: shell.exe || process.env.ComSpec || 'cmd.exe',
        args: ['/d', '/s', '/c', `"chcp 65001>nul & ${cmd}"`],
        opts: { env, windowsVerbatimArguments: true }
      };
  }
}

function cdLine(shell, cwd) {
  switch (shell.kind) {
    case 'powershell': return `Set-Location '${cwd}'`;
    case 'bash': return `cd "${cwd}"`;
    case 'wsl': return `wsl -d ${shell.distro} --cd "${cwd}"`;
    default: return `cd /d ${cwd}`;
  }
}

function killTree(pid, sync) {
  if (!pid) return;
  try {
    if (IS_WIN) {
      const args = ['/PID', String(pid), '/T', '/F'];
      if (sync) spawnSync('taskkill', args, { windowsHide: true });
      else spawn('taskkill', args, { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch { /* đã kết thúc */ }
}

/**
 * @param {{ onLog: (cmdId:string, type:string, text:string) => void, onStatus: (snap:object) => void }} sink
 */
function createEngine(sink) {
  const runs = new Map();

  const log = (run, type, text) => sink.onLog(run.cmdId, type, text);
  const status = (run) => sink.onStatus({
    cmdId: run.cmdId,
    status: run.status,
    steps: run.stepStatus.slice(),
    codes: run.stepCodes.slice(),
    pid: run.child ? run.child.pid : null,
    startedAt: run.startedAt,
    endedAt: run.endedAt
  });

  function start(job) {
    const { cmdId, cwd, shell } = job;
    const existing = runs.get(cmdId);
    if (existing && existing.status === 'running') return { ok: false, error: 'Lệnh này đang chạy' };

    const steps = (job.steps || []).map((s) => String(s).trim()).filter(Boolean);
    const run = {
      cmdId,
      cwd,
      shell,
      steps,
      stopOnError: job.stopOnError !== false,
      idx: -1,
      stepStatus: steps.map(() => 'pending'),
      stepCodes: steps.map(() => null),
      status: 'running',
      child: null,
      stopped: false,
      anyFailed: false,
      startedAt: Date.now(),
      endedAt: null
    };
    runs.set(cmdId, run);

    if (!steps.length) {
      log(run, 'error', 'Không có lệnh nào để chạy.');
      finish(run, 'failed');
      return { ok: true };
    }
    let dirOk = false;
    try { dirOk = fs.statSync(cwd).isDirectory(); } catch { dirOk = false; }
    if (!dirOk) {
      log(run, 'error', `Thư mục không tồn tại: ${cwd}`);
      finish(run, 'failed');
      return { ok: true };
    }

    log(run, 'system', cdLine(shell, cwd));
    status(run);
    nextStep(run);
    return { ok: true };
  }

  function nextStep(run) {
    if (run.stopped) return;
    run.idx += 1;
    if (run.idx >= run.steps.length) {
      finish(run, run.anyFailed ? 'failed' : 'success');
      return;
    }

    const i = run.idx;
    const cmd = run.steps[i];
    run.stepStatus[i] = 'running';
    log(run, 'step', `▶ [${i + 1}/${run.steps.length}] ${cmd}`);

    const t0 = Date.now();
    const sp = buildSpawn(run.shell, cmd, run.cwd);
    let child;
    try {
      child = spawn(sp.file, sp.args, {
        ...sp.opts,
        cwd: run.cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (e) {
      log(run, 'error', `Không chạy được lệnh: ${e.message}`);
      stepEnd(run, i, -1, t0);
      return;
    }

    run.child = child;
    status(run);

    const out = lineReader((l) => log(run, 'stdout', l));
    const err = lineReader((l) => log(run, 'stderr', l));
    child.stdout.on('data', (d) => out.write(d));
    child.stderr.on('data', (d) => err.write(d));

    let done = false;
    child.on('error', (e) => {
      if (done) return;
      done = true;
      out.end();
      err.end();
      log(run, 'error', `Không chạy được lệnh: ${e.message}`);
      stepEnd(run, i, -1, t0);
    });
    child.on('close', (code) => {
      if (done) return;
      done = true;
      out.end();
      err.end();
      stepEnd(run, i, code == null ? -1 : code, t0);
    });
  }

  function stepEnd(run, i, code, t0) {
    run.child = null;
    run.stepCodes[i] = code;
    const secs = ((Date.now() - t0) / 1000).toFixed(1) + 's';

    if (run.stopped) {
      run.stepStatus[i] = 'stopped';
      log(run, 'stop', '■ Đã dừng bởi người dùng');
      finish(run, 'stopped');
      return;
    }
    if (code === 0) {
      run.stepStatus[i] = 'done';
      log(run, 'ok', `✔ Bước ${i + 1} xong · exit 0 · ${secs}`);
    } else {
      run.stepStatus[i] = 'failed';
      run.anyFailed = true;
      log(run, 'error', `✖ Bước ${i + 1} lỗi · exit ${code} · ${secs}`);
      if (run.stopOnError) {
        log(run, 'error', 'Dừng chuỗi lệnh do có lỗi.');
        finish(run, 'failed');
        return;
      }
    }
    status(run);
    nextStep(run);
  }

  function finish(run, st) {
    run.status = st;
    run.endedAt = Date.now();
    run.child = null;
    if (st === 'success') {
      log(run, 'ok', `✔ Hoàn tất ${run.steps.length}/${run.steps.length} lệnh · ${fmtDur(run.endedAt - run.startedAt)}`);
    }
    status(run);
  }

  function stop(cmdId) {
    const run = runs.get(cmdId);
    if (!run || run.status !== 'running') return { ok: false };
    run.stopped = true;
    const pid = run.child && run.child.pid;
    if (pid) {
      log(run, 'system', `taskkill /PID ${pid} /T /F`);
      killTree(pid, false);
    } else {
      log(run, 'stop', '■ Đã dừng bởi người dùng');
      finish(run, 'stopped');
    }
    return { ok: true };
  }

  function runningCount() {
    let n = 0;
    for (const r of runs.values()) if (r.status === 'running') n++;
    return n;
  }

  function killAll() {
    for (const r of runs.values()) {
      if (r.status === 'running') {
        r.stopped = true;
        if (r.child) killTree(r.child.pid, true);
      }
    }
  }

  return { start, stop, runningCount, killAll, isRunning: (id) => runs.get(id)?.status === 'running' };
}

module.exports = { createEngine, killTree, fmtDur, psEncode, IS_WIN };
