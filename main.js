/**
 * SK Store - JavaScript puro
 * Hosting: GitHub Pages
 *
 * - Los juegos se detectan automáticamente leyendo la carpeta games/ con la API de GitHub
 * - Admin: 1eracuentasecundariadegd@gmail.com
 * - La contraseña del admin se lee desde myaccount.txt (archivo en la raíz del repo)
 * - Usuarios normales: usuario + contraseña guardados en localStorage
 * - Email opcional solo para que el admin pueda contactar a los beta testers
 */

// ============================================================
// CONFIGURACIÓN - CAMBIA ESTOS DOS VALORES
// ============================================================
const GITHUB_USER = 'Anonimo-Crypto';   // <-- pon tu usuario de GitHub
const GITHUB_REPO = 'SK-Store';                // <-- pon el nombre de tu repositorio

const ADMIN_USERNAME = '1eracuentasecundariadegd@gmail.com';
const MAX_BETA = 10;

// ============================================================

let GAMES = [];
let currentUser = null;   // { username, email?, isAdmin }
let currentGameId = null;
let isDownloading = false;
let authMode = 'login';
let adminPasswordCache = null; // se lee una vez de myaccount.txt

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

function getUsers() { return store.get('users', {}); }
function saveUsers(u) { store.set('users', u); }

function getDownloads(gameId) {
  const all = store.get('downloads', {});
  return all[gameId] || 0;
}
function incDownloads(gameId) {
  const all = store.get('downloads', {});
  all[gameId] = (all[gameId] || 0) + 1;
  store.set('downloads', all);
}

function getComments(gameId) {
  const all = store.get('comments', {});
  return all[gameId] || [];
}
function addComment(gameId, author, text) {
  const all = store.get('comments', {});
  if (!all[gameId]) all[gameId] = [];
  all[gameId].unshift({ author, text, date: new Date().toISOString() });
  store.set('comments', all);
}

function getBetaRequests() { return store.get('betaRequests', []); }
function saveBetaRequests(list) { store.set('betaRequests', list); }
function getAcceptedBetas(gameId) {
  return getBetaRequests().filter(r => r.gameId === gameId && r.status === 'accepted');
}

function addUserMessage(username, msg) {
  const all = store.get('userMessages', {});
  if (!all[username]) all[username] = [];
  all[username].unshift({ ...msg, date: new Date().toISOString(), read: false });
  store.set('userMessages', all);
}

function getUnreadAdminCount() {
  return getBetaRequests().filter(r => r.status === 'pending').length;
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
  // 1) Intentar con la API de GitHub (funciona en GitHub Pages)
  if (GITHUB_USER && GITHUB_USER !== 'TU_USUARIO_DE_GITHUB') {
    try {
      const games = await loadGamesFromGitHub();
      if (games.length > 0) {
        GAMES = games;
        renderGames();
        return;
      }
    } catch (e) {
      console.warn('GitHub API falló:', e.message);
    }
  }

  // 2) Fallback: games.json local (útil para pruebas)
  try {
    const res = await fetch('games.json?t=' + Date.now());
    if (res.ok) {
      GAMES = await res.json();
      renderGames();
      return;
    }
  } catch (_) {}

  // 3) Fallback final: los ejemplos que ya están en la carpeta
  GAMES = [
    {
      id: 'Malakias',
      name: 'Malakias',
      apk: 'Malakias.apk',
      size: 0,
      iconLetter: 'M',
      color: COLORS[0],
      coverUrl: 'games/Malakias/Portada.png'
    },
    {
      id: 'PixelRunner',
      name: 'Pixel Runner',
      apk: 'PixelRunner.apk',
      size: 0,
      iconLetter: 'P',
      color: COLORS[1],
      coverUrl: 'games/PixelRunner/Portada.png'
    }
  ];
  renderGames();
}

