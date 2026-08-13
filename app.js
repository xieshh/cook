/* ============================================================
 * 今天吃什么 · 两个人的家常菜
 * 纯前端单页应用：搜索/分类/随机/收藏/做过/买菜清单/食材找菜/自定义/坚果云同步
 * ============================================================ */

const STORE_KEY = 'zycp_data_v1';
const SYNC_FILE = '/dav/zycp/data.json';

const CATEGORIES = ['全部', '荤菜', '素菜', '凉菜', '汤羹', '主食', '海鲜', '蛋豆制品', '甜品'];

/* ---------------- 本地数据 ---------------- */
let data = {
  favorites: [],        // 菜id数组
  history: [],          // [{id, name, date}]
  customRecipes: [],    // 自定义菜谱
  grocery: [],          // [{key, name, amount, unit, fromId, bought}]
  theme: 'light',
  sync: { url: 'https://dav.jianguoyun.com/dav', user: '', pass: '', path: 'zycp/data.json', enabled: false }
};

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) data = Object.assign(data, JSON.parse(raw));
  } catch (e) { console.warn('loadLocal failed', e); }
}
function saveLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { console.warn(e); }
}

function getRecipes() {
  return window.RECIPES.concat(data.customRecipes.map(r => Object.assign({ custom: true }, r)));
}
function findRecipe(id) { return getRecipes().find(r => r.id === id); }
function isFav(id) { return data.favorites.indexOf(id) !== -1; }
function doneBefore(id, days) {
  const t = Date.now() - days * 864e5;
  return data.history.some(h => h.id === id && new Date(h.date).getTime() > t);
}

/* ---------------- 基础渲染 ---------------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

let curCat = '全部', curFlavor = '', curTime = '', curDiff = '';
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 1800);
}

/* ---------------- 分类 / 筛选 ---------------- */
function renderCats() {
  const el = $('#catTabs');
  el.innerHTML = CATEGORIES.map(c =>
    `<button class="cat-tab ${c === curCat ? 'active' : ''}" data-cat="${c}">${c}</button>`).join('');
}
function fillFilters() {
  const flavors = new Set();
  const diffs = new Set();
  getRecipes().forEach(r => {
    if (r.flavor) r.flavor.split(/[、,，/]/).forEach(f => f.trim() && flavors.add(f.trim()));
    diffs.add(r.difficulty);
  });
  const f = $('#filterFlavor');
  f.innerHTML = '<option value="">口味:全部</option>' + Array.from(flavors).map(v => `<option>${v}</option>`).join('');
  const d = $('#filterDiff');
  d.innerHTML = '<option value="">难度:全部</option>' +
    '<option value="1">简单</option><option value="2">一般</option><option value="3">稍难</option><option value="4">较难</option><option value="5">挑战</option>';
}
function timeBucket(t) {
  if (t <= 15) return '1'; if (t <= 30) return '2'; if (t <= 60) return '3'; return '4';
}
function matchesFilters(r) {
  if (curCat !== '全部' && r.category !== curCat) return false;
  if (curFlavor && !(r.flavor || '').includes(curFlavor)) return false;
  if (curTime && timeBucket(r.time) !== curTime) return false;
  if (curDiff && r.difficulty !== parseInt(curDiff)) return false;
  return true;
}
function renderList() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const list = getRecipes().filter(r => {
    if (!matchesFilters(r)) return false;
    if (!q) return true;
    const hay = [r.name, r.category, r.flavor || '', (r.tags || []).join(' '),
      (r.ingredients || []).map(i => i.n).join(' '), (r.steps || []).join(' ')].join(' ').toLowerCase();
    return q.split(/\s+/).every(k => hay.includes(k));
  });
  $('#listEmpty').classList.toggle('hidden', list.length > 0);
  $('#recipeList').innerHTML = list.map(cardHTML).join('');
}
function cardHTML(r) {
  const fav = isFav(r.id);
  return `<div class="recipe-card" data-id="${r.id}">
    <div class="r-main">
      <div class="r-name">${r.name}${doneBefore(r.id, 7) ? ' <span class="tag">最近吃过</span>' : ''}</div>
      <div class="r-meta">
        <span class="tag cat">${r.category}</span>
        <span class="tag">${'★'.repeat(r.difficulty)}${'☆'.repeat(5 - r.difficulty)}</span>
        <span class="tag">⏱ ${r.time}分钟</span>
        ${r.flavor ? `<span class="tag">${r.flavor}</span>` : ''}
      </div>
    </div>
    <button class="fav-btn ${fav ? 'on' : ''}" data-fav="${r.id}">${fav ? '❤️' : '🤍'}</button>
  </div>`;
}

