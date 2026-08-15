/**
 * SK Store - JavaScript puro
 * Hosting: GitHub Pages
 *
 * - Los juegos se detectan automáticamente leyendo la carpeta games/ con la API de GitHub
 * - Admin: 1eracuentasecundariadegd@gmail.com
 * - Contraseña de admin fija en el código
 * - Usuarios normales: usuario + contraseña guardados en localStorage
 * - Email opcional solo para que el admin pueda contactar a los beta testers
 */

// ============================================================
// CONFIGURACIÓN - CAMBIA ESTOS DOS VALORES
// ============================================================
const GITHUB_USER = 'Anonimo-Crypto';
const GITHUB_REPO = 'SK-Store';

const ADMIN_USERNAME = '1eracuentasecundariadegd@gmail.com';
const ADMIN_PASSWORD = 'TLOZBOTW';
const MAX_BETA = 10;

// ============================================================
// FIREBASE - pega aquí la config de tu proyecto
// Firebase Console → Project settings → Your apps → SDK setup
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA7SvgYiXGOiYG8lWfUKoCRG6OGku7KOXU",
  authDomain: "sk-store-1e990.firebaseapp.com",
  projectId: "sk-store-1e990",
  storageBucket: "sk-store-1e990.firebasestorage.app",
  messagingSenderId: "10255653834",
  appId: "1:10255653834:web:7ffcf90fce8bf4814b4d33",
  measurementId: "G-77P3LYL1LB"
};

let db = null; // Firestore
let firebaseReady = false;

function initFirebase() {
  try {
    if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes('PEGA_AQUI')) {
      console.warn('[SK Store] Firebase no configurado. Usando datos locales.');
      return false;
    }
    if (typeof firebase === 'undefined') {
      console.warn('[SK Store] SDK de Firebase no cargado.');
      return false;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    firebaseReady = true;
    console.log('[SK Store] Firebase conectado');
    return true;
  } catch (e) {
    console.error('[SK Store] Error Firebase:', e);
    firebaseReady = false;
    return false;
  }
}

// ============================================================

let GAMES = [];      // juegos
let APPS = [];       // apps
let currentUser = null;   // { username, email?, isAdmin }
let currentGameId = null;
let currentTab = 'games'; // 'games' | 'apps' | 'users'
let authMode = 'login';

// ============== STORAGE ==============
const store = {
  get(key, def = null) {
    try {
      const v = localStorage.getItem('skstore_' + key);
      return v ? JSON.parse(v) : def;
    } catch { return def; }
  },
  set(key, val) {
    localStorage.setItem('skstore_' + key, JSON.stringify(val));
  }
};

// ---------- USUARIOS ----------
async function getUsers() {
  if (firebaseReady) {
    try {
      const snap = await db.collection('users').get();
      const users = {};
      snap.forEach(doc => { users[doc.id] = doc.data(); });
      store.set('users', users); // cache
      return users;
    } catch (e) {
      console.warn('Firebase getUsers:', e);
    }
  }
  return store.get('users', {});
}

async function saveUser(username, data) {
  const key = username.toLowerCase();
  if (firebaseReady) {
    try {
      await db.collection('users').doc(key).set({
        ...data,
        username: data.username || username,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Firebase saveUser:', e);
    }
  }
  const users = store.get('users', {});
  users[key] = { ...users[key], ...data, username: data.username || username };
  store.set('users', users);
}

async function getUser(username) {
  const key = username.toLowerCase();
  if (firebaseReady) {
    try {
      const doc = await db.collection('users').doc(key).get();
      if (doc.exists) return doc.data();
    } catch (e) {
      console.warn('Firebase getUser:', e);
    }
  }
  const users = store.get('users', {});
  return users[key] || null;
}

// ---------- DESCARGAS (globales) ----------
function getDownloadsCached(itemId) {
  const all = store.get('downloads', {});
  return all[itemId] || 0;
}

async function getDownloads(itemId) {
  if (firebaseReady) {
    try {
      const doc = await db.collection('downloads').doc(itemId).get();
      const count = doc.exists ? (doc.data().count || 0) : 0;
      const all = store.get('downloads', {});
      all[itemId] = count;
      store.set('downloads', all);
      return count;
    } catch (e) {
      console.warn('Firebase getDownloads:', e);
    }
  }
  return getDownloadsCached(itemId);
}

async function incDownloads(itemId) {
  if (firebaseReady) {
    try {
      const ref = db.collection('downloads').doc(itemId);
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(ref);
        const current = doc.exists ? (doc.data().count || 0) : 0;
        tx.set(ref, { count: current + 1, updatedAt: new Date().toISOString() }, { merge: true });
      });
      const doc = await ref.get();
      const count = doc.exists ? (doc.data().count || 0) : 0;
      const all = store.get('downloads', {});
      all[itemId] = count;
      store.set('downloads', all);
      return count;
    } catch (e) {
      console.warn('Firebase incDownloads:', e);
    }
  }
  const all = store.get('downloads', {});
  all[itemId] = (all[itemId] || 0) + 1;
  store.set('downloads', all);
  return all[itemId];
}