async function loadGamesFromGitHub() {
  const api = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/games`;
  const res = await fetch(api);
  if (!res.ok) throw new Error('No se pudo listar la carpeta games/');

  const items = await res.json();
  const folders = items.filter(i => i.type === 'dir');

  const games = [];

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const folderRes = await fetch(folder.url);
    if (!folderRes.ok) continue;

    const files = await folderRes.json();
    const apk = files.find(f => f.name.toLowerCase().endsWith('.apk'));
    const readme = files.find(f => f.name.toLowerCase() === 'readme.md');
    const cover = files.find(f => f.name.toLowerCase() === 'portada.png');

    if (!apk) continue; // sin APK no se muestra

    let name = folder.name;
    // Intentar sacar el título del README
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

    games.push({
      id: folder.name,
      name: name,
      apk: apk.name,
      size: apk.size || 0,
      iconLetter: name[0].toUpperCase(),
      color: COLORS[i % COLORS.length],
      apkUrl: apk.download_url,
      readmeUrl: readme ? readme.download_url : null,
      coverUrl: cover ? cover.download_url : null
    });
  }

  return games;
}

function renderGames() {
  const grid = $('#games-grid');
  const empty = $('#no-games');
  grid.innerHTML = '';

  if (GAMES.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  GAMES.forEach(g => {
    const downloads = getDownloads(g.id);
    const card = document.createElement('div');
    card.className = 'game-card';
    card.onclick = () => goDetail(g.id);

    const coverSrc = g.coverUrl || `games/${g.id}/Portada.png`;
    const iconHtml = `<img src="${coverSrc}" alt="${escapeHtml(g.name)}" onerror="this.style.display='none';this.parentElement.textContent='${g.iconLetter}'">`;

    card.innerHTML = `
      <div class="game-card-icon" style="background:linear-gradient(135deg,${g.color}22,${g.color}55);color:${g.color}">
        ${iconHtml}
      </div>
      <div class="game-card-body">
        <div class="game-card-title">${escapeHtml(g.name)}</div>
        <div class="game-card-meta">${downloads} descarga${downloads !== 1 ? 's' : ''}</div>
      </div>
    `;
    grid.appendChild(card);
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
  showView('home');
  renderGames();
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
  const game = GAMES.find(g => g.id === gameId);
  if (!game) {
    showToast('Juego no encontrado');
    goHome();
    return;
  }

  $('#detail-title').textContent = game.name;
  const detailIcon = $('#detail-icon');
  const coverSrc = game.coverUrl || `games/${game.id}/Portada.png`;
  detailIcon.innerHTML = `<img src="${coverSrc}" alt="${escapeHtml(game.name)}" onerror="this.remove();this.parentElement.textContent='${game.iconLetter}'">`;
  detailIcon.style.background = `linear-gradient(135deg,${game.color}22,${game.color}55)`;
  detailIcon.style.color = game.color;
  $('#detail-downloads').textContent = `${getDownloads(gameId)} descarga${getDownloads(gameId) !== 1 ? 's' : ''}`;
  $('#detail-size').textContent = formatSize(game.size);

  // Descripción
  const descEl = $('#detail-description');
  descEl.innerHTML = '<em>Cargando descripción...</em>';

  const readmeUrl = game.readmeUrl || `games/${game.id}/README.md`;
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
  $('#btn-install').textContent = 'Instalar';

  // Beta
  const accepted = getAcceptedBetas(gameId);
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
    const myReq = getBetaRequests().find(
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

  renderComments(gameId);
  if (currentUser) {
    $('#comment-form').classList.remove('hidden');
    $('#comment-login-hint').classList.add('hidden');
  } else {
    $('#comment-form').classList.add('hidden');
    $('#comment-login-hint').classList.remove('hidden');
  }
}

function renderComments(gameId) {
  const list = $('#comments-list');
  const comments = getComments(gameId);
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
  if (!currentGameId || isDownloading) return;
  const game = GAMES.find(g => g.id === currentGameId);
  if (!game) return;

  isDownloading = true;
  const btn = $('#btn-install');
  btn.disabled = true;
  btn.textContent = 'Descargando...';

  const progressWrap = $('#download-progress');
  progressWrap.classList.remove('hidden');
  const fill = $('#progress-fill');
  const text = $('#progress-text');

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 14 + 4;
    if (progress > 92) progress = 92;
    fill.style.width = progress + '%';
    text.textContent = Math.floor(progress) + '%';
  }, 160);

  // Preferir la URL raw de GitHub si existe, si no la ruta local
  const url = game.apkUrl || `games/${game.id}/${game.apk}`;

  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('No se pudo descargar el APK');
      return res.blob();
    })
    .then(blob => {
      clearInterval(interval);
      fill.style.width = '100%';
      text.textContent = '100%';

      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = game.apk;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);

      incDownloads(game.id);
      $('#detail-downloads').textContent = `${getDownloads(game.id)} descargas`;

      btn.textContent = 'Instalado ✓';
      showToast('Descarga completada');
      setTimeout(() => {
        isDownloading = false;
        btn.disabled = false;
        btn.textContent = 'Instalar de nuevo';
      }, 1400);
    })
    .catch(err => {
      clearInterval(interval);
      console.error(err);
      showToast('Error al descargar el APK');
      btn.disabled = false;
      btn.textContent = 'Instalar';
      progressWrap.classList.add('hidden');
      isDownloading = false;
    });
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
function requestBeta(gameId) {
  if (!currentUser) { openLoginModal(); return; }

  const accepted = getAcceptedBetas(gameId);
  if (accepted.length >= MAX_BETA) {
    showToast('Cupo de beta testers lleno');
    return;
  }
  const exists = getBetaRequests().find(
    r => r.gameId === gameId && r.username.toLowerCase() === currentUser.username.toLowerCase()
  );
  if (exists) {
    showToast('Ya tienes una solicitud para este juego');
    return;
  }

  const list = getBetaRequests();
  list.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    gameId,
    username: currentUser.username,
    email: currentUser.email || null,
    status: 'pending',
    date: new Date().toISOString()
  });
  saveBetaRequests(list);

  showToast('Solicitud enviada. El desarrollador la revisará.');
  renderDetail(gameId);
  updateMessagesBadge();
}

// ============== MENSAJES (SOLO ADMIN) ==============
function updateMessagesBadge() {
  const btn = $('#btn-messages');
  const badge = $('#msg-badge');

  if (currentUser && currentUser.isAdmin) {
    btn.classList.remove('hidden');
    const count = getUnreadAdminCount();
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

function renderMessages() {
  if (!currentUser || !currentUser.isAdmin) {
    goHome();
    return;
  }

  const list = $('#messages-list');
  const pending = getBetaRequests().filter(r => r.status === 'pending');

  if (!pending.length) {
    list.innerHTML = '<div class="empty-state">No hay solicitudes pendientes</div>';
    return;
  }

  list.innerHTML = pending.map(r => {
    const game = GAMES.find(g => g.id === r.gameId);
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

function acceptBeta(reqId) {
  if (!currentUser || !currentUser.isAdmin) return;

  const list = getBetaRequests();
  const req = list.find(r => r.id === reqId);
  if (!req) return;

  if (getAcceptedBetas(req.gameId).length >= MAX_BETA) {
    showToast('Ya hay 10 beta testers en este juego');
    return;
  }

  req.status = 'accepted';
  saveBetaRequests(list);

  addUserMessage(req.username, {
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

function rejectBeta(reqId) {
  if (!currentUser || !currentUser.isAdmin) return;

  const list = getBetaRequests();
  const req = list.find(r => r.id === reqId);
  if (!req) return;

  req.status = 'rejected';
  saveBetaRequests(list);

  addUserMessage(req.username, {
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

// ============== CONTRASEÑA DEL ADMIN (lee myaccount.txt) ==============
async function loadAdminPassword() {
  if (adminPasswordCache !== null) return adminPasswordCache;
  try {
    const res = await fetch('myaccount.txt?t=' + Date.now());
    if (!res.ok) throw new Error('No se pudo leer myaccount.txt');
    // Quitar espacios, saltos de línea y retornos de carro
    const text = (await res.text()).replace(/\r/g, '').trim();
    adminPasswordCache = text;
    return text;
  } catch (e) {
    console.error('Error leyendo myaccount.txt:', e);
    adminPasswordCache = '';
    return '';
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
  $('#email-group').classList.toggle('visible', isRegister);
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
  if (!password) {
    err.textContent = 'Escribe una contraseña';
    err.classList.remove('hidden');
    return;
  }
  if (password.length < 4) {
    err.textContent = 'La contraseña debe tener al menos 4 caracteres';
    err.classList.remove('hidden');
    return;
  }

  const users = getUsers();
  const key = username.toLowerCase();
  const isAdminAttempt = username.toLowerCase() === ADMIN_USERNAME.toLowerCase();

  // ===== CUENTA ADMIN (siempre se verifica con myaccount.txt) =====
  if (isAdminAttempt) {
    const realPass = await loadAdminPassword();
    if (!realPass) {
      err.textContent = 'No se pudo leer myaccount.txt. ¿Está el archivo en la raíz y estás usando un servidor local o GitHub Pages?';
      err.classList.remove('hidden');
      return;
    }
    if (password !== realPass) {
      err.textContent = 'Contraseña incorrecta';
      err.classList.remove('hidden');
      return;
    }
    currentUser = {
      username: ADMIN_USERNAME,
      email: ADMIN_USERNAME,
      isAdmin: true
    };
    finishLogin('Bienvenido, administrador');
    return;
  }

  // ===== USUARIOS NORMALES =====
  if (authMode === 'register') {
    if (users[key]) {
      err.textContent = 'Ese nombre de usuario ya está en uso';
      err.classList.remove('hidden');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      err.textContent = 'El correo no parece válido';
      err.classList.remove('hidden');
      return;
    }

    users[key] = {
      username: username,
      password: password,
      email: email || null
    };
    saveUsers(users);

    currentUser = {
      username: username,
      email: email || null,
      isAdmin: false
    };
    finishLogin('Cuenta creada. ¡Bienvenido!');
  } else {
    // Login normal
    const user = users[key];
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

  if (currentUser.isAdmin && getUnreadAdminCount() > 0) {
    setTimeout(() => showToast('Tienes solicitudes de beta pendientes'), 900);
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
  if (session.username === ADMIN_USERNAME && session.isAdmin) {
    currentUser = {
      username: ADMIN_USERNAME,
      email: ADMIN_USERNAME,
      isAdmin: true
    };
    updateUserUI();
    return;
  }

  // Usuario normal
  const users = getUsers();
  const user = users[session.username.toLowerCase()];
  if (!user) return;

  currentUser = {
    username: user.username,
    email: user.email || null,
    isAdmin: false
  };
  updateUserUI();
}

// ============== COMENTARIOS ==============
function submitComment() {
  if (!currentUser || !currentGameId) return;
  const input = $('#comment-input');
  const text = input.value.trim();
  if (!text) return;
  addComment(currentGameId, currentUser.username, text);
  input.value = '';
  renderComments(currentGameId);
  showToast('Comentario publicado');
}

// ============== INIT ==============
async function init() {
  initTheme();
  restoreSession();
  await loadGames();

  const params = new URLSearchParams(location.search);
  const gameParam = params.get('game');
  if (gameParam && GAMES.some(g => g.id === gameParam)) {
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
  $('#btn-share').onclick = shareGame;
  $('#btn-comment').onclick = submitComment;
  $('#btn-messages').onclick = goMessages;
  const themeBtn = document.getElementById('btn-theme');
  if (themeBtn) themeBtn.onclick = toggleTheme;

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
