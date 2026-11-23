// Bọc trong IIFE: contextBridge đã tạo biến toàn cục `api`, khai báo trùng tên ở phạm vi global sẽ gây SyntaxError
(() => {
'use strict';

// Lỗi nào cũng hiện lên màn hình thay vì im lặng
function showFatal(msg) {
  const box = document.getElementById('toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast error';
  el.textContent = 'Lỗi: ' + msg;
  box.append(el);
  setTimeout(() => el.remove(), 8000);
}
window.addEventListener('error', (e) => showFatal(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => showFatal((e.reason && e.reason.message) || String(e.reason)));

if (!window.api) showFatal('Không tải được preload (window.api). Hãy chạy lại bằng "npm start".');
const api = window.api;
const $ = (sel, root = document) => root.querySelector(sel);

// ===========================================================================
// Hằng số
// ===========================================================================
const LS = { cats: 'cmdm.categories', cmds: 'cmdm.commands', ui: 'cmdm.ui' };
const MAX_LOG = 5000;
const UNCAT = 'uncat';
const PALETTE = ['#58A6FF', '#BC8CFF', '#E3B341', '#3FB950', '#F0883E', '#F778BA', '#39C5CF', '#6E7681'];

const STATUS = {
  idle: { label: 'Chờ', color: '#9AA3B2' },
  running: { label: 'Đang chạy', color: '#58A6FF' },
  success: { label: 'Hoàn tất', color: '#3FB950' },
  failed: { label: 'Lỗi', color: '#F85149' },
  stopped: { label: 'Đã dừng', color: '#D29922' },
  opened: { label: 'Đã mở ngoài', color: '#39C5CF' }
};
const STEP = {
  pending: { icon: null, color: '#8B949E', bg: '#1E232C', label: () => 'Chờ' },
  running: { icon: '●', color: '#58A6FF', bg: 'rgba(88,166,255,.15)', label: () => 'Đang chạy…' },
  done: { icon: '✓', color: '#3FB950', bg: 'rgba(63,185,80,.15)', label: () => 'Xong · exit 0' },
  failed: { icon: '✕', color: '#F85149', bg: 'rgba(248,81,73,.15)', label: (c) => `Lỗi · exit ${c ?? '?'}` },
  stopped: { icon: '■', color: '#D29922', bg: 'rgba(210,153,34,.15)', label: () => 'Đã dừng' }
};

const STROKE = {
  terminal: '<path d="M4 17l6-5-6-5"/><path d="M12 19h8"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  console: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10l3 2-3 2"/><path d="M12 15h5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2"/><path d="M3 12A9 9 0 0 1 18.5 5.8"/><path d="M18 2v4h-4"/><path d="M6 22v-4h4"/>',
  download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 20V9"/><path d="M7 14l5-5 5 5"/><path d="M5 4h14"/>',
  chevrons: '<path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/>'
};
const FILLED = {
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>'
};

// ===========================================================================
// Tiện ích
// ===========================================================================
function icon(name, size = 16) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  const filled = FILLED[name];
  const attrs = filled
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" ${attrs}>${filled || STROKE[name] || ''}</svg>`;
  return span;
}

/** Tạo phần tử DOM: h('div', {class, style:{}, onClick}, ...children) */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const pad = (n) => String(n).padStart(2, '0');
function fmtTime(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function fmtDur(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return hh ? `${hh}:${pad(mm)}:${pad(s % 60)}` : `${pad(mm)}:${pad(s % 60)}`;
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function load(key, def) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? def;
  } catch {
    return def;
  }
}

function toast(msg, type = 'info') {
  const el = h('div', { class: `toast ${type}` }, msg);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

// ===========================================================================
// Dữ liệu
// ===========================================================================
let categories = load(LS.cats, []);
let commands = load(LS.cmds, []);
const ui = Object.assign({ selectedId: null, collapsed: {}, autoScroll: true, filter: 'all' }, load(LS.ui, {}));
const runtime = {};
let search = '';
/** Môi trường thực thi quét được trên máy */
let shells = [];
let appIsAdmin = false;

const shellOf = (c) => shells.find((s) => s.id === (c.shell || 'cmd'));
const shellLabel = (c) => {
  const s = shellOf(c);
  return s ? s.name.replace(' (cửa sổ ngoài)', '') : `${c.shell} (không có trên máy)`;
};

if (!Array.isArray(categories)) categories = [];
if (!Array.isArray(commands)) commands = [];
if (!categories.some((c) => c.id === UNCAT)) {
  categories.push({ id: UNCAT, name: 'Chưa phân loại', color: '#6E7681', locked: true });
}

function save() {
  localStorage.setItem(LS.cats, JSON.stringify(categories));
  localStorage.setItem(LS.cmds, JSON.stringify(commands));
}
function saveUi() {
  localStorage.setItem(LS.ui, JSON.stringify(ui));
}

const byId = (id) => commands.find((c) => c.id === id);
const selected = () => byId(ui.selectedId);
const catOf = (c) => categories.find((x) => x.id === c.categoryId) || categories.find((x) => x.id === UNCAT);

function rt(id) {
  if (!runtime[id]) {
    runtime[id] = { status: 'idle', steps: [], codes: [], log: [], startedAt: null, endedAt: null, pid: null, resetAfterStop: false };
  }
  return runtime[id];
}
function resetRt(r) {
  Object.assign(r, { status: 'idle', steps: [], codes: [], log: [], startedAt: null, endedAt: null, pid: null, resetAfterStop: false });
}

function elapsedText(r) {
  const now = Date.now();
  switch (r.status) {
    case 'running': return `đã chạy ${fmtDur(now - r.startedAt)}`;
    case 'success': return `xong sau ${fmtDur(r.endedAt - r.startedAt)}`;
    case 'failed': return `lỗi sau ${fmtDur(r.endedAt - r.startedAt)}`;
    case 'stopped': return `dừng sau ${fmtDur(r.endedAt - r.startedAt)}`;
    case 'opened': return `mở lúc ${fmtTime(r.endedAt || now)}`;
    default: return 'chưa chạy';
  }
}

// ===========================================================================
// Sidebar
// ===========================================================================
const BAR_ORDER = ['running', 'failed', 'stopped', 'opened', 'success', 'idle'];
const BAR_COLOR = { running: '#58A6FF', failed: '#F85149', stopped: '#D29922', opened: '#39C5CF', success: '#3FB950', idle: '#3A4250' };
const META_COLOR = { running: '#79B8FF', failed: '#FF8A80', stopped: '#E3B341', opened: '#39C5CF', success: '#56D364', idle: '#9AA3B2' };

const statusOf = (c) => rt(c.id).status;
const countStatus = (list, st) => list.filter((c) => statusOf(c) === st).length;

function renderFilters() {
  const chip = (id, label, n, dot) => {
    const on = (ui.filter || 'all') === id;
    return h('button', {
      type: 'button',
      class: 'chip' + (on ? ' on' : ''),
      'aria-pressed': String(on),
      onClick: () => { ui.filter = id; saveUi(); renderSidebar(); }
    },
      dot ? h('span', { class: 'cdot' + (id === 'running' ? ' pulse' : ''), style: { background: dot } }) : null,
      label,
      h('span', { class: 'n' }, n));
  };
  $('#filters').replaceChildren(
    chip('all', 'Tất cả', commands.length),
    chip('running', 'Đang chạy', countStatus(commands, 'running'), '#58A6FF'),
    chip('failed', 'Lỗi', countStatus(commands, 'failed'), '#F85149'));
}

function renderSidebar() {
  renderFilters();
  const q = search.trim().toLowerCase();
  const filter = ui.filter || 'all';
  const filtering = !!q || filter !== 'all';
  const wrap = $('#groups');
  wrap.replaceChildren();

  const matchQ = (c) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.cwd.toLowerCase().includes(q) ||
    c.steps.some((s) => s.toLowerCase().includes(q));
  const matchF = (c) => filter === 'all' || statusOf(c) === filter;

  let shown = 0;
  for (const cat of categories) {
    const all = commands.filter((c) => catOf(c).id === cat.id);
    const items = all.filter((c) => matchQ(c) && matchF(c));
    if (filtering ? !items.length : (!all.length && cat.id === UNCAT)) continue;
    shown++;

    // khi đang lọc/tìm: luôn mở danh mục có kết quả
    const collapsed = !filtering && !!ui.collapsed[cat.id];
    const running = countStatus(all, 'running');
    const failed = countStatus(all, 'failed');
    const bar = BAR_ORDER.map((st) => ({ st, n: countStatus(all, st) })).filter((x) => x.n);

    wrap.append(
      h('section', { class: 'group' + (collapsed ? '' : ' open') },
        h('button', {
          type: 'button',
          class: 'group-head' + (filtering ? ' locked' : ''),
          'aria-expanded': String(!collapsed),
          title: filtering ? cat.name : (collapsed ? 'Mở danh mục' : 'Thu gọn danh mục'),
          onClick: () => {
            if (filtering) return;
            ui.collapsed[cat.id] = !ui.collapsed[cat.id];
            saveUi();
            renderSidebar();
          }
        },
          h('span', { class: 'chev' + (collapsed ? ' collapsed' : '') }, icon('down', 14)),
          h('span', { class: 'cat-ico', style: { background: hexA(cat.color, 0.15) } }, h('i', { style: { background: cat.color } })),
          h('span', { class: 'gname' }, cat.name),
          running ? h('span', { class: 'pill run', title: `${running} lệnh đang chạy` }, h('span', { class: 'pdot pulse' }), `${running} chạy`) : null,
          failed ? h('span', { class: 'pill fail', title: `${failed} lệnh lỗi` }, icon('x', 9), `${failed} lỗi`) : null,
          h('span', { class: 'count', title: `${all.length} lệnh` }, all.length)
        ),
        collapsed && bar.length
          ? h('div', { class: 'status-bar', 'aria-hidden': 'true' },
              bar.map((x) => h('span', { title: `${x.n} ${STATUS[x.st].label}`, style: { flex: String(x.n), background: BAR_COLOR[x.st] } })))
          : null,
        collapsed
          ? null
          : h('div', { class: 'items', style: { borderLeftColor: hexA(cat.color, 0.35) } },
              items.length ? items.map(itemEl) : h('div', { class: 'empty-group' }, 'Chưa có lệnh'))
      )
    );
  }
  if (!shown) {
    wrap.append(h('div', { class: 'side-empty' }, filtering ? 'Không có lệnh nào khớp bộ lọc' : 'Chưa có lệnh nào'));
  }
  updateToggleAll();
  updateSummary();
}

function itemMeta(c, r) {
  if (r.status === 'running') return `Đang chạy · ${fmtDur(Date.now() - (r.startedAt || Date.now()))}`;
  if (r.status === 'failed') {
    const code = [...(r.codes || [])].reverse().find((x) => x != null && x !== 0);
    return `Lỗi${code != null ? ' · exit ' + code : ''}`;
  }
  return `${c.steps.length} lệnh · ${STATUS[r.status].label}`;
}

function itemEl(c) {
  const r = rt(c.id);
  const st = STATUS[r.status];
  const running = r.status === 'running';
  return h('div', {
    class: 'item' + (ui.selectedId === c.id ? ' selected' : '') + (running ? ' running' : ''),
    tabindex: '0',
    onClick: () => select(c.id),
    onKeydown: (e) => { if (e.key === 'Enter') select(c.id); }
  },
    h('span', { class: 'dot' + (running ? ' pulse' : ''), style: { background: st.color } }),
    h('div', { class: 'item-text' },
      h('span', { class: 'item-name', title: c.name }, c.name),
      h('span', { class: 'item-cwd mono', title: c.cwd }, c.cwd),
      h('span', { class: 'item-meta', 'data-run': running ? c.id : null, style: { color: META_COLOR[r.status] || st.color } }, itemMeta(c, r))
    ),
    running
      ? h('button', { type: 'button', class: 'quick stop', title: 'Tắt', 'aria-label': `Tắt ${c.name}`, onClick: (e) => { e.stopPropagation(); stopCommand(c.id); } }, icon('stop', 11))
      : h('button', { type: 'button', class: 'quick run', title: 'Chạy', 'aria-label': `Chạy ${c.name}`, onClick: (e) => { e.stopPropagation(); runCommand(c.id); } }, icon('play', 12))
  );
}

function visibleCatIds() {
  return categories.filter((cat) => cat.id !== UNCAT || commands.some((c) => catOf(c).id === UNCAT)).map((c) => c.id);
}
function updateToggleAll() {
  const btn = $('#btnToggleAll');
  if (!btn) return;
  const ids = visibleCatIds();
  const allCollapsed = ids.length > 0 && ids.every((id) => ui.collapsed[id]);
  const label = allCollapsed ? 'Mở tất cả danh mục' : 'Thu gọn tất cả danh mục';
  btn.title = label;
  btn.setAttribute('aria-label', label);
}
function toggleAllCategories() {
  const ids = visibleCatIds();
  const allCollapsed = ids.length > 0 && ids.every((id) => ui.collapsed[id]);
  ids.forEach((id) => { ui.collapsed[id] = !allCollapsed; });
  saveUi();
  renderSidebar();
}
function stopAll() {
  const running = commands.filter((c) => statusOf(c) === 'running');
  running.forEach((c) => api.stop(c.id));
  if (running.length) toast(`Đang tắt ${running.length} lệnh…`);
}

function updateSummary() {
  const running = commands.filter((c) => rt(c.id).status === 'running').length;
  const cats = categories.filter((c) => c.id !== UNCAT).length;
  $('#summary').textContent = `${commands.length} lệnh · ${cats} danh mục`;
  $('#runChip').classList.toggle('hidden', !running);
  $('#runChipText').textContent = `${running} đang chạy`;
  const foot = $('#sideFoot');
  if (foot) {
    foot.classList.toggle('hidden', !running);
    $('#runningCount').textContent = `${running} lệnh đang chạy`;
  }
}

function select(id) {
  ui.selectedId = id;
  saveUi();
  renderSidebar();
  renderDetail();
}

// ===========================================================================
// Chi tiết + log
// ===========================================================================
function renderDetail() {
  const main = $('#detail');
  main.replaceChildren();
  const c = selected();
  if (!c) {
    main.append(emptyState());
    return;
  }
  main.append(h('div', { id: 'detailTop', class: 'detail-top' }), logPanel(c));
  renderDetailTop();
  renderLog();
}

/** Logo toanf2103, lấy từ logo ở thanh tiêu đề */
function brandLogo(size) {
  const svg = document.querySelector('.brand .logo svg').cloneNode(true);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function emptyState() {
  const none = !commands.length;
  return h('div', { class: 'empty' },
    h('div', { class: 'logo' }, brandLogo(48)),
    h('h2', null, none ? 'Chưa có lệnh nào' : 'Chọn một lệnh'),
    h('p', null, none
      ? 'Tạo lệnh đầu tiên: đặt tên, chọn thư mục và thêm các lệnh cần chạy.'
      : 'Chọn một lệnh ở danh sách bên trái để xem chi tiết và log.'),
    h('button', { type: 'button', class: 'btn primary', onClick: () => openEditor(null) }, icon('plus', 15), 'Tạo lệnh mới')
  );
}

function renderDetailTop() {
  const top = $('#detailTop');
  const c = selected();
  if (!top || !c) return;
  const r = rt(c.id);
  const st = STATUS[r.status];
  const cat = catOf(c);
  const running = r.status === 'running';

  top.replaceChildren(
    h('section', { class: 'head' },
      h('div', { class: 'head-info' },
        h('div', { class: 'title-row' },
          h('span', { class: 'cat-chip', style: { color: cat.color, background: hexA(cat.color, 0.14) } }, cat.name),
          h('h1', null, c.name),
          h('span', { class: 'badge', style: { color: st.color, background: hexA(st.color, 0.14) } },
            h('span', { class: 'bdot', style: { background: st.color } }), st.label)
        ),
        h('button', { type: 'button', class: 'path mono', title: 'Mở thư mục trong Explorer', onClick: () => api.openFolder(c.cwd) },
          icon('folder', 14), c.cwd),
        h('div', { class: 'meta-row' },
          h('span', { class: 'env-chip' + (shellOf(c) ? '' : ' missing') }, icon('console', 12), shellLabel(c)),
          c.admin ? h('span', { class: 'admin-chip' }, icon('shield', 12), 'Admin') : null,
          h('span', { class: 'meta' },
            `${c.steps.length} lệnh · chạy tuần tự${c.stopOnError !== false ? ' · dừng khi lỗi' : ''} · `,
            h('span', { id: 'elapsed' }, elapsedText(r))))
      ),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn run', disabled: running, onClick: () => runCommand(c.id) }, icon('play', 14), 'Chạy'),
        h('button', { type: 'button', class: 'btn', onClick: () => resetCommand(c.id) }, icon('reset', 14), 'Reset'),
        h('button', { type: 'button', class: 'btn danger', disabled: !running, onClick: () => stopCommand(c.id) }, icon('stop', 12), 'Tắt'),
        h('button', { type: 'button', class: 'icon-btn', title: 'Mở cửa sổ cmd tại thư mục', 'aria-label': 'Mở cửa sổ cmd tại thư mục', onClick: () => api.openTerminal(c.cwd) }, icon('console', 15)),
        h('button', { type: 'button', class: 'icon-btn', title: 'Sửa', 'aria-label': 'Sửa lệnh', onClick: () => openEditor(c) }, icon('edit', 15)),
        h('button', { type: 'button', class: 'icon-btn', title: 'Nhân bản', 'aria-label': 'Nhân bản lệnh', onClick: () => duplicate(c) }, icon('copy', 15)),
        h('button', { type: 'button', class: 'icon-btn', title: 'Xoá', 'aria-label': 'Xoá lệnh', onClick: () => confirmDelete(c) }, icon('trash', 15))
      )
    ),
    h('section', { class: 'steps', 'aria-label': 'Các bước' },
      c.steps.map((s, i) => {
        const key = r.steps[i] || 'pending';
        const p = STEP[key];
        return h('div', { class: 'step' },
          h('span', { class: 'step-ico', style: { color: p.color, background: p.bg } }, p.icon || String(i + 1)),
          h('code', { title: s }, s),
          h('span', { class: 'step-label', style: { color: p.color } }, p.label(r.codes[i]))
        );
      })
    )
  );
}

function logTitle(c) {
  const r = rt(c.id);
  return `LOG · ${shellLabel(c)}${c.admin ? ' · Admin' : ''}${r.pid ? ' · PID ' + r.pid : ''} · ${r.log.length} dòng`;
}

function logPanel(c) {
  return h('section', { class: 'log-panel', 'aria-label': 'Log realtime' },
    h('div', { class: 'log-bar' },
      h('div', { class: 'log-title' }, icon('console', 14), h('span', { id: 'logTitle' }, logTitle(c))),
      h('div', { class: 'log-tools' },
        h('label', { class: 'chk' },
          h('input', {
            type: 'checkbox',
            checked: ui.autoScroll,
            onChange: (e) => {
              ui.autoScroll = e.target.checked;
              saveUi();
              if (ui.autoScroll) scrollLogBottom();
            }
          }),
          'Tự cuộn'),
        h('button', { type: 'button', class: 'btn xs', onClick: copyLog }, 'Sao chép'),
        h('button', { type: 'button', class: 'btn xs', onClick: clearLog }, 'Xoá log')
      )
    ),
    h('div', { id: 'log', class: 'log mono', tabindex: '0' })
  );
}

function lineEl(l) {
  return h('div', { class: `ln ${l.type}` },
    h('span', { class: 'ts' }, l.t ? fmtTime(l.t) : '--:--:--'),
    h('span', { class: 'tx' }, l.text === '' ? ' ' : l.text));
}

function renderLog() {
  const el = $('#log');
  const c = selected();
  if (!el || !c) return;
  const r = rt(c.id);
  if (!r.log.length) {
    el.replaceChildren(h('div', { class: 'ln placeholder' },
      h('span', { class: 'ts' }, '--:--:--'),
      h('span', { class: 'tx' }, 'Chưa có log. Bấm "Chạy" để bắt đầu — log hiện ở đây theo thời gian thực.')));
  } else {
    const frag = document.createDocumentFragment();
    r.log.forEach((l) => frag.append(lineEl(l)));
    el.replaceChildren(frag);
  }
  updateLogTitle();
  scrollLogBottom(true);
}

function updateLogTitle() {
  const c = selected();
  const t = $('#logTitle');
  if (c && t) t.textContent = logTitle(c);
}

function scrollLogBottom(force) {
  const el = $('#log');
  if (el && (ui.autoScroll || force)) el.scrollTop = el.scrollHeight;
}

function appendLog(id, lines) {
  const r = rt(id);
  r.log.push(...lines);
  if (r.log.length > MAX_LOG) r.log.splice(0, r.log.length - MAX_LOG);

  if (ui.selectedId !== id) return;
  const el = $('#log');
  if (!el) return;
  const ph = el.querySelector('.placeholder');
  if (ph) ph.remove();
  const frag = document.createDocumentFragment();
  lines.forEach((l) => frag.append(lineEl(l)));
  el.append(frag);
  while (el.childElementCount > MAX_LOG) el.firstElementChild.remove();
  updateLogTitle();
  scrollLogBottom();
}

function copyLog() {
  const c = selected();
  if (!c) return;
  const text = rt(c.id).log.map((l) => `${l.t ? fmtTime(l.t) : ''}  ${l.text}`).join('\r\n');
  api.copy(text).then(() => toast('Đã sao chép log', 'ok'));
}

function clearLog() {
  const c = selected();
  if (!c) return;
  rt(c.id).log = [];
  renderLog();
}

// ===========================================================================
// Chạy / Tắt / Reset
// ===========================================================================
const pendingStarts = new Set();
const PARAMETER_PATTERN = /\{([\p{L}_][\p{L}\p{M}\p{N}_]*)\}/gu;

function promptParameters(c, steps, names) {
  return new Promise((resolve) => {
    let result = null;
    const inputs = new Map();
    const fields = names.map((name, i) => {
      const input = h('input', {
        id: `run-param-${i}`,
        type: 'text',
        class: 'input mono',
        autocomplete: 'off',
        spellcheck: 'false',
        autofocus: i === 0
      });
      inputs.set(name, input);
      return h('div', { class: 'field' }, h('label', { for: `run-param-${i}` }, name), input);
    });
    const form = h('form', {
      class: 'modal md',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'run-params-title',
      onSubmit: (e) => {
        e.preventDefault();
        result = steps.map((step) => step.replace(PARAMETER_PATTERN, (_match, name) => inputs.get(name).value));
        close();
      }
    },
      h('div', { class: 'modal-head' },
        h('div', null,
          h('h2', { id: 'run-params-title' }, 'Nhập tham số'),
          h('div', { class: 'sub' }, c.name)),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng', onClick: () => close() }, icon('x', 16))),
      h('div', { class: 'modal-body' },
        h('span', { class: 'hint muted' }, 'Có thể để trống. Giá trị được thay nguyên văn; hãy đặt dấu nháy trong lệnh mẫu nếu cần. Mỗi lần chạy sẽ nhập lại.'),
        fields),
      h('div', { class: 'modal-foot' },
        h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'Huỷ'),
        h('button', { type: 'submit', class: 'btn run' }, icon('play', 14), 'Chạy'))
    );
    const close = openModal(form, () => resolve(result));
  });
}

async function runCommand(id) {
  const c = byId(id);
  if (!c) return;
  const r = rt(id);
  if (r.status === 'running' || pendingStarts.has(id)) return;
  let steps = c.steps.map((s) => s.trim()).filter(Boolean);
  if (!steps.length) {
    toast('Lệnh chưa có bước nào', 'error');
    return;
  }

  pendingStarts.add(id);
  let started = false;
  try {
    const names = [...new Set(steps.flatMap((step) => Array.from(step.matchAll(PARAMETER_PATTERN), (match) => match[1])))];
    if (names.length) {
      const resolved = await promptParameters(c, steps, names);
      if (!resolved) return;
      steps = resolved.map((s) => s.trim()).filter(Boolean);
      if (!steps.length) {
        toast('Không có lệnh nào để chạy sau khi thay tham số', 'error');
        return;
      }
    }

    if (c.clearOnRun || !r.log.length) r.log = [];
    else r.log.push({ t: Date.now(), type: 'sep', text: '──────────── chạy lại ────────────' });

    Object.assign(r, {
      status: 'running',
      steps: steps.map(() => 'pending'),
      codes: [],
      startedAt: Date.now(),
      endedAt: null,
      pid: null,
      resetAfterStop: false
    });
    started = true;
    renderSidebar();
    if (ui.selectedId === id) {
      renderDetailTop();
      renderLog();
    }

    const res = await api.start({
      cmdId: id,
      name: c.name,
      cwd: c.cwd,
      steps,
      stopOnError: c.stopOnError !== false,
      shellId: c.shell || 'cmd',
      admin: !!c.admin
    });
    if (!res || !res.ok) throw new Error((res && res.error) || 'Không chạy được lệnh');
  } catch (e) {
    const message = (e && e.message) || 'Không chạy được lệnh';
    if (started && r.status === 'running') {
      if (r.resetAfterStop) resetRt(r);
      else {
        r.status = 'failed';
        r.endedAt = Date.now();
        appendLog(id, [{ t: Date.now(), type: 'error', text: message }]);
      }
      renderSidebar();
      if (ui.selectedId === id) {
        renderDetailTop();
        renderLog();
      }
    }
    toast(message, 'error');
  } finally {
    pendingStarts.delete(id);
  }
}

function stopCommand(id) {
  api.stop(id);
}

function resetCommand(id) {
  const r = rt(id);
  if (r.status === 'running') {
    r.resetAfterStop = true;
    r.log = [];
    api.stop(id);
  } else {
    resetRt(r);
  }
  renderSidebar();
  if (ui.selectedId === id) {
    renderDetailTop();
    renderLog();
  }
}

api.onLog(({ cmdId, lines }) => {
  const r = rt(cmdId);
  if (r.resetAfterStop) return;
  appendLog(cmdId, lines);
});

api.onStatus((d) => {
  const r = rt(d.cmdId);
  const prev = r.status;
  if (r.resetAfterStop && d.status !== 'running') {
    resetRt(r);
  } else {
    Object.assign(r, {
      status: d.status,
      steps: d.steps,
      codes: d.codes,
      pid: d.pid,
      startedAt: d.startedAt,
      endedAt: d.endedAt
    });
  }

  if (prev === 'running' && r.status !== 'running' && ui.selectedId !== d.cmdId) {
    const c = byId(d.cmdId);
    if (c && r.status === 'failed') toast(`"${c.name}" bị lỗi`, 'error');
    else if (c && r.status === 'success') toast(`"${c.name}" đã hoàn tất`, 'ok');
  }

  renderSidebar();
  if (ui.selectedId === d.cmdId) {
    renderDetailTop();
    if (r.status === 'idle') renderLog();
    else updateLogTitle();
  }
});

setInterval(() => {
  const c = selected();
  if (!c || rt(c.id).status !== 'running') return;
  const el = $('#elapsed');
  if (el) el.textContent = elapsedText(rt(c.id));
}, 1000);

// ===========================================================================
// Thêm / sửa / xoá lệnh
// ===========================================================================
function duplicate(c) {
  const copy = { ...structuredClone(c), id: uid(), name: `${c.name} (bản sao)` };
  const idx = commands.indexOf(c);
  commands.splice(idx + 1, 0, copy);
  save();
  select(copy.id);
  toast('Đã nhân bản lệnh', 'ok');
}

function confirmDelete(c) {
  const close = openModal(
    h('div', { class: 'modal sm', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' }, h('h2', null, 'Xoá lệnh?')),
      h('div', { class: 'modal-body' },
        h('p', { style: { margin: 0, color: '#C9D1D9' } }, `Lệnh "${c.name}" sẽ bị xoá vĩnh viễn.`,
          rt(c.id).status === 'running' ? ' Tiến trình đang chạy sẽ bị tắt.' : '')),
      h('div', { class: 'modal-foot' },
        h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'Huỷ'),
        h('button', {
          type: 'button',
          class: 'btn danger',
          onClick: () => {
            if (rt(c.id).status === 'running') api.stop(c.id);
            commands = commands.filter((x) => x.id !== c.id);
            delete runtime[c.id];
            if (ui.selectedId === c.id) ui.selectedId = null;
            save();
            saveUi();
            close();
            renderAll();
          }
        }, icon('trash', 14), 'Xoá')
      )
    )
  );
}

function openEditor(cmd, opts = {}) {
  const isNew = !cmd;
  const draft = cmd
    ? structuredClone(cmd)
    : {
        id: uid(),
        name: '',
        categoryId: opts.categoryId || (categories.find((c) => c.id !== UNCAT) || { id: UNCAT }).id,
        cwd: '',
        steps: [''],
        stopOnError: true,
        clearOnRun: false,
        shell: 'cmd',
        admin: false
      };
  if (!draft.steps.length) draft.steps = [''];
  if (!draft.shell) draft.shell = 'cmd';

  // --- Môi trường thực thi
  const shellSel = h('select', { id: 'f-shell', class: 'input', onChange: (e) => { draft.shell = e.target.value; updateShellHint(); } });
  const shellHint = h('span', { class: 'hint muted' });
  const KIND_HINT = {
    cmd: 'Chạy bằng cmd.exe /c, log hiện realtime trong app.',
    powershell: 'Chạy bằng PowerShell, log hiện realtime trong app. Lỗi cmdlet hoặc exit code ≠ 0 đều tính là lỗi.',
    bash: 'Chạy bằng bash -lc, log hiện realtime trong app. Dùng cú pháp bash (&&, $VAR, …).',
    wsl: 'Chạy trong Linux (WSL), đường dẫn Windows được chuyển tự động. Log hiện realtime trong app.',
    wt: 'Mở cửa sổ Windows Terminal riêng và chạy các lệnh trong đó. Log chỉ hiện trong cửa sổ ấy, nút Tắt không áp dụng.'
  };
  const fillShells = () => {
    const opts = shells.map((s) => h('option', { value: s.id, selected: s.id === draft.shell }, s.name));
    if (!shells.some((s) => s.id === draft.shell)) {
      opts.unshift(h('option', { value: draft.shell, selected: true }, `${draft.shell} (không có trên máy)`));
    }
    shellSel.replaceChildren(...opts);
    shellSel.value = draft.shell;
    updateShellHint();
  };
  function updateShellHint() {
    const s = shells.find((x) => x.id === draft.shell);
    shellHint.textContent = s ? `${KIND_HINT[s.kind] || ''}  ·  ${s.exe}` : 'Môi trường này không có trên máy, hãy chọn môi trường khác.';
    shellHint.className = 'hint ' + (s ? 'muted' : 'bad');
  }
  fillShells();
  const rescanBtn = h('button', {
    type: 'button',
    class: 'btn',
    title: 'Quét lại các môi trường có trên máy',
    onClick: async () => {
      rescanBtn.disabled = true;
      shells = await api.listShells(true);
      rescanBtn.disabled = false;
      fillShells();
      toast(`Tìm thấy ${shells.length} môi trường`, 'ok');
    }
  }, icon('refresh', 15), 'Quét lại');

  // --- Tên
  const nameIn = h('input', { id: 'f-name', type: 'text', class: 'input', value: draft.name, placeholder: 'VD: API Backend – build & publish', autofocus: true });

  // --- Danh mục
  const catSel = h('select', { id: 'f-cat', class: 'input', onChange: (e) => { draft.categoryId = e.target.value; } });
  const fillCats = () => {
    catSel.replaceChildren(...categories.map((c) => h('option', { value: c.id, selected: c.id === draft.categoryId }, c.name)));
    catSel.value = draft.categoryId;
  };
  fillCats();
  const newCatIn = h('input', { type: 'text', class: 'input', placeholder: 'Tên danh mục mới' });
  const addNewCat = () => {
    const name = newCatIn.value.trim();
    if (!name) { newCatIn.focus(); return; }
    const cat = { id: uid(), name, color: PALETTE[(categories.length - 1) % PALETTE.length] };
    categories.splice(categories.findIndex((c) => c.id === UNCAT), 0, cat);
    save();
    draft.categoryId = cat.id;
    fillCats();
    newCatIn.value = '';
    newCatRow.classList.add('hidden');
    renderSidebar();
  };
  newCatIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNewCat(); } });
  const newCatRow = h('div', { class: 'inline-new hidden' },
    newCatIn,
    h('button', { type: 'button', class: 'btn primary', onClick: addNewCat }, 'Thêm'),
    h('button', { type: 'button', class: 'btn', onClick: () => newCatRow.classList.add('hidden') }, 'Huỷ'));

  // --- Thư mục
  const cwdHint = h('span', { class: 'hint' });
  let hintTimer = null;
  const checkCwd = () => {
    clearTimeout(hintTimer);
    hintTimer = setTimeout(async () => {
      const p = cwdIn.value.trim();
      if (!p) { cwdHint.textContent = ''; cwdHint.className = 'hint'; return; }
      const ok = await api.dirExists(p);
      cwdHint.textContent = ok ? '✓ Thư mục tồn tại' : '✕ Không tìm thấy thư mục';
      cwdHint.className = 'hint ' + (ok ? 'ok' : 'bad');
    }, 250);
  };
  const cwdIn = h('input', { id: 'f-cwd', type: 'text', class: 'input mono', value: draft.cwd, placeholder: 'D:\\projects\\my-app', onInput: checkCwd });
  checkCwd();

  // --- Danh sách lệnh
  const stepList = h('div', { class: 'step-list' });
  let dragFrom = -1;

  const renderSteps = (focusIdx) => {
    stepList.replaceChildren(...draft.steps.map((s, i) => {
      const input = h('input', {
        type: 'text',
        class: 'input mono',
        value: s,
        placeholder: i === 0 ? 'VD: git pull' : 'Lệnh tiếp theo…',
        'aria-label': `Lệnh ${i + 1}`,
        onInput: (e) => { draft.steps[i] = e.target.value; },
        onKeydown: (e) => {
          if (e.key === 'Enter' && !e.ctrlKey) {
            e.preventDefault();
            draft.steps.splice(i + 1, 0, '');
            renderSteps(i + 1);
          } else if (e.key === 'Backspace' && e.target.value === '' && draft.steps.length > 1) {
            e.preventDefault();
            draft.steps.splice(i, 1);
            renderSteps(Math.max(0, i - 1));
          }
        },
        onPaste: (e) => {
          const text = e.clipboardData.getData('text');
          if (!/\r?\n/.test(text)) return;
          e.preventDefault();
          const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
          if (!lines.length) return;
          const cur = e.target.value;
          const first = cur ? cur + lines[0] : lines[0];
          draft.steps.splice(i, 1, first, ...lines.slice(1));
          renderSteps(i + lines.length - 1);
        }
      });
      const row = h('div', {
        class: 'step-row',
        onDragstart: (e) => { dragFrom = i; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; },
        onDragend: () => { row.draggable = false; row.classList.remove('dragging'); },
        onDragover: (e) => { if (dragFrom < 0) return; e.preventDefault(); row.classList.add('drag-over'); },
        onDragleave: () => row.classList.remove('drag-over'),
        onDrop: (e) => {
          e.preventDefault();
          row.classList.remove('drag-over');
          if (dragFrom < 0 || dragFrom === i) return;
          const [moved] = draft.steps.splice(dragFrom, 1);
          draft.steps.splice(i, 0, moved);
          dragFrom = -1;
          renderSteps(i);
        }
      },
        h('span', { class: 'grip', title: 'Kéo để đổi thứ tự', onMousedown: () => { row.draggable = true; }, onMouseup: () => { row.draggable = false; } }, icon('grip', 14)),
        h('span', { class: 'num' }, i + 1),
        input,
        h('button', { type: 'button', class: 'icon-btn ghost md', 'aria-label': 'Lên', title: 'Lên', disabled: i === 0, onClick: () => { [draft.steps[i - 1], draft.steps[i]] = [draft.steps[i], draft.steps[i - 1]]; renderSteps(i - 1); } }, icon('up', 14)),
        h('button', { type: 'button', class: 'icon-btn ghost md', 'aria-label': 'Xuống', title: 'Xuống', disabled: i === draft.steps.length - 1, onClick: () => { [draft.steps[i + 1], draft.steps[i]] = [draft.steps[i], draft.steps[i + 1]]; renderSteps(i + 1); } }, icon('down', 14)),
        h('button', { type: 'button', class: 'icon-btn ghost md danger', 'aria-label': 'Xoá dòng', title: 'Xoá dòng', disabled: draft.steps.length === 1, onClick: () => { draft.steps.splice(i, 1); renderSteps(Math.min(i, draft.steps.length - 1)); } }, icon('trash', 14))
      );
      return row;
    }));
    if (focusIdx != null) {
      const inp = stepList.querySelectorAll('input')[focusIdx];
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  };
  renderSteps();

  // --- Tuỳ chọn
  const stopChk = h('input', { type: 'checkbox', checked: draft.stopOnError !== false });
  const clearChk = h('input', { type: 'checkbox', checked: !!draft.clearOnRun });
  const adminChk = h('input', { type: 'checkbox', checked: !!draft.admin });

  const errEl = h('span', { class: 'err' });

  const submit = (andRun) => {
    const name = nameIn.value.trim();
    const cwd = cwdIn.value.trim();
    const steps = draft.steps.map((s) => s.trim()).filter(Boolean);
    if (!name) { errEl.textContent = 'Nhập tên lệnh'; nameIn.focus(); return; }
    if (!cwd) { errEl.textContent = 'Nhập đường dẫn mở cmd'; cwdIn.focus(); return; }
    if (!steps.length) { errEl.textContent = 'Thêm ít nhất 1 lệnh'; return; }

    const data = {
      ...draft,
      name,
      cwd,
      steps,
      categoryId: catSel.value,
      shell: shellSel.value,
      admin: adminChk.checked,
      stopOnError: stopChk.checked,
      clearOnRun: clearChk.checked
    };
    if (isNew) commands.push(data);
    else commands[commands.findIndex((x) => x.id === data.id)] = data;
    if (ui.collapsed[data.categoryId]) delete ui.collapsed[data.categoryId];
    save();
    close();
    select(data.id);
    toast(isNew ? 'Đã tạo lệnh' : 'Đã lưu thay đổi', 'ok');
    if (andRun) runCommand(data.id);
  };

  const form = h('form', {
    class: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    onSubmit: (e) => { e.preventDefault(); submit(false); },
    onKeydown: (e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); submit(true); } }
  },
    h('div', { class: 'modal-head' },
      h('div', null,
        h('h2', null, isNew ? 'Tạo lệnh mới' : 'Sửa lệnh'),
        h('div', { class: 'sub' }, 'Các lệnh chạy lần lượt trong cùng thư mục · Enter: thêm dòng · Ctrl+Enter: lưu & chạy')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng', onClick: () => close() }, icon('x', 16))
    ),
    h('div', { class: 'modal-body' },
      h('div', { class: 'field' }, h('label', { for: 'f-name' }, 'Tên lệnh'), nameIn),
      h('div', { class: 'field' },
        h('label', { for: 'f-cat' }, 'Danh mục'),
        h('div', { class: 'field-row' },
          catSel,
          h('button', { type: 'button', class: 'btn', onClick: () => { newCatRow.classList.toggle('hidden'); newCatIn.focus(); } }, icon('plus', 15), 'Danh mục mới')),
        newCatRow),
      h('div', { class: 'field' },
        h('label', { for: 'f-cwd' }, 'Đường dẫn mở cmd'),
        h('div', { class: 'field-row' },
          cwdIn,
          h('button', {
            type: 'button',
            class: 'btn',
            onClick: async () => {
              const p = await api.pickFolder(cwdIn.value.trim());
              if (p) { cwdIn.value = p; checkCwd(); }
            }
          }, icon('folder', 15), 'Chọn thư mục…')),
        cwdHint),
      h('div', { class: 'field' },
        h('label', { for: 'f-shell' }, 'Môi trường thực thi'),
        h('div', { class: 'field-row' }, shellSel, rescanBtn),
        shellHint),
      h('div', { class: 'field' },
        h('div', { class: 'field-head' },
          h('span', { class: 'field-label' }, 'Danh sách lệnh'),
          h('span', { class: 'muted small' }, 'Kéo để đổi thứ tự · dán nhiều dòng sẽ tách thành nhiều lệnh')),
        stepList,
        h('button', { type: 'button', class: 'btn dashed', onClick: () => { draft.steps.push(''); renderSteps(draft.steps.length - 1); } }, icon('plus', 15), 'Thêm lệnh')),
      h('div', { class: 'options' },
        h('label', null, adminChk, icon('shield', 14), 'Chạy với quyền Administrator',
          h('span', { class: 'muted small' }, appIsAdmin ? '(app đang chạy bằng admin, không cần hỏi UAC)' : '(Windows sẽ hỏi UAC mỗi lần chạy)')),
        h('label', null, stopChk, 'Dừng chuỗi lệnh khi một lệnh lỗi (exit code ≠ 0)'),
        h('label', null, clearChk, 'Tự xoá log cũ mỗi lần bấm Chạy'))
    ),
    h('div', { class: 'modal-foot' },
      errEl,
      h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'Huỷ'),
      h('button', { type: 'submit', class: 'btn outline-primary' }, 'Lưu'),
      h('button', { type: 'button', class: 'btn primary', onClick: () => submit(true) }, icon('play', 13), 'Lưu & chạy'))
  );

  const close = openModal(form);
}