/* ---------------- 详情 ---------------- */
let detailId = null, detailServings = 2;
function calcAmount(amount, factor) {
  const m = String(amount).trim();
  if (/^[\d.]+\/[\d.]+$/.test(m)) { const [a, b] = m.split('/'); return +(parseFloat(a) / parseFloat(b) * factor).toFixed(1); }
  const n = parseFloat(m);
  if (isNaN(n)) return m;
  const v = n * factor;
  return Number.isInteger(v) ? v : +v.toFixed(1);
}
function showDetail(id) {
  const r = findRecipe(id);
  if (!r) return;
  detailId = id;
  detailServings = r.servings || 2;
  const fav = isFav(id), done = doneBefore(id, 1);
  const factor = detailServings / (r.servings || 2);
  $('#detailBody').innerHTML = `
    <div class="d-title">${r.name}</div>
    <div class="d-meta">
      <span class="tag cat">${r.category}</span>
      <span class="tag">${'★'.repeat(r.difficulty)}${'☆'.repeat(5 - r.difficulty)}</span>
      <span class="tag">⏱ ${r.time}分钟</span>
      ${r.flavor ? `<span class="tag">${r.flavor}</span>` : ''}
      ${r.custom ? '<span class="tag">我的拿手菜</span>' : ''}
    </div>
    <div class="d-actions">
      <button class="btn-big" id="dFav">${fav ? '❤️ 已收藏' : '🤍 收藏'}</button>
      <button class="btn-big btn-ghost" id="dDone">${done ? '✅ 今天做过' : '✔️ 做过了'}</button>
      <button class="btn-big btn-ghost" id="dCart">🛒 买菜清单</button>
    </div>
    <div class="d-section">
      <h4>🥬 食材（${detailServings}人份）</h4>
      <div class="servings-row">
        <button id="sMinus">−</button><span class="s-val">${detailServings}</span><button id="sPlus">＋</button>
        <span class="hint">人数可加减</span>
      </div>
      <table class="ing-table">${(r.ingredients || []).map(i => `
        <tr><td>${i.n}</td><td>${calcAmount(i.a, factor)}${i.u}</td></tr>`).join('')}</table>
    </div>
    <div class="d-section">
      <h4>👨‍🍳 做法</h4>
      ${(r.steps || []).map((s, i) => `<div class="step-item"><span class="step-num">${i + 1}</span><span>${s}</span></div>`).join('')}
    </div>
    ${r.tips ? `<div class="d-section"><h4>💡 小贴士</h4><div class="d-tips"><b>要点：</b>${r.tips}</div></div>` : ''}
  `;
  $('#detailOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeDetail() {
  $('#detailOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

/* ---------------- 收藏 / 做过 / 历史 ---------------- */
function toggleFav(id) {
  const i = data.favorites.indexOf(id);
  if (i === -1) { data.favorites.push(id); toast('已收藏 ❤️'); }
  else { data.favorites.splice(i, 1); toast('已取消收藏'); }
  saveLocal(); scheduleSync();
  renderList();
  const r = findRecipe(id);
  if (detailId === id && r) $('#dFav').textContent = isFav(id) ? '❤️ 已收藏' : '🤍 收藏';
}
function markDone(id) {
  const r = findRecipe(id); if (!r) return;
  const today = new Date().toISOString().slice(0, 10);
  const existing = data.history.find(h => h.id === id && h.date === today);
  if (!existing) {
    data.history.unshift({ id, name: r.name, date: today });
    if (data.history.length > 60) data.history.pop();
    toast('记好啦，今天吃了 ' + r.name);
  } else {
    data.history = data.history.filter(h => !(h.id === id && h.date === today));
    toast('已撤销今天的记录');
  }
  saveLocal(); scheduleSync();
  renderList(); renderHistory();
  if (detailId === id) $('#dDone').textContent = doneBefore(id, 1) ? '✅ 今天做过' : '✔️ 做过了';
}
function renderHistory() {
  const el = $('#historyList');
  const items = data.history.slice(0, 30);
  $('#historyEmpty').classList.toggle('hidden', items.length > 0);
  el.innerHTML = items.map(h => `<div class="history-item"><span>${h.name}</span><span class="h-date">${h.date}</span></div>`).join('');
}

/* ---------------- 买菜清单 ---------------- */
function addToGrocery(id) {
  const r = findRecipe(id); if (!r) return;
  (r.ingredients || []).forEach(i => {
    const key = id + '|' + i.n;
    const ex = data.grocery.find(g => g.key === key);
    if (ex) ex.amount = i.a, ex.unit = i.u, ex.bought = false;
    else data.grocery.push({ key, name: i.n, amount: i.a, unit: i.u, fromId: id, fromName: r.name, bought: false });
  });
  saveLocal(); scheduleSync();
  renderGrocery();
  toast('已加入买菜清单 🛒');
}
function renderGrocery() {
  const el = $('#groceryList');
  $('#groceryEmpty').classList.toggle('hidden', data.grocery.length > 0);
  el.innerHTML = data.grocery.map(g => `
    <div class="g-item ${g.bought ? 'bought' : ''}" data-key="${g.key}">
      <span class="g-check">✓</span>
      <span class="g-name">${g.name}</span>
      <span class="g-amount">${g.amount}${g.unit}</span>
      <span class="g-from">${g.fromName}</span>
    </div>`).join('');
}
function toggleBought(key) {
  const g = data.grocery.find(x => x.key === key);
  if (g) g.bought = !g.bought;
  saveLocal(); scheduleSync(); renderGrocery();
}
function copyGrocery() {
  const pending = data.grocery.filter(g => !g.bought);
  if (!pending.length) { toast('清单已空或全部买完'); return; }
  const lines = ['🥬 今日买菜清单：'];
  pending.forEach(g => lines.push(`· ${g.name} ${g.amount}${g.unit}（${g.fromName}）`));
  lines.push('——来自「今天吃什么」');
  copyText(lines.join('\n'));
}
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('已复制，去微信粘贴吧 📋'), () => fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text; document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); toast('已复制 📋'); } catch (e) { toast('复制失败，请长按选择复制'); }
  ta.remove();
}
function clearBought() {
  const before = data.grocery.length;
  data.grocery = data.grocery.filter(g => !g.bought);
  saveLocal(); scheduleSync(); renderGrocery();
  toast(before === data.grocery.length ? '没有已买的条目' : '已清除已买项');
}

