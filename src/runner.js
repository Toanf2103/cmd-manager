'use strict';

/**
 * Chế độ runner: app được mở lại bằng quyền Administrator (qua UAC) với tham số
 *   --cmdm-runner <job.json>
 * Runner chạy chuỗi lệnh, ghi log + trạng thái ra log.jsonl cùng thư mục.
 * App chính đọc file đó để hiển thị realtime; muốn dừng thì app chính tạo file "stop".
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { createEngine } = require('./engine');

function run(jobPath) {
  let job;
  try {
    job = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
  } catch {
    app.exit(2);
    return;
  }
  const dir = path.dirname(jobPath);
  const logPath = path.join(dir, 'log.jsonl');
  const stopPath = path.join(dir, 'stop');

  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    try { fs.appendFileSync(logPath, buf.join('')); } catch { /* bỏ qua */ }
    buf = [];
  };
  const write = (o) => buf.push(JSON.stringify(o) + '\n');

  let stopPoll = null;
  const flushTimer = setInterval(flush, 100);
  let ended = false;

  const done = (st) => {
    if (ended) return;
    ended = true;
    if (stopPoll) clearInterval(stopPoll);
    clearInterval(flushTimer);
    flush();
    setTimeout(() => app.exit(st === 'success' ? 0 : 1), 100);
  };

  const engine = createEngine({
    onLog: (_id, type, text) => write({ k: 'log', t: Date.now(), type, text }),
    onStatus: (s) => {
      write({ k: 'status', s });
      flush();
      if (s.status !== 'running') done(s.status);
    }
  });

  write({ k: 'log', t: Date.now(), type: 'system', text: '[Admin] Đang chạy với quyền Administrator' });

  stopPoll = setInterval(() => {
    if (fs.existsSync(stopPath)) {
      clearInterval(stopPoll);
      stopPoll = null;
      engine.stop(job.cmdId);
    }
  }, 250);

  if (fs.existsSync(stopPath)) {
    write({ k: 'log', t: Date.now(), type: 'stop', text: '■ Đã dừng trước khi chạy' });
    write({ k: 'status', s: { cmdId: job.cmdId, status: 'stopped', steps: [], codes: [], pid: null, startedAt: Date.now(), endedAt: Date.now() } });
    done('stopped');
    return;
  }

  const res = engine.start(job);
  if (!res.ok) {
    write({ k: 'log', t: Date.now(), type: 'error', text: res.error || 'Không chạy được' });
    done('failed');
  }
}

module.exports = { run };
