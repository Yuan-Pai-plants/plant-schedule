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

// ── 多頁籤管理 ─────────────────────────────────────────────────────
const TABS_META_KEY = 'plantTabs';     // 儲存頁籤清單 + activeId
const TAB_PREFIX    = 'plantTab_';     // 每個頁籤的 schedule data prefix
const MAT_PREFIX    = 'plantMat_';     // 每個頁籤的 materials prefix

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function loadTabsMeta() {
  try {
    const raw = JSON.parse(localStorage.getItem(TABS_META_KEY));
    if (raw && Array.isArray(raw.tabs) && raw.tabs.length > 0) return raw;
  } catch {}
  return null;
}

function saveTabsMeta(meta) {
  localStorage.setItem(TABS_META_KEY, JSON.stringify(meta));
}

// 遷移舊版單植物資料到第一個頁籤
function migrateFromLegacy() {
  const legacy = localStorage.getItem('plantSchedule');
  const legacyMats = localStorage.getItem('plantMaterials');

  const firstId = generateId();
  let plantName = '';
  let scheduleData = emptyData();
  let materialsData = null;

  if (legacy) {
    try {
      const parsed = JSON.parse(legacy);
      plantName = parsed.plantName || '';
      scheduleData = {
        plantName,
        lastApplied: {
          root:  (parsed.lastApplied && parsed.lastApplied.root)  || {},
          spray: (parsed.lastApplied && parsed.lastApplied.spray) || {},
        },
      };
    } catch {}
  }
  if (legacyMats) {
    try {
      const parsed = JSON.parse(legacyMats);
      if (Array.isArray(parsed) && parsed.length > 0) materialsData = parsed;
    } catch {}
  }

  const meta = {
    activeId: firstId,
    tabs: [{ id: firstId, name: plantName || '植物 1' }],
  };
  saveTabsMeta(meta);
  localStorage.setItem(TAB_PREFIX + firstId, JSON.stringify(scheduleData));
  if (materialsData) {
    localStorage.setItem(MAT_PREFIX + firstId, JSON.stringify(materialsData));
  }

  // 清除舊 key
  localStorage.removeItem('plantSchedule');
  localStorage.removeItem('plantMaterials');

  return meta;
}

function ensureTabsMeta() {
  let meta = loadTabsMeta();
  if (!meta) {
    // 嘗試遷移舊版
    meta = migrateFromLegacy();
  }
  return meta;
}

// ── 目前頁籤的 Data / Materials ─────────────────────────────────────
function getActiveTabId() {
  return ensureTabsMeta().activeId;
}

