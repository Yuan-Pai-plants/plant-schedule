// ── 資材資料庫（預設值，可由 localStorage 覆蓋） ──────────────────
const DEFAULT_MATERIALS = [
  {
    priority: 1, name: '摩西菌根菌', category: '真菌',
    cycle: 90, safeInterval: 14,
    groups: ['root'],
    methods: { root: '根際戳洞倒入，需物理接觸活體根系' },
  },
  {
    priority: 2, name: '光合菌', category: '細菌',
    cycle: 14, safeInterval: 3,
    groups: ['spray'],
    methods: { spray: '葉面噴灑（含葉背）、莖部與土表噴灑' },
  },
  {
    priority: 3, name: '枯草桿菌', category: '細菌',
    cycle: 30, safeInterval: 5,
    groups: ['root', 'spray'],
    methods: { root: '稀釋後土灌', spray: '稀釋後葉面噴灑' },
  },
  {
    priority: 4, name: '菌利害', category: '複合菌',
    cycle: 30, safeInterval: 7,
    groups: ['root', 'spray'],
    methods: { root: '稀釋後土灌', spray: '稀釋後葉面噴灑' },
  },
  {
    priority: 5, name: '奈斯鈣鎂硼', category: '肥料',
    cycle: 14, safeInterval: 3,
    groups: ['root', 'spray'],
    methods: { root: '稀釋後土灌', spray: '稀釋後葉面噴灑' },
  },
  {
    priority: 6, name: '矽綠勇', category: '肥料',
    cycle: 14, safeInterval: 3,
    groups: ['root', 'spray'],
    methods: { root: '稀釋後土灌', spray: '稀釋後葉面噴灑' },
  },
];

// ── 日期工具 ─────────────────────────────────────────────────────
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// "YYYY-MM-DD" → Date（本地時區）
function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Date → "YYYY-MM-DD"
function toInputStr(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Date → "M/D"（跨年顯示 "YYYY/M/D"）
function displayDate(d) {
  if (d.getFullYear() !== today().getFullYear()) {
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── LocalStorage ─────────────────────────────────────────────────
const STORAGE_KEY = 'plantSchedule';

function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!raw) return emptyData();
    // 確保巢狀結構存在（相容舊版資料）
    if (!raw.lastApplied || !raw.lastApplied.root) {
      return { plantName: raw.plantName || '', lastApplied: { root: {}, spray: {} } };
    }
    return raw;
  } catch {
    return emptyData();
  }
}