/* ---------------- 随机推荐 ---------------- */
function pick(items, avoid) {
  const pool = items.filter(r => !avoid || !avoid.has(r.id));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : items[Math.floor(Math.random() * items.length)];
}
function rollOne() {
  const recent = new Set(data.history.filter(h => new Date(h.date).getTime() > Date.now() - 7 * 864e5).map(h => h.id));
  const r = pick(getRecipes().filter(x => !x.custom), recent);
  showRandomResult([r], '🎲 今天就吃这个！');
}
function rollSet() {
  const recent = new Set(data.history.filter(h => new Date(h.date).getTime() > Date.now() - 3 * 864e5).map(h => h.id));
  const base = getRecipes().filter(x => !x.custom && !recent.has(x.id));
  const picked = [];
  const meat = pick(base.filter(x => x.category === '荤菜'), null);
  picked.push(meat);
  let veg = pick(base.filter(x => x.category === '素菜' && x.id !== meat.id), null);
  picked.push(veg);
  const soup = base.find(x => x.category === '汤羹' && !picked.some(p => p.id === x.id));
  if (soup) picked.push(soup);
  showRandomResult(picked, '🍽️ 今日菜单搭配好了');
}
function showRandomResult(recipes, title) {
  $('#randomResult').innerHTML = `<div class="random-card"><p class="empty" style="padding:8px 0 14px">${title}</p>` +
    recipes.map(cardHTML).join('') + '</div>';
}
function markDoneFromRandom() {
  $$('#randomResult .recipe-card').forEach(el => {
    if (!isFav(el.dataset.id)) return;
  });
}

/* ---------------- 按食材找菜 ---------------- */
function findDishesByIngredients() {
  const input = $('#ingInput').value.trim();
  if (!input) { toast('先输入家里有的食材'); return; }
  const keys = input.split(/[,，、;；\s]+/).filter(Boolean);
  const scored = getRecipes().map(r => {
    const ings = (r.ingredients || []).map(i => i.n);
    const hit = keys.filter(k => ings.some(n => n.includes(k)));
    return { r, hit };
  }).filter(x => x.hit.length).sort((a, b) => b.hit.length - a.hit.length);
  $('#randomResult').innerHTML = scored.length
    ? `<div class="random-card"><p class="empty" style="padding:8px 0 14px">🔍 家里有这些食材，可以做 ${scored.length} 道菜：</p>` +
      scored.map(x => cardHTML(x.r)).join('') + '</div>'
    : `<div class="random-card"><p class="empty">没找到匹配的菜，换个说法试试（如：鸡蛋、番茄）</p></div>`;
}