function loadData() {
  const tabId = getActiveTabId();
  try {
    const raw = JSON.parse(localStorage.getItem(TAB_PREFIX + tabId));
    if (!raw) return emptyData();
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
  const tabId = getActiveTabId();
  localStorage.setItem(TAB_PREFIX + tabId, JSON.stringify(data));

  // 同步頁籤名稱
  const meta = ensureTabsMeta();
  const tab = meta.tabs.find(t => t.id === tabId);
  if (tab && data.plantName) {
    tab.name = data.plantName;
    saveTabsMeta(meta);
    renderTabs();
  }
}

function loadMaterials() {
  const tabId = getActiveTabId();
  try {
    const raw = JSON.parse(localStorage.getItem(MAT_PREFIX + tabId));
    if (Array.isArray(raw) && raw.length > 0) return raw;
  } catch {}
  return DEFAULT_MATERIALS.map(m => ({ ...m }));
}

function saveMaterials(mats) {
  const tabId = getActiveTabId();
  localStorage.setItem(MAT_PREFIX + tabId, JSON.stringify(mats));
}

// ── 頁籤操作 ──────────────────────────────────────────────────────
function addTab() {
  const meta = ensureTabsMeta();
  const newId = generateId();
  const n = meta.tabs.length + 1;
  meta.tabs.push({ id: newId, name: `植物 ${n}` });
  meta.activeId = newId;
  saveTabsMeta(meta);
  localStorage.setItem(TAB_PREFIX + newId, JSON.stringify(emptyData()));
  fullRender();
}

function switchTab(tabId) {
  const meta = ensureTabsMeta();
  if (meta.activeId === tabId) return;
  meta.activeId = tabId;
  saveTabsMeta(meta);
  fullRender();
}

let _pendingDeleteId = null;

function requestDeleteTab(tabId) {
  const meta = ensureTabsMeta();
  if (meta.tabs.length <= 1) return; // 至少保留一個頁籤

  const tab = meta.tabs.find(t => t.id === tabId);
  const name = tab ? tab.name : '此頁籤';
  document.getElementById('delete-tab-msg').textContent =
    `確定要刪除「${name}」及其所有資料嗎？此操作無法復原。`;
  _pendingDeleteId = tabId;
  document.getElementById('delete-tab-modal').classList.remove('hidden');
}

function confirmDeleteTab() {
  if (!_pendingDeleteId) return;
  const meta = ensureTabsMeta();
  const idx = meta.tabs.findIndex(t => t.id === _pendingDeleteId);
  if (idx === -1) return;

  // 清除該頁籤的資料
  localStorage.removeItem(TAB_PREFIX + _pendingDeleteId);
  localStorage.removeItem(MAT_PREFIX + _pendingDeleteId);
  meta.tabs.splice(idx, 1);

  // 若刪除的是 active tab，切到前一個或後一個
  if (meta.activeId === _pendingDeleteId) {
    meta.activeId = meta.tabs[Math.min(idx, meta.tabs.length - 1)].id;
  }
  saveTabsMeta(meta);

  _pendingDeleteId = null;
  document.getElementById('delete-tab-modal').classList.add('hidden');
  fullRender();
}

function cancelDeleteTab() {
  _pendingDeleteId = null;
  document.getElementById('delete-tab-modal').classList.add('hidden');
}

// ── 渲染頁籤列 ─────────────────────────────────────────────────────
function renderTabs() {
  const meta = ensureTabsMeta();
  const scroll = document.getElementById('tab-scroll');
  scroll.innerHTML = '';

  meta.tabs.forEach(tab => {
    const isActive = tab.id === meta.activeId;
    const tabEl = document.createElement('div');
    tabEl.className = `tab-item${isActive ? ' tab-active' : ''}`;
    tabEl.dataset.tabId = tab.id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.name || '未命名';
    label.addEventListener('click', () => switchTab(tab.id));

    tabEl.appendChild(label);

    // 僅在有超過一個頁籤時顯示刪除按鈕
    if (meta.tabs.length > 1) {
      const delBtn = document.createElement('button');
      delBtn.className = 'tab-del-btn';
      delBtn.title = '刪除此頁籤';
      delBtn.textContent = '✕';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        requestDeleteTab(tab.id);
      });
      tabEl.appendChild(delBtn);
    }

    scroll.appendChild(tabEl);
  });

  // 確保 active tab 可見
  requestAnimationFrame(() => {
    const activeEl = scroll.querySelector('.tab-active');
    if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  });
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
// Phase 4: 迭代模擬
//   每輪挑出 nextDate 最早的項目，模擬施作它並記錄安全間隔封鎖，
//   重新計算剩餘項目的 nextDate 後再排序，如此反覆。
//   解決單次鏈式遞延忽略「施作後可能重新排序」的問題。
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

  // Phase 3（初始排序，為迭代模擬提供起始順序）
  entries.sort((a, b) => {
    const diff = a.nextDate - b.nextDate;
    return diff !== 0 ? diff : a.priority - b.priority;
  });

  // Phase 4: 迭代模擬
  const schedule  = [];
  const remaining = entries.map(e => ({ ...e, baseNext: new Date(e.nextDate) }));
  const simBlocks = [];

  while (remaining.length) {
    // 從 baseNext 重算，套用所有模擬封鎖
    remaining.forEach(item => {
      item.nextDate = new Date(item.baseNext);
      simBlocks.forEach(b => {
        if (b.name !== item.name && item.nextDate < b.until)
          item.nextDate = new Date(b.until);
      });
    });

    // 排序：nextDate 升冪，同日依 priority
    remaining.sort((a, b) => (a.nextDate - b.nextDate) || (a.priority - b.priority));

    // 取出第一個，加入模擬封鎖
    const next = remaining.shift();
    schedule.push(next);
    simBlocks.push({ name: next.name, until: addDays(next.nextDate, next.safeInterval) });
  }

  return schedule;
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
    tr.draggable = true;
    tr.dataset.index = idx;
    tr.dataset.name  = m.name;
    tr.innerHTML = `
      <td class="mat-drag-handle" title="拖曳排序">⠿</td>
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

// ── 資材表格拖拉排序 ──────────────────────────────────────────────
let matDragIdx = null;
let _matDragFromHandle = false;

function clearMatDrag() {
  document.getElementById('materials-tbody').querySelectorAll('tr').forEach(row => {
    row.classList.remove('mat-dragging', 'mat-drop-above', 'mat-drop-below');
    row.style.transform = '';
  });
}

function initMatDragDrop() {
  const tbody = document.getElementById('materials-tbody');

  tbody.addEventListener('mousedown', e => {
    _matDragFromHandle = !!e.target.closest('.mat-drag-handle');
  });

  tbody.addEventListener('dragstart', e => {
    if (!_matDragFromHandle) { e.preventDefault(); return; }
    const tr = e.target.closest('tr[draggable]');
    if (!tr) return;
    matDragIdx = parseInt(tr.dataset.index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
    requestAnimationFrame(() => tr.classList.add('mat-dragging'));
  });

  tbody.addEventListener('dragover', e => {
    e.preventDefault();
    if (matDragIdx === null) return;
    const tr = e.target.closest('tr[draggable]');
    if (!tr) return;
    const targetIdx = parseInt(tr.dataset.index);
    if (targetIdx === matDragIdx) return;

    const rect = tr.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;

    tbody.querySelectorAll('.mat-drop-above, .mat-drop-below')
         .forEach(r => r.classList.remove('mat-drop-above', 'mat-drop-below'));
    tr.classList.add(insertBefore ? 'mat-drop-above' : 'mat-drop-below');
  });

  tbody.addEventListener('dragleave', e => {
    if (!tbody.contains(e.relatedTarget)) clearMatDrag();
  });

  tbody.addEventListener('drop', e => {
    e.preventDefault();
    if (matDragIdx === null) return;
    const tr = e.target.closest('tr[draggable]');
    if (!tr) return;

    const targetIdx = parseInt(tr.dataset.index);
    const rect      = tr.getBoundingClientRect();
    const insertPos = e.clientY < rect.top + rect.height / 2 ? targetIdx : targetIdx + 1;
    const finalPos  = insertPos > matDragIdx ? insertPos - 1 : insertPos;

    clearMatDrag();

    if (finalPos !== matDragIdx) {
      const mats = loadMaterials();
      const [removed] = mats.splice(matDragIdx, 1);
      mats.splice(finalPos, 0, removed);
      mats.forEach((m, i) => { m.priority = i + 1; });
      saveMaterials(mats);
      renderMaterialsTable();
      render();
    }
    matDragIdx = null;
  });

  tbody.addEventListener('dragend', () => {
    clearMatDrag();
    matDragIdx = null;
    _matDragFromHandle = false;
  });
}

// ── fullRender: 一次重繪所有（頁籤切換後呼叫） ──────────────────────
function fullRender() {
  renderTabs();
  render();
  renderMaterialsTable();
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

// 頁籤操作
document.getElementById('add-tab-btn').addEventListener('click', addTab);
document.getElementById('confirm-delete-btn').addEventListener('click', confirmDeleteTab);
document.getElementById('cancel-delete-btn').addEventListener('click', cancelDeleteTab);
document.querySelector('.delete-backdrop').addEventListener('click', cancelDeleteTab);

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
  renderTabs(); // 同步更新頁籤名稱
});
document.getElementById('cancel-name-btn').addEventListener('click', () => {
  document.getElementById('name-modal').classList.add('hidden');
});
document.getElementById('plant-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('save-name-btn').click();
});
document.querySelector('.modal-backdrop:not(.delete-backdrop)').addEventListener('click', () => {
  document.getElementById('name-modal').classList.add('hidden');
});

// 匯出（包含所有頁籤）
document.getElementById('export-btn').addEventListener('click', () => {
  const meta = ensureTabsMeta();
  const exportData = {
    _version: 2,
    _exportDate: toInputStr(today()),
    tabs: meta.tabs.map(tab => {
      let scheduleData = emptyData();
      let materialsData = null;
      try {
        scheduleData = JSON.parse(localStorage.getItem(TAB_PREFIX + tab.id)) || emptyData();
      } catch {}
      try {
        const raw = JSON.parse(localStorage.getItem(MAT_PREFIX + tab.id));
        if (Array.isArray(raw) && raw.length > 0) materialsData = raw;
      } catch {}
      return {
        id: tab.id,
        name: tab.name,
        schedule: scheduleData,
        materials: materialsData,
      };
    }),
    activeId: meta.activeId,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
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

      // 新版多頁籤格式
      if (data._version === 2 && Array.isArray(data.tabs)) {
        // 清除現有頁籤資料
        const oldMeta = loadTabsMeta();
        if (oldMeta) {
          oldMeta.tabs.forEach(t => {
            localStorage.removeItem(TAB_PREFIX + t.id);
            localStorage.removeItem(MAT_PREFIX + t.id);
          });
        }

        const newMeta = {
          activeId: data.activeId || data.tabs[0].id,
          tabs: data.tabs.map(t => ({ id: t.id, name: t.name })),
        };
        saveTabsMeta(newMeta);
        data.tabs.forEach(t => {
          localStorage.setItem(TAB_PREFIX + t.id, JSON.stringify(t.schedule || emptyData()));
          if (t.materials) localStorage.setItem(MAT_PREFIX + t.id, JSON.stringify(t.materials));
        });
        fullRender();
        alert('匯入成功！');
        e.target.value = '';
        return;
      }

      // 舊版單植物格式相容
      if (typeof data === 'object' && typeof data.lastApplied === 'object') {
        data.lastApplied.root  = data.lastApplied.root  || {};
        data.lastApplied.spray = data.lastApplied.spray || {};

        // 儲存到目前作用的頁籤
        const scheduleData = {
          plantName: data.plantName || '',
          lastApplied: data.lastApplied,
        };
        saveData(scheduleData);

        if (Array.isArray(data.plantMaterials) && data.plantMaterials.length) {
          saveMaterials(data.plantMaterials);
        }

        fullRender();
        alert('匯入成功！（舊版格式已匯入至目前頁籤）');
        e.target.value = '';
        return;
      }

      throw new Error('格式不正確');
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
ensureTabsMeta();
fullRender();
initMatDragDrop();
