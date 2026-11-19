'use strict';

// Điểm vào: chế độ runner (quyền admin) hoặc app giao diện bình thường
const idx = process.argv.indexOf('--cmdm-runner');
if (idx !== -1) {
  require('./runner').run(process.argv[idx + 1]);
} else {
  require('./app-main');
}