// ===========================================================================
// Quản lý danh mục
// ===========================================================================
function openCategories() {
  const draft = structuredClone(categories);
  let newColor = PALETTE[(draft.length - 1) % PALETTE.length];
  const counts = (id) => commands.filter((c) => catOf(c).id === id).length;

  const list = h('div', { class: 'cat-list' });
  const renderList = () => {
    list.replaceChildren(...draft.map((c, i) =>
      h('div', { class: 'cat-row' },
        h('button', {
          type: 'button',
          class: 'swatch-btn',
          title: 'Đổi màu',
          'aria-label': `Đổi màu ${c.name}`,
          style: { background: c.color },
          onClick: () => { c.color = PALETTE[(PALETTE.indexOf(c.color) + 1) % PALETTE.length]; renderList(); }
        }),
        h('input', { type: 'text', class: 'input', value: c.name, 'aria-label': 'Tên danh mục', onInput: (e) => { c.name = e.target.value; } }),
        h('span', { class: 'muted small nowrap' }, `${counts(c.id)} lệnh`),
        h('button', { type: 'button', class: 'icon-btn ghost md', 'aria-label': 'Lên', disabled: i === 0, onClick: () => { [draft[i - 1], draft[i]] = [draft[i], draft[i - 1]]; renderList(); } }, icon('up', 14)),
        h('button', { type: 'button', class: 'icon-btn ghost md', 'aria-label': 'Xuống', disabled: i === draft.length - 1, onClick: () => { [draft[i + 1], draft[i]] = [draft[i], draft[i + 1]]; renderList(); } }, icon('down', 14)),
        h('button', {
          type: 'button',
          class: 'icon-btn ghost md danger',
          'aria-label': 'Xoá danh mục',
          title: c.locked ? 'Danh mục mặc định, không xoá được' : 'Xoá danh mục',
          disabled: !!c.locked,
          onClick: () => { draft.splice(i, 1); renderList(); }
        }, icon('trash', 14))
      )
    ));
  };
  renderList();

  const nameIn = h('input', { id: 'new-cat', type: 'text', class: 'input', placeholder: 'VD: Database' });
  const palette = h('div', { class: 'palette' });
  const renderPalette = () => {
    palette.replaceChildren(h('span', { class: 'muted small' }, 'Màu:'),
      ...PALETTE.map((hex) => h('button', {
        type: 'button',
        class: hex === newColor ? 'on' : '',
        style: { background: hex },
        'aria-label': `Chọn màu ${hex}`,
        onClick: () => { newColor = hex; renderPalette(); }
      })));
  };
  renderPalette();
  const add = () => {
    const name = nameIn.value.trim();
    if (!name) { nameIn.focus(); return; }
    const at = draft.findIndex((c) => c.id === UNCAT);
    draft.splice(at < 0 ? draft.length : at, 0, { id: uid(), name, color: newColor });
    nameIn.value = '';
    newColor = PALETTE[(PALETTE.indexOf(newColor) + 1) % PALETTE.length];
    renderList();
    renderPalette();
    nameIn.focus();
  };
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  const node = h('div', { class: 'modal md', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' },
      h('div', null, h('h2', null, 'Quản lý danh mục'), h('div', { class: 'sub' }, 'Nhóm lệnh theo dự án hoặc loại việc')),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng', onClick: () => close() }, icon('x', 16))),
    h('div', { class: 'modal-body' },
      list,
      h('div', { class: 'add-cat' },
        h('label', { for: 'new-cat', class: 'field-label' }, 'Thêm danh mục'),
        h('div', { class: 'field-row' }, nameIn, h('button', { type: 'button', class: 'btn primary', onClick: add }, icon('plus', 15), 'Thêm')),
        palette),
      h('span', { class: 'muted small' }, '"Chưa phân loại" là mặc định, không xoá được. Xoá danh mục khác → lệnh bên trong chuyển về đây.')),
    h('div', { class: 'modal-foot' },
      h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'Huỷ'),
      h('button', {
        type: 'button',
        class: 'btn primary',
        onClick: () => {
          draft.forEach((c) => { c.name = c.name.trim() || 'Không tên'; });
          if (!draft.some((c) => c.id === UNCAT)) draft.push({ id: UNCAT, name: 'Chưa phân loại', color: '#6E7681', locked: true });
          const ids = new Set(draft.map((c) => c.id));
          commands.forEach((c) => { if (!ids.has(c.categoryId)) c.categoryId = UNCAT; });
          categories = draft;
          save();
          close();
          renderAll();
          toast('Đã lưu danh mục', 'ok');
        }
      }, 'Lưu'))
  );
  const close = openModal(node);
}

