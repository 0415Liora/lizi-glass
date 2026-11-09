/* 厘子 · 病恋档案 —— 应用逻辑
   纯静态 / 零外部依赖 / 微信内可直接打开
   数据本地持久化 + URL 只读快照（可选云端仓库短链） */
(function () {
'use strict';

/* ============ 基础工具 ============ */
var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function merge(base, over) {
  var out = clone(base);
  Object.keys(over || {}).forEach(function (k) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = merge(out[k], over[k]);
    else out[k] = over[k];
  });
  return out;
}
function getPath(o, p) { var a = p.split('.'), c = o; for (var i = 0; i < a.length; i++) { if (c == null) return undefined; c = c[a[i]]; } return c; }
function setPath(o, p, v) { var a = p.split('.'), c = o; for (var i = 0; i < a.length - 1; i++) { if (c[a[i]] == null) c[a[i]] = {}; c = c[a[i]]; } c[a[a.length - 1]] = v; }
function uid(n) { var s = '', c = 'abcdefghijkmnpqrstuvwxyz23456789'; for (var i = 0; i < (n || 6); i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function haptic() { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
function toast(msg, ms) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(t._tm); t._tm = setTimeout(function () { t.classList.remove('on'); }, ms || 2300);
}
function fmtTime() {
  var d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function isDataImg(s) { return typeof s === 'string' && s.indexOf('data:image') === 0; }
function isImgSrc(s) { return typeof s === 'string' && (s.indexOf('data:image') === 0 || /^(https?:\/\/|\/|\.\/|assets\/|[A-Za-z0-9_\-./]+\.(png|jpe?g|webp|gif|svg))/.test(s)); }
function safeUrl(u) { return typeof u === 'string' && /^(https?:\/\/|data:|mailto:|tel:)/i.test(u.trim()); }

/* ============ 全局状态 ============ */
var KEY = 'lizi_state_v1', LINKS_KEY = 'lizi_readonly_links_v1';
var S = merge(window.DEFAULTS, {});
var READONLY = false, EDIT = false, LOGIN = false, TAB = 'home', ADMIN_SEC = '';
var BASE = location.origin + location.pathname;

function loadLocal() {
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var old = JSON.parse(raw);
      // 版本迁移：旧版深色数据一次性切到「透亮玻璃」新版外观，用户自定义内容保留
      if (!old.version || old.version < 2) {
        old.theme = 'glass'; old.bgDim = 10; old.bgBlur = 2;
        if (!old.intro) old.intro = clone(window.DEFAULTS.intro);
        old.version = 2;
      }
      // v3：内置相册图 / 内置 MP3 / 手动擦除文案 —— 只在仍是默认空值时补齐，绝不覆盖用户自己上传或改过的内容
      if (old.version < 3) {
        var D = window.DEFAULTS;
        if (old.album && Array.isArray(old.album.items)) {
          old.album.items.forEach(function (it, i) {
            if (!it.img && D.album.items[i] && D.album.items[i].img) {
              it.img = D.album.items[i].img;
              if (!it.text || /^(窗上的雨|十字架落在|蓝屏之前|她没有回信)/.test(it.text)) it.text = D.album.items[i].text;
            }
          });
        }
        if (old.home && old.home.music && !old.home.music.url) {
          var m = D.home.music;
          old.home.music.url = m.url; old.home.music.cover = m.cover;
          if (!old.home.music.title || old.home.music.title === '未载入音轨') old.home.music.title = m.title;
          if (!old.home.music.artist || /插入音乐链接/.test(old.home.music.artist)) old.home.music.artist = m.artist;
          old.home.music.auto = true;
        }
        if (old.intro && (!old.intro.tip || old.intro.tip === '轻触屏幕，擦去雾气')) old.intro.tip = D.intro.tip;
        old.version = 3;
      }
      S = merge(window.DEFAULTS, old);
    }
  } catch (e) { console.warn('本地读取失败', e); }
}
function save() {
  if (READONLY) return;
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('本地空间已满：请减少图片数量/尺寸，或在「链接与分享」启用云端仓库'); }
}

/* ============ 图片高清处理（相册导入 / 自定义背景） ============ */
/* 只做等比缩放 + 高质量 WebP/JPEG 编码，不降低原始清晰度；小图不放大 */
function readImage(file, maxSide, quality, cb) {
  if (!file || !/^image\//.test(file.type)) { toast('请选择图片文件'); return; }
  var fr = new FileReader();
  fr.onload = function () {
    var src = fr.result, img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight, lim = maxSide || 2000;
      var scale = Math.min(1, lim / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      var cx = cv.getContext('2d');
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, cw, ch);
      var out;
      try { out = cv.toDataURL('image/webp', quality || .9); } catch (e) { out = ''; }
      if (!out || out.indexOf('image/webp') < 0) out = cv.toDataURL('image/jpeg', quality || .92);
      cb(out);
    };
    img.onerror = function () { cb(src); };
    img.src = src;
  };
  fr.readAsDataURL(file);
}
function readRaw(file, cb) { var fr = new FileReader(); fr.onload = function () { cb(fr.result); }; fr.readAsDataURL(file); }
/* 只读快照专用：把图片再压一档（长边 1400 / q .86），兼顾「看得清」与「链接不过长」 */
function shrinkForSnapshot(s, lim, q) {
  return new Promise(function (resolve) {
    if (!isDataImg(s)) return resolve(s);
    lim = lim || 1400; q = q || .86;
    var img = new Image();
    img.onload = function () {
      var sc = Math.min(1, lim / Math.max(img.naturalWidth, img.naturalHeight));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * sc); cv.height = Math.round(img.naturalHeight * sc);
      var cx = cv.getContext('2d'); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(img, 0, 0, cv.width, cv.height);
      var o = ''; try { o = cv.toDataURL('image/webp', q); } catch (e) {}
      if (!o || o.indexOf('image/webp') < 0) o = cv.toDataURL('image/jpeg', q + .02);
      resolve(o.length < s.length ? o : s);
    };
    img.onerror = function () { resolve(s); };
    img.src = s;
  });
}

/* ============ 只读快照：原链接 + 后缀（短链 / 内嵌兜底） ============ */
function bytesToB64url(bytes) {
  var bin = '', CH = 0x8000;
  for (var i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(s) {
  var b = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  var bin = atob(b), arr = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function encodeSnapshot(obj) {
  var bytes = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream !== 'undefined') {
    return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')))
      .arrayBuffer().then(function (ab) { return 'g' + bytesToB64url(new Uint8Array(ab)); })
      .catch(function () { return 'j' + bytesToB64url(bytes); });
  }
  return Promise.resolve('j' + bytesToB64url(bytes));
}
function decodeSnapshot(str) {
  var flag = str.charAt(0), arr = b64urlToBytes(str.slice(1));
  if (flag === 'g' && typeof DecompressionStream !== 'undefined') {
    return new Response(new Blob([arr]).stream().pipeThrough(new DecompressionStream('gzip')))
      .arrayBuffer().then(function (ab) { return JSON.parse(new TextDecoder().decode(ab)); })
      .catch(function () { return JSON.parse(new TextDecoder().decode(arr)); });
  }
  return Promise.resolve(JSON.parse(new TextDecoder().decode(arr)));
}
async function buildSnapshot(compact) {
  var snap = clone(S);
  delete snap.password;                 // 只读快照绝不携带管理密码
  snap.share = { cloudOn: false, cloudEndpoint: '', cloudName: '' };
  // 纯静态托管（无云端仓库）时把图片再压一档，控制只读链接长度，手机上看依然清晰
  var LIM = compact ? 1150 : 1400, Q = compact ? .82 : .86;
  var jobs = [];
  function walk(o) {
    Object.keys(o).forEach(function (k) {
      if (typeof o[k] === 'string' && isDataImg(o[k])) {
        jobs.push((function (key) { return shrinkForSnapshot(o[key], LIM, Q).then(function (v) { o[key] = v; }); })(k));
      } else if (o[k] && typeof o[k] === 'object') walk(o[k]);
    });
  }
  walk(snap);
  await Promise.all(jobs);
  return snap;
}
/* 可选云端仓库：填入任何「POST 存 JSON / GET 取 JSON」的国内免费服务或自建云函数即可让链接变短 */
async function cloudPut(payload) {
  var ep = (S.share && S.share.cloudEndpoint || '').trim();
  if (!ep) throw new Error('no endpoint');
  var r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'lizi', payload: payload }) });
  if (!r.ok) throw new Error('http ' + r.status);
  var txt = await r.text(), id = '';
  try {
    var j = JSON.parse(txt);
    id = j.id || j.key || j.code || (j.data && (j.data.id || j.data.key)) || j.url || '';
  } catch (e) { id = txt.trim().slice(0, 120); }
  if (!id) throw new Error('bad response');
  return encodeURIComponent(String(id));
}
async function cloudGet(id) {
  var ep = (S.share && S.share.cloudEndpoint || '').trim();
  var sep = ep.indexOf('?') >= 0 ? '&' : (ep.endsWith('/') ? '' : '/');
  var r = await fetch(ep + sep + 'id=' + encodeURIComponent(id));
  if (!r.ok) throw new Error('http ' + r.status);
  var j = await r.json();
  return j.payload || j.data || j;
}
function baseLink() { return BASE + location.search; }
/* 随站自带的云端快照仓库：存在则只读链接为真正短链；静态托管时自动降级为内嵌快照 */
var AUTO_CLOUD = '';
function cloudBase() {
  var dir = location.pathname.replace(/[^/]*$/, '');
  return location.origin + dir + 'api/snap' + location.search;
}
async function probeCloud() {
  if (READONLY) return;
  // 用一个静态标记文件判断部署形态，避免在无接口的静态托管上产生 404 请求
  try {
    var dir = location.pathname.replace(/[^/]*$/, '');
    var sep = location.search ? (location.search + '&') : '?';
    var r = await fetch(location.origin + dir + 'cloud.json' + sep + '_=' + Date.now(), { method: 'GET' });
    if (!r.ok) return;
    var j = await r.json();
    if (j && j.cloud === true) AUTO_CLOUD = cloudBase();
    else AUTO_CLOUD = '';
  } catch (e) { AUTO_CLOUD = ''; }
}

/* ============ 主题 / 背景 ============ */
function applyTheme() {
  document.documentElement.setAttribute('data-theme', S.theme || 'noir');
  var bl = $('#bgLayer');
  bl.style.backgroundImage = S.bgImage ? 'url("' + S.bgImage + '")' : '';
  document.documentElement.style.setProperty('--bg-blur', (S.bgBlur || 0) + 'px');
  var dim = S.bgDim == null ? 30 : Number(S.bgDim);
  if ((S.theme === 'noir' || S.theme === 'mono') && dim < 30) dim = 42;
  document.documentElement.style.setProperty('--bg-dim', dim / 100);
  $('#rain').style.opacity = S.rainOn === false ? '0' : '.9';
}
function applyMode() {
  document.body.classList.toggle('readonly', READONLY);
  document.body.classList.toggle('editing', EDIT && !READONLY);
}