// ---------- COMENTARIOS ----------
async function getComments(gameId) {
  if (firebaseReady) {
    try {
      const snap = await db.collection('comments').doc(gameId).collection('items')
        .orderBy('date', 'desc').limit(50).get();
      return snap.docs.map(d => d.data());
    } catch (e) {
      console.warn('Firebase getComments:', e);
    }
  }
  const all = store.get('comments', {});
  return all[gameId] || [];
}

async function addComment(gameId, author, text) {
  const comment = { author, text, date: new Date().toISOString() };
  if (firebaseReady) {
    try {
      await db.collection('comments').doc(gameId).collection('items').add(comment);
      return;
    } catch (e) {
      console.warn('Firebase addComment:', e);
    }
  }
  const all = store.get('comments', {});
  if (!all[gameId]) all[gameId] = [];
  all[gameId].unshift(comment);
  store.set('comments', all);
}

// ---------- BETA REQUESTS ----------
async function getBetaRequests() {
  if (firebaseReady) {
    try {
      const snap = await db.collection('betaRequests').orderBy('date', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('Firebase getBetaRequests:', e);
    }
  }
  return store.get('betaRequests', []);
}

async function saveBetaRequest(req) {
  if (firebaseReady) {
    try {
      if (req.id) {
        const { id, ...data } = req;
        await db.collection('betaRequests').doc(id).set(data, { merge: true });
      } else {
        const ref = await db.collection('betaRequests').add(req);
        req.id = ref.id;
      }
      return req;
    } catch (e) {
      console.warn('Firebase saveBetaRequest:', e);
    }
  }
  const list = store.get('betaRequests', []);
  const idx = list.findIndex(r => r.id === req.id);
  if (idx >= 0) list[idx] = req;
  else list.push(req);
  store.set('betaRequests', list);
  return req;
}

async function getAcceptedBetas(gameId) {
  const list = await getBetaRequests();
  return list.filter(r => r.gameId === gameId && r.status === 'accepted');
}

async function addUserMessage(username, msg) {
  const entry = { ...msg, date: new Date().toISOString(), read: false };
  if (firebaseReady) {
    try {
      await db.collection('userMessages').doc(username).collection('items').add(entry);
      return;
    } catch (e) {
      console.warn('Firebase addUserMessage:', e);
    }
  }
  const all = store.get('userMessages', {});
  if (!all[username]) all[username] = [];
  all[username].unshift(entry);
  store.set('userMessages', all);
}

async function getUnreadAdminCount() {
  const list = await getBetaRequests();
  return list.filter(r => r.status === 'pending').length;
}

// ============== HELPERS ==============
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function showToast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

function formatSize(bytes) {
  if (!bytes || bytes < 1024) return (bytes || 0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function simpleMarkdown(md) {
  if (!md) return '';
  return md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/, '<ul>$1</ul>')
    .replace(/\n/g, '<br>');
}

const COLORS = [
  '#4caf50', '#2196f3', '#ff5722', '#9c27b0',
  '#ff9800', '#00bcd4', '#e91e63', '#3f51b5',
  '#009688', '#cddc39'
];


// ============== TEMA (modo oscuro) ==============
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const sun = document.getElementById('icon-sun');
  const moon = document.getElementById('icon-moon');
  if (sun && moon) {
    if (theme === 'dark') {
      sun.classList.remove('hidden');
      moon.classList.add('hidden');
    } else {
      sun.classList.add('hidden');
      moon.classList.remove('hidden');
    }
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('skstore_theme', next);
}

function initTheme() {
  const saved = localStorage.getItem('skstore_theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

// ============== CARGAR JUEGOS (puro JS + GitHub API) ==============
async function loadGames() {
  GAMES = [];
  APPS = [];

  if (GITHUB_USER) {
    try {
      console.log('[SK Store] Cargando desde GitHub:', GITHUB_USER + '/' + GITHUB_REPO);
      const [games, apps] = await Promise.all([
        loadFolderFromGitHub('games'),
        loadFolderFromGitHub('apps')
      ]);
      GAMES = games;
      APPS = apps;
      console.log('[SK Store] Juegos:', GAMES.length, 'Apps:', APPS.length);
      renderGames();
      // Prefetch download counts
      [...GAMES, ...APPS].forEach(g => getDownloads(g.id));
      return;
    } catch (e) {
      console.warn('[SK Store] GitHub API falló:', e.message);
    }
  }

  // Fallback local de ejemplo
  console.log('[SK Store] Usando ejemplos locales');
  GAMES = [
    {
      id: 'Malakias',
      name: 'Malakias',
      apk: 'Malakias.apk',
      size: 0,
      iconLetter: 'M',
      color: COLORS[0],
      coverUrl: 'games/Malakias/Portada.png',
      folder: 'games',
      developer: 'Desarrollador independiente'
    },
    {
      id: 'PixelRunner',
      name: 'Pixel Runner',
      apk: 'PixelRunner.apk',
      size: 0,
      iconLetter: 'P',
      color: COLORS[1],
      coverUrl: 'games/PixelRunner/Portada.png',
      folder: 'games',
      developer: 'Desarrollador independiente'
    }
  ];
  APPS = [];
  renderGames();
}

async function loadFolderFromGitHub(folderName) {
  const api = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${folderName}`;
  const res = await fetch(api);
  if (!res.ok) {
    if (res.status === 404) return []; // carpeta vacía o inexistente
    const errBody = await res.text().catch(() => '');
    if (res.status === 403) {
      throw new Error('API de GitHub limitó las peticiones. Espera un momento.');
    }
    throw new Error('Error ' + res.status + ' al listar ' + folderName);
  }

  const items = await res.json();
  if (!Array.isArray(items)) return [];
  const folders = items.filter(i => i.type === 'dir');
  const list = [];

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const folderRes = await fetch(folder.url);
    if (!folderRes.ok) continue;
    const files = await folderRes.json();
    const apk = files.find(f => f.name.toLowerCase().endsWith('.apk'));
    const readme = files.find(f => f.name.toLowerCase() === 'readme.md');
    const cover = files.find(f => f.name.toLowerCase() === 'portada.png');
    const devFile = files.find(f => f.name.toLowerCase() === 'developer.txt');

    if (!apk) continue;

    let name = folder.name;
    let developer = 'Desarrollador independiente';

    if (readme && readme.download_url) {
      try {
        const mdRes = await fetch(readme.download_url);
        if (mdRes.ok) {
          const md = await mdRes.text();
          const match = md.match(/^#\s+(.+)$/m);
          if (match) name = match[1].trim();
        }
      } catch (_) {}
    }

    if (devFile && devFile.download_url) {
      try {
        const dRes = await fetch(devFile.download_url);
        if (dRes.ok) developer = (await dRes.text()).trim() || developer;
      } catch (_) {}
    }

    list.push({
      id: folder.name,
      name: name,
      apk: apk.name,
      size: apk.size || 0,
      iconLetter: name[0].toUpperCase(),
      color: COLORS[i % COLORS.length],
      apkUrl: apk.download_url,
      readmeUrl: readme ? readme.download_url : null,
      coverUrl: cover ? cover.download_url : null,
      folder: folderName,
      developer: developer
    });
  }
  return list;
}

function getCurrentList() {
  return currentTab === 'apps' ? APPS : GAMES;
}

function findItem(id) {
  return GAMES.find(g => g.id === id) || APPS.find(g => g.id === id);
}

function renderGames() {
  const grid = $('#games-grid');
  const empty = $('#no-games');
  if (!grid) return;
  grid.innerHTML = '';

  const list = getCurrentList();

  // Títulos
  const title = $('#home-title');
  const sub = $('#home-subtitle');
  if (title) title.textContent = currentTab === 'apps' ? 'Apps' : 'Juegos';
  if (sub) sub.textContent = currentTab === 'apps'
    ? 'Aplicaciones independientes'
    : 'Juegos independientes hechos con pasión';

  if (list.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.forEach(g => {
    const downloads = getDownloadsCached(g.id);
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => goDetail(g.id);

    const folder = g.folder || (currentTab === 'apps' ? 'apps' : 'games');
    const coverSrc = g.coverUrl || `${folder}/${g.id}/Portada.png`;
    const iconHtml = `<img src="${coverSrc}" alt="${escapeHtml(g.name)}" onerror="this.style.display='none';this.parentElement.textContent='${g.iconLetter}'">`;

    card.innerHTML = `
      <div class="game-card-icon" style="background:linear-gradient(135deg,${g.color}22,${g.color}55);color:${g.color}">
        ${iconHtml}
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${escapeHtml(g.name)}</div>
        <div class="game-card-meta" data-dl-id="${g.id}">${downloads} descarga${downloads !== 1 ? 's' : ''}</div>
      </div>
    `;
    grid.appendChild(card);

    // Actualizar contador global en segundo plano
    getDownloads(g.id).then(n => {
      const el = card.querySelector(`[data-dl-id="${g.id}"]`);
      if (el) el.textContent = `${n} descarga${n !== 1 ? 's' : ''}`;
    });
  });
}

// ============== NAVIGATION ==============
function showView(name) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $(`#view-${name}`).classList.remove('hidden');
  $('#btn-back').classList.toggle('hidden', name === 'home');
  updateMessagesBadge();
}

function goHome() {
  currentGameId = null;
  history.replaceState(null, '', location.pathname);
  if (currentTab === 'users' && currentUser && currentUser.isAdmin) {
    showView('users');
    renderUsers();
  } else {
    if (currentTab === 'users') currentTab = 'games';
    showView('home');
    renderGames();
  }
}

function goDetail(gameId) {
  currentGameId = gameId;
  history.replaceState(null, '', `?game=${encodeURIComponent(gameId)}`);
  showView('detail');
  renderDetail(gameId);
}

function goMessages() {
  if (!currentUser || !currentUser.isAdmin) return;
  showView('messages');
  renderMessages();
}

// ============== DETALLE ==============
async function renderDetail(gameId) {
  const game = findItem(gameId);
  if (!game) {
    showToast('No encontrado');
    goHome();
    return;
  }

  $('#detail-title').textContent = game.name;
  const detailIcon = $('#detail-icon');
  const coverSrc = game.coverUrl || `${game.folder || 'games'}/${game.id}/Portada.png`;
  detailIcon.innerHTML = `<img src="${coverSrc}" alt="${escapeHtml(game.name)}" onerror="this.remove();this.parentElement.textContent='${game.iconLetter}'">`;
  detailIcon.style.background = `linear-gradient(135deg,${game.color}22,${game.color}55)`;
  detailIcon.style.color = game.color;
  const cachedDl = getDownloadsCached(gameId);
  $('#detail-downloads').textContent = `${cachedDl} descarga${cachedDl !== 1 ? 's' : ''}`;
  getDownloads(gameId).then(n => {
    $('#detail-downloads').textContent = `${n} descarga${n !== 1 ? 's' : ''}`;
  });
  const devEl = $('#detail-developer');
  if (devEl) devEl.textContent = game.developer || '—';
  $('#detail-size').textContent = formatSize(game.size);

  // Descripción
  const descEl = $('#detail-description');
  descEl.innerHTML = '<em>Cargando descripción...</em>';

  const readmeUrl = game.readmeUrl || `${game.folder || 'games'}/${game.id}/README.md`;
  try {
    const res = await fetch(readmeUrl);
    if (res.ok) {
      if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        descEl.innerHTML = marked.parse(await res.text());
      } else {
        descEl.innerHTML = simpleMarkdown(await res.text());
      }
    } else {
      descEl.textContent = 'Sin descripción disponible.';
    }
  } catch {
    descEl.textContent = 'Sin descripción disponible.';
  }

  // Reset progreso
  $('#download-progress').classList.add('hidden');
  $('#progress-fill').style.width = '0%';
  $('#progress-text').textContent = '0%';
  $('#btn-install').disabled = false;
  $('#btn-install').textContent = 'Descargar';

  // Beta
  const accepted = await getAcceptedBetas(gameId);
  $('#beta-count').textContent = `${accepted.length}/${MAX_BETA}`;

  const betaBtn = $('#btn-beta-request');
  const betaStatus = $('#beta-status');
  betaStatus.classList.add('hidden');
  betaBtn.classList.remove('hidden');
  betaBtn.disabled = false;

  if (!currentUser) {
    betaBtn.textContent = 'Inicia sesión para solicitar';
    betaBtn.onclick = openLoginModal;
  } else {
    const allReqs = await getBetaRequests();
    const myReq = allReqs.find(
      r => r.gameId === gameId && r.username.toLowerCase() === currentUser.username.toLowerCase()
    );
    if (myReq) {
      betaBtn.classList.add('hidden');
      betaStatus.classList.remove('hidden');
      if (myReq.status === 'pending') betaStatus.textContent = 'Solicitud pendiente de revisión.';
      else if (myReq.status === 'accepted') betaStatus.textContent = '¡Eres beta tester de este juego!';
      else betaStatus.textContent = 'Tu solicitud fue rechazada.';
    } else if (accepted.length >= MAX_BETA) {
      betaBtn.disabled = true;
      betaBtn.textContent = 'Cupo de beta testers lleno';
    } else {
      betaBtn.textContent = 'Solicitar ser beta tester';
      betaBtn.onclick = () => requestBeta(gameId);
    }
  }

  await renderComments(gameId);
  if (currentUser) {
    $('#comment-form').classList.remove('hidden');
    $('#comment-login-hint').classList.add('hidden');
  } else {
    $('#comment-form').classList.add('hidden');
    $('#comment-login-hint').classList.remove('hidden');
  }
}

async function renderComments(gameId) {
  const list = $('#comments-list');
  const comments = await getComments(gameId);
  if (!comments.length) {
    list.innerHTML = '<p class="hint">Sé el primero en comentar</p>';
    return;
  }
  list.innerHTML = comments.map(c => `
    <div class="comment">
      <div class="comment-header">
        <span class="comment-author">${escapeHtml(c.author)}</span>
        <span class="comment-date">${formatDate(c.date)}</span>
      </div>
      <div class="comment-body">${escapeHtml(c.text)}</div>
    </div>
  `).join('');
}

// ============== DESCARGA ==============
function startDownload() {
  if (!currentGameId) return;
  const game = findItem(currentGameId);
  if (!game) return;

  const btn = $('#btn-install');
  const progressWrap = $('#download-progress');
  const fill = $('#progress-fill');
  const text = $('#progress-text');

  // Ruta relativa (mismo origen en GitHub Pages) → el navegador muestra su diálogo nativo
  // Si falla (pruebas locales raras), se usa la URL raw de GitHub como respaldo
  const folder = game.folder || 'games';
  const url = `${folder}/${game.id}/${game.apk}`;

  // Descarga nativa del navegador (como cualquier página normal)
  // Esto muestra el diálogo del navegador y la barra de descarga del sistema
  const a = document.createElement('a');
  a.href = url;
  a.download = game.apk; // sugiere el nombre del archivo
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Contar descarga (global)
  btn.textContent = 'Iniciando...';
  btn.disabled = true;
  incDownloads(game.id).then(n => {
    $('#detail-downloads').textContent = `${n} descarga${n !== 1 ? 's' : ''}`;
  });

  showToast('Si el navegador lo pide, acepta la descarga');

  // No mostramos barra falsa: el progreso real lo lleva el navegador
  progressWrap.classList.add('hidden');

  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = 'Descargar de nuevo';
  }, 1500);
}

// ============== COMPARTIR ==============
function shareGame() {
  if (!currentGameId) return;
  const url = `${location.origin}${location.pathname}?game=${encodeURIComponent(currentGameId)}`;
  if (navigator.share) {
    navigator.share({ title: `SK Store – ${currentGameId}`, text: 'Mira este juego', url })
      .catch(() => copyShare(url));
  } else {
    copyShare(url);
  }
}
function copyShare(url) {
  navigator.clipboard.writeText(url)
    .then(() => showToast('Enlace copiado'))
    .catch(() => prompt('Copia este enlace:', url));
}

// ============== BETA ==============
async function requestBeta(gameId) {
  if (!currentUser) { openLoginModal(); return; }

  const accepted = await getAcceptedBetas(gameId);
  if (accepted.length >= MAX_BETA) {
    showToast('Cupo de beta testers lleno');
    return;
  }
  const allReqs = await getBetaRequests();
  const exists = allReqs.find(
    r => r.gameId === gameId && r.username.toLowerCase() === currentUser.username.toLowerCase()
  );
  if (exists) {
    showToast('Ya tienes una solicitud para este juego');
    return;
  }

  await saveBetaRequest({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    gameId,
    username: currentUser.username,
    email: currentUser.email || null,
    status: 'pending',
    date: new Date().toISOString()
  });

  showToast('Solicitud enviada. El desarrollador la revisará.');
  renderDetail(gameId);
  updateMessagesBadge();
}

// ============== MENSAJES (SOLO ADMIN) ==============
async function updateMessagesBadge() {
  const btn = $('#btn-messages');
  const badge = $('#msg-badge');

  if (currentUser && currentUser.isAdmin) {
    btn.classList.remove('hidden');
    const count = await getUnreadAdminCount();
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  } else {
    btn.classList.add('hidden');
    badge.classList.add('hidden');
  }
}

async function renderMessages() {
  if (!currentUser || !currentUser.isAdmin) {
    goHome();
    return;
  }

  const list = $('#messages-list');
  const allReqs = await getBetaRequests();
  const pending = allReqs.filter(r => r.status === 'pending');

  if (!pending.length) {
    list.innerHTML = '<div class="empty-state">No hay solicitudes pendientes</div>';
    return;
  }

  list.innerHTML = pending.map(r => {
    const game = findItem(r.gameId);
    // Mostrar claramente el correo para que el admin pueda escribirle
    const emailBlock = r.email
      ? `<div style="margin-top:6px">
           <strong>Correo:</strong> 
           <a href="mailto:${escapeHtml(r.email)}" style="color:var(--primary)">${escapeHtml(r.email)}</a>
         </div>`
      : `<div style="margin-top:6px;color:#888"><em>No dejó correo</em></div>`;

    return `
      <div class="message-card unread">
        <div class="message-title">Solicitud de beta tester</div>
        <div class="message-meta">
          <strong>Juego:</strong> ${game ? escapeHtml(game.name) : r.gameId}<br>
          <strong>Usuario:</strong> ${escapeHtml(r.username)}
          ${emailBlock}
          <div style="margin-top:4px;font-size:0.8rem">${formatDate(r.date)}</div>
        </div>
        <div class="message-actions">
          <button class="btn-accept" onclick="acceptBeta('${r.id}')">Aceptar</button>
          <button class="btn-reject" onclick="rejectBeta('${r.id}')">Rechazar</button>
        </div>
      </div>
    `;
  }).join('');
}

async function acceptBeta(reqId) {
  if (!currentUser || !currentUser.isAdmin) return;

  const list = await getBetaRequests();
  const req = list.find(r => r.id === reqId);
  if (!req) return;

  const accepted = await getAcceptedBetas(req.gameId);
  if (accepted.length >= MAX_BETA) {
    showToast('Ya hay 10 beta testers en este juego');
    return;
  }

  req.status = 'accepted';
  await saveBetaRequest(req);

  await addUserMessage(req.username, {
    type: 'beta_accepted',
    gameId: req.gameId,
    text: `¡Felicidades! Has sido aceptado como beta tester de «${req.gameId}».`
  });

  // Abrir correo para que el admin escriba al usuario
  if (req.email) {
    const subject = encodeURIComponent(`SK Store – Aceptado como beta tester de ${req.gameId}`);
    const body = encodeURIComponent(
      `Hola ${req.username},\n\nHas sido aceptado como beta tester del juego "${req.gameId}" en SK Store.\n\n¡Gracias por tu interés!\n\n— SK Store`
    );
    window.open(`mailto:${req.email}?subject=${subject}&body=${body}`, '_blank');
    showToast(`Aceptado. Se abrió tu correo para escribir a ${req.email}`);
  } else {
    showToast(`Aceptado: ${req.username} (no dejó correo)`);
  }

  renderMessages();
  updateMessagesBadge();
}

async function rejectBeta(reqId) {
  if (!currentUser || !currentUser.isAdmin) return;

  const list = await getBetaRequests();
  const req = list.find(r => r.id === reqId);
  if (!req) return;

  req.status = 'rejected';
  await saveBetaRequest(req);

  await addUserMessage(req.username, {
    type: 'beta_rejected',
    gameId: req.gameId,
    text: `Tu solicitud de beta tester para «${req.gameId}» no fue aceptada en esta ocasión.`
  });

  if (req.email) {
    const subject = encodeURIComponent(`SK Store – Solicitud de beta tester`);
    const body = encodeURIComponent(
      `Hola ${req.username},\n\nLamentablemente tu solicitud para ser beta tester de "${req.gameId}" no pudo ser aceptada en esta ocasión.\n\nGracias por tu interés.\n\n— SK Store`
    );
    window.open(`mailto:${req.email}?subject=${subject}&body=${body}`, '_blank');
    showToast(`Rechazado. Se abrió tu correo para avisar a ${req.email}`);
  } else {
    showToast('Solicitud rechazada');
  }

  renderMessages();
  updateMessagesBadge();
}

window.acceptBeta = acceptBeta;
window.rejectBeta = rejectBeta;


function togglePasswordVisibility() {
  const input = document.getElementById('auth-password');
  const eye = document.getElementById('icon-eye');
  const eyeOff = document.getElementById('icon-eye-off');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (eye) eye.classList.add('hidden');
    if (eyeOff) eyeOff.classList.remove('hidden');
  } else {
    input.type = 'password';
    if (eye) eye.classList.remove('hidden');
    if (eyeOff) eyeOff.classList.add('hidden');
  }
}