/* ---------------- 自定义菜谱 ---------------- */
function genId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function openAddForm() {
  $('#addForm').reset();
  $('#addOverlay').classList.remove('hidden');
}
function closeAdd() { $('#addOverlay').classList.add('hidden'); }
function saveCustom(e) {
  e.preventDefault();
  const ingredients = $('#afIngredients').value.trim().split('\n').filter(Boolean).map(line => {
    const m = line.match(/^(.+?)\s+([\d./]+)\s*(克|g|毫升|ml|勺|汤匙|茶匙|个|根|颗|片|块|瓣|只|条|束|碗|杯|包|把)?$/);
    if (m) return { n: m[1].trim(), a: m[2], u: m[3] || '' };
    return { n: line.trim(), a: '适量', u: '' };
  });
  if (ingredients.length === 0) { toast('请填写至少一种食材'); return; }
  const steps = $('#afSteps').value.trim().split('\n').filter(Boolean);
  if (steps.length === 0) { toast('请填写做法步骤'); return; }
  const rec = {
    id: genId(), custom: true,
    name: $('#afName').value.trim(),
    category: $('#afCategory').value,
    flavor: $('#afFlavor').value.trim() || '家常',
    time: parseInt($('#afTime').value) || 30,
    difficulty: parseInt($('#afDiff').value) || 2,
    ingredients, steps,
    tips: $('#afTips').value.trim()
  };
  if (!rec.name) { toast('请填写菜名'); return; }
  data.customRecipes.unshift(rec);
  saveLocal(); scheduleSync();
  closeAdd();
  renderCustom(); renderList(); fillFilters();
  toast('已添加 👩‍🍳');
}
function renderCustom() {
  const el = $('#customList');
  $('#customEmpty').classList.toggle('hidden', data.customRecipes.length > 0);
  el.innerHTML = data.customRecipes.map(r => `
    <div class="recipe-card" data-id="${r.id}">
      <div class="r-main"><div class="r-name">${r.name}</div>
        <div class="r-meta"><span class="tag cat">${r.category}</span><span class="tag">⏱ ${r.time}分钟</span></div>
      </div>
      <button class="fav-btn" data-del="${r.id}" title="删除">🗑️</button>
    </div>`).join('');
}
function deleteCustom(id) {
  data.customRecipes = data.customRecipes.filter(r => r.id !== id);
  data.history = data.history.filter(h => h.id !== id);
  data.grocery = data.grocery.filter(g => g.fromId !== id);
  saveLocal(); scheduleSync();
  renderCustom(); renderList();
  toast('已删除');
}