/* ============ 渲染：状态栏 / 顶栏 / 底栏 ============ */
function renderStatus() {
  var st = S.status || {};
  var tm = st.autoTime === false ? (st.timeText || '') : fmtTime();
  var islandImg = st.image ? '<img src="' + esc(st.image) + '" alt="">' : '<span class="dot"></span>';
  $('#statusbar').innerHTML =
    '<div class="sb-left"><span data-txt="status.timeText" style="font-variant-numeric:tabular-nums">' + esc(tm) + '</span>' +
      (st.leftText ? '<span style="font-size:9px;opacity:.55" data-txt="status.leftText">' + esc(st.leftText) + '</span>' : '') + '</div>' +
    '<div class="island">' + islandImg + '<span data-txt="status.islandText">' + esc(st.islandText || '') + '</span></div>' +
    '<div class="sb-right">' +
      (st.rightText ? '<span style="font-size:10px" data-txt="status.rightText">' + esc(st.rightText) + '</span>' : '') +
      '<span class="bars"><i></i><i></i><i></i><i></i></span>' +
      '<svg viewBox="0 0 16 12" width="14" height="11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M1 4.2a10 10 0 0 1 14 0M3.6 7a6.5 6.5 0 0 1 8.8 0M6.2 9.7a2.5 2.5 0 0 1 3.6 0"/><circle cx="8" cy="11" r=".7" fill="currentColor" stroke="none"/></svg>' +
      '<span class="sb-bat"><i></i></span></div>';
  // 自动时钟：状态栏文字可手动改，但聊天小字时间永远跟随手机实时时钟（不可改）
  if (st.autoTime !== false) { var el = $('#statusbar [data-txt="status.timeText"]'); if (el) el.setAttribute('contenteditable', 'false'); }
}
function renderTop() {
  var t = S.top || {};
  var logo = t.image ? '<img src="' + esc(t.image) + '" alt="">' : window.svg('cross', 19);
  $('#topbar').innerHTML =
    '<div class="logo">' + logo + '</div>' +
    '<div class="tt"><h1 data-txt="top.title">' + esc(t.title || '') + '</h1><p data-txt="top.subtitle">' + esc(t.subtitle || '') + '</p></div>' +
    (READONLY ? '<div class="iconBtn" title="只读">' + window.svg('eye', 16) + '</div>' :
      '<button class="iconBtn" id="adminBtn" title="后台管理">' + window.svg(EDIT ? 'gear' : 'lock', 16) + '</button>' +
      (EDIT ? '<button class="iconBtn" id="exitEditBtn" title="退出编辑">' + window.svg('close', 14) + '</button>' : ''));
}
var TABS = [
  { k: 'album', n: '相册', ic: 'album' },
  { k: 'home', n: '主页', ic: 'home' },
  { k: 'msg', n: '消息', ic: 'msg' },
  { k: 'me', n: '关于我', ic: 'me' }
];
function renderTabs() {
  var labels = S.tabLabels || window.DEFAULTS.tabLabels;
  $('#tabbar').innerHTML = TABS.map(function (t, i) {
    return '<button class="tab' + (TAB === t.k ? ' on' : '') + '" data-tab="' + t.k + '">' +
      '<span class="ic">' + window.svg(t.ic, 21) + '</span><span data-txt="tabLabels.' + i + '">' + esc(labels[i] || t.n) + '</span></button>';
  }).join('');
}

/* ============ 渲染：主页（病恋档案 + 软件图标 + 便签 + 音乐） ============ */
function renderHome() {
  var p = S.profile || {}, h = S.home || {}, m = h.music || {};
  var rows = (p.rows || []).map(function (r, i) {
    return '<div class="rowline"><span data-txt="profile.rows.' + i + '.k">' + esc(r.k) + '</span>' +
      '<span data-txt="profile.rows.' + i + '.v">' + esc(r.v) + '</span></div>';
  }).join('');
  var apps = (h.apps || []).map(function (a, i) {
    var inner = isImgSrc(a.icon) ? '<img src="' + esc(a.icon) + '" alt="">' : window.svg(window.ICONS[a.icon] ? a.icon : 'sparkle', 24);
    return '<div class="appItem' + (safeUrl(a.link) ? ' hasLink' : '') + '" data-link="' + esc(a.link || '') + '">' +
      '<div class="appIcon">' + inner + '</div>' +
      '<span class="nm" data-txt="home.apps.' + i + '.name">' + esc(a.name || '') + '</span>' +
      '<span class="miniLink">↗</span></div>';
  }).join('');
  var notes = (h.notes || []).map(function (n, i) {
    return '<div class="stickyNote tap" data-link="' + esc(n.link || '') + '">' +
      (safeUrl(n.link) ? '<span class="lk">↗</span>' : '') +
      '<div class="txt" data-txt="home.notes.' + i + '.text">' + esc(n.text || '') + '</div></div>';
  }).join('');
  var cover = isImgSrc(m.cover) ? '<img src="' + esc(m.cover) + '" alt="">' : window.svg('music', 22);
  var playing = AUDIO_ON && !AUDIO_PAUSED;
  $('#page-home').innerHTML =
    '<div class="page-head"><span class="k" data-txt="home.title">' + esc(h.title || '') + '</span><span class="idx">01 / 04</span></div>' +

    '<div class="glass card profileCard">' +
      '<div class="sig"><div class="avatar">' + window.svg('cross', 26) + '</div><div>' +
        '<h2 data-txt="profile.name">' + esc(p.name || '') + '</h2>' +
        '<div class="en" data-txt="profile.en">' + esc(p.en || '') + '</div></div></div>' +
      '<div class="badges">' +
        ['gender', 'attr', 'sign', 'mbti'].map(function (k) {
          return '<span class="badge" data-txt="profile.' + k + '">' + esc(p[k] || '') + '</span>';
        }).join('') + '</div>' +
      '<div class="tagline" data-txt="profile.tagline">' + esc(p.tagline || '') + '</div>' +
      '<div class="subline" data-txt="profile.subline">' + esc(p.subline || '') + '</div>' +
      '<div class="divider"></div><div class="rows">' + rows + '</div>' +
      '<div class="divider"></div><div class="verse" data-txt="profile.verse">' + esc(p.verse || '') + '</div>' +
    '</div>' +

    '<div class="footMark crossD" data-txt="profile.footer">' + esc(p.footer || '') + '</div>' +

    '<div class="glass card" style="margin-top:14px">' +
      '<div class="tiny" style="margin-bottom:14px;display:flex;justify-content:space-between"><span>APPLICATIONS</span><span>†</span></div>' +
      '<div class="appGrid">' + apps + '</div></div>' +

    '<div class="glass card musicCard" style="margin-top:12px">' +
      '<div class="musicCover" id="musicCover">' + cover + '</div>' +
      '<div class="mi"><div class="mt" data-txt="home.music.title">' + esc(m.title || '') + '</div>' +
        '<div class="ma" data-txt="home.music.artist">' + esc(m.artist || '') + '</div>' +
        '<div class="eq' + (playing ? '' : ' off') + '" id="eq"><i></i><i></i><i></i><i></i></div></div>' +
      '<button class="playBtn" id="playBtn">' + window.svg(playing ? 'pause' : 'play', 16) + '</button></div>' +

    (h.notes && h.notes.length ? '<div class="stack" style="margin-top:12px">' + notes + '</div>' : '') +
    '<div class="footMark">† SIGNAL LOST · 0217 †</div>';
  mountMusicFrame();
}

/* ============ 渲染：相册 ============ */
function renderAlbum() {
  var a = S.album || {};
  var items = (a.items || []).map(function (it, i) {
    var img = isImgSrc(it.img)
      ? '<img src="' + esc(it.img) + '" alt="' + esc(it.text || '') + '" data-zoom="' + i + '">'
      : '<div class="ph" data-zoom="' + i + '"><span class="crossD">✝</span><span class="tiny">NO IMAGE / 点击导入</span></div>';
    var corner = (it.showLink && safeUrl(it.link))
      ? '<button class="corner" data-golink="' + esc(it.link) + '" title="打开链接">' + esc(it.linkLabel || '↗') + '</button>' : '';
    return '<div class="albumItem tap">' + img + corner +
      '<div class="cap" data-txt="album.items.' + i + '.text">' + esc(it.text || '') + '</div></div>';
  }).join('');
  var add = (EDIT && !READONLY) ? '<button class="albumItem addItem tap" id="albumAdd">' + window.svg('plus', 22) + '</button>' : '';
  $('#page-album').innerHTML =
    '<div class="page-head"><span class="k" data-txt="album.title">' + esc(a.title || '') + '</span><span class="idx">00 / 04</span></div>' +
    '<div class="tiny" style="margin:-6px 2px 14px;line-height:1.7" data-txt="album.hint">' + esc(a.hint || '') + '</div>' +
    '<div class="albumGrid">' + items + add + '</div>' +
    '<div class="footMark">† ARCHIVE / 请勿唤醒 †</div>';
}

/* ============ 渲染：消息 ============ */
function renderMsg() {
  var g = S.msg || {}, f = g.focus || {};
  var notes = (g.notes || []).map(function (n, i) {
    return '<div class="glass card" style="margin-bottom:11px" data-link="' + esc(n.link || '') + '">' +
      '<div class="tiny" style="margin-bottom:8px">NOTE ' + String(i + 1).padStart(2, '0') + ' †</div>' +
      '<div class="txt" style="font-size:11.5px;line-height:1.75;white-space:pre-line" data-txt="msg.notes.' + i + '.text">' + esc(n.text || '') + '</div>' +
      (isImgSrc(n.img) ? '<img class="noteImg" src="' + esc(n.img) + '" alt="" data-zoomsrc="' + esc(n.img) + '">' : '') +
      (safeUrl(n.link) ? '<div class="noteLink">↗ 打开链接</div>' : '') + '</div>';
  }).join('');
  var mins = Math.max(0, parseInt(f.minutes, 10) || 0);
  var left = FOCUS_LEFT != null ? FOCUS_LEFT : mins * 60;
  $('#page-msg').innerHTML =
    '<div class="page-head"><span class="k" data-txt="msg.title">' + esc(g.title || '') + '</span><span class="idx">02 / 04</span></div>' +
    '<div class="metaRow">' +
      '<div class="glass metaBox"><div class="tiny">' + window.svg('pin', 12) + ' 地点 / PLACE</div>' +
        '<div class="val" data-txt="msg.place">' + esc(g.place || '') + '</div></div>' +
      '<div class="glass metaBox"><div class="tiny">' + window.svg('cloud', 12) + ' 天气 / WEATHER</div>' +
        '<div class="val" data-txt="msg.weather">' + esc(g.weather || '') + '</div></div></div>' +
    '<div class="tiny" style="margin:4px 2px 10px">MEMO / 便签</div>' + notes +
    '<div class="glass focusCard" style="margin-top:14px">' +
      '<div class="tiny">' + window.svg('timer', 13) + ' FOCUS · 专注计时</div>' +
      '<div class="focusNum" id="focusNum">' + fmtClock(left) + '</div>' +
      '<div class="cap" data-txt="msg.focus.caption">' + esc(f.caption || '') + '</div>' +
      '<div class="focusBtns"><button class="pill solid" id="focusStart">' + (FOCUS_RUN ? '暂停' : '开始') + '</button>' +
      '<button class="pill" id="focusReset">重置</button></div></div>' +
    '<div class="footMark">† 静音 · 未读 †</div>';
}
function fmtClock(sec) {
  sec = Math.max(0, Math.round(sec));
  return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
}