// ============== AUTH ==============
function openLoginModal() {
  authMode = 'login';
  updateAuthUI();
  $('#modal-overlay').classList.remove('hidden');
  $('#auth-username').value = '';
  $('#auth-password').value = '';
  $('#auth-email').value = '';
  $('#auth-error').classList.add('hidden');
  setTimeout(() => $('#auth-username').focus(), 80);
}

function closeModal() {
  $('#modal-overlay').classList.add('hidden');
}

function updateAuthUI() {
  const isRegister = authMode === 'register';
  $('#modal-title').textContent = isRegister ? 'Crear cuenta' : 'Iniciar sesión';
  $('#btn-auth-submit').textContent = isRegister ? 'Registrarse' : 'Entrar';
  $('#switch-text').textContent = isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
  $('#btn-switch-mode').textContent = isRegister ? 'Inicia sesión' : 'Regístrate';
  $('#email-group').classList.add('visible'); // siempre visible (admin se valida por correo)
  $('#auth-error').classList.add('hidden');
}

function switchAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  updateAuthUI();
}

async function handleAuth() {
  const username = $('#auth-username').value.trim();
  const password = $('#auth-password').value;
  const email = $('#auth-email').value.trim();
  const err = $('#auth-error');

  if (!password) {
    err.textContent = 'Escribe una contraseña';
    err.classList.remove('hidden');
    return;
  }

  const key = (username || '').toLowerCase();

  // ===== ADMIN: se verifica por CORREO (3er campo) + CONTRASEÑA (2do campo) =====
  if (email && email.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
    if (password !== ADMIN_PASSWORD) {
      err.textContent = 'Contraseña incorrecta';
      err.classList.remove('hidden');
      return;
    }
    currentUser = {
      username: (username && username.length >= 1) ? username : 'Admin',
      email: ADMIN_USERNAME,
      isAdmin: true
    };
    // Registrar también en Firebase para que aparezca en la lista
    await saveUser(currentUser.username, {
      username: currentUser.username,
      email: ADMIN_USERNAME,
      isAdmin: true,
      createdAt: new Date().toISOString()
    });
    finishLogin('Bienvenido, administrador');
    return;
  }

  // Validaciones para usuarios normales
  if (!username) {
    err.textContent = 'Escribe un nombre de usuario';
    err.classList.remove('hidden');
    return;
  }
  if (username.length < 2) {
    err.textContent = 'El nombre debe tener al menos 2 caracteres';
    err.classList.remove('hidden');
    return;
  }
  if (password.length < 4) {
    err.textContent = 'La contraseña debe tener al menos 4 caracteres';
    err.classList.remove('hidden');
    return;
  }

  // ===== USUARIOS NORMALES =====
  if (authMode === 'register') {
    const existing = await getUser(username);
    if (existing) {
      err.textContent = 'Ese nombre de usuario ya está en uso';
      err.classList.remove('hidden');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.textContent = 'El correo no parece válido';
      err.classList.remove('hidden');
      return;
    }

    await saveUser(username, {
      username: username,
      password: password,
      email: email || null,
      isAdmin: false,
      createdAt: new Date().toISOString()
    });

    currentUser = {
      username: username,
      email: email || null,
      isAdmin: false
    };
    finishLogin('Cuenta creada. ¡Bienvenido!');
  } else {
    // Login normal
    const user = await getUser(username);
    if (!user || user.password !== password) {
      err.textContent = 'Usuario o contraseña incorrectos';
      err.classList.remove('hidden');
      return;
    }
    currentUser = {
      username: user.username,
      email: user.email || null,
      isAdmin: false
    };
    finishLogin(`¡Hola, ${currentUser.username}!`);
  }
}