// ===========================================================================
// Modal
// ===========================================================================
let modalClose = null;
function openModal(node, onClose) {
  if (modalClose) modalClose();
  const root = $('#modalRoot');
  const prevFocus = document.activeElement;
  root.replaceChildren(h('div', { class: 'backdrop' }, node));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.replaceChildren();
    modalClose = null;
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (onClose) onClose();
  };
  modalClose = close;
  setTimeout(() => {
    if (closed) return;
    const f = node.querySelector('[autofocus]') || node.querySelector('input, select, button');
    if (f) f.focus();
  });
  return close;
}

// ===========================================================================
// Xuất / nhập dữ liệu (JSON)
// ===========================================================================
const BACKUP_APP = 'cmd-manager';
const BACKUP_VERSION = 1;

async function exportData() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  const data = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    categories,
    commands
  };
  const res = await api.exportData(JSON.stringify(data, null, 2), `cmd-manager-backup-${stamp}.json`);
  if (res && res.ok) toast(`Đã xuất ${commands.length} lệnh, ${categories.length - 1} danh mục`, 'ok');
  else if (res && res.error) toast(`Không xuất được: ${res.error}`, 'error');
}

/** Kiểm tra + chuẩn hoá dữ liệu từ file; ném lỗi tiếng Việt nếu sai định dạng */
function parseBackup(text) {
  let raw;
  try { raw = JSON.parse(text); } catch { throw new Error('File không phải JSON hợp lệ'); }
  if (!raw || typeof raw !== 'object') throw new Error('File không đúng định dạng');
  if (raw.app && raw.app !== BACKUP_APP) throw new Error('File không phải bản sao lưu của CMD Manager');
  const cats = Array.isArray(raw.categories) ? raw.categories : [];
  const cmds = Array.isArray(raw.commands) ? raw.commands : null;
  if (!cmds) throw new Error('File không có danh sách lệnh (commands)');

  const outCats = cats
    .filter((c) => c && typeof c.id === 'string' && c.id)
    .map((c) => ({
      id: c.id,
      name: String(c.name || 'Không tên').trim() || 'Không tên',
      color: /^#[0-9a-f]{6}$/i.test(c.color || '') ? c.color : PALETTE[0],
      ...(c.id === UNCAT ? { locked: true } : {})
    }));
  const outCmds = cmds
    .filter((c) => c && typeof c === 'object')
    .map((c) => ({
      id: typeof c.id === 'string' && c.id ? c.id : uid(),
      name: String(c.name || 'Không tên').trim() || 'Không tên',
      categoryId: typeof c.categoryId === 'string' ? c.categoryId : UNCAT,
      cwd: String(c.cwd || ''),
      steps: (Array.isArray(c.steps) ? c.steps : []).map((s) => String(s)).filter((s) => s.trim()),
      shell: typeof c.shell === 'string' && c.shell ? c.shell : 'cmd',
      admin: !!c.admin,
      stopOnError: c.stopOnError !== false,
      clearOnRun: !!c.clearOnRun
    }));
  return { categories: outCats, commands: outCmds, exportedAt: raw.exportedAt };
}