/* ============ 渲染：关于我 / 聊天 ============ */
function renderMe() {
  var c = S.me || {};
  var kws = (c.keywords || []).map(function (k, i) {
    return '<button class="kwChip" data-kw="' + i + '">' + esc(k.k || '') + '</button>';
  }).join('');
  var msgs = CHAT_MSGS.map(function (m) {
    return '<div class="bubbleRow ' + (m.who === 'me' ? 'me' : 'them') + '">' +
      (m.who === 'them' ? '<div class="bav">' + window.svg('cross', 13) + '</div>' : '') +
      '<div class="bubble">' + esc(m.text || '') + '<span class="t">' + esc(m.t || fmtTime()) + '</span></div></div>';
  }).join('');
  $('#page-me').innerHTML =
    '<div class="chatWrap">' +
    '<div class="page-head" style="margin-bottom:6px"><span class="k" data-txt="me.title">' + esc(c.title || '') + '</span><span class="idx">03 / 04</span></div>' +
    '<div class="chatHead"><div class="av">' + window.svg('sparkle', 19) + '</div><div>' +
      '<div class="nm" data-txt="profile.name">' + esc(S.profile.name || '') + '</div>' +
      '<div class="st">信号稳定 · 自动回复已开启</div></div></div>' +
    '<div class="divider" style="margin:2px 0 10px"></div>' +
    '<div class="chatBody" id="chatBody">' + msgs + '</div>' +
    '<div class="tiny" style="margin:2px 2px 4px">关键词 / 点击即触发自动回复</div>' +
    '<div class="kwBar">' + kws + '</div>' +
    '<div class="chatInput"><input id="chatText" placeholder="输入关键词，或说点什么…" autocomplete="off">' +
      '<button class="sendBtn" id="chatSend">' + window.svg('send', 16) + '</button></div>' +
    '</div>';
  var b = $('#chatBody'); if (b) b.scrollTop = b.scrollHeight;
}