function finishLogin(msg) {
  store.set('session', {
    username: currentUser.username,
    email: currentUser.email,
    isAdmin: currentUser.isAdmin
  });

  closeModal();
  updateUserUI();
  showToast(msg);

  if (currentGameId) renderDetail(currentGameId);
  updateMessagesBadge();

  if (currentUser.isAdmin) {
    getUnreadAdminCount().then(n => {
      if (n > 0) setTimeout(() => showToast('Tienes solicitudes de beta pendientes'), 900);
    });
  }
}

function updateUserUI() {
  if (currentUser) {
    $('#btn-login').classList.add('hidden');
    $('#user-info').classList.remove('hidden');
    $('#user-name').textContent = currentUser.username;
  } else {
    $('#btn-login').classList.remove('hidden');
    $('#user-info').classList.add('hidden');
  }
  updateMessagesBadge();
  updateAdminTabs();
}

function logout() {
  currentUser = null;
  store.set('session', null);
  updateUserUI();
  if (currentGameId) renderDetail(currentGameId);
  showToast('Sesión cerrada');
  goHome();
}

function restoreSession() {
  const session = store.get('session');
  if (!session || !session.username) return;

  // Si es el admin, confiamos en la sesión (ya verificó la contraseña antes)
  if (session.isAdmin) {
    currentUser = {
      username: session.username || 'Admin',
      email: ADMIN_USERNAME,
      isAdmin: true
    };
    updateUserUI();
    return;
  }

  // Usuario normal
  getUser(session.username).then(user => {
    if (!user) return;
    currentUser = {
      username: user.username,
      email: user.email || null,
      isAdmin: false
    };
    updateUserUI();
  });
}