function applyImport(data, mode) {
  let cats;
  let cmds;
  if (mode === 'replace') {
    cats = data.categories.slice();
    cmds = data.commands.slice();
  } else {
    // Gộp: trùng id thì lấy bản trong file, còn lại giữ nguyên
    cats = categories.slice();
    for (const c of data.categories) {
      const i = cats.findIndex((x) => x.id === c.id);
      if (i >= 0) cats[i] = { ...cats[i], ...c };
      else cats.splice(Math.max(0, cats.findIndex((x) => x.id === UNCAT)), 0, c);
    }
    cmds = commands.slice();
    for (const c of data.commands) {
      const i = cmds.findIndex((x) => x.id === c.id);
      if (i >= 0) cmds[i] = c;
      else cmds.push(c);
    }
  }
  if (!cats.some((c) => c.id === UNCAT)) cats.push({ id: UNCAT, name: 'Chưa phân loại', color: '#6E7681', locked: true });
  const ids = new Set(cats.map((c) => c.id));
  cmds.forEach((c) => { if (!ids.has(c.categoryId)) c.categoryId = UNCAT; });

  categories = cats;
  commands = cmds;
  // bỏ trạng thái của các lệnh không còn tồn tại (trừ lệnh đang chạy)
  for (const id of Object.keys(runtime)) {
    if (!byId(id) && runtime[id].status !== 'running') delete runtime[id];
  }
  if (ui.selectedId && !byId(ui.selectedId)) ui.selectedId = null;
  if (!ui.selectedId && commands.length) ui.selectedId = commands[0].id;
  save();
  saveUi();
  renderAll();
}