/* ============ 统一渲染 ============ */
function renderAll() {
  applyTheme(); applyMode();
  renderStatus(); renderTop(); renderTabs();
  renderAlbum(); renderHome(); renderMsg(); renderMe();
  $$('.page').forEach(function (p) { p.classList.toggle('on', p.dataset.page === TAB); });
  applyEditable();
  $('#navPrev').innerHTML = window.svg('up', 14);
  $('#navNext').innerHTML = window.svg('down', 14);
  $('#editPanelBtn').innerHTML = window.svg('gear', 15);
  $('#editDoneBtn').innerHTML = window.svg('close', 15);
}
function applyEditable() {
  $$('[data-txt]').forEach(function (el) {
    if (EDIT && !READONLY) el.setAttribute('contenteditable', 'true');
    else el.removeAttribute('contenteditable');
  });
  // 自动时钟时状态栏时间不可直接改（可在后台切为手动）
  if (S.status.autoTime !== false) { var t = $('#statusbar [data-txt="status.timeText"]'); if (t) t.removeAttribute('contenteditable'); }
}
function setTab(k, silent) {
  TAB = k;
  $$('.page').forEach(function (p) { p.classList.toggle('on', p.dataset.page === k); });
  $$('.tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === k); });
  if (!silent) haptic();
  var pg = $('#page-' + k); if (pg) pg.scrollTop = 0;
}

/* ============ 音乐：直链 / 网易云外链 / 本地音频（原码率、不转码） ============ */
var AUDIO_ON = false, AUDIO_PAUSED = true, AUDIO_TYPE = 'none', PENDING_PLAY = false;
var MUSIC_IFRAME_SRC = '', MUSIC_BLOCK = false;
var audio = $('#audio');
audio.loop = true; audio.volume = 1; audio.preload = 'auto';

function jumpable(u) { return typeof u === 'string' && /^(https?:\/\/|mailto:|tel:)/i.test(u.trim()); }
function resolveMusic(url) {
  if (!url) return { type: 'none', src: '' };
  if (/^data:audio|^data:application\/octet-stream/.test(url)) return { type: 'audio', src: url };
  if (/music\.163\.com|163cn\.tv/i.test(url)) {
    var id = (url.match(/[?&]id=(\d+)/) || url.match(/\/song\/(\d+)/) || [])[1];
    if (id) return { type: 'iframe', src: 'https://music.163.com/outchain/player?type=2&id=' + id + '&auto=1&height=66' };
  }
  if (/\.(mp3|m4a|aac|flac|ogg|opus|wav|mp4)(\?|#|$)/i.test(url)) return { type: 'audio', src: url };
  return { type: 'audio', src: url }; // 其它链接先尝试直连音频，失败再提示
}
function mountMusicFrame() {
  var r = resolveMusic((S.home.music || {}).url), box = $('#musicFrame');
  if (MUSIC_BLOCK && r.type === 'iframe') { box.innerHTML = ''; box.style.display = 'none'; return; }
  if (r.type === 'iframe' && r.src !== MUSIC_IFRAME_SRC) {
    MUSIC_IFRAME_SRC = r.src;
    box.style.cssText = 'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);width:min(340px,92vw);height:86px;z-index:40;border-radius:16px;overflow:hidden;-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);box-shadow:0 14px 40px rgba(0,0,0,.4)';
    box.innerHTML = '<iframe src="' + esc(r.src) + '" frameborder="0" width="100%" height="86" allow="autoplay; encrypted-media" style="display:block;border-radius:16px"></iframe>';
  } else if (r.type !== 'iframe') {
    MUSIC_IFRAME_SRC = ''; box.innerHTML = ''; box.style.display = 'none';
  } else box.style.display = 'block';
}
function updateMusicUI() {
  var b = $('#playBtn'), eq = $('#eq');
  if (b) b.innerHTML = window.svg(AUDIO_ON ? 'pause' : 'play', 16);
  if (eq) eq.classList.toggle('off', !AUDIO_ON);
}
function initMusic() {
  var m = S.home.music || {}, r = resolveMusic(m.url);
  AUDIO_TYPE = r.type; AUDIO_ON = false; AUDIO_PAUSED = true; MUSIC_BLOCK = false;
  if (r.type === 'audio') {
    if (audio.src !== r.src) { audio.src = r.src; try { audio.load(); } catch (e) {} }
  } else { try { audio.removeAttribute('src'); audio.load(); } catch (e) {} }
  mountMusicFrame(); updateMusicUI();
  if (m.url && m.auto !== false) { PENDING_PLAY = true; tryPlay(); }
}
function tryPlay() {
  var m = S.home.music || {};
  if (!m.url || m.auto === false) return;
  if (AUDIO_TYPE === 'audio') {
    var p = audio.play();
    if (p && p.then) p.then(function () { AUDIO_ON = true; AUDIO_PAUSED = false; PENDING_PLAY = false; updateMusicUI(); toast('正在播放 · ' + (m.title || '未命名音轨') + '（原码率）'); })
      .catch(function () { PENDING_PLAY = true; });
    else { AUDIO_ON = true; AUDIO_PAUSED = false; updateMusicUI(); }
  } else if (AUDIO_TYPE === 'iframe') {
    AUDIO_ON = true; AUDIO_PAUSED = false; PENDING_PLAY = false; updateMusicUI();
    toast('正在播放 · ' + (m.title || '平台外链音轨'));
  }
}
function playMusic() {
  if (AUDIO_TYPE === 'none') { toast('请先在后台插入音乐链接或上传音频'); return; }
  MUSIC_BLOCK = false;
  if (AUDIO_TYPE === 'iframe') { MUSIC_IFRAME_SRC = ''; mountMusicFrame(); }
  tryPlay();
}
function pauseMusic() {
  AUDIO_ON = false; AUDIO_PAUSED = true; PENDING_PLAY = false; MUSIC_BLOCK = true;
  try { audio.pause(); } catch (e) {}
  var box = $('#musicFrame'); if (box) { box.innerHTML = ''; box.style.display = 'none'; }
  MUSIC_IFRAME_SRC = ''; updateMusicUI();
}
function toggleMusic() { haptic(); if (AUDIO_ON) { pauseMusic(); toast('已暂停'); } else playMusic(); }
audio.addEventListener('error', function () {
  if (!AUDIO_ON && (S.home.music || {}).url) { /* 平台分享页不是音频直链，保留提示 */ }
});
audio.addEventListener('playing', function () { AUDIO_ON = true; AUDIO_PAUSED = false; updateMusicUI(); });
audio.addEventListener('pause', function () { if (AUDIO_ON) { AUDIO_ON = false; updateMusicUI(); } });
/* 浏览器/微信自动播放策略：首次任意触摸后补播 */
document.addEventListener('pointerdown', function () { if (PENDING_PLAY) tryPlay(); });
document.addEventListener('touchstart', function () { if (PENDING_PLAY) tryPlay(); }, { passive: true });
/* 离开页面 / 跳转外链自动断开音乐 */
document.addEventListener('visibilitychange', function () { if (document.hidden && AUDIO_ON) pauseMusic(); });
window.addEventListener('pagehide', function () { if (AUDIO_ON) pauseMusic(); });
function go(url) {
  if (!jumpable(url)) return;
  if (AUDIO_ON) pauseMusic();
  haptic();
  window.location.href = url.trim();   // 同页跳转，浏览器返回键即可回到本站
}

/* ============ 聊天（关键词自动回复 / 24H 时间戳不可编辑） ============ */
var CHAT_MSGS = [];
function syncChat() {
  CHAT_MSGS = (S.me.messages || []).map(function (m) {
    return { who: m.who === 'me' ? 'me' : 'them', text: m.text || '', t: fmtTime() };
  });
  if (!CHAT_MSGS.length) CHAT_MSGS = [{ who: 'them', text: S.me.greeting || '…', t: fmtTime() }];
}
function sendChat(text) {
  text = String(text || '').trim(); if (!text) return;
  CHAT_MSGS.push({ who: 'me', text: text, t: fmtTime() });
  var hit = null, kws = S.me.keywords || [];
  for (var i = 0; i < kws.length; i++) { if (kws[i].k && (text === kws[i].k || text.indexOf(kws[i].k) >= 0)) { hit = kws[i]; break; } }
  var reply = hit ? hit.r : (S.me.fallback || '…');
  renderMe();
  setTimeout(function () { CHAT_MSGS.push({ who: 'them', text: reply, t: fmtTime() }); renderMe(); haptic(); }, 460);
}

/* ============ 专注计时 ============ */
var FOCUS_RUN = false, FOCUS_LEFT = null, FOCUS_TM = null;
function focusTick() {
  if (!FOCUS_RUN) return;
  var mins = Math.max(0, parseInt(S.msg.focus.minutes, 10) || 0);
  if (FOCUS_LEFT == null) FOCUS_LEFT = mins * 60;
  FOCUS_LEFT--;
  if (FOCUS_LEFT <= 0) { FOCUS_LEFT = 0; FOCUS_RUN = false; toast('专注结束 · 可以回头看了'); renderMsg(); return; }
  var el = $('#focusNum'); if (el) el.textContent = fmtClock(FOCUS_LEFT);
}

/* ============ 图片放大 ============ */
var LB_LINK = '';
function openLightbox(i) {
  var it = (S.album.items || [])[parseInt(i, 10)]; if (!it) return;
  var im = $('#lbImg'); im.src = isImgSrc(it.img) ? it.img : '';
  im.style.display = isImgSrc(it.img) ? 'block' : 'none';
  $('#lbCap').textContent = it.text || '';
  LB_LINK = (it.showLink && jumpable(it.link)) ? it.link : '';
  $('#lbLink').style.display = LB_LINK ? 'inline-block' : 'none';
  $('#lightbox').classList.add('on'); haptic();
}
function openSrc(src, cap) {
  $('#lbImg').src = src; $('#lbImg').style.display = 'block';
  $('#lbCap').textContent = cap || ''; LB_LINK = '';
  $('#lbLink').style.display = 'none'; $('#lightbox').classList.add('on');
}

/* ============ 后台管理 ============ */
var OPEN_SECS = [];
function copyText(t) {
  function fallback() {
    var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(t).then(function () { toast('已复制，可直接粘贴到微信发送'); }, fallback);
  } else fallback();
}
function fld(label, path, type, opt) {
  opt = opt || {};
  var v = getPath(S, path); if (v == null) v = '';
  var id = 'data-bind="' + path + '"';
  if (type === 'textarea') return '<div class="fld"><label>' + label + '</label><textarea ' + id + '>' + esc(v) + '</textarea></div>';
  if (type === 'check') return '<label class="sw"><span>' + label + '</span><input type="checkbox" ' + id + ' ' + (v ? 'checked' : '') + '></label>';
  if (type === 'range') return '<div class="fld"><label>' + label + ' · ' + v + '</label><input type="range" min="' + (opt.min || 0) + '" max="' + (opt.max || 100) + '" ' + id + ' value="' + esc(v) + '"></div>';
  if (type === 'select') return '<div class="fld"><label>' + label + '</label><select ' + id + '>' + opt.options.map(function (o) {
    return '<option value="' + esc(o[0]) + '" ' + (String(v) === String(o[0]) ? 'selected' : '') + '>' + esc(o[1]) + '</option>';
  }).join('') + '</select></div>';
  return '<div class="fld"><label>' + label + '</label><input type="' + (type || 'text') + '" ' + id + ' value="' + esc(v) + '" placeholder="' + esc(opt.ph || '') + '"></div>';
}
function imgFld(label, path, ms) {
  var v = getPath(S, path);
  return '<div class="fld"><label>' + label + '（点选后从手机相册导入）</label>' +
    '<div style="display:flex;align-items:center;gap:9px">' +
    (isImgSrc(v) ? '<img class="thumb" src="' + esc(v) + '" alt="">' : '') +
    '<input type="file" accept="image/*" data-img="' + path + '" data-ms="' + (ms || 2000) + '" style="font-size:10px">' +
    (isImgSrc(v) ? '<button class="btn sm" data-act="clearimg:' + path + '">清除</button>' : '') + '</div></div>';
}
function itemTop(path, i) {
  return '<div class="irTop"><span class="idx">' + String(i + 1).padStart(2, '0') + '</span><span class="sp"></span>' +
    '<button data-act="up:' + path + ':' + i + '" title="上移">' + window.svg('up', 13) + '</button>' +
    '<button data-act="down:' + path + ':' + i + '" title="下移">' + window.svg('down', 13) + '</button>' +
    '<button data-act="del:' + path + ':' + i + '" title="删除">' + window.svg('trash', 13) + '</button></div>';
}
function itemField(path, i, d) {
  var p = path + '.' + i + '.' + d.k, v = getPath(S, p);
  if (d.t === 'textarea') return '<div class="fld"><label>' + d.l + '</label><textarea data-bind="' + p + '">' + esc(v || '') + '</textarea></div>';
  if (d.t === 'check') return '<label class="sw"><span>' + d.l + '</span><input type="checkbox" data-bind="' + p + '" ' + (v ? 'checked' : '') + '></label>';
  if (d.t === 'img') return imgFld(d.l, p, 2000);
  if (d.t === 'icon') {
    var opts = Object.keys(window.ICONS).map(function (k) { return [k, k]; });
    if (isImgSrc(v)) opts.unshift([v, '自定义图片（当前）']);
    return fld(d.l, p, 'select', { options: opts }) +
      '<div class="fld"><label>或上传自定义图标</label><input type="file" accept="image/*" data-img="' + p + '" data-ms="400" style="font-size:10px"></div>';
  }
  return '<div class="fld"><label>' + d.l + '</label><input type="text" data-bind="' + p + '" value="' + esc(v == null ? '' : v) + '" placeholder="' + esc(d.ph || '') + '"></div>';
}
function arrEditor(title, path, defs, newItem, sec) {
  var arr = getPath(S, path) || [];
  var body = arr.map(function (_, i) {
    return '<div class="itemRow">' + itemTop(path, i) + defs.map(function (d) { return itemField(path, i, d); }).join('') + '</div>';
  }).join('');
  return '<details class="sec" data-sec="' + sec + '"><summary>' + title + '（' + arr.length + '）</summary><div class="in">' +
    (body || '<div class="hint">暂无内容，点下方添加。</div>') +
    '<button class="btn" data-act="add:' + path + '">' + window.svg('plus', 13) + ' 添加一项</button></div></details>';
}
var NEW_ITEMS = {
  'album.items': { img: '', text: '新的影像', link: '', showLink: false, linkLabel: '↗' },
  'home.apps': { name: '新应用', icon: 'sparkle', link: '' },
  'home.notes': { text: '新的便签', link: '' },
  'msg.notes': { text: '新的便签', img: '', link: '' },
  'me.keywords': { k: '新关键词', r: '自动回复内容' },
  'profile.rows': { k: '项目', v: '内容' }
};
function renderAdmin() {
  var a = $('#admin'), head =
    '<div class="adminHead"><div style="color:var(--accent)">' + window.svg('cross', 18) + '</div>' +
    '<h3>后台管理 · CONSOLE</h3><button class="iconBtn" id="adminClose">' + window.svg('close', 15) + '</button></div>';
  if (!LOGIN) {
    a.innerHTML = head + '<div class="loginBox"><div class="lg">' + window.svg('lock', 28) + '</div>' +
      '<h3>ADMIN ONLY</h3><p>本站仅有一个管理权限<br>输入密码后可编辑全部内容<br>其他访客仅可浏览</p>' +
      '<input type="password" id="pwd" placeholder="管理员密码" autocomplete="off">' +
      '<div class="err" id="pwdErr"></div><button class="btn pri" id="loginBtn" style="width:200px">进入后台</button>' +
      '<p style="opacity:.45;font-size:9px">初始密码见源码 defaults.js · password 字段，登录后请修改</p></div>';
    return;
  }
  a.innerHTML = head + '<div class="adminBody" id="adminBody">' +

    '<details class="sec" data-sec="look"><summary>外观 / 背景 / 主题</summary><div class="in">' +
      fld('视觉主题', 'theme', 'select', { options: [['glass', '透亮玻璃 · 银白（默认，贴近资料）'], ['blue', '渐变浅蓝 · 液态 INS'], ['noir', '忧郁黑白 + 浅蓝液态'], ['mono', '纯黑白 · MONO'], ['custom', '自定义（配合背景图）']] }) +
      imgFld('自定义网站背景图', 'bgImage', 2400) +
      fld('背景模糊 px', 'bgBlur', 'range', { min: 0, max: 20 }) +
      fld('背景暗度 %', 'bgDim', 'range', { min: 0, max: 90 }) +
      '<label class="sw"><span>仿真雨滴特效（凝珠 / 汇流 / 水痕）</span><input type="checkbox" data-bind="rainOn" ' + (S.rainOn !== false ? 'checked' : '') + '></label>' +
      fld('雨滴密度', 'rainLevel', 'range', { min: 10, max: 120 }) +
      fld('雨滴滑落速度（越小越慢）', 'rainSpeed', 'range', { min: 8, max: 100 }) +
      '<div class="hint">背景图、主题、雨滴均为全站生效；切换后即时预览。玻璃已调为透亮半透，边缘带一圈细亮描边。</div></div></details>' +

    '<details class="sec" data-sec="intro"><summary>进场动画 / 擦玻璃 · 雨滴车窗</summary><div class="in">' +
      '<label class="sw"><span>开启进场动画</span><input type="checkbox" data-bind="intro.on" ' + (S.intro.on !== false ? 'checked' : '') + '></label>' +
      fld('中间主文字', 'intro.title') +
      fld('副标文字', 'intro.sub') +
      fld('底部提示文字', 'intro.tip') +
      fld('跳过按钮文字', 'intro.skip') +
      fld('擦开多少 % 后进入', 'intro.need', 'range', { min: 12, max: 75 }) +
      imgFld('进场背景底图（默认已用你的资料图）', 'intro.image', 2400) +
      '<div class="hint">开场是一块起雾的车窗：大小不一的仿真雨滴打上玻璃、带涟漪与缓慢滑落的水痕。<b>必须用手指或鼠标在屏幕上滑动把雾擦开</b>，底部进度条走满后自动擦净并进入主站；不想擦可点「跳过」。所有文字与底图都可改。</div></div></details>' +

    '<details class="sec" data-sec="bar"><summary>状态栏 / 顶栏 / 底栏（所有文字与图片）</summary><div class="in">' +
      '<label class="sw"><span>状态栏时间跟随手机实时时钟</span><input type="checkbox" data-bind="status.autoTime" ' + (S.status.autoTime !== false ? 'checked' : '') + '></label>' +
      fld('状态栏时间文字（关闭自动后可改）', 'status.timeText') +
      fld('状态栏左侧文字', 'status.leftText') +
      fld('灵动岛文字', 'status.islandText') +
      fld('状态栏右侧文字', 'status.rightText') +
      imgFld('状态栏小图', 'status.image', 200) +
      fld('顶栏标题', 'top.title') + fld('顶栏副标题', 'top.subtitle') +
      imgFld('顶栏图片 / 头像', 'top.image', 400) +
      '<div class="divider"></div><div class="tiny">底栏四个标签文字</div>' +
      '<div class="row2">' + fld('① 左下角', 'tabLabels.0') + fld('②', 'tabLabels.1') + '</div>' +
      '<div class="row2">' + fld('③', 'tabLabels.2') + fld('④', 'tabLabels.3') + '</div>' +
      '<div class="hint">聊天消息左下角的时间小字为系统实时 24H 制，永远不可修改；其余所有文字（含底栏、状态栏、天气、地点、时间文案）均可更改。</div></div></details>' +

    '<details class="sec" data-sec="profile"><summary>病恋档案 / 个人资料</summary><div class="in">' +
      fld('名字', 'profile.name') + fld('英文名', 'profile.en') +
      '<div class="row2">' + fld('性别', 'profile.gender') + fld('属性', 'profile.attr') + '</div>' +
      '<div class="row2">' + fld('星座', 'profile.sign') + fld('MBTI', 'profile.mbti') + '</div>' +
      fld('主文案', 'profile.tagline') + fld('副文案', 'profile.subline') +
      fld('诗句（可换行）', 'profile.verse', 'textarea') + fld('页脚', 'profile.footer') +
      arrEditor('档案条目', 'profile.rows', [{ k: 'k', l: '项目名', t: 'text' }, { k: 'v', l: '内容', t: 'text' }], NEW_ITEMS['profile.rows'], 'rows') +
      '</div></details>' +

    '<details class="sec" data-sec="album"><summary>相册（图片 / 文案 / 链接）</summary><div class="in">' +
      fld('相册左上角标题', 'album.title') + fld('相册说明', 'album.hint') +
      arrEditor('相册卡片', 'album.items', [
        { k: 'img', l: '相册图片', t: 'img' },
        { k: 'text', l: '图片文案', t: 'textarea' },
        { k: 'link', l: '图片链接（点击右上角 ↗ 跳转）', t: 'text', ph: 'https://…' },
        { k: 'showLink', l: '显示右上角链接跳转', t: 'check' },
        { k: 'linkLabel', l: '右上角角标文字', t: 'text' }
      ], NEW_ITEMS['album.items'], 'albumItems') +
      '<div class="hint">浏览态点击图片可高清放大；右上角角标是否出现由「显示右上角链接跳转」控制。插入图片的 UI 只在此后台，不占用底栏。</div></div></details>' +

    '<details class="sec" data-sec="home"><summary>主页 / 软件图标 / 便签 / 音乐</summary><div class="in">' +
      fld('主页标题', 'home.title') +
      arrEditor('软件图标（插入链接后点击直接跳转）', 'home.apps', [
        { k: 'name', l: '名称', t: 'text' },
        { k: 'icon', l: '图标样式', t: 'icon' },
        { k: 'link', l: '跳转链接', t: 'text', ph: 'https://…' }
      ], NEW_ITEMS['home.apps'], 'apps') +
      arrEditor('便签', 'home.notes', [
        { k: 'text', l: '便签文字', t: 'textarea' },
        { k: 'link', l: '便签链接', t: 'text', ph: 'https://…' }
      ], NEW_ITEMS['home.notes'], 'homeNotes') +
      fld('音乐标题', 'home.music.title') + fld('音乐副标 / 歌手', 'home.music.artist') +
      fld('音乐链接（音乐APP分享链接 / 音频直链）', 'home.music.url', 'text', { ph: 'https://music.163.com/song?id=… 或 .mp3 直链' }) +
      imgFld('音乐封面', 'home.music.cover', 600) +
      '<label class="sw"><span>访客进入自动播放 / 离开自动断开</span><input type="checkbox" data-bind="home.music.auto" ' + (S.home.music.auto !== false ? 'checked' : '') + '></label>' +
      '<div class="fld"><label>或上传本地音频文件（原码率、一定可播，建议 &lt; 3MB）</label><input type="file" accept="audio/*" data-audio="home.music.url" style="font-size:10px"></div>' +
      '<div class="hint">音质：音频直链 / 本地文件按原码率解码，不做任何转码与增益；网易云歌曲链接自动转为官方外链播放器；QQ音乐等分享页若无直链会提示。浏览器与微信要求首次触摸后才允许有声播放，已自动补播。</div></div></details>' +

    '<details class="sec" data-sec="msg"><summary>消息 / 便签 / 地点天气 / 专注计时</summary><div class="in">' +
      fld('消息标题', 'msg.title') +
      arrEditor('便签（文字 / 图片 / 链接）', 'msg.notes', [
        { k: 'text', l: '便签文字', t: 'textarea' },
        { k: 'img', l: '便签图片', t: 'img' },
        { k: 'link', l: '便签链接', t: 'text', ph: 'https://…' }
      ], NEW_ITEMS['msg.notes'], 'msgNotes') +
      '<div class="row2">' + fld('地标 / 地点', 'msg.place') + fld('天气', 'msg.weather') + '</div>' +
      fld('专注分钟数', 'msg.focus.minutes', 'number') +
      fld('时间下方文案', 'msg.focus.caption') + '</div></details>' +

    '<details class="sec" data-sec="me"><summary>关于我 / 聊天自动回复</summary><div class="in">' +
      fld('页面标题', 'me.title') + fld('开场白', 'me.greeting', 'textarea') +
      fld('未命中关键词时的默认回复', 'me.fallback', 'textarea') +
      arrEditor('关键词 → 自动回复', 'me.keywords', [
        { k: 'k', l: '关键词（点击状态栏或输入均可触发）', t: 'text' },
        { k: 'r', l: '自动回复内容', t: 'textarea' }
      ], NEW_ITEMS['me.keywords'], 'kws') +
      '<button class="btn" data-act="chatreset">重置聊天记录</button>' +
      '<div class="hint">聊天窗口上方的关键词状态栏点击即触发自动回复；手动输入包含关键词也会触发。所有气泡左下角时间由系统实时生成，不可更改。</div></div></details>' +

    '<details class="sec" data-sec="share"><summary>链接与分享 / 只读快照 / 云端仓库</summary><div class="in">' +
      '<div class="hint">原站链接：' + esc(baseLink()) + '</div>' +
      '<button class="btn pri" data-act="genlink" style="width:100%">' + window.svg('share', 14) + ' 生成新的只读链接（原链接 + 随机后缀）</button>' +
      '<div id="shareResult"></div>' +
      '<div class="divider"></div>' +
      '<div class="hint" id="cloudState"></div>' +
      '<label class="sw"><span>改用自定义第三方云端仓库（可选）</span><input type="checkbox" data-bind="share.cloudOn" ' + (S.share.cloudOn ? 'checked' : '') + '></label>' +
      fld('云端接口地址', 'share.cloudEndpoint', 'text', { ph: 'https://你的云函数/或国内免费 JSON 仓库' }) +
      fld('仓库备注名', 'share.cloudName') +
      '<div class="hint">本站自带云端快照仓库（server.js 的 /api/snap）：检测到即自动启用，只读链接为真正短链，高清图片与文字存在云端，微信可直接打开。若部署在纯静态托管（无此接口），自动降级为「数据内嵌只读链接」，同样可读。自定义接口约定：POST {app,payload} 返回 {id}；GET ?id=xxx 返回 {payload}。可选国内方案：腾讯云 CloudBase 云函数 / 阿里云函数计算 + OSS / Gitee 自建代理 / 任意兼容 JSONBin 的免费仓库。已生成的只读链接自带内容快照，之后修改本站或一键恢复都不会影响它。</div>' +
      '<div class="divider"></div>' +
      '<div class="hint">已生成的只读链接（各自独立、互不影响）：</div><div id="linkList"></div>' +
      '<div class="divider"></div>' +
      '<div class="btnRow"><button class="btn" data-act="export">导出数据</button>' +
      '<button class="btn" data-act="import">导入数据</button>' +
      '<button class="btn danger" data-act="restore">一键恢复初始内容</button></div>' +
      '<div class="hint">一键恢复只重置当前站点内容，已生成的只读链接仍展示生成那一刻的内容。</div></div></details>' +

    '<details class="sec" data-sec="pass"><summary>安全 / 管理员密码</summary><div class="in">' +
      fld('修改管理员密码', 'password', 'text') +
      '<button class="btn" data-act="logout">退出登录（回到只读浏览）</button>' +
      '<div class="hint">全站只有一个管理员密码，不存在其他账号；访客无登录入口。密码不会写入任何只读快照。</div></div></details>' +

    '<div class="footMark" style="color:rgba(210,228,248,.35)">† LÍ ZǏ · CLINICAL NOTE 0217 †</div></div>';
  // 恢复分区展开状态
  $$('#admin .sec').forEach(function (d) { if (OPEN_SECS.indexOf(d.dataset.sec) >= 0) d.open = true; });
  var cs = $('#cloudState');
  if (cs) cs.textContent = (AUTO_CLOUD || (S.share.cloudOn && (S.share.cloudEndpoint || '').trim()))
    ? '当前：云端快照仓库可用 → 生成的是短链接（推荐，微信打开最稳）。'
    : '当前：未检测到云端接口 → 生成内嵌高清快照链接（同样可在微信打开）。';
  renderLinkList();
}
function renderLinkList() {
  var box = $('#linkList'); if (!box) return;
  var arr = []; try { arr = JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); } catch (e) {}
  box.innerHTML = arr.length ? arr.slice(0, 12).map(function (x, i) {
    return '<div class="itemRow" style="gap:5px"><div style="font-size:9.5px;opacity:.65">' + esc(x.time) + ' · ' + esc(x.id) + '</div>' +
      '<div style="font-size:9px;word-break:break-all;line-height:1.6;opacity:.8">' + esc(x.link.slice(0, 90)) + (x.link.length > 90 ? '…' : '') + '</div>' +
      '<div class="btnRow"><button class="btn sm" data-act="copylink:' + i + '">复制</button>' +
      '<button class="btn sm" data-act="openlink:' + i + '">打开</button></div></div>';
  }).join('') : '<div class="hint">还没有生成过只读链接。</div>';
}
function refreshAdmin() {
  OPEN_SECS = $$('#admin .sec[open]').map(function (d) { return d.dataset.sec; });
  renderAdmin();
}
function openAdmin() {
  $('#overlay').classList.add('on'); $('#admin').classList.add('on');
  document.body.classList.add('adminOpen'); renderAdmin();
}
function closeAdmin() {
  $('#overlay').classList.remove('on'); $('#admin').classList.remove('on');
  document.body.classList.remove('adminOpen');
}

/* ============ 只读链接生成 / 恢复 / 导入导出 ============ */
async function cloudPutAt(ep, payload) {
  var r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ app: 'lizi', payload: payload }) });
  if (!r.ok) throw new Error('http ' + r.status);
  var txt = await r.text(), id = '';
  try { var j = JSON.parse(txt); id = j.id || j.key || (j.data && (j.data.id || j.data.key)) || ''; } catch (e) { id = txt.trim().slice(0, 120); }
  if (!id) throw new Error('bad');
  return encodeURIComponent(String(id));
}
async function genReadonly() {
  toast('正在打包高清快照…', 1200);
  try {
    var custom = (S.share.cloudOn && (S.share.cloudEndpoint || '').trim()) ? S.share.cloudEndpoint.trim() : '';
    var ep = custom || AUTO_CLOUD;
    var snap = await buildSnapshot(!ep);
    var payload = await encodeSnapshot(snap);
    var rid = uid(6), link = '', cloud = false;
    if (ep) {
      try {
        var id = await cloudPutAt(ep, payload);
        if (!custom && AUTO_CLOUD) {
          link = baseLink() + '#s=' + rid + '.' + id;   // 随站仓库：最短后缀
        } else {
          var epb = bytesToB64url(new TextEncoder().encode(ep));
          link = baseLink() + '#c=' + rid + '.' + epb + '.' + id;
        }
        cloud = true;
      } catch (e) { console.warn('云端快照失败，降级内嵌', e); }
    }
    if (!link) link = baseLink() + '#r=' + rid + '.' + payload;
    var arr = []; try { arr = JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); } catch (e) {}
    arr.unshift({ id: rid, link: link, time: new Date().toLocaleString('zh-CN', { hour12: false }) });
    localStorage.setItem(LINKS_KEY, JSON.stringify(arr.slice(0, 30)));
    var box = $('#shareResult');
    if (box) box.innerHTML = '<div class="itemRow"><div class="hint">' + (cloud ? '云端短链已生成（短链接）' : '内嵌只读链接已生成（自包含高清快照，微信可直接打开）') + ' · 后缀 ' + esc(rid) + '</div>' +
      '<textarea readonly id="shareLink" style="width:100%;min-height:88px;font-size:9.5px;word-break:break-all;border-radius:10px;padding:9px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);color:inherit">' + esc(link) + '</textarea>' +
      '<div class="btnRow"><button class="btn pri sm" data-act="copynow">复制链接</button><button class="btn sm" data-act="opennow">在本机打开</button></div>' +
      '<div class="hint">只读链接无管理入口、不可编辑；发给别人即可在微信直接点开。每次生成后缀都不同，彼此独立。</div></div>';
    renderLinkList();
    window.__LAST_LINK = link;
    toast('只读链接已生成 · ' + rid, 2600);
  } catch (e) { console.error(e); toast('生成失败：' + e.message); }
}
async function bootReadonly() {
  var h = location.hash || '';
  var rc = h.match(/^#r=([^.]+)\.(.+)$/), cc = h.match(/^#c=([^.]+)\.([^.]+)\.(.+)$/), sc = h.match(/^#s=([^.]+)\.(.+)$/);
  if (!rc && !cc && !sc) return false;
  try {
    var snap;
    if (cc || sc) {
      var ep = sc ? cloudBase() : new TextDecoder().decode(b64urlToBytes(cc[2]));
      var sep = ep.indexOf('?') >= 0 ? '&' : '?';
      var r = await fetch(ep + sep + 'id=' + (sc ? sc[2] : cc[3]));
      if (!r.ok) throw new Error('云端读取失败');
      var j = await r.json(); var pl = j.payload || j.data || j;
      snap = typeof pl === 'string' ? await decodeSnapshot(pl) : pl;
    } else snap = await decodeSnapshot(rc[2]);
    if (!snap || !snap.profile) throw new Error('快照内容无效');
    READONLY = true; LOGIN = false; EDIT = false;
    S = merge(window.DEFAULTS, snap); S.password = '';
    return true;
  } catch (e) { console.warn('只读快照读取失败', e); toast('只读快照读取失败，请向作者重新索取链接'); return false; }
}
function restoreAll() {
  if (!window.confirm('一键恢复为初始内容？\n已生成过的只读链接不受影响，仍展示生成时内容。')) return;
  var pw = S.password, sh = clone(S.share || {});
  S = merge(window.DEFAULTS, {}); S.password = pw; S.share = sh;
  save(); syncChat(); FOCUS_RUN = false; FOCUS_LEFT = null;
  renderAll(); initMusic(); refreshAdmin(); toast('已恢复初始内容（密码与云端配置保留）');
}
function exportData() {
  var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'lizi-backup-' + uid(4) + '.json'; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000); toast('数据已导出');
}