// ============== COMENTARIOS ==============
async function submitComment() {
  if (!currentUser || !currentGameId) return;
  const input = $('#comment-input');
  const text = input.value.trim();
  if (!text) return;
  await addComment(currentGameId, currentUser.username, text);
  input.value = '';
  await renderComments(currentGameId);
  showToast('Comentario publicado');
}


// ============== TABS & USUARIOS ==============
function switchTab(tab) {
  currentTab = tab;
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  if (tab === 'users') {
    if (!currentUser || !currentUser.isAdmin) {
      switchTab('games');
      return;
    }
    showView('users');
    renderUsers();
  } else {
    showView('home');
    renderGames();
  }
}

async function renderUsers(filter = '') {
  const list = $('#users-list');
  const totalEl = $('#users-total');
  if (!list) return;

  const users = await getUsers();
  let entries = Object.values(users);

  if (filter) {
    const q = filter.toLowerCase();
    entries = entries.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }

  totalEl.textContent = `${Object.keys(users).length} usuario${Object.keys(users).length !== 1 ? 's' : ''} registrados (en este dispositivo)`;

  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-state">No hay usuarios para mostrar</div>';
    return;
  }

  list.innerHTML = entries.map(u => `
    <div class="user-card">
      <div class="user-card-name">${escapeHtml(u.username)}</div>
      <div class="user-card-meta">
        <div><strong>Correo:</strong> ${u.email ? escapeHtml(u.email) : '<em>No indicado</em>'}</div>
        <div><strong>Cuenta:</strong> registrada en este dispositivo</div>
      </div>
    </div>
  `).join('');
}