/* ---------------- 坚果云同步 ---------------- */
let syncTimer = null;
function scheduleSync() {
  if (!data.sync.enabled) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncPush, 800);
}
function syncAuth() {
  return 'Basic ' + btoa(unescape(encodeURIComponent(data.sync.user + ':' + data.sync.pass)));
}
function syncUrl() {
  const base = data.sync.url.replace(/\/+$/, '');
  const path = data.sync.path.replace(/^\/+/, '');
  return base + '/' + path;
}
function syncPayload() {
  return JSON.stringify({
    favorites: data.favorites,
    history: data.history,
    customRecipes: data.customRecipes,
    grocery: data.grocery
  });
}
function syncPull() {
  const u = syncUrl();
  return fetch(u, { method: 'GET', headers: { Authorization: syncAuth() } })
    .then(res => {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
}
function mergeRemote(remote) {
  if (!remote) return;
  data.favorites = Array.from(new Set(data.favorites.concat(remote.favorites || [])));
  const seen = new Set(data.history.map(h => h.id + '|' + h.date));
  (remote.history || []).forEach(h => { if (!seen.has(h.id + '|' + h.date)) data.history.push(h); });
  data.history.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 60);
  const cseen = new Set(data.customRecipes.map(c => c.id));
  (remote.customRecipes || []).forEach(c => { if (!cseen.has(c.id)) data.customRecipes.push(c); });
  const gseen = new Set(data.grocery.map(g => g.key));
  (remote.grocery || []).forEach(g => { if (!gseen.has(g.key)) data.grocery.push(g); });
  saveLocal();
}
function syncPush() {
  const u = syncUrl();
  return fetch(u, {
    method: 'PUT',
    headers: { Authorization: syncAuth(), 'Content-Type': 'application/json' },
    body: syncPayload()
  }).then(res => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
  });
}
async function syncNow(showMsg) {
  if (!data.sync.enabled) { if (showMsg) toast('先开启云端同步'); return; }
  try {
    const remote = await syncPull();
    mergeRemote(remote);
    await syncPush();
    refreshAll();
    if (showMsg) toast('同步成功 ☁️');
    setSyncStatus('ok', '同步正常 ✓');
  } catch (e) {
    console.warn('sync failed', e);
    if (showMsg) toast('同步失败，稍后重试');
    setSyncStatus('err', '同步失败：' + (e.message || e) + '（请检查账号/密码/网络）');
  }
}
function setSyncStatus(cls, msg) {
  $('#syncStatus').className = 'sync-status ' + cls;
  $('#syncStatus').innerHTML = msg;
}
function renderSyncPanel() {
  const s = data.sync;
  $('#syncPanel').innerHTML = `
    <div class="sync-status ${s.enabled ? 'ok' : ''}" id="syncStatus">${s.enabled ? '☁️ 已开启，数据云端同步中' : '⚙️ 未开启同步（数据仅存本机）'}</div>
    <div class="sync-form">
      <input id="sUrl" value="${s.url}" placeholder="WebDAV地址（默认坚果云）">
      <input id="sUser" value="${s.user}" placeholder="坚果云账号（邮箱）">
      <input id="sPass" type="password" value="${s.pass}" placeholder="应用密码（非登录密码）">
      <input id="sPath" value="${s.path}" placeholder="文件路径（默认 zycp/data.json）">
    </div>
    <div class="sync-form" style="display:flex;gap:8px;margin-top:10px">
      <button id="sSave" class="btn-big" style="flex:1">保存并同步</button>
      <button id="sTest" class="btn-big btn-ghost" style="flex:1">立即同步</button>
    </div>`;
  $('#syncStatus').className = 'sync-status' + (s.enabled ? ' ok' : '');
  $('#syncStatus').innerHTML = s.enabled ? '☁️ 已开启，数据云端同步中' : '⚙️ 未开启同步（数据仅存本机）';
}
function saveSyncForm() {
  data.sync.url = $('#sUrl').value.trim() || 'https://dav.jianguoyun.com/dav';
  data.sync.user = $('#sUser').value.trim();
  data.sync.pass = $('#sPass').value.trim();
  data.sync.path = $('#sPath').value.trim() || 'zycp/data.json';
  data.sync.enabled = !!(data.sync.user && data.sync.pass);
  saveLocal();
  if (data.sync.enabled) {
    setSyncStatus('', '☁️ 已开启，正在同步…');
    syncNow(true);
  } else {
    setSyncStatus('', '⚙️ 已关闭同步');
    toast('已关闭同步');
  }
}

/* ---------------- 深色模式 ---------------- */
function applyTheme() {
  document.documentElement.dataset.theme = data.theme;
  $('#themeBtn').textContent = data.theme === 'dark' ? '☀️' : '🌙';
}

/* ---------------- 数据导入导出 ---------------- */
function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zycp-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('已导出备份');
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (obj.favorites || obj.customRecipes || obj.grocery || obj.history) {
        data = Object.assign(data, obj);
        saveLocal(); refreshAll();
        toast('导入成功');
      } else toast('文件格式不对');
    } catch (e) { toast('文件解析失败'); }
  };
  reader.readAsText(file);
}
function resetAll() {
  if (!confirm('确定清空本机的收藏、做过记录、清单和自定义菜谱吗？此操作不可恢复。')) return;
  data.favorites = []; data.history = []; data.customRecipes = []; data.grocery = [];
  saveLocal(); refreshAll();
  toast('已清空本地数据');
}

/* ---------------- 页面切换 ---------------- */
function switchPage(name) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $('#page-' + name).classList.add('active');
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === name));
  window.scrollTo(0, 0);
}

function refreshAll() {
  renderCats(); fillFilters(); renderList(); renderHistory(); renderGrocery(); renderCustom(); renderSyncPanel();
}