/* ============ 仿真雨滴：静态凝珠 / 间歇滑落 / 汇流长大 / 水痕蒸发 / 折射高光 ============ */
function initRain() {
  var cv = $('#rain'), cx = cv.getContext('2d');
  var trail = document.createElement('canvas'), tx = trail.getContext('2d');  // 水痕层（缓慢蒸发）
  var W = 0, H = 0, dpr = 1, raf = 0, beads = [], runners = [];
  function speed() { var v = S.rainSpeed == null ? 42 : Number(S.rainSpeed); return Math.max(.12, Math.min(1.6, v / 42)); }
  function light() { var t = document.documentElement.getAttribute('data-theme'); return t === 'glass' || t === 'blue'; }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    trail.width = W * dpr; trail.height = H * dpr;
    tx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  /* 贴在玻璃上的静态凝珠：数量多、大小悬殊、几乎不动 */
  function mkBead(init) {
    return { x: Math.random() * W, y: init ? Math.random() * H : -24,
      r: .7 + Math.pow(Math.random(), 2.1) * 4.6,
      ph: Math.random() * 6.28, rip: init ? 0 : 1 };
  }
  /* 滑落水珠：走走停停（表面张力），会吞并沿途凝珠而长大 */
  function mkRun(init) {
    return { x: Math.random() * W, y: init ? Math.random() * H : -30 - Math.random() * H * .3,
      r: 3.0 + Math.random() * 4.8, v: .02 + Math.random() * .06,
      pause: Math.random() * 90, wob: Math.random() * 6.28,
      drift: (Math.random() - .5) * .16, py: 0 };
  }
  function refill() {
    var lv = S.rainLevel == null ? 70 : Number(S.rainLevel);
    var nb = Math.min(240, Math.round(lv * 1.9));
    var nr = Math.max(3, Math.round(lv / 12));
    while (beads.length < nb) beads.push(mkBead(true));
    if (beads.length > nb) beads.length = nb;
    while (runners.length < nr) runners.push(mkRun(true));
    if (runners.length > nr) runners.length = nr;
  }
  /* 单颗水珠的凸透镜质感：亮心 → 冷灰环 → 底部暗影 → 高光点 → 细描边 */
  function drawDrop(c, x, y, r, lit, alpha) {
    if (r < .35) return;
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha;
    var ry = r * 1.10;
    var g = c.createRadialGradient(x - r * .34, y - r * .42, 0, x, y, r * 1.5);
    g.addColorStop(0, lit ? 'rgba(255,255,255,.96)' : 'rgba(255,255,255,.72)');
    g.addColorStop(.30, lit ? 'rgba(226,238,250,.40)' : 'rgba(198,224,252,.30)');
    g.addColorStop(.74, lit ? 'rgba(126,156,188,.26)' : 'rgba(120,160,210,.18)');
    g.addColorStop(1, lit ? 'rgba(78,108,142,.10)' : 'rgba(150,195,240,.02)');
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, ry, 0, 0, 6.283); c.fill();
    // 底部暗影（折射下沉）
    c.fillStyle = lit ? 'rgba(64,92,124,.16)' : 'rgba(10,26,48,.22)';
    c.beginPath(); c.ellipse(x + r * .06, y + ry * .52, r * .72, ry * .30, 0, 0, 6.283); c.fill();
    // 边缘细描边
    c.strokeStyle = lit ? 'rgba(70,102,138,.28)' : 'rgba(210,232,255,.22)';
    c.lineWidth = .7; c.beginPath(); c.ellipse(x, y, r, ry, 0, 0, 6.283); c.stroke();
    // 左上主高光 + 右下小反光
    c.fillStyle = 'rgba(255,255,255,.95)';
    c.beginPath(); c.arc(x - r * .36, y - ry * .42, Math.max(.55, r * .21), 0, 6.283); c.fill();
    c.fillStyle = lit ? 'rgba(255,255,255,.55)' : 'rgba(210,232,255,.42)';
    c.beginPath(); c.arc(x + r * .34, y + ry * .34, Math.max(.35, r * .10), 0, 6.283); c.fill();
    c.restore();
  }
  function frame() {
    raf = 0;
    if (document.hidden || S.rainOn === false) return;
    var lit = light(), sp = speed();
    cx.clearRect(0, 0, W, H);
    // 水痕缓慢蒸发
    tx.save(); tx.globalCompositeOperation = 'destination-out';
    tx.fillStyle = 'rgba(0,0,0,.010)'; tx.fillRect(0, 0, W, H); tx.restore();
    // 合成已有水痕（淡）
    cx.save(); cx.globalAlpha = lit ? .5 : .45;
    cx.drawImage(trail, 0, 0, W, H); cx.restore();

    // 静态凝珠
    for (var i = 0; i < beads.length; i++) {
      var b = beads[i];
      b.ph += .012;
      if (b.rip > 0) {
        b.rip -= .03;
        cx.strokeStyle = (lit ? 'rgba(90,120,152,' : 'rgba(220,238,255,') + (b.rip * .35) + ')';
        cx.lineWidth = .8; cx.beginPath();
        cx.ellipse(b.x, b.y, b.r * (1 + (1 - b.rip) * 3), b.r * (1 + (1 - b.rip) * 3), 0, 0, 6.283); cx.stroke();
      }
      var br = b.r * (1 + Math.sin(b.ph) * .035);
      drawDrop(cx, b.x, b.y, br, lit, .92);
    }
    // 滑落水珠
    for (var j = 0; j < runners.length; j++) {
      var d = runners[j], py = d.y;
      d.wob += .014;
      if (d.pause > 0) { d.pause -= 1; d.v *= .86; }        // 表面张力黏住
      else {
        d.v += .00055 * sp;                                  // 极缓的重力加速
        if (Math.random() < .0022) d.pause = 12 + Math.random() * 70;
      }
      var vmax = (.18 + d.r * .052) * sp;
      if (d.v > vmax) d.v = vmax;
      d.y += d.v * (1 + d.r / 9);
      d.x += Math.sin(d.wob) * .10 + d.drift;
      // 只有真正滑落的大水珠才留下极细的水痕（不把凝珠拉成泪滴）
      if (d.y - py > .18 && d.r > 4) {
        var len = Math.min(96, (d.y - py) + d.r * 1.6);
        var g2 = tx.createLinearGradient(d.x, d.y - len, d.x, d.y);
        g2.addColorStop(0, lit ? 'rgba(120,148,178,0)' : 'rgba(190,220,250,0)');
        g2.addColorStop(1, lit ? 'rgba(112,140,172,.085)' : 'rgba(200,228,255,.075)');
        tx.fillStyle = g2;
        tx.fillRect(d.x - d.r * .11, d.y - len, d.r * .22, len);
      }
      // 汇流：吞并路径上的静态凝珠，自己长大、略加速
      for (var k = 0; k < beads.length; k++) {
        var q = beads[k];
        var dx = q.x - d.x, dy = q.y - d.y;
        if (dx * dx + dy * dy < (d.r + q.r) * (d.r + q.r) * 1.3) {
          d.r = Math.min(15, d.r + q.r * .16); d.v += .01 * sp;
          beads[k] = mkBead(false); beads[k].y = Math.min(H, d.y + 6); beads[k].x = d.x + (Math.random() - .5) * 30;
        }
      }
      drawDrop(cx, d.x, d.y, d.r, lit, 1);
      if (d.y - d.r > H + 24) runners[j] = mkRun(false);
    }
    raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  resize(); refill(); kick();
  window.addEventListener('resize', function () { resize(); refill(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  setInterval(function () { refill(); if (S.rainOn !== false) kick(); }, 4000);
}

/* ============ 进场动画：起雾车窗 / 雨滴打上玻璃 / 擦玻璃 ============ */
var INTRO_RAF = 0, INTRO_DONE = false;
function initIntro() {
  var el = $('#intro'); if (!el) return;
  var cfg = S.intro || {};
  if (cfg.on === false) { el.parentNode.removeChild(el); return; }
  try { if (sessionStorage.getItem('lizi_intro') === '1') { el.parentNode.removeChild(el); return; } } catch (e) {}

  var src = cfg.image || 'assets/intro.jpg';
  var cssUrl = 'url("' + src + '")';
  $('#introBg').style.backgroundImage = cssUrl;
  $('#introFog').style.backgroundImage = cssUrl;
  $('#introTitle').textContent = cfg.title || '厘 子';
  $('#introSub').textContent = cfg.sub || '';
  $('#introTip').textContent = cfg.tip || '';
  $('#introSkip').textContent = cfg.skip || '跳过';

  var clearCv = $('#introClear'), rainCv = $('#introRain');
  var cc = clearCv.getContext('2d'), rc = rainCv.getContext('2d');
  var W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
  var img = new Image(), imgReady = false;
  img.onload = function () { imgReady = true; };
  img.onerror = function () { imgReady = false; };
  img.src = src;

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    [clearCv, rainCv].forEach(function (c) {
      c.width = W * dpr; c.height = H * dpr;
      c.style.width = W + 'px'; c.style.height = H + 'px';
    });
    cc.setTransform(dpr, 0, 0, dpr, 0, 0);
    rc.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawCover(ctx, im, w, h) {
    if (!im || !im.width) return;
    var s = Math.max(w / im.width, h / im.height), dw = im.width * s, dh = im.height * s;
    ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
  /* 一抹：把雾层下的清晰底图「擦」出来，边缘留一圈被推开的水膜 */
  function wipe(x, y, r) {
    if (!imgReady) return;
    // 外圈：雾被抹开时略带半透明的水痕晕
    var halo = cc.createRadialGradient(x, y, r * .78, x, y, r * 1.14);
    halo.addColorStop(0, 'rgba(255,255,255,0)');
    halo.addColorStop(.62, 'rgba(255,255,255,.10)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    cc.fillStyle = halo; cc.beginPath(); cc.arc(x, y, r * 1.14, 0, 6.283); cc.fill();
    cc.save(); cc.beginPath(); cc.arc(x, y, r, 0, 6.283); cc.clip();
    drawCover(cc, img, W, H); cc.restore();
    cc.save();
    cc.strokeStyle = 'rgba(255,255,255,.22)'; cc.lineWidth = 2.4;
    cc.beginPath(); cc.arc(x, y, r - 1.2, 0, 6.283); cc.stroke();
    cc.strokeStyle = 'rgba(120,148,178,.10)'; cc.lineWidth = 1;
    cc.beginPath(); cc.arc(x, y, r + 1.5, 0, 6.283); cc.stroke();
    cc.restore();
  }

  /* 车窗雨滴（仿真）：静态凝珠 + 打上涟漪 + 极缓间歇滑落 + 水痕 */
  var wet = [], WET_N = 0, wetTrail = document.createElement('canvas'), wtc = wetTrail.getContext('2d');
  function mkWet(first) {
    return { x: Math.random() * W, y: first ? Math.random() * H : -30 - Math.random() * 60,
      r: 1.2 + Math.pow(Math.random(), 2.6) * 10.5,
      vy: 0, ripple: first ? Math.random() : 1, trail: 0, drift: (Math.random() - .5) * .14,
      hold: Math.random() * 70, ph: Math.random() * 6.28 };
  }
  function refillWet() {
    WET_N = Math.min(170, Math.max(70, Math.round(W * H / 9200)));
    while (wet.length < WET_N) wet.push(mkWet(true));
    if (wet.length > WET_N) wet.length = WET_N;
  }
  function resizeTrail() { wetTrail.width = Math.round(W * dpr); wetTrail.height = Math.round(H * dpr); wtc.setTransform(dpr, 0, 0, dpr, 0, 0); }
  function drawWet(alpha) {
    rc.clearRect(0, 0, W, H);
    wtc.save(); wtc.globalCompositeOperation = 'destination-out';
    wtc.fillStyle = 'rgba(0,0,0,.008)'; wtc.fillRect(0, 0, W, H); wtc.restore();
    rc.save(); rc.globalAlpha = alpha * .9; rc.drawImage(wetTrail, 0, 0, W, H); rc.restore();
    rc.globalAlpha = alpha;
    for (var i = 0; i < wet.length; i++) {
      var d = wet[i], py = d.y;
      d.ph += .01;
      if (d.hold > 0) { d.hold -= 1; d.vy *= .85; }
      else { d.vy += .0008 + d.r * .00009; if (Math.random() < .002) d.hold = 10 + Math.random() * 60; }
      var vmax = .14 + d.r * .035;
      if (d.vy > vmax) d.vy = vmax;
      d.y += d.vy * (1 + d.r / 11); d.x += d.drift + Math.sin(d.ph) * .05;
      if (d.ripple > 0) d.ripple -= .026;
      if (d.ripple > 0) {
        rc.strokeStyle = 'rgba(255,255,255,' + (d.ripple * .5) + ')'; rc.lineWidth = 1;
        rc.beginPath(); rc.ellipse(d.x, d.y, d.r * (1 + (1 - d.ripple) * 2.6), d.r * (1 + (1 - d.ripple) * 2.6), 0, 0, 6.283); rc.stroke();
      }
      if (d.y - py > .18 && d.r > 3.4) {
        var tl = Math.min(96, d.y - py + d.r * 1.5);
        var g2 = wtc.createLinearGradient(d.x, d.y - tl, d.x, d.y);
        g2.addColorStop(0, 'rgba(120,148,178,0)');
        g2.addColorStop(1, 'rgba(116,144,176,.08)');
        wtc.fillStyle = g2; wtc.fillRect(d.x - d.r * .10, d.y - tl, d.r * .20, tl);
      }
      // 水珠本体：凸透镜折射（亮心 + 冷灰边缘 + 底部暗影）
      var ry = d.r * 1.10;
      var g = rc.createRadialGradient(d.x - d.r * .34, d.y - d.r * .42, 0, d.x, d.y, d.r * 1.45);
      g.addColorStop(0, 'rgba(255,255,255,.96)');
      g.addColorStop(.30, 'rgba(226,238,250,.40)');
      g.addColorStop(.74, 'rgba(128,156,188,.24)');
      g.addColorStop(1, 'rgba(88,116,150,.08)');
      rc.fillStyle = g;
      rc.beginPath(); rc.ellipse(d.x, d.y, d.r, ry, 0, 0, 6.283); rc.fill();
      rc.fillStyle = 'rgba(64,92,124,.14)';
      rc.beginPath(); rc.ellipse(d.x, d.y + ry * .5, d.r * .7, ry * .3, 0, 0, 6.283); rc.fill();
      rc.strokeStyle = 'rgba(78,106,140,.24)'; rc.lineWidth = .7;
      rc.beginPath(); rc.ellipse(d.x, d.y, d.r, ry, 0, 0, 6.283); rc.stroke();
      rc.fillStyle = 'rgba(255,255,255,.95)';
      rc.beginPath(); rc.arc(d.x - d.r * .34, d.y - d.r * .44, Math.max(.6, d.r * .2), 0, 6.283); rc.fill();
      if (d.y - d.r > H + 40) wet[i] = mkWet(false);
    }
    rc.globalAlpha = 1;
  }

  /* ---- 手动擦除：累计擦开面积，达标才进入 ---- */
  var NEED = Math.max(12, Math.min(75, Number(cfg.need == null ? 38 : cfg.need)));
  var progress = 0, fading = false, last = null;
  var progs = $('#introProg'), progBar = $('#introProgBar');
  // 低分辨率擦除掩码：统计被擦开的比例
  var mw = 48, mh = 84, mask = new Uint8Array(mw * mh), masked = 0;
  function markMask(x, y, r) {
    var x0 = Math.max(0, Math.floor((x - r) / W * mw)), x1 = Math.min(mw - 1, Math.ceil((x + r) / W * mw));
    var y0 = Math.max(0, Math.floor((y - r) / H * mh)), y1 = Math.min(mh - 1, Math.ceil((y + r) / H * mh));
    var r2 = r * r;
    for (var gy = y0; gy <= y1; gy++) for (var gx = x0; gx <= x1; gx++) {
      var k = gy * mw + gx; if (mask[k]) continue;
      var cx = (gx + .5) / mw * W, cy = (gy + .5) / mh * H, dx = cx - x, dy = cy - y;
      if (dx * dx + dy * dy <= r2) { mask[k] = 1; masked++; }
    }
  }
  function updateProg() {
    var p = masked / (mw * mh) * 100;
    if (p > progress) progress = p;
    if (progBar) progBar.style.width = Math.min(100, progress / NEED * 100) + '%';
    if (progress >= NEED && !fading) reveal();
  }
  function finish() {
    if (INTRO_DONE) return;
    INTRO_DONE = true;
    cancelAnimationFrame(INTRO_RAF);
    try { sessionStorage.setItem('lizi_intro', '1'); } catch (e) {}
    el.classList.add('done');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1250);
  }
  function reveal() {
    fading = true;
    if (progs) progs.classList.add('done');
    $('#introFog').classList.add('clear');
    cc.clearRect(0, 0, W, H); drawCover(cc, img, W, H);
    setTimeout(function () { var c = $('#introCenter'); if (c) c.classList.add('out'); }, 140);
    setTimeout(finish, 1100);
  }
  function frame() {
    drawWet(fading ? .3 : 1);
    INTRO_RAF = requestAnimationFrame(frame);
  }
  var BR = function () { return Math.max(W, H) * .105; };
  function wipeAt(x, y) {
    if (!imgReady) return;                 // 底图未就绪时不擦、不记进度，避免无反馈
    var r = BR();
    wipe(x, y, r);
    markMask(x, y, r * 1.12);
    updateProg();
  }
  // 连续轨迹插值：快速滑动也擦得连贯
  function strokeTo(x, y) {
    if (last) {
      var dx = x - last.x, dy = y - last.y, dist = Math.hypot(dx, dy), step = BR() * .42;
      var n = Math.min(24, Math.ceil(dist / step));
      for (var i = 1; i <= n; i++) wipeAt(last.x + dx * i / n, last.y + dy * i / n);
    } else wipeAt(x, y);
    last = { x: x, y: y };
  }
  function pts(e) {
    if (e.touches && e.touches.length) return Array.prototype.slice.call(e.touches);
    if (e.changedTouches && e.changedTouches.length) return Array.prototype.slice.call(e.changedTouches);
    return [e];
  }
  function onDown(e) { if (fading || INTRO_DONE) return; last = null; var p = pts(e); for (var i = 0; i < p.length; i++) wipeAt(p[i].clientX, p[i].clientY); last = { x: p[0].clientX, y: p[0].clientY }; }
  function onMove(e) {
    if (fading || INTRO_DONE) return;
    if (e.cancelable && e.type === 'touchmove') e.preventDefault();
    var p = pts(e);
    for (var i = 0; i < p.length; i++) strokeTo(p[i].clientX, p[i].clientY);
  }
  function onUp() { last = null; }
  resize(); resizeTrail(); refillWet();
  window.addEventListener('resize', function () { resize(); resizeTrail(); refillWet(); cc.clearRect(0, 0, W, H); });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', function (e) { if (e.buttons || e.pressure) onMove(e); });
  el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
  el.addEventListener('touchstart', onDown, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onUp); el.addEventListener('touchcancel', onUp);
  $('#introSkip').addEventListener('click', function (e) { e.stopPropagation(); if (!fading) reveal(); });
  INTRO_RAF = requestAnimationFrame(frame);
}

/* ============ 事件绑定 ============ */
var renderTimer = null;
function scheduleRender() { clearTimeout(renderTimer); renderTimer = setTimeout(function () { renderAll(); }, 90); }
function bindEvents() {
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#admin')) return;                 // 后台面板内部单独处理
    if (t.closest('#lightbox')) return;
    if (document.body.classList.contains('adminOpen') && !t.closest('.phone')) { closeAdmin(); return; }

    var tab = t.closest('[data-tab]');
    if (tab) { if (EDIT && t.closest('[data-txt]')) return; setTab(tab.dataset.tab); return; }
    if (t.closest('#navPrev') || t.closest('#navNext')) {
      var i = TABS.map(function (x) { return x.k; }).indexOf(TAB);
      var n = t.closest('#navPrev') ? (i + 3) % 4 : (i + 1) % 4;
      setTab(TABS[n].k); return;
    }
    if (t.closest('#adminBtn')) { haptic(); openAdmin(); return; }
    if (t.closest('#exitEditBtn')) { EDIT = false; renderAll(); toast('已退出编辑，进入浏览模式'); return; }
    if (t.closest('#editPanelBtn')) { haptic(); openAdmin(); return; }
    if (t.closest('#editDoneBtn')) { EDIT = false; renderAll(); toast('已退出编辑，进入浏览模式'); return; }
    if (t.closest('#overlay')) { closeAdmin(); return; }

    var gl = t.closest('[data-golink]'); if (gl) { go(gl.dataset.golink); return; }
    var z = t.closest('[data-zoom]'); if (z) { openLightbox(z.dataset.zoom); return; }
    var zs = t.closest('[data-zoomsrc]'); if (zs) { openSrc(zs.dataset.zoomsrc, ''); return; }
    if (t.closest('#albumAdd')) {
      S.album.items.push(clone(NEW_ITEMS['album.items'])); save(); renderAll(); refreshAdmin();
      toast('已添加卡片，请在后台导入图片'); return;
    }
    if (t.closest('#playBtn')) { toggleMusic(); return; }
    if (t.closest('#musicCover')) { if (!AUDIO_ON) playMusic(); return; }
    var kw = t.closest('[data-kw]'); if (kw) {
      haptic(); var k = (S.me.keywords || [])[parseInt(kw.dataset.kw, 10)];
      if (k) sendChat(k.k); return;
    }
    if (t.closest('#chatSend')) { var inp = $('#chatText'); if (inp) { sendChat(inp.value); inp.value = ''; } return; }
    if (t.closest('#focusStart')) {
      FOCUS_RUN = !FOCUS_RUN; haptic();
      if (FOCUS_RUN && FOCUS_LEFT == null) FOCUS_LEFT = (parseInt(S.msg.focus.minutes, 10) || 0) * 60;
      renderMsg(); return;
    }
    if (t.closest('#focusReset')) { FOCUS_RUN = false; FOCUS_LEFT = null; renderMsg(); return; }

    // 链接：浏览态点击直接丝滑跳转，无需二次确认；编辑态点在文字上则进入文字编辑
    var l = t.closest('[data-link]');
    if (l && l.dataset.link) {
      if (EDIT && t.closest('[data-txt]')) return;
      if (jumpable(l.dataset.link)) { go(l.dataset.link); return; }
    }
  });

  // 键盘回车发送消息
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !e.target) return;
    if (e.target.id === 'chatText') { e.preventDefault(); sendChat(e.target.value); e.target.value = ''; }
    if (e.target.id === 'pwd') { e.preventDefault(); var b = $('#loginBtn'); if (b) b.click(); }
  });

  // 直接编辑文字：失焦即保存（只读访客无 contenteditable）
  document.addEventListener('focusout', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-txt][contenteditable="true"]') : null;
    if (!el || READONLY) return;
    var v = el.innerText.replace(/\u00a0/g, ' ').trim();
    setPath(S, el.dataset.txt, v); save(); toast('已保存');
  });

  // 后台：通用字段绑定
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.bind) return;
    if (el.closest && el.closest('#admin')) {
      var v = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.type === 'number' ? Number(el.value) : el.value);
      setPath(S, el.dataset.bind, v); save(); scheduleRender();
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.bind && el.type === 'checkbox' && el.closest('#admin')) {
      setPath(S, el.dataset.bind, el.checked); save(); scheduleRender();
    }
    // 图片导入（相册 / 背景 / 图标 / 便签）
    if (el.dataset && el.dataset.img && el.files && el.files[0]) {
      var path = el.dataset.img, ms = Number(el.dataset.ms) || 2000;
      readImage(el.files[0], ms, .92, function (v) {
        setPath(S, path, v); save(); renderAll(); refreshAdmin(); toast('图片已高清导入');
      });
    }
    // 本地音频导入
    if (el.dataset && el.dataset.audio && el.files && el.files[0]) {
      var f = el.files[0];
      if (f.size > 4 * 1024 * 1024) { toast('音频请小于 4MB，或改用音乐链接'); return; }
      readRaw(f, function (v) { setPath(S, el.dataset.audio, v); save(); renderAll(); initMusic(); refreshAdmin(); toast('音频已导入（原码率）'); });
    }
  });

  // 后台：登录 / 关闭 / 分区展开记忆 / 各类动作
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('#adminClose')) { closeAdmin(); return; }
    if (t.closest('#loginBtn')) {
      var pwd = $('#pwd'), err = $('#pwdErr');
      if (pwd && pwd.value === S.password) {
        LOGIN = true; EDIT = true; try { sessionStorage.setItem('lizi_admin', '1'); } catch (e2) {}
        renderAll(); renderAdmin(); toast('已进入后台 · 现在所有内容都可直接编辑');
      } else { if (err) err.textContent = '密码不正确'; if (pwd) pwd.value = ''; }
      return;
    }
    var sec = t.closest('#admin .sec > summary');
    if (sec) { setTimeout(function () { OPEN_SECS = $$('#admin .sec[open]').map(function (d) { return d.dataset.sec; }); }, 0); }
    var btn = t.closest('#admin [data-act]'); if (!btn) return;
    var parts = btn.dataset.act.split(':'), act = parts[0];
    var links = []; try { links = JSON.parse(localStorage.getItem(LINKS_KEY) || '[]'); } catch (e3) {}
    if (act === 'add' || act === 'del' || act === 'up' || act === 'down') {
      var path = parts[1], arr = getPath(S, path) || [], idx = parseInt(parts[2], 10);
      if (act === 'add') { arr.push(clone(NEW_ITEMS[path] || { text: '新内容' })); toast('已添加'); }
      if (act === 'del') { arr.splice(idx, 1); toast('已删除'); }
      if (act === 'up' && idx > 0) { var a0 = arr[idx]; arr[idx] = arr[idx - 1]; arr[idx - 1] = a0; }
      if (act === 'down' && idx < arr.length - 1) { var b0 = arr[idx]; arr[idx] = arr[idx + 1]; arr[idx + 1] = b0; }
      setPath(S, path, arr); save(); renderAll(); refreshAdmin();
      if (path.indexOf('me.') === 0 || path === 'me.messages') syncChat();
      return;
    }
    if (act === 'clearimg') { setPath(S, parts[1], ''); save(); renderAll(); refreshAdmin(); return; }
    if (act === 'chatreset') { syncChat(); renderMe(); toast('聊天记录已重置'); return; }
    if (act === 'genlink') { genReadonly(); return; }
    if (act === 'opennow' || act === 'copynow' || act === 'copylink' || act === 'openlink') {
      var link = (act === 'copylink' || act === 'openlink') ? links[parseInt(parts[1], 10)].link : (window.__LAST_LINK || '');
      if (act === 'openlink' || act === 'opennow') { if (link) window.open(link, '_blank'); }
      else copyText(link);
      return;
    }
    if (act === 'restore') { restoreAll(); return; }
    if (act === 'export') { exportData(); return; }
    if (act === 'import') {
      var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'application/json,.json';
      fi.onchange = function () { if (!fi.files[0]) return; readRaw(fi.files[0], function (v) {
        try {
          var txt = '';
          try { txt = new TextDecoder().decode(Uint8Array.from(atob(v.split(',')[1]), function (c) { return c.charCodeAt(0); })); }
          catch (e5) { txt = decodeURIComponent(v.replace(/^data:[^,]*,/, '')); }
          S = merge(window.DEFAULTS, JSON.parse(txt));
          save(); syncChat(); renderAll(); initMusic(); refreshAdmin(); toast('数据已导入');
        } catch (er) { toast('文件格式不正确'); }
      }); };
      fi.click(); return;
    }
    if (act === 'logout') {
      LOGIN = false; EDIT = false; try { sessionStorage.removeItem('lizi_admin'); } catch (e4) {}
      renderAll(); closeAdmin(); toast('已退出登录，当前为只读浏览'); return;
    }
  });

  // 图片放大层
  $('#lbClose').addEventListener('click', function () { $('#lightbox').classList.remove('on'); });
  $('#lightbox').addEventListener('click', function (e) { if (e.target.id === 'lightbox') $('#lightbox').classList.remove('on'); });
  $('#lbLink').addEventListener('click', function () { if (LB_LINK) go(LB_LINK); });
  $('#overlay').addEventListener('click', function () { closeAdmin(); });
}

/* ============ 启动 ============ */
async function boot() {
  var ro = await bootReadonly();
  if (!ro) { loadLocal(); await probeCloud(); }
  LOGIN = !READONLY && (function () { try { return sessionStorage.getItem('lizi_admin') === '1'; } catch (e) { return false; } })();
  EDIT = LOGIN && !READONLY;
  syncChat();
  renderAll();
  initMusic();
  initRain();
  bindEvents();
  initIntro();
  setTab(TAB, true);
  FOCUS_TM = setInterval(focusTick, 1000);
  setInterval(function () {
    if (S.status.autoTime === false || READONLY) return;
    var el = $('#statusbar [data-txt="status.timeText"]');
    if (el && el.getAttribute('contenteditable') !== 'true') el.textContent = fmtTime();
  }, 15000);
  document.title = (S.profile && S.profile.name ? S.profile.name + ' · ' : '') + '病恋档案';
  if (READONLY) toast('只读快照 · 内容已锁定，仅供浏览', 2800);
}
boot();


})();