function updateAdminTabs() {
  const tabUsers = $('#tab-users');
  if (!tabUsers) return;
  if (currentUser && currentUser.isAdmin) {
    tabUsers.classList.remove('hidden');
  } else {
    tabUsers.classList.add('hidden');
    if (currentTab === 'users') switchTab('games');
  }
}

// ============== INIT ==============
async function init() {
  initTheme();
  initFirebase();
  restoreSession();
  await loadGames();

  const params = new URLSearchParams(location.search);
  const gameParam = params.get('game');
  if (gameParam && findItem(gameParam)) {
    goDetail(gameParam);
  } else {
    showView('home');
  }

  $('#btn-back').onclick = goHome;
  $('#logo-btn').onclick = goHome;
  $('#btn-login').onclick = openLoginModal;
  $('#btn-logout').onclick = logout;
  $('#btn-close-modal').onclick = closeModal;
  $('#btn-auth-submit').onclick = handleAuth;
  $('#btn-switch-mode').onclick = switchAuthMode;
  $('#btn-install').onclick = startDownload;

  // Bottom tabs
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  const usersSearch = $('#users-search');
  if (usersSearch) {
    usersSearch.addEventListener('input', () => renderUsers(usersSearch.value.trim()));
  }
  $('#btn-share').onclick = shareGame;
  $('#btn-comment').onclick = submitComment;
  $('#btn-messages').onclick = goMessages;
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.onclick = toggleTheme;
  const passToggle = document.getElementById('btn-toggle-password');
  if (passToggle) passToggle.onclick = togglePasswordVisibility;

  ['auth-username', 'auth-password', 'auth-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleAuth();
    });
  });

  $('#modal-overlay').addEventListener('click', e => {
    if (e.target === $('#modal-overlay')) closeModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