async function importData() {
  const res = await api.importData();
  if (!res || res.canceled) return;
  if (!res.ok) { toast(`Không đọc được file: ${res.error}`, 'error'); return; }

  let data;
  try { data = parseBackup(res.text); } catch (e) { toast(e.message, 'error'); return; }

  const userCats = data.categories.filter((c) => c.id !== UNCAT).length;
  const dupes = data.commands.filter((c) => byId(c.id)).length;
  const running = commands.filter((c) => rt(c.id).status === 'running').length;
  let mode = 'merge';

  const radio = (value, title, desc) => h('label', { class: 'mode' },
    h('input', { type: 'radio', name: 'import-mode', value, checked: value === mode, onChange: () => { mode = value; } }),
    h('div', null, h('b', null, title), h('span', null, desc)));

  const close = openModal(
    h('div', { class: 'modal md', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' },
        h('div', null, h('h2', null, 'Nhập dữ liệu'), h('div', { class: 'sub' }, 'Từ file sao lưu JSON')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Đóng', onClick: () => close() }, icon('x', 16))),
      h('div', { class: 'modal-body' },
        h('div', { class: 'import-summary' },
          h('div', { class: 'file' }, res.path),
          h('div', null, `${data.commands.length} lệnh · ${userCats} danh mục`,
            data.exportedAt ? ` · xuất lúc ${new Date(data.exportedAt).toLocaleString('vi-VN')}` : ''),
          dupes ? h('div', { style: { color: '#E3B341' } }, `${dupes} lệnh trùng với lệnh đang có (cùng id)`) : null),
        h('div', { class: 'mode-list' },
          radio('merge', 'Gộp vào dữ liệu hiện tại', 'Thêm lệnh và danh mục mới; mục trùng id sẽ được cập nhật theo file. Không xoá gì.'),
          radio('replace', 'Thay thế toàn bộ', `Xoá ${commands.length} lệnh và ${categories.length - 1} danh mục hiện có, dùng hoàn toàn dữ liệu trong file.`)),
        running ? h('span', { class: 'hint bad' }, `Đang có ${running} lệnh chạy; chúng vẫn tiếp tục chạy sau khi nhập.`) : null),
      h('div', { class: 'modal-foot' },
        h('button', { type: 'button', class: 'btn', onClick: () => close() }, 'Huỷ'),
        h('button', {
          type: 'button',
          class: 'btn primary',
          onClick: () => {
            applyImport(data, mode);
            close();
            toast(mode === 'replace' ? `Đã thay thế bằng ${data.commands.length} lệnh` : `Đã gộp ${data.commands.length} lệnh`, 'ok');
          }
        }, icon('upload', 15), 'Nhập'))
    )
  );
}

// ===========================================================================
// Khởi động
// ===========================================================================
function renderAll() {
  renderSidebar();
  renderDetail();
}

document.querySelectorAll('[data-icon]').forEach((el) => el.prepend(icon(el.dataset.icon, el.classList.contains('logo') ? 16 : 15)));

$('#btnNew').addEventListener('click', () => openEditor(null));

// Header mờ đi khi cửa sổ mất focus (giống thanh tiêu đề gốc)
window.addEventListener('blur', () => document.body.classList.add('win-blurred'));
window.addEventListener('focus', () => document.body.classList.remove('win-blurred'));
$('#btnCats').addEventListener('click', openCategories);
$('#btnToggleAll').addEventListener('click', toggleAllCategories);
$('#btnStopAll').addEventListener('click', stopAll);

// cập nhật thời gian chạy trên từng dòng ở sidebar
setInterval(() => {
  document.querySelectorAll('.item-meta[data-run]').forEach((el) => {
    const c = byId(el.dataset.run);
    if (c) el.textContent = itemMeta(c, rt(c.id));
  });
}, 1000);
$('#btnExport').addEventListener('click', exportData);
$('#btnImport').addEventListener('click', importData);
$('#search').addEventListener('input', (e) => { search = e.target.value; renderSidebar(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    if (e.repeat) return;
    if (modalClose) modalClose();
    else api.hideWindow();
    return;
  }
  if (modalClose) return;
  if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); openEditor(null); }
  if (e.ctrlKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); $('#search').focus(); }
});

if (ui.selectedId && !byId(ui.selectedId)) ui.selectedId = null;
if (!ui.selectedId && commands.length) ui.selectedId = commands[0].id;
renderAll();

// Quét môi trường thực thi + kiểm tra quyền admin (không chặn lần vẽ đầu tiên)
Promise.all([api.listShells(false), api.isAdmin()]).then(([list, admin]) => {
  shells = list || [];
  appIsAdmin = !!admin;
  if (appIsAdmin) $('#adminBadge').classList.remove('hidden');
  renderAll();
});
})();