function emptyData() {
  return { plantName: '', lastApplied: { root: {}, spray: {} } };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── 資材 LocalStorage ─────────────────────────────────────────────
const MATERIALS_KEY = 'plantMaterials';

function loadMaterials() {
  try {
    const raw = JSON.parse(localStorage.getItem(MATERIALS_KEY));
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {}
  return DEFAULT_MATERIALS.map(m => ({ ...m }));
}

function saveMaterials(mats) {
  localStorage.setItem(MATERIALS_KEY, JSON.stringify(mats));
}

// ── 排程演算法（每組獨立執行） ─────────────────────────────────────
//
// Phase 1: 原始 nextDate
//   - 已施作 → lastDate + cycle
//   - 未施作 → today
//
// Phase 2: 已施作項目的安全間隔封鎖
//   每個已施作項目 X，會封鎖同組其他項目直到 X.lastDate + X.safeInterval
//
// Phase 3: 排序
//   nextDate 升冪；同日依 priority 升冪
//   （priority 對從未施作的項目有排序意義；已施作項目靠 nextDate 自然排）
//
// Phase 4: 鏈式遞延
//   順序走過每個項目：item[i].nextDate >= item[i-1].nextDate + item[i-1].safeInterval
//   即「前一個項目若在其 nextDate 施作，其安全間隔會影響下一個」
//
function computeGroupSchedule(groupKey, data) {
  const t              = today();
  const lastAppliedMap = (data.lastApplied && data.lastApplied[groupKey]) || {};
  const items          = loadMaterials().filter(m => m.groups && m.groups.includes(groupKey));

  // Phase 1
  const entries = items.map(m => {
    const lastStr  = lastAppliedMap[m.name];
    const lastDate = lastStr ? parseDate(lastStr) : null;
    const nextDate = lastDate ? addDays(lastDate, m.cycle) : new Date(t);
    return { ...m, lastDate, nextDate: new Date(nextDate), method: m.methods[groupKey] };
  });

  // Phase 2
  entries.forEach(x => {
    if (!x.lastDate) return;
    const blockUntil = addDays(x.lastDate, x.safeInterval);
    entries.forEach(y => {
      if (y.name === x.name) return;
      if (y.nextDate < blockUntil) y.nextDate = new Date(blockUntil);
    });
  });

  // Phase 3
  entries.sort((a, b) => {
    const diff = a.nextDate - b.nextDate;
    return diff !== 0 ? diff : a.priority - b.priority;
  });

  // Phase 4
  for (let i = 1; i < entries.length; i++) {
    const prev     = entries[i - 1];
    const chainMin = addDays(prev.nextDate, prev.safeInterval);
    if (entries[i].nextDate < chainMin) entries[i].nextDate = new Date(chainMin);
  }

  return entries;
}

// ── 渲染 ──────────────────────────────────────────────────────────
function renderGroup(groupKey, data) {
  const schedule = computeGroupSchedule(groupKey, data);
  const t        = today();
  const current  = schedule[0];

  // 主行動卡片
  document.getElementById(`name-${groupKey}`).textContent = current.name;

  const earliestEl = document.getElementById(`earliest-${groupKey}`);
  earliestEl.textContent = current.nextDate > t
    ? `最早可施作：${displayDate(current.nextDate)}`
    : '';

  // 日期輸入預設今日（若空白）
  const dateInput = document.getElementById(`date-${groupKey}`);
  if (!dateInput.value) dateInput.value = toInputStr(t);

  // 排程清單（3 欄，跳過目前行動卡片已顯示的第一項）
  const tbody = document.getElementById(`tbody-${groupKey}`);
  tbody.innerHTML = '';
  schedule.slice(1).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="item-name">${item.name}</div>
        <div class="item-cat">${item.category}</div>
      </td>
      <td>${item.lastDate ? displayDate(item.lastDate) : '—'}</td>
      <td>${displayDate(item.nextDate)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function render() {
  const data   = loadData();
  const nameEl = document.getElementById('plant-name-display');

  if (data.plantName) {
    nameEl.textContent = data.plantName;
    nameEl.classList.remove('empty');
  } else {
    nameEl.textContent = '點擊設定植物名稱';
    nameEl.classList.add('empty');
  }

  renderGroup('root',  data);
  renderGroup('spray', data);
}

// ── 資材管理表格 ──────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderMaterialsTable() {
  const mats  = loadMaterials();
  const data  = loadData();
  const tbody = document.getElementById('materials-tbody');
  tbody.innerHTML = '';

  mats.forEach((m, idx) => {
    const lastRoot  = data.lastApplied.root[m.name]  || '';
    const lastSpray = data.lastApplied.spray[m.name] || '';
    const hasRoot   = m.groups && m.groups.includes('root');
    const hasSpray  = m.groups && m.groups.includes('spray');

    const tr = document.createElement('tr');
    tr.dataset.index = idx;
    tr.dataset.name  = m.name;
    tr.innerHTML = `
      <td><input type="text"   class="mat-input mat-name"     value="${escapeHtml(m.name)}"     placeholder="名稱"></td>
      <td><input type="text"   class="mat-input mat-cat"      value="${escapeHtml(m.category)}" placeholder="類別"></td>
      <td><input type="number" class="mat-input mat-cycle"    value="${m.cycle}"        min="1"></td>
      <td><input type="number" class="mat-input mat-interval" value="${m.safeInterval}" min="0"></td>
      <td><label class="mat-date-label">
        <input type="checkbox" class="mat-root" ${hasRoot ? 'checked' : ''}>
        <input type="date" class="mat-date mat-last-root" value="${lastRoot}" ${!hasRoot ? 'disabled' : ''}>
      </label></td>
      <td><label class="mat-date-label">
        <input type="checkbox" class="mat-spray" ${hasSpray ? 'checked' : ''}>
        <input type="date" class="mat-date mat-last-spray" value="${lastSpray}" ${!hasSpray ? 'disabled' : ''}>
      </label></td>
      <td><button class="icon-btn mat-del-btn" title="刪除">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// ── 事件（統一用委派避免重複綁定） ────────────────────────────────
document.getElementById('app').addEventListener('click', e => {
  // 確認送出
  const confirmBtn = e.target.closest('.confirm-btn');
  if (confirmBtn) {
    const group   = confirmBtn.dataset.group;
    const dateVal = document.getElementById(`date-${group}`).value;
    if (!dateVal) return;

    const data     = loadData();
    const schedule = computeGroupSchedule(group, data);
    const current  = schedule[0];

    data.lastApplied[group][current.name] = dateVal;
    saveData(data);
    document.getElementById(`date-${group}`).value = '';
    render();
    renderMaterialsTable();
    return;
  }

});

// 植物名稱
function openNameModal() {
  document.getElementById('plant-name-input').value = loadData().plantName || '';
  document.getElementById('name-modal').classList.remove('hidden');
  document.getElementById('plant-name-input').focus();
}
document.getElementById('edit-name-btn').addEventListener('click', openNameModal);
document.getElementById('plant-name-display').addEventListener('click', openNameModal);

document.getElementById('save-name-btn').addEventListener('click', () => {
  const data     = loadData();
  data.plantName = document.getElementById('plant-name-input').value.trim();
  saveData(data);
  document.getElementById('name-modal').classList.add('hidden');
  render();
});
document.getElementById('cancel-name-btn').addEventListener('click', () => {
  document.getElementById('name-modal').classList.add('hidden');
});
document.getElementById('plant-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('save-name-btn').click();
});
document.querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('name-modal').classList.add('hidden');
});

// 匯出
document.getElementById('export-btn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...loadData(), plantMaterials: loadMaterials() }, null, 2)], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `plant-schedule-${toInputStr(today())}.json`;
  a.click();
});

// 匯入
document.getElementById('import-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (typeof data !== 'object' || typeof data.lastApplied !== 'object') throw new Error();
      data.lastApplied.root  = data.lastApplied.root  || {};
      data.lastApplied.spray = data.lastApplied.spray || {};
      if (Array.isArray(data.plantMaterials) && data.plantMaterials.length) {
        saveMaterials(data.plantMaterials);
      }
      const { plantMaterials, ...scheduleData } = data;
      saveData(scheduleData);
      render();
      renderMaterialsTable();
      alert('匯入成功！');
    } catch {
      alert('匯入失敗：檔案格式不正確。');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// 資材表格 — 編輯
document.getElementById('materials-tbody').addEventListener('change', e => {
  const tr = e.target.closest('tr');
  if (!tr) return;

  const idx     = parseInt(tr.dataset.index);
  const oldName = tr.dataset.name;
  const mats    = loadMaterials();
  const data    = loadData();

  const newName = tr.querySelector('.mat-name').value.trim();

  // 名稱變更時同步 lastApplied key
  if (newName && newName !== oldName) {
    ['root', 'spray'].forEach(g => {
      if (data.lastApplied[g][oldName] !== undefined) {
        data.lastApplied[g][newName] = data.lastApplied[g][oldName];
        delete data.lastApplied[g][oldName];
      }
    });
    tr.dataset.name = newName;
  }

  const hasRoot  = tr.querySelector('.mat-root').checked;
  const hasSpray = tr.querySelector('.mat-spray').checked;
  const groups   = [...(hasRoot ? ['root'] : []), ...(hasSpray ? ['spray'] : [])];
  const name     = newName || oldName;

  mats[idx] = {
    ...mats[idx],
    name,
    category:     tr.querySelector('.mat-cat').value.trim(),
    cycle:        Math.max(1, parseInt(tr.querySelector('.mat-cycle').value)    || 1),
    safeInterval: Math.max(0, parseInt(tr.querySelector('.mat-interval').value) || 0),
    groups,
    priority: idx + 1,
  };

  // 上次施作日期
  const lastRootVal  = tr.querySelector('.mat-last-root').value;
  const lastSprayVal = tr.querySelector('.mat-last-spray').value;
  if (hasRoot)  { if (lastRootVal)  data.lastApplied.root[name]  = lastRootVal;  else delete data.lastApplied.root[name];  }
  else            { delete data.lastApplied.root[name]; }
  if (hasSpray) { if (lastSprayVal) data.lastApplied.spray[name] = lastSprayVal; else delete data.lastApplied.spray[name]; }
  else            { delete data.lastApplied.spray[name]; }

  // 同步 disabled 狀態
  tr.querySelector('.mat-last-root').disabled  = !hasRoot;
  tr.querySelector('.mat-last-spray').disabled = !hasSpray;

  saveMaterials(mats);
  saveData(data);
  render();
});

// 資材表格 — 刪除
document.getElementById('materials-tbody').addEventListener('click', e => {
  const btn = e.target.closest('.mat-del-btn');
  if (!btn) return;

  const tr   = btn.closest('tr');
  const idx  = parseInt(tr.dataset.index);
  const name = tr.dataset.name;
  const mats = loadMaterials();

  mats.splice(idx, 1);
  mats.forEach((m, i) => { m.priority = i + 1; });

  const data = loadData();
  delete data.lastApplied.root[name];
  delete data.lastApplied.spray[name];

  saveMaterials(mats);
  saveData(data);
  renderMaterialsTable();
  render();
});

// 資材表格 — 新增
document.getElementById('add-material-btn').addEventListener('click', () => {
  const mats = loadMaterials();
  mats.push({
    priority: mats.length + 1,
    name: '', category: '',
    cycle: 14, safeInterval: 3,
    groups: ['root', 'spray'],
    methods: {},
  });
  saveMaterials(mats);
  renderMaterialsTable();
  const rows = document.querySelectorAll('#materials-tbody tr');
  if (rows.length) rows[rows.length - 1].querySelector('.mat-name').focus();
});

// ── 初始化 ────────────────────────────────────────────────────────
render();
renderMaterialsTable();