/* ---------------- 事件绑定 ---------------- */
function bind() {
  $('#catTabs').addEventListener('click', e => {
    const b = e.target.closest('.cat-tab'); if (!b) return;
    curCat = b.dataset.cat; renderCats(); renderList();
  });
  $('#searchInput').addEventListener('input', renderList);
  $('#filterFlavor').addEventListener('change', e => { curFlavor = e.target.value; renderList(); });
  $('#filterTime').addEventListener('change', e => { curTime = e.target.value; renderList(); });
  $('#filterDiff').addEventListener('change', e => { curDiff = e.target.value; renderList(); });
  $('#filterReset').addEventListener('click', () => {
    curFlavor = curTime = curDiff = '';
    $('#filterFlavor').value = $('#filterTime').value = $('#filterDiff').value = '';
    renderList();
  });

  $('#recipeList').addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
    const card = e.target.closest('.recipe-card');
    if (card) showDetail(card.dataset.id);
  });

  $('#detailBody').addEventListener('click', e => {
    const t = e.target;
    if (t.id === 'dFav') toggleFav(detailId);
    else if (t.id === 'dDone') markDone(detailId);
    else if (t.id === 'dCart') addToGrocery(detailId);
    else if (t.id === 'sMinus') { detailServings = Math.max(1, detailServings - 1); reRenderDetailAmounts(); }
    else if (t.id === 'sPlus') { detailServings = Math.min(20, detailServings + 1); reRenderDetailAmounts(); }
  });
  $('#detailClose').addEventListener('click', closeDetail);
  $('#detailOverlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeDetail(); });

  function reRenderDetailAmounts() {
    const r = findRecipe(detailId); if (!r) return;
    const factor = detailServings / (r.servings || 2);
    $('.servings-row .s-val').textContent = detailServings;
    const rows = $$('.ing-table tr');
    (r.ingredients || []).forEach((i, idx) => {
      if (rows[idx]) rows[idx].children[1].textContent = calcAmount(i.a, factor) + i.u;
    });
  }

  $('#rollOne').addEventListener('click', rollOne);
  $('#rollSet').addEventListener('click', rollSet);
  $('#ingFindBtn').addEventListener('click', findDishesByIngredients);
  $('#ingInput').addEventListener('keydown', e => { if (e.key === 'Enter') findDishesByIngredients(); });

  $('#copyList').addEventListener('click', copyGrocery);
  $('#clearBought').addEventListener('click', clearBought);
  $('#groceryList').addEventListener('click', e => {
    const item = e.target.closest('.g-item');
    if (item) toggleBought(item.dataset.key);
  });

  $('#addRecipeBtn').addEventListener('click', openAddForm);
  $('#addClose').addEventListener('click', closeAdd);
  $('#addForm').addEventListener('submit', saveCustom);
  $('#customList').addEventListener('click', e => {
    const del = e.target.closest('[data-del]');
    if (del) { e.stopPropagation(); deleteCustom(del.dataset.del); return; }
    const card = e.target.closest('.recipe-card');
    if (card) showDetail(card.dataset.id);
  });

  $('#syncPanel').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'sTest') syncNow(true);
    else if (id === 'sSave') saveSyncForm();
  });
  $('#syncPanel').addEventListener('change', e => {
    if (e.target.id === 'sUrl') data.sync.url = e.target.value.trim();
    if (e.target.id === 'sUser') data.sync.user = e.target.value.trim();
    if (e.target.id === 'sPass') data.sync.pass = e.target.value.trim();
    if (e.target.id === 'sPath') data.sync.path = e.target.value.trim();
  });

  $('#exportData').addEventListener('click', exportData);
  $('#importData').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });
  $('#resetData').addEventListener('click', resetAll);

  $('#themeBtn').addEventListener('click', () => {
    data.theme = data.theme === 'dark' ? 'light' : 'dark';
    saveLocal(); applyTheme();
  });

  $$('.nav-btn').forEach(b => b.addEventListener('click', () => switchPage(b.dataset.page)));
}

/* ---------------- 启动 ---------------- */
function init() {
  loadLocal();
  if (!data.sync.url) data.sync.url = 'https://dav.jianguoyun.com/dav';
  applyTheme();
  refreshAll();
  bind();
  if (data.sync.enabled) setTimeout(syncNow, 600);
}
document.addEventListener('DOMContentLoaded', init);
