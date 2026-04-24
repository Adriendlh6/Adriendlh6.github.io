const APP_VERSION = 'v3.5';
const ROUTES = {
  mercuriale: { title: 'Mercuriale', file: 'pages/mercuriale.html' },
  fournisseurs: { title: 'Fournisseurs', file: 'pages/fournisseurs.html' },
  recettes: { title: 'Recettes', file: 'pages/recettes.html' },
  monentreprise: { title: 'Gestion des données d’entreprise', file: 'pages/mon-entreprise.html' },
  parametres: { title: 'Paramètres', file: 'pages/parametres.html' },
};

const ROUTE_ASSETS = {
  mercuriale: {
    css: ['assets/css/mercuriale.css'],
    js: ['assets/js/mercuriale.js']
  },
  fournisseurs: {
    css: ['assets/css/fournisseurs.css'],
    js: ['assets/js/fournisseurs.js']
  },
  recettes: {
    css: ['assets/css/recettes.css'],
    js: ['assets/js/recettes.js']
  },
  monentreprise: {
    css: ['assets/css/mon-entreprise.css'],
    js: ['assets/js/mon-entreprise.js']
  },
  parametres: {
    css: ['assets/css/parametres.css'],
    js: ['assets/js/parametres.js']
  }
};

const state = { route: 'mercuriale' };

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
function esc(s=''){ return String(s).replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
function num(v){
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const normalized = String(v).replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lockBodyScroll(){ document.body.classList.add('sheet-open'); }
function unlockBodyScroll(){ if (!qsa('.bottom-sheet:not(.hidden), .sheet-backdrop:not(.hidden)').length) document.body.classList.remove('sheet-open'); }
function openSheet(sheet, backdrop){ if (!sheet || !backdrop) return; sheet.classList.remove('hidden'); backdrop.classList.remove('hidden'); sheet.setAttribute('aria-hidden','false'); lockBodyScroll(); }
function closeSheet(sheet, backdrop){ if (!sheet || !backdrop) return; sheet.classList.add('hidden'); backdrop.classList.add('hidden'); sheet.setAttribute('aria-hidden','true'); unlockBodyScroll(); }

async function refreshDashboard(){ return; }
window.refreshDashboard = refreshDashboard;

function unloadRouteAssets(){
  qsa('[data-route-asset]').forEach(node => node.remove());
  delete window.FournisseursPage;
  delete window.MercurialePage;
  delete window.RecettesPage;
  delete window.MonEntreprisePage;
  delete window.ParametresPage;
}

function loadScriptAsset(src){
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src + '?v=' + encodeURIComponent(APP_VERSION);
    script.defer = true;
    script.dataset.routeAsset = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureRouteAssets(route){
  unloadRouteAssets();
  const assets = ROUTE_ASSETS[route];
  if (!assets) return;
  (assets.css || []).forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href + '?v=' + encodeURIComponent(APP_VERSION);
    link.dataset.routeAsset = 'true';
    document.head.appendChild(link);
  });
  for (const src of (assets.js || [])) await loadScriptAsset(src);
}

async function initCurrentPage(){
  if (state.route === 'mercuriale') return window.MercurialePage?.render?.();
  if (state.route === 'fournisseurs') return window.FournisseursPage?.render?.();
  if (state.route === 'recettes') return window.RecettesPage?.render?.();
  if (state.route === 'monentreprise') return window.MonEntreprisePage?.render?.();
  if (state.route === 'parametres') return window.ParametresPage?.render?.();
}

function renderRouteError(route, error){
  const target = qs('#app-content');
  if (!target) return;
  target.innerHTML = `
    <section class="card">
      <h2>Module indisponible</h2>
      <p class="muted">Le module <strong>${esc(route)}</strong> n'a pas pu être chargé.</p>
      <pre class="notice" style="white-space:pre-wrap">${esc(error?.message || String(error || 'Erreur inconnue'))}</pre>
    </section>
  `;
}

async function loadRoute(route){
  state.route = ROUTES[route] ? route : 'mercuriale';
  const cfg = ROUTES[state.route];
  qs('#pageTitle').textContent = cfg.title;
  qsa('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.route === state.route));
  try {
    const html = await fetch(cfg.file + '?v=' + encodeURIComponent(APP_VERSION)).then(r => {
      if (!r.ok) throw new Error(`Page introuvable: ${cfg.file}`);
      return r.text();
    });
    qs('#app-content').innerHTML = html;
    await ensureRouteAssets(state.route);
    await initCurrentPage();
    history.replaceState({}, '', '#' + state.route);
  } catch (error) {
    console.error(`[route:${state.route}]`, error);
    renderRouteError(state.route, error);
  } finally {
    closeSidebar();
  }
}

function openSidebar(){ qs('#sidebar').classList.add('open'); qs('#overlay').classList.remove('hidden'); }
function closeSidebar(){ qs('#sidebar').classList.remove('open'); qs('#overlay').classList.add('hidden'); }

window.loadRoute = loadRoute;

function handleHashChange(){
  const next = (location.hash || '#mercuriale').replace('#','');
  if (next && next !== state.route) loadRoute(next);
}

function initShell(){
  qs('#footerVersion').textContent = APP_VERSION;
  qsa('.nav-link').forEach(btn => btn.onclick = () => loadRoute(btn.dataset.route));
  qs('#menuToggle').onclick = openSidebar;
  qs('#overlay').onclick = closeSidebar;
  const initial = (location.hash || '#mercuriale').replace('#','');
  loadRoute(initial);
  window.addEventListener('hashchange', handleHashChange);
}

document.addEventListener('DOMContentLoaded', initShell);
