  const APP_VERSION = 'v2.3.4';
const ROUTES = {
  dashboard: { title: 'Dashboard', file: 'pages/dashboard.html' },
  mercuriale: { title: 'Mercuriale', file: 'pages/mercuriale.html' },
  recettes: { title: 'Recettes', file: 'pages/recettes.html' },
  fournisseurs: { title: 'Fournisseurs', file: 'pages/fournisseurs.html' },
  simulation: { title: 'Simulation', file: 'pages/simulation.html' },
  parametres: { title: 'Paramètres', file: 'pages/parametres.html' },
};

const state = { route: 'dashboard' };
const MERCURIALE_CATEGORIES_KEY = 'mercuriale_categories';
const MERCURIALE_ALLERGENES = [
  'Gluten', 'Blé', 'Seigle', 'Orge', 'Avoine', 'Épeautre', 'Crustacés', 'Œufs', 'Poissons',
  'Arachides', 'Soja', 'Lait', 'Amandes', 'Noisettes', 'Noix', 'Noix de cajou', 'Noix de pécan',
  'Noix du Brésil', 'Pistaches', 'Macadamia', 'Céleri', 'Moutarde', 'Graines de sésame',
  'Anhydride sulfureux', 'Sulfites', 'Lupin', 'Mollusques'
];
const TVA_OPTIONS = [0, 2.1, 5.5, 10, 20];

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
function num(v){ return Number(v||0); }
function safePrice(v){ const n = Number(v); return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY; }

function buildOfferComparison(offres=[]){
  const valid = (offres || []).filter(Boolean).map(offre => ({
    ...offre,
    prixHTUnite: Number(offre.prixHTUnite || 0),
    prixHTColis: Number(offre.prixHTColis || 0),
  }));
  let bestUnit = null;
  let bestColis = null;
  for (const offre of valid){
    if (offre.prixHTUnite > 0 && (!bestUnit || offre.prixHTUnite < bestUnit.prixHTUnite)) bestUnit = offre;
    if (offre.prixHTColis > 0 && (!bestColis || offre.prixHTColis < bestColis.prixHTColis)) bestColis = offre;
  }
  return { bestUnit, bestColis };
}

function formatDeltaPercent(bestValue, currentValue){
  const best = Number(bestValue || 0);
  const current = Number(currentValue || 0);
  if (!(best > 0) || !(current > 0)) return '';
  const delta = ((current - best) / best) * 100;
  if (Math.abs(delta) < 0.05) return 'Même prix';
  const rounded = Math.round(delta * 10) / 10;
  return rounded > 0 ? `+${String(rounded).replace('.', ',')} %` : `${String(rounded).replace('.', ',')} %`;
}
function round(v, decimals=4){
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
function formatNumberInput(v, decimals=4){
  if (v === '' || v == null || !Number.isFinite(Number(v))) return '';
  return String(round(v, decimals)).replace(/\.?0+$/, '');
}
function esc(s=''){ return String(s).replace(/[&<>\"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
function slugify(s=''){ return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

function humanizeSlug(s=''){
  const normalized = String(s || '').replace(/-/g, ' ').trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function normalizeEan13(value=''){
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12) {
    const checksum = computeEan13Checksum(digits);
    return digits + String(checksum);
  }
  if (digits.length === 13) {
    const checksum = computeEan13Checksum(digits.slice(0, 12));
    return checksum === Number(digits[12]) ? digits : '';
  }
  return '';
}

function computeEan13Checksum(base12=''){
  const digits = String(base12 || '').replace(/\D/g, '').slice(0, 12).split('').map(Number);
  if (digits.length !== 12) return 0;
  const sum = digits.reduce((acc, n, idx) => acc + n * (idx % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

function ean13Svg(value=''){
  const ean = normalizeEan13(value);
  if (!ean) return '<div class="muted">EAN non renseigné ou invalide.</div>';
  const patterns = {
    L: {'0':'0001101','1':'0011001','2':'0010011','3':'0111101','4':'0100011','5':'0110001','6':'0101111','7':'0111011','8':'0110111','9':'0001011'},
    G: {'0':'0100111','1':'0110011','2':'0011011','3':'0100001','4':'0011101','5':'0111001','6':'0000101','7':'0010001','8':'0001001','9':'0010111'},
    R: {'0':'1110010','1':'1100110','2':'1101100','3':'1000010','4':'1011100','5':'1001110','6':'1010000','7':'1000100','8':'1001000','9':'1110100'}
  };
  const parityMap = {
    '0':'LLLLLL','1':'LLGLGG','2':'LLGGLG','3':'LLGGGL','4':'LGLLGG',
    '5':'LGGLLG','6':'LGGGLL','7':'LGLGLG','8':'LGLGGL','9':'LGGLGL'
  };
  const leftDigits = ean.slice(1,7).split('');
  const rightDigits = ean.slice(7).split('');
  const parity = parityMap[ean[0]];
  let bits = '101';
  leftDigits.forEach((digit, idx) => { bits += patterns[parity[idx]][digit]; });
  bits += '01010';
  rightDigits.forEach(digit => { bits += patterns.R[digit]; });
  bits += '101';
  const moduleWidth = 2;
  const quiet = 10 * moduleWidth;
  const normalHeight = 62;
  const guardHeight = 74;
  const width = quiet * 2 + bits.length * moduleWidth;
  let x = quiet;
  let rects = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      const isGuard = i < 3 || (i >= 45 && i < 50) || i >= 92;
      rects += `<rect x="${x}" y="0" width="${moduleWidth}" height="${isGuard ? guardHeight : normalHeight}" fill="#111"/>`;
    }
    x += moduleWidth;
  }
  return `<svg class="ean-svg" viewBox="0 0 ${width} 78" role="img" aria-label="Code-barres EAN ${ean}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="78" fill="#fff"/>
    ${rects}
  </svg>`;
}


function getOfferTrend(ingredient, offre, field){
  const current = Number(offre?.[field] || 0);
  if (!(current > 0)) return 'flat';
  const history = (ingredient?.priceHistory || [])
    .filter(entry => entry.offerId === offre.id && Number(entry[field] || 0) > 0)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  const previousDifferent = history.find(entry => Math.abs(Number(entry[field] || 0) - current) > 0.0001);
  if (!previousDifferent) return 'flat';
  const prev = Number(previousDifferent[field] || 0);
  if (!(prev > 0)) return 'flat';
  if (current > prev) return 'up';
  if (current < prev) return 'down';
  return 'flat';
}

function trendArrowMarkup(direction){
  const map = {
    up: { symbol: '↗', label: 'Hausse' },
    down: { symbol: '↘', label: 'Baisse' },
    flat: { symbol: '→', label: 'Stable' },
  };
  const item = map[direction] || map.flat;
  return `<span class="price-trend price-trend--${item.label.toLowerCase()}" aria-label="${item.label}" title="${item.label}">${item.symbol}</span>`;
}

function getPrimaryOffer(ingredient){
  const offers = (ingredient?.offres || []);
  return offers.find(offre => offre.sourcePrincipale) || offers[0] || null;
}

function getIngredientSearchTokens(ingredient){
  const offerTokens = (ingredient?.offres || []).flatMap(offre => [offre.ean, offre.marque, offre.reference]).filter(Boolean).join(' ');
  return `${ingredient?.nom || ''} ${offerTokens}`.toLowerCase();
}

function getOfferDisplayEan(offre=''){
  return normalizeEan13(offre?.ean || '') || String(offre?.ean || '').replace(/\s+/g, '');
}

function getIngredientPrimaryEan(ingredient){
  const offer = getPrimaryOffer(ingredient);
  return getOfferDisplayEan(offer || {});
}

function formatPriceHistoryDate(value){
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(d);
}

function localDayStamp(date = new Date()){
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildPriceHistoryList(entries, fournisseurs=[]){
  const safeEntries = (entries || [])
    .map(entry => ({ ...entry, prixHTUnite: Number(entry.prixHTUnite || 0), prixHTColis: Number(entry.prixHTColis || 0) }))
    .filter(entry => entry.timestamp && (entry.prixHTUnite > 0 || entry.prixHTColis > 0));
  if (!safeEntries.length) return '<div class="notice">Pas encore d’historique de prix.</div>';

  const palette = ['#b8742a', '#2f7d32', '#2563eb', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#6b7280'];
  const groupsMap = new Map();
  safeEntries.forEach(entry => {
    const key = `${entry.fournisseurId || 'none'}__${entry.marque || ''}`;
    if (!groupsMap.has(key)) {
      const supplier = fournisseurs.find(f => f.id === entry.fournisseurId);
      const base = supplier?.nom || 'Sans fournisseur';
      groupsMap.set(key, {
        key,
        color: palette[groupsMap.size % palette.length],
        label: entry.marque ? `${base} / ${entry.marque}` : base,
        entries: []
      });
    }
    groupsMap.get(key).entries.push(entry);
  });

  const groups = [...groupsMap.values()].map(group => ({
    ...group,
    entries: group.entries.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
  }));

  return `<div class="history-list-groups">${groups.map(group => {
    const avgEntries = group.entries.filter(entry => {
      const d = new Date(entry.timestamp);
      return Number.isFinite(d.getTime()) && ((Date.now() - d.getTime()) / (1000*60*60*24)) <= 365;
    });
    const avg = avgEntries.length ? avgEntries.reduce((sum, entry) => sum + (entry.prixHTUnite || 0), 0) / avgEntries.length : 0;
    return `<section class="history-list-group">
      <div class="history-list-group-head">
        <div class="history-list-group-title-wrap">
          <span class="price-history-legend-chip" style="background:${group.color}"></span>
          <div>
            <div class="history-list-group-title">${esc(group.label)}</div>
            <div class="history-list-group-sub">Moyenne 12 mois : ${euro(avg)}</div>
          </div>
        </div>
        <div class="history-list-group-count">${group.entries.length} relevé${group.entries.length > 1 ? 's' : ''}</div>
      </div>
      <div class="history-list-rows">
        ${group.entries.map(entry => `<article class="history-list-row">
          <div class="history-list-date">${formatPriceHistoryDate(entry.timestamp)}</div>
          <div class="history-list-metrics">
            <div class="history-metric-box">
              <span class="history-metric-label">HT unité</span>
              <strong>${euro(entry.prixHTUnite)}</strong>
            </div>
            <div class="history-metric-box">
              <span class="history-metric-label">HT colis</span>
              <strong>${euro(entry.prixHTColis)}</strong>
            </div>
          </div>
        </article>`).join('')}
      </div>
    </section>`;
  }).join('')}</div>`;
}

function buildPriceHistoryChart(entries, fournisseurs=[]){
  const safeEntries = (entries || [])
    .map(entry => ({ ...entry, prixHTUnite: Number(entry.prixHTUnite || 0), prixHTColis: Number(entry.prixHTColis || 0), timestamp: entry.timestamp }))
    .filter(entry => Number.isFinite(entry.prixHTUnite) && entry.prixHTUnite > 0 && entry.timestamp);
  if (!safeEntries.length) return '<div class="muted">Pas encore assez de données pour afficher le graphique.</div>';

  const palette = ['#b8742a', '#2f7d32', '#2563eb', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#6b7280'];
  const supplierName = (entry) => {
    const supplier = fournisseurs.find(f => f.id === entry.fournisseurId);
    const base = supplier?.nom || 'Sans fournisseur';
    return entry.marque ? `${base} / ${entry.marque}` : base;
  };

  const groupsMap = new Map();
  safeEntries.forEach(entry => {
    const key = `${entry.fournisseurId || 'none'}__${entry.marque || ''}`;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { key, label: supplierName(entry), entries: [] });
    }
    groupsMap.get(key).entries.push(entry);
  });

  const groups = [...groupsMap.values()].map((group, idx) => ({
    ...group,
    color: palette[idx % palette.length],
    entries: group.entries.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp))
  }));

  const timestamps = safeEntries.map(entry => new Date(entry.timestamp).getTime()).filter(Number.isFinite);
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const values = safeEntries.map(entry => entry.prixHTUnite);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const timeSpan = Math.max(maxTime - minTime, 1);
  const valueSpan = Math.max(maxValue - minValue, 1);
  const width = 640;
  const height = 260;
  const padLeft = 56;
  const padRight = 18;
  const padTop = 18;
  const padBottom = 42;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const xAt = (ts) => padLeft + (((ts - minTime) / timeSpan) * chartWidth);
  const yAt = (val) => padTop + chartHeight - (((val - minValue) / valueSpan) * chartHeight);
  const tickCount = 4;
  const tickDates = [];
  for (let i = 0; i < tickCount; i++) {
    tickDates.push(minTime + ((timeSpan / Math.max(tickCount - 1, 1)) * i));
  }
  const tickLabels = tickDates.map(ts => new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: '2-digit' }).format(new Date(ts)));
  const yTicks = [minValue, minValue + valueSpan / 2, maxValue];

  const lines = groups.map(group => {
    const points = group.entries.map(entry => `${xAt(new Date(entry.timestamp).getTime())},${yAt(entry.prixHTUnite)}`).join(' ');
    const circles = group.entries.map(entry => {
      const x = xAt(new Date(entry.timestamp).getTime());
      const y = yAt(entry.prixHTUnite);
      return `<circle cx="${x}" cy="${y}" r="3.2" fill="${group.color}"/>`;
    }).join('');
    return `<polyline fill="none" stroke="${group.color}" stroke-width="3" points="${points}" stroke-linecap="round" stroke-linejoin="round"/>${circles}`;
  }).join('');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const legend = groups.map(group => {
    const recent = group.entries.filter(entry => new Date(entry.timestamp) >= twelveMonthsAgo);
    const source = recent.length ? recent : group.entries;
    const avg = source.reduce((sum, entry) => sum + entry.prixHTUnite, 0) / Math.max(source.length, 1);
    return `<div class="price-history-legend-item">
      <span class="price-history-legend-chip" style="background:${group.color}"></span>
      <div class="price-history-legend-text">
        <div class="price-history-legend-name">${esc(group.label)}</div>
        <div class="price-history-legend-meta">Moyenne 12 mois : ${euro(avg)}</div>
      </div>
    </div>`;
  }).join('');

  return `<div class="price-history-chart-wrap">
    <svg class="price-history-chart" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Historique des prix par fournisseur">
      <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="#fffaf4" />
      ${yTicks.map(val => `<line x1="${padLeft}" y1="${yAt(val)}" x2="${width-padRight}" y2="${yAt(val)}" stroke="#eadfce" stroke-width="1"/>`).join('')}
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height-padBottom}" stroke="#cdbca7" stroke-width="1.5"/>
      <line x1="${padLeft}" y1="${height-padBottom}" x2="${width-padRight}" y2="${height-padBottom}" stroke="#cdbca7" stroke-width="1.5"/>
      ${lines}
      ${yTicks.map(val => `<text x="${padLeft-8}" y="${yAt(val)+4}" text-anchor="end" class="price-history-chart-label">${euro(val)}</text>`).join('')}
      ${tickDates.map((ts, idx) => `<text x="${xAt(ts)}" y="${height-16}" text-anchor="middle" class="price-history-chart-label">${tickLabels[idx]}</text>`).join('')}
    </svg>
    <div class="price-history-legend">${legend}</div>
  </div>`;
}

function snapshotOfferForHistory(offre){
  return {
    fournisseurId: offre?.fournisseurId || '',
    marque: offre?.marque || '',
    reference: offre?.reference || '',
    ean: offre?.ean || '',
    sourcePrincipale: Boolean(offre?.sourcePrincipale),
    prixHTUnite: round(offre?.prixHTUnite, 4),
    prixTTCUnite: round(offre?.prixTTCUnite, 4),
    prixHTColis: round(offre?.prixHTColis, 4),
    prixTTCColis: round(offre?.prixTTCColis, 4),
  };
}

function appendPriceHistory(previousIngredient, draft){
  const previousHistory = Array.isArray(previousIngredient?.priceHistory) ? previousIngredient.priceHistory : [];
  const previousById = new Map((previousIngredient?.offres || []).map(offre => [offre.id, snapshotOfferForHistory(offre)]));
  const nextHistory = [...previousHistory];
  for (const offre of (draft.offres || [])){
    const snapshot = snapshotOfferForHistory(offre);
    const before = previousById.get(offre.id);
    const changed = !before || JSON.stringify(before) !== JSON.stringify(snapshot);
    if (changed){
      nextHistory.unshift({
        id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        ingredientId: draft.id,
        offerId: offre.id,
        timestamp: localDayStamp(),
        ...snapshot
      });
    }
  }
  return nextHistory;
}


function getOrCreateProductPrintChooser(){
  // Toujours recréer proprement pour éviter l'accumulation de listeners
  let root = document.getElementById('product-print-chooser');
  if (root) root.remove();
  root = document.createElement('div');
  root.id = 'product-print-chooser';
  root.className = 'print-chooser hidden';
  root.innerHTML = `
    <div class="print-chooser-backdrop hidden"></div>
    <section class="print-chooser-dialog hidden" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="product-print-chooser-title">
      <div class="print-chooser-head">
        <div>
          <div class="print-chooser-kicker">Impression produit</div>
          <h3 id="product-print-chooser-title">Choisir les informations à imprimer</h3>
        </div>
        <button type="button" class="icon-square-btn" id="print-chooser-close-btn" aria-label="Fermer" title="Fermer">✕</button>
      </div>
      <div class="print-chooser-body"></div>
    </section>`;
  document.body.appendChild(root);
  return {
    root,
    backdrop: root.querySelector('.print-chooser-backdrop'),
    dialog: root.querySelector('.print-chooser-dialog'),
    body: root.querySelector('.print-chooser-body')
  };
}

function openProductPrintChooser(ingredient, category, fournisseurs){
  const chooser = getOrCreateProductPrintChooser();
  const offers = ingredient.offres || [];
  const supplierChoices = offers.map(offre => {
    const supplier = fournisseurs.find(f => f.id === offre.fournisseurId);
    const labelBase = supplier?.nom || 'Sans fournisseur';
    const label = offre.marque ? `${labelBase} / ${offre.marque}` : labelBase;
    return `<option value="${esc(offre.fournisseurId || '')}">${esc(label)}</option>`;
  }).join('');

  chooser.body.innerHTML = `
    <div class="print-options-grid">
      <section class="print-options-card">
        <div class="print-options-card__head">
          <h4>Sections</h4>
          <label class="print-inline-check">
            <input type="checkbox" id="print-all-sections" checked>
            <span>Tout sélectionner</span>
          </label>
        </div>
        <div class="print-options-checks">
          <label class="print-check-row"><input type="checkbox" name="sections" value="infos" checked><span>Infos</span></label>
          <label class="print-check-row"><input type="checkbox" name="sections" value="historique" checked><span>Historique</span></label>
          <label class="print-check-row"><input type="checkbox" name="sections" value="utilisation"><span>Utilisation</span></label>
          <label class="print-check-row"><input type="checkbox" name="sections" value="tracabilites"><span>Traçabilités</span></label>
        </div>
      </section>
      <section class="print-options-card">
        <h4>Fournisseurs</h4>
        <label class="field-label" for="print-supplier-filter">Choix à imprimer</label>
        <select id="print-supplier-filter">
          <option value="all">Tous les fournisseurs</option>
          ${supplierChoices}
        </select>
        <p class="muted small">Le filtre fournisseur s'applique aux offres affichées et à l'historique des prix.</p>
      </section>
    </div>
    <div class="print-chooser-actions">
      <button type="button" class="btn secondary" id="print-chooser-cancel-btn">Annuler</button>
      <button type="button" class="btn primary" id="print-chooser-confirm-btn">🖨️ Imprimer</button>
    </div>`;

  // Affichage
  chooser.root.classList.remove('hidden');
  chooser.backdrop.classList.remove('hidden');
  chooser.dialog.classList.remove('hidden');
  chooser.dialog.setAttribute('aria-hidden', 'false');
  lockBodyScroll();

  // Logique "Tout sélectionner"
  const allToggle = chooser.root.querySelector('#print-all-sections');
  const sectionChecks = [...chooser.root.querySelectorAll('input[name="sections"]')];
  const syncToggle = () => {
    const checked = sectionChecks.filter(el => el.checked).length;
    allToggle.checked = checked === sectionChecks.length;
    allToggle.indeterminate = checked > 0 && checked < sectionChecks.length;
  };
  allToggle.onchange = () => {
    sectionChecks.forEach(el => { el.checked = allToggle.checked; });
    allToggle.indeterminate = false;
  };
  sectionChecks.forEach(el => { el.onchange = syncToggle; });
  syncToggle();

  // Fermeture
  const doClose = () => closeProductPrintChooser();
  chooser.root.querySelector('#print-chooser-close-btn').onclick = doClose;
  chooser.root.querySelector('#print-chooser-cancel-btn').onclick = doClose;
  chooser.backdrop.onclick = doClose;

  // Impression — type="button" pour éviter tout submit parasite
  chooser.root.querySelector('#print-chooser-confirm-btn').onclick = () => {
    const selectedSections = sectionChecks.filter(el => el.checked).map(el => el.value);
    if (!selectedSections.length) {
      alert('Sélectionne au moins une section à imprimer.');
      return;
    }
    const supplierFilter = chooser.root.querySelector('#print-supplier-filter')?.value || 'all';
    closeProductPrintChooser();
    printProductSheet(ingredient, category, fournisseurs, { sections: selectedSections, supplierFilter });
  };
}

function closeProductPrintChooser(){
  const root = document.getElementById('product-print-chooser');
  if (!root) return;
  root.classList.add('hidden');
  unlockBodyScroll();
}

function getOrCreatePrintRoot(){
  let root = document.getElementById('product-print-root');
  if (!root) {
    root = document.createElement('section');
    root.id = 'product-print-root';
    root.className = 'product-print-root hidden';
    document.body.appendChild(root);
  }
  return root;
}

function buildProductPrintMarkup(ingredient, category, fournisseurs, options={}){
  const sections = Array.isArray(options.sections) && options.sections.length ? options.sections : ['infos'];
  const supplierFilter = options.supplierFilter || 'all';
  const nutrition = ingredient.nutrition || {};
  const allergenes = (ingredient.allergenes || []).map(humanizeSlug);
  const filteredOffers = (ingredient.offres || []).filter(offre => supplierFilter === 'all' || String(offre.fournisseurId || '') === String(supplierFilter));
  const filteredHistory = (ingredient.priceHistory || []).filter(entry => supplierFilter === 'all' || String(entry.fournisseurId || '') === String(supplierFilter));
  const offers = filteredOffers.map(offre => {
    const supplier = fournisseurs.find(f => f.id === offre.fournisseurId);
    return `<tr>
      <td>${esc(supplier?.nom || 'Sans fournisseur')}</td>
      <td>${esc(offre.marque || '-')}</td>
      <td>${esc(offre.reference || '-')}</td>
      <td>${esc(offre.quantiteColis || '-')} ${esc(offre.uniteColis || ingredient.uniteBase || 'u')}</td>
      <td>${String(offre.tva ?? 0).replace('.', ',')}%</td>
      <td>${offre.prixHTUnite ? euro(offre.prixHTUnite) : '-'}</td>
      <td>${offre.prixHTColis ? euro(offre.prixHTColis) : '-'}</td>
    </tr>`;
  }).join('');
  const historyRows = filteredHistory.slice().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(entry => {
    const supplier = fournisseurs.find(f => f.id === entry.fournisseurId);
    return `<tr>
      <td>${formatPriceHistoryDate(entry.timestamp)}</td>
      <td>${esc(supplier?.nom || 'Sans fournisseur')}</td>
      <td>${esc(entry.marque || '-')}</td>
      <td>${entry.prixHTUnite ? euro(entry.prixHTUnite) : '-'}</td>
      <td>${entry.prixHTColis ? euro(entry.prixHTColis) : '-'}</td>
    </tr>`;
  }).join('');
  const sectionMarkup = [];

  if (sections.includes('infos')) {
    sectionMarkup.push(`
      <section class="print-section-block">
        <div class="print-section-title">Infos</div>
        <section class="print-grid">
          <article class="print-card">
            <div class="detail-label">Nom du produit</div>
            <div class="detail-value detail-title-value">${esc(ingredient.nom || '-')}</div>
            <div class="detail-label">Catégorie</div>
            <div class="print-category-wrap">${categoryChip(category)}</div>
          </article>
          <article class="print-card">
            <div class="detail-label">EAN</div>
            <div class="print-barcode-wrap">${ean13Svg(getIngredientPrimaryEan(ingredient))}</div>
            <div class="print-ean-text monospace">${esc(getIngredientPrimaryEan(ingredient) || '-')}</div>
          </article>
        </section>
        <section class="print-card">
          <h2>Fournisseurs</h2>
          ${offers ? `<table class="print-table"><thead><tr><th>Fournisseur</th><th>Marque</th><th>Référence</th><th>Colis</th><th>TVA</th><th>HT unité</th><th>HT colis</th></tr></thead><tbody>${offers}</tbody></table>` : '<div class="muted">Aucune offre enregistrée pour ce filtre.</div>'}
        </section>
        <section class="print-two-col">
          <article class="print-card">
            <h2>Allergènes</h2>
            <div class="toolbar chip-row">${allergenes.length ? allergenes.map(a => `<span class="tag">${esc(a)}</span>`).join('') : '<span class="muted">Aucun allergène renseigné.</span>'}</div>
          </article>
          <article class="print-card">
            <h2>Nutrition pour 100 g</h2>
            <div class="print-nutrition-grid">
              <div><strong>Énergie</strong><span>${esc(formatNutritionValue('energie', nutrition.energie))}</span></div>
              <div><strong>Matières grasses</strong><span>${esc(formatNutritionValue('matieresGrasses', nutrition.matieresGrasses))}</span></div>
              <div><strong>Acides gras saturés</strong><span>${esc(formatNutritionValue('acidesGrasSatures', nutrition.acidesGrasSatures))}</span></div>
              <div><strong>Glucides</strong><span>${esc(formatNutritionValue('glucides', nutrition.glucides))}</span></div>
              <div><strong>Sucres</strong><span>${esc(formatNutritionValue('sucres', nutrition.sucres))}</span></div>
              <div><strong>Protéines</strong><span>${esc(formatNutritionValue('proteines', nutrition.proteines))}</span></div>
              <div><strong>Sel</strong><span>${esc(formatNutritionValue('sel', nutrition.sel))}</span></div>
            </div>
          </article>
        </section>
        ${ingredient.note ? `<section class="print-card"><h2>Note</h2><div>${esc(ingredient.note)}</div></section>` : ''}
      </section>`);
  }

  if (sections.includes('historique')) {
    sectionMarkup.push(`
      <section class="print-section-block">
        <div class="print-section-title">Historique</div>
        <section class="print-card">
          <h2>Historique des prix</h2>
          ${historyRows ? `<table class="print-table"><thead><tr><th>Date</th><th>Fournisseur</th><th>Marque</th><th>HT unité</th><th>HT colis</th></tr></thead><tbody>${historyRows}</tbody></table>` : '<div class="muted">Aucun historique de prix pour ce filtre.</div>'}
        </section>
        <section class="print-card">
          <h2>Historique des achats</h2>
          <div class="muted">En cours de développement.</div>
        </section>
      </section>`);
  }

  if (sections.includes('utilisation')) {
    sectionMarkup.push(`
      <section class="print-section-block">
        <div class="print-section-title">Utilisation</div>
        <section class="print-card"><div class="muted">En cours de développement.</div></section>
      </section>`);
  }

  if (sections.includes('tracabilites')) {
    sectionMarkup.push(`
      <section class="print-section-block">
        <div class="print-section-title">Traçabilités</div>
        <section class="print-card"><div class="muted">En cours de développement.</div></section>
      </section>`);
  }

  const supplierLabel = supplierFilter === 'all'
    ? 'Tous les fournisseurs'
    : (() => {
        const supplier = fournisseurs.find(f => String(f.id) === String(supplierFilter));
        return supplier?.nom || 'Fournisseur sélectionné';
      })();

  return `
    <div class="print-page">
      <header class="print-header">
        <div>
          <div class="print-app-name">Copilot boulangerie</div>
          <h1>Fiche produit</h1>
          <div class="print-subtitle">Édition du ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
        <div class="print-print-meta">
          <div class="print-category-wrap">${categoryChip(category)}</div>
          <div class="print-filter-badge">${esc(supplierLabel)}</div>
        </div>
      </header>
      ${sectionMarkup.join('')}
    </div>`;
}

function printProductSheet(ingredient, category, fournisseurs, options={}){
  const root = getOrCreatePrintRoot();
  root.innerHTML = buildProductPrintMarkup(ingredient, category, fournisseurs, options);
  root.classList.remove('hidden');
  document.body.classList.add('printing-product');
  setTimeout(() => window.print(), 50);
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    const chooser = document.getElementById('product-print-chooser');
    if (chooser && !chooser.classList.contains('hidden')) closeProductPrintChooser();
  }
});

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-product');
  document.body.classList.remove('printing-mercuriale');
  const root = document.getElementById('product-print-root');
  if (root) root.classList.add('hidden');
  const mercurialeRoot = document.getElementById('mercuriale-print-root');
  if (mercurialeRoot) mercurialeRoot.classList.add('hidden');
  const chooser = document.getElementById('product-print-chooser');
  if (chooser) chooser.classList.add('hidden');
});



function getOrCreateMercurialePrintRoot(){
  let root = document.getElementById('mercuriale-print-root');
  if (!root) {
    root = document.createElement('section');
    root.id = 'mercuriale-print-root';
    root.className = 'mercuriale-print-root hidden';
    document.body.appendChild(root);
  }
  return root;
}


function buildMercurialePrintMarkup(ingredients, categories, fournisseurs){
  let lastCategoryKey = null;
  const sortedIngredients = [...ingredients].sort((a, b) => {
    const catA = getCategoryById(categories, a.categorieId)?.nom || 'Sans catégorie';
    const catB = getCategoryById(categories, b.categorieId)?.nom || 'Sans catégorie';
    const byCategory = catA.localeCompare(catB, 'fr', { sensitivity: 'base' });
    if (byCategory !== 0) return byCategory;
    return (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
  });

  const rows = sortedIngredients.map(ingredient => {
    const category = getCategoryById(categories, ingredient.categorieId);
    const categoryName = category?.nom || 'Sans catégorie';
    const categoryColor = category?.couleur || '#d9d2c3';
    const categoryKey = `${categoryName}__${categoryColor}`;
    const offres = (ingredient.offres || []).length ? (ingredient.offres || []) : [null];
    const normalizedEan = getIngredientPrimaryEan(ingredient);
    const eanMarkup = normalizedEan
      ? `<div class="print-ean-block">${ean13Svg(normalizedEan)}<div class="print-ean-number">${esc(normalizedEan)}</div></div>`
      : `<div class="muted">${esc(ingredient.ean || '-')}</div>`;

    let block = '';
    if (categoryKey !== lastCategoryKey) {
      block += `<tr class="print-category-row"><td colspan="7"><div class="print-category-band" style="--cat-color:${esc(categoryColor)}"><span class="print-category-band__dot"></span><span class="print-category-band__label">${esc(categoryName)}</span></div></td></tr>`;
      lastCategoryKey = categoryKey;
    }

    block += offres.map((offre, idx) => {
      const supplier = offre ? fournisseurs.find(f => f.id === offre.fournisseurId) : null;
      return `<tr class="${idx === 0 ? 'product-first-row' : 'product-sub-row'}">
        <td>${idx === 0 ? esc(ingredient.nom || '-') : ''}</td>
        <td>${idx === 0 ? eanMarkup : ''}</td>
        <td>${esc(supplier?.nom || '-')}</td>
        <td>${esc(offre?.marque || '-')}</td>
        <td>${esc(offre?.reference || '-')}</td>
        <td>${offre?.prixHTUnite ? euro(offre.prixHTUnite) : '-'}</td>
        <td>${offre?.prixHTColis ? euro(offre.prixHTColis) : '-'}</td>
      </tr>`;
    }).join('');

    return block;
  }).join('');

  return `
    <div class="print-page mercuriale-print-page">
      <header class="print-header">
        <div>
          <div class="print-app-name">Copilot boulangerie</div>
          <h1>Mercuriale</h1>
          <div class="print-subtitle">Édition du ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </header>
      <section class="print-card">
        <table class="print-table mercuriale-print-table">
          <thead>
            <tr>
              <th>Produit</th><th>EAN</th><th>Fournisseur</th><th>Marque</th><th>Référence</th><th>HT unité</th><th>HT colis</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7">Aucun produit enregistré.</td></tr>'}</tbody>
        </table>
      </section>
    </div>`;
}

function printMercuriale(ingredients, categories, fournisseurs){
  const root = getOrCreateMercurialePrintRoot();
  root.innerHTML = buildMercurialePrintMarkup(ingredients, categories, fournisseurs);
  root.classList.remove('hidden');
  document.body.classList.add('printing-mercuriale');
  setTimeout(() => window.print(), 50);
}

function ingredientCloneForDuplicate(ingredient){
  const copy = JSON.parse(JSON.stringify(ingredient || {}));
  delete copy.id;
  copy.nom = `${ingredient?.nom || 'Produit'} (copie)`;
  copy.note = ingredient?.note || '';
  copy.priceHistory = Array.isArray(ingredient?.priceHistory) ? ingredient.priceHistory.slice(0, 50) : [];
  copy.offres = (copy.offres || []).map(offre => ({ ...offre, id: `offre_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }));
  return copy;
}

let scrollLockCount = 0;
function lockBodyScroll(){
  scrollLockCount += 1;
  document.body.classList.add('sheet-open');
  document.documentElement.classList.add('sheet-open');
}
function unlockBodyScroll(){
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (!scrollLockCount){
    document.body.classList.remove('sheet-open');
    document.documentElement.classList.remove('sheet-open');
  }
}
function openSheet(sheet, backdrop){
  if (!sheet || !backdrop) return;
  sheet.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  sheet.setAttribute('aria-hidden', 'false');
  lockBodyScroll();
}
function closeSheet(sheet, backdrop){
  if (!sheet || !backdrop) return;
  sheet.classList.add('hidden');
  backdrop.classList.add('hidden');
  sheet.setAttribute('aria-hidden', 'true');
  unlockBodyScroll();
}

async function loadRoute(route){
  state.route = ROUTES[route] ? route : 'dashboard';
  const cfg = ROUTES[state.route];
  const html = await fetch(cfg.file + '?v=' + encodeURIComponent(APP_VERSION)).then(r=>r.text());
  qs('#app-content').innerHTML = html;
  qs('#pageTitle').textContent = cfg.title;
  qsa('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.route === state.route));
  initCurrentPage();
  closeSidebar();
  history.replaceState({}, '', '#' + state.route);
}

function openSidebar(){ qs('#sidebar').classList.add('open'); qs('#overlay').classList.remove('hidden'); }
function closeSidebar(){ qs('#sidebar').classList.remove('open'); qs('#overlay').classList.add('hidden'); }

async function renderDashboard(){
  const [ingredients,fournisseurs,recettes] = await Promise.all([
    AppDB.getAll('ingredients'), AppDB.getAll('fournisseurs'), AppDB.getAll('recettes')
  ]);
  qs('[data-kpi="ingredients"]').textContent = ingredients.length;
  qs('[data-kpi="fournisseurs"]').textContent = fournisseurs.length;
  qs('[data-kpi="recettes"]').textContent = recettes.length;
  qs('[data-kpi="offres"]').textContent = ingredients.reduce((acc,i)=>acc + ((i.offres||[]).length),0);
}

async function renderFournisseurs(){
  const list = await AppDB.getAll('fournisseurs');
  const target = qs('#fournisseurs-list');
  if (!list.length) { target.innerHTML = '<div class="notice">Aucun fournisseur enregistré.</div>'; return; }
  target.innerHTML = list.map(f => `<div class="item"><div class="item-top"><div><strong>${esc(f.nom)}</strong><div class="muted">${esc(f.contact||'')}</div><div class="muted">${esc(f.telephone||'')}</div></div><button class="btn danger" type="button" data-delete-fournisseur="${f.id}">Supprimer</button></div></div>`).join('');
  qsa('[data-delete-fournisseur]').forEach(btn => btn.onclick = async()=>{ await AppDB.delete('fournisseurs', btn.dataset.deleteFournisseur); renderFournisseurs(); });
}

async function getMercurialeCategories(){
  const row = await AppDB.get('parametres', MERCURIALE_CATEGORIES_KEY);
  return row?.categories || [];
}
async function saveMercurialeCategories(categories){
  await AppDB.put('parametres', { id: MERCURIALE_CATEGORIES_KEY, categories });
}

function getCategoryById(categories, id){
  return categories.find(cat => cat.id === id) || null;
}
function categoryChip(category){
  if (!category) return '<span class="tag">Sans catégorie</span>';
  const bg = category.couleur || '#8b5e34';
  return `<span class="tag category-chip" style="--chip-color:${esc(bg)}">${esc(category.nom)}</span>`;
}

function fournisseurOptions(list, selected=''){
  return ['<option value="">Sélectionner</option>']
    .concat(list.map(f => `<option value="${f.id}" ${f.id===selected?'selected':''}>${esc(f.nom)}</option>`))
    .join('');
}
function categorieOptions(categories, selected=''){
  return [`<option value="">Sans catégorie</option>`]
    .concat(categories.map(cat => `<option value="${cat.id}" ${cat.id===selected?'selected':''}>${esc(cat.nom)}</option>`))
    .join('');
}
function tvaOptions(selected=''){
  return TVA_OPTIONS.map(v => `<option value="${v}" ${String(v)===String(selected)?'selected':''}>${String(v).replace('.',',')}%</option>`).join('');
}

function computeOffreFromField(offre, field){
  const q = num(offre.quantiteColis);
  const tvaRate = num(offre.tva) / 100;
  if (!q) return offre;
  if (field === 'prixHTColis') {
    offre.prixHTUnite = round(num(offre.prixHTColis) / q, 4);
    offre.prixTTCUnite = round(offre.prixHTUnite * (1 + tvaRate), 4);
    offre.prixTTCColis = round(num(offre.prixHTColis) * (1 + tvaRate), 4);
  } else if (field === 'prixTTCColis') {
    offre.prixHTColis = round(num(offre.prixTTCColis) / (1 + tvaRate), 4);
    offre.prixHTUnite = round(offre.prixHTColis / q, 4);
    offre.prixTTCUnite = round(num(offre.prixTTCColis) / q, 4);
  } else if (field === 'prixHTUnite') {
    offre.prixHTColis = round(num(offre.prixHTUnite) * q, 4);
    offre.prixTTCUnite = round(num(offre.prixHTUnite) * (1 + tvaRate), 4);
    offre.prixTTCColis = round(offre.prixHTColis * (1 + tvaRate), 4);
  } else if (field === 'prixTTCUnite') {
    offre.prixHTUnite = round(num(offre.prixTTCUnite) / (1 + tvaRate), 4);
    offre.prixHTColis = round(offre.prixHTUnite * q, 4);
    offre.prixTTCColis = round(num(offre.prixTTCUnite) * q, 4);
  } else if (field === 'tva' || field === 'quantiteColis') {
    if (num(offre.prixHTColis)) return computeOffreFromField(offre, 'prixHTColis');
    if (num(offre.prixTTCColis)) return computeOffreFromField(offre, 'prixTTCColis');
    if (num(offre.prixHTUnite)) return computeOffreFromField(offre, 'prixHTUnite');
    if (num(offre.prixTTCUnite)) return computeOffreFromField(offre, 'prixTTCUnite');
  }
  return offre;
}

function getIngredientDraft(form, currentIngredientId){
  const data = Object.fromEntries(new FormData(form).entries());
  return {
    id: currentIngredientId || undefined,
    nom: data.nom || '',
    categorieId: data.categorieId || '',
    uniteBase: data.uniteBase || 'kg',
    note: data.note || '',
    nutrition: {
      energie: data.energie || '',
      matieresGrasses: data.matieresGrasses || '',
      acidesGrasSatures: data.acidesGrasSatures || '',
      glucides: data.glucides || '',
      sucres: data.sucres || '',
      proteines: data.proteines || '',
      sel: data.sel || '',
    },
    allergenes: qsa('input[name="allergenes"]:checked', form).map(i => i.value),
  };
}

async function renderMercuriale(){
  const [ingredients, fournisseurs] = await Promise.all([AppDB.getAll('ingredients'), AppDB.getAll('fournisseurs')]);
  let categories = await getMercurialeCategories();
  let currentIngredientId = null;
  let ingredientDraft = null;
  let offres = [];

  const ingredientsList = qs('#ingredients-list');
  const emptyState = qs('#ingredients-empty');
  const ingredientSheet = qs('#ingredient-sheet');
  const ingredientBackdrop = qs('#ingredient-sheet-backdrop');
  const categoriesSheet = qs('#categories-sheet');
  const categoriesBackdrop = qs('#categories-sheet-backdrop');
  const detailSheet = qs('#ingredient-detail-sheet');
  const detailBackdrop = qs('#ingredient-detail-sheet-backdrop');
  const ingredientForm = qs('#ingredient-form');
  const categoriesForm = qs('#categorie-form');
  const offersEditor = qs('#offres-editor');
  const ingredientCategorySelect = qs('#ingredient-categorie');
  const colorPreview = qs('#categorie-color-preview');
  const categoriesList = qs('#categories-list');
  const ingredientSheetTitle = qs('#ingredient-sheet-title');
  const detailContent = qs('#ingredient-detail-content');
  const detailTitle = qs('#ingredient-detail-title');
  const searchInput = qs('#mercuriale-search');
  const filterCategorySelect = qs('#mercuriale-filter-category');
  const filterSupplierSelect = qs('#mercuriale-filter-fournisseur');
  const sortSelect = qs('#mercuriale-sort');
  const filterToggleBtn = qs('#toggle-mercuriale-filters-btn');
  const filtersPanel = qs('#mercuriale-filters-panel');
  const filters = { search: '', categorieId: '', fournisseurId: '', sort: 'az' };

const mercurialeHeader = qs('.mercuriale-header');
let selectionBar = qs('#mercuriale-selection-bar');
if (!selectionBar && mercurialeHeader) {
  selectionBar = document.createElement('div');
  selectionBar.id = 'mercuriale-selection-bar';
  selectionBar.className = 'mercuriale-selection-bar hidden';
  selectionBar.innerHTML = `
    <div class="mercuriale-selection-info"><strong id="selection-count">0</strong> sélectionné(s)</div>
    <div class="mercuriale-selection-actions">
      <button id="print-selection-btn" class="btn secondary" type="button">Imprimer la sélection</button>
      <button id="delete-selection-btn" class="btn danger" type="button">Supprimer la sélection</button>
      <button id="clear-selection-btn" class="btn" type="button">Annuler</button>
    </div>`;
  mercurialeHeader.insertAdjacentElement('afterend', selectionBar);
}
let selectedIngredientIds = new Set();
let longPressTimer = null;
let longPressTriggered = false;

  function renderAllergenes(selected=[]){
    const grid = qs('#allergenes-grid');
    grid.innerHTML = MERCURIALE_ALLERGENES.map(name => {
      const slug = slugify(name);
      return `<label class="allergene-item"><input type="checkbox" name="allergenes" value="${esc(slug)}" ${selected.includes(slug)?'checked':''}><span>${esc(name)}</span></label>`;
    }).join('');
  }


function updateSelectionBar(){
  if (!selectionBar) return;
  const hasSelection = selectedIngredientIds.size > 0;
  selectionBar.classList.toggle('hidden', !hasSelection);
  const countNode = qs('#selection-count', selectionBar);
  if (countNode) countNode.textContent = String(selectedIngredientIds.size);
}

function clearSelection(){
  selectedIngredientIds.clear();
  renderIngredients();
  updateSelectionBar();
}

function toggleIngredientSelection(id){
  if (selectedIngredientIds.has(id)) selectedIngredientIds.delete(id);
  else selectedIngredientIds.add(id);
  renderIngredients();
  updateSelectionBar();
}

function startLongPress(card){
  clearTimeout(longPressTimer);
  longPressTriggered = false;
  longPressTimer = setTimeout(() => {
    longPressTriggered = true;
    const id = card.dataset.productId;
    if (id && !selectedIngredientIds.has(id)) selectedIngredientIds.add(id);
    renderIngredients();
    updateSelectionBar();
  }, 420);
}

function cancelLongPress(){
  clearTimeout(longPressTimer);
  longPressTimer = null;
}

function renderIngredients(){
  const visibleIngredients = getVisibleIngredients();
  if (!ingredients.length){
    emptyState.classList.remove('hidden');
    ingredientsList.innerHTML = '';
    updateSelectionBar();
    return;
  }
  if (!visibleIngredients.length){
    emptyState.classList.remove('hidden');
    emptyState.textContent = 'Aucun produit ne correspond à la recherche.';
    ingredientsList.innerHTML = '';
    updateSelectionBar();
    return;
  }
  emptyState.classList.add('hidden');
  emptyState.textContent = 'Aucun produit enregistré.';
  ingredientsList.innerHTML = visibleIngredients.map(ingredient => {
    const cat = getCategoryById(categories, ingredient.categorieId);
    const firstOffre = (ingredient.offres || [])[0];
    const supplier = firstOffre ? fournisseurs.find(f => f.id === firstOffre.fournisseurId) : null;
    const sub = firstOffre ? `${esc(firstOffre.marque || supplier?.nom || 'Sans fournisseur')} · ${firstOffre.prixHTUnite ? euro(firstOffre.prixHTUnite) + ' HT / ' + esc(firstOffre.uniteColis || ingredient.uniteBase || 'unité') : 'Sans prix'}` : 'Aucune offre fournisseur';
    const isSelected = selectedIngredientIds.has(ingredient.id);
    return `
      <article class="item product-card ${isSelected ? 'selected' : ''}" data-product-id="${ingredient.id}" tabindex="0" aria-selected="${isSelected ? 'true' : 'false'}">
        <div class="item-top">
          <div>
            <strong>${esc(ingredient.nom)}</strong>
            <div class="toolbar chip-row">${categoryChip(cat)}</div>
            <div class="muted">EAN : ${esc(getIngredientPrimaryEan(ingredient) || '-')}</div>
            <div class="muted">${sub}</div>
          </div>
        </div>
      </article>`;
  }).join('');

  qsa('.product-card').forEach(card => {
    const id = card.dataset.productId;
    card.onclick = () => {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      if (selectedIngredientIds.size > 0) {
        toggleIngredientSelection(id);
        return;
      }
      showIngredientDetail(id);
    };
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (selectedIngredientIds.size > 0) toggleIngredientSelection(id);
        else showIngredientDetail(id);
      }
    };
    card.addEventListener('touchstart', () => startLongPress(card), { passive: true });
    card.addEventListener('touchend', cancelLongPress, { passive: true });
    card.addEventListener('touchmove', cancelLongPress, { passive: true });
    card.addEventListener('touchcancel', cancelLongPress, { passive: true });
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      startLongPress(card);
    });
    card.addEventListener('mouseup', cancelLongPress);
    card.addEventListener('mouseleave', cancelLongPress);
  });

  updateSelectionBar();
}

function renderCategorySelect(selected=''){
    ingredientCategorySelect.innerHTML = categorieOptions(categories, selected);
  }

  function renderMercurialeFilterControls(){
    if (filterCategorySelect) {
      filterCategorySelect.innerHTML = `<option value="">Toutes les catégories</option>${categories.map(cat => `<option value="${cat.id}" ${filters.categorieId === cat.id ? 'selected' : ''}>${esc(cat.nom)}</option>`).join('')}`;
    }
    if (filterSupplierSelect) {
      filterSupplierSelect.innerHTML = `<option value="">Tous les fournisseurs</option>${fournisseurs.map(f => `<option value="${f.id}" ${filters.fournisseurId === f.id ? 'selected' : ''}>${esc(f.nom)}</option>`).join('')}`;
    }
    if (sortSelect) sortSelect.value = filters.sort;
    if (searchInput) searchInput.value = filters.search;
  }

  function updateFiltersToggleState(){
    if (!filterToggleBtn || !filtersPanel) return;
    const isOpen = !filtersPanel.classList.contains('hidden');
    filterToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    filterToggleBtn.classList.toggle('active', isOpen);
  }

  function ingredientUnitSortPrice(ingredient){
    const prices = (ingredient.offres || []).map(offre => safePrice(offre.prixHTUnite));
    const best = Math.min(...prices, Number.POSITIVE_INFINITY);
    return Number.isFinite(best) ? best : Number.POSITIVE_INFINITY;
  }

  function getVisibleIngredients(){
    const search = (filters.search || '').trim().toLowerCase();
    let visible = ingredients.filter(ingredient => {
      const matchesSearch = !search || getIngredientSearchTokens(ingredient).includes(search);
      const matchesCategory = !filters.categorieId || ingredient.categorieId === filters.categorieId;
      const matchesSupplier = !filters.fournisseurId || (ingredient.offres || []).some(offre => offre.fournisseurId === filters.fournisseurId);
      return matchesSearch && matchesCategory && matchesSupplier;
    });
    visible.sort((a, b) => {
      if (filters.sort === 'za') return String(b.nom || '').localeCompare(String(a.nom || ''), 'fr', { sensitivity: 'base' });
      if (filters.sort === 'price-asc') return ingredientUnitSortPrice(a) - ingredientUnitSortPrice(b) || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' });
      if (filters.sort === 'price-desc') return ingredientUnitSortPrice(b) - ingredientUnitSortPrice(a) || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' });
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' });
    });
    return visible;
  }

  
function renderOffers(){
    if (!offres.length){
      offersEditor.innerHTML = '<div class="notice">Aucune offre ajoutée.</div>';
      return;
    }
    offres.forEach((offre, idx) => {
      if (!offre.id) offre.id = `offre_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      if (!('sourcePrincipale' in offre)) offre.sourcePrincipale = idx === 0;
    });
    if (!offres.some(offre => offre.sourcePrincipale) && offres[0]) offres[0].sourcePrincipale = true;
    offersEditor.innerHTML = offres.map((offre, idx) => `
      <div class="item offre-card" data-offre-index="${idx}">
        <div class="offre-card-header">
          <div class="detail-value">Offre ${idx + 1}</div>
          <label class="primary-source-toggle">
            <input type="radio" name="source-principale" data-offre-field="sourcePrincipale" data-index="${idx}" ${offre.sourcePrincipale ? 'checked' : ''}>
            <span>Source principale</span>
          </label>
        </div>
        <div class="form-grid">
          <div class="field"><label>Fournisseur</label><select data-offre-field="fournisseurId" data-index="${idx}">${fournisseurOptions(fournisseurs, offre.fournisseurId)}</select></div>
          <div class="field"><label>Marque</label><input data-offre-field="marque" data-index="${idx}" value="${esc(offre.marque || '')}" autocomplete="off"></div>
          <div class="field"><label>EAN marque / produit</label><input data-offre-field="ean" data-index="${idx}" value="${esc(offre.ean || '')}" inputmode="numeric" autocomplete="off"></div>
          <div class="field"><label>Référence</label><input data-offre-field="reference" data-index="${idx}" value="${esc(offre.reference || '')}" autocomplete="off"></div>
          <div class="field"><label>TVA</label><select data-offre-field="tva" data-index="${idx}">${tvaOptions(offre.tva ?? '5.5')}</select></div>
          <div class="field"><label>Quantité colis</label><input type="text" inputmode="decimal" data-offre-field="quantiteColis" data-index="${idx}" value="${formatNumberInput(offre.quantiteColis)}"></div>
          <div class="field"><label>Unité colis</label><select data-offre-field="uniteColis" data-index="${idx}"><option value="kg" ${offre.uniteColis==='kg'?'selected':''}>kg</option><option value="piece" ${offre.uniteColis==='piece'?'selected':''}>pièce</option><option value="l" ${offre.uniteColis==='l'?'selected':''}>l</option></select></div>
          <div class="field"><label>Prix HT unité</label><input type="text" inputmode="decimal" data-offre-field="prixHTUnite" data-index="${idx}" value="${formatNumberInput(offre.prixHTUnite)}"></div>
          <div class="field"><label>Prix TTC unité</label><input type="text" inputmode="decimal" data-offre-field="prixTTCUnite" data-index="${idx}" value="${formatNumberInput(offre.prixTTCUnite)}"></div>
          <div class="field"><label>Prix HT colis</label><input type="text" inputmode="decimal" data-offre-field="prixHTColis" data-index="${idx}" value="${formatNumberInput(offre.prixHTColis)}"></div>
          <div class="field"><label>Prix TTC colis</label><input type="text" inputmode="decimal" data-offre-field="prixTTCColis" data-index="${idx}" value="${formatNumberInput(offre.prixTTCColis)}"></div>
        </div>
        <div class="toolbar toolbar-end" style="margin-top:12px">
          <button class="btn danger" type="button" data-remove-offre="${idx}">Supprimer l’offre</button>
        </div>
      </div>`).join('');
  }

  function resetIngredientForm(){
    currentIngredientId = null;
    ingredientDraft = null;
    ingredientSheetTitle.textContent = 'Ajouter un ingrédient';
    ingredientForm.reset();
    offres = [];
    renderCategorySelect('');
    renderOffers();
    renderAllergenes([]);
  }

  function populateIngredientForm(ingredient){
    currentIngredientId = ingredient?.id || null;
    ingredientSheetTitle.textContent = ingredient?.id ? 'Modifier un ingrédient' : 'Ajouter un ingrédient';
    ingredientForm.reset();
    ingredientForm.nom.value = ingredient?.nom || '';
    ingredientForm.uniteBase.value = ingredient?.uniteBase || 'kg';
    if (ingredientForm.note) ingredientForm.note.value = ingredient?.note || '';
    renderCategorySelect(ingredient?.categorieId || '');
    ingredientForm.energie.value = ingredient?.nutrition?.energie || '';
    ingredientForm.matieresGrasses.value = ingredient?.nutrition?.matieresGrasses || '';
    ingredientForm.acidesGrasSatures.value = ingredient?.nutrition?.acidesGrasSatures || '';
    ingredientForm.glucides.value = ingredient?.nutrition?.glucides || '';
    ingredientForm.sucres.value = ingredient?.nutrition?.sucres || '';
    ingredientForm.proteines.value = ingredient?.nutrition?.proteines || '';
    ingredientForm.sel.value = ingredient?.nutrition?.sel || '';
    renderAllergenes(ingredient?.allergenes || []);
    offres = JSON.parse(JSON.stringify(ingredient?.offres || []));
    renderOffers();
  }

  function openIngredientSheetWithData(ingredient){
    populateIngredientForm(ingredient);
    openSheet(ingredientSheet, ingredientBackdrop);
  }


  function formatNutritionValue(key, value){
    if (value === undefined || value === null || value === '') return '-';
    const normalized = String(value).trim();
    const unitMap = {
      energie: 'kcal',
      matieresGrasses: 'g',
      acidesGrasSatures: 'g',
      glucides: 'g',
      sucres: 'g',
      proteines: 'g',
      sel: 'g',
    };
    const unit = unitMap[key] || '';
    if (!unit) return normalized;
    return /(kcal|g|kg|l)$/i.test(normalized) ? normalized : `${normalized} ${unit}`;
  }

  

async function showIngredientDetail(id){
    const ingredient = ingredients.find(item => item.id === id);
    if (!ingredient) return;
    const category = getCategoryById(categories, ingredient.categorieId);
    detailTitle.textContent = ingredient.nom;
    const nutrition = ingredient.nutrition || {};
    const allergenesLabels = (ingredient.allergenes || []).map(humanizeSlug);
    const nutritionRows = [
      ['Énergie', formatNutritionValue('energie', nutrition.energie)],
      ['Matières grasses', formatNutritionValue('matieresGrasses', nutrition.matieresGrasses)],
      ['Acides gras saturés', formatNutritionValue('acidesGrasSatures', nutrition.acidesGrasSatures)],
      ['Glucides', formatNutritionValue('glucides', nutrition.glucides)],
      ['Sucres', formatNutritionValue('sucres', nutrition.sucres)],
      ['Protéines', formatNutritionValue('proteines', nutrition.proteines)],
      ['Sel', formatNutritionValue('sel', nutrition.sel)],
    ];
    const historyEntries = (ingredient.priceHistory || []).slice().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    const primaryOffer = getPrimaryOffer(ingredient);
    const otherOffers = (ingredient.offres || []).filter(offre => !primaryOffer || offre.id !== primaryOffer.id);
    const renderOfferCard = (offre, { primary=false } = {}) => {
      const supplier = fournisseurs.find(f => f.id === offre.fournisseurId);
      const displayEan = getOfferDisplayEan(offre);
      const unitTrend = getOfferTrend(ingredient, offre, 'prixHTUnite');
      const colisTrend = getOfferTrend(ingredient, offre, 'prixHTColis');
      return `<div class="item compact-item fournisseur-detail-item${primary ? ' is-primary-offer' : ''}">
        <div class="item-top">
          <div>
            <div class="detail-value">${esc(supplier?.nom || 'Sans fournisseur')}</div>
            <div class="muted">${esc(offre.marque || '-')} · ${esc(offre.reference || '-')}</div>
          </div>
          <div class="toolbar chip-row">${offre.sourcePrincipale ? '<span class="tag source-badge">Principale</span>' : ''}</div>
        </div>
        ${displayEan ? `<div class="ean-visual-wrap fournisseur-ean-wrap">${ean13Svg(displayEan)}<div class="barcode-number monospace">${esc(displayEan)}</div></div>` : '<div class="muted">EAN non renseigné.</div>'}
        <div class="muted">${esc(offre.quantiteColis || '-')} ${esc(offre.uniteColis || ingredient.uniteBase || 'unité')} · TVA ${String(offre.tva ?? 0).replace('.', ',')}%</div>
        <div class="offer-price-lines">
          <div class="offer-price-line"><span class="detail-label">Prix HT unitaire</span><span class="offer-price-line__value">${trendArrowMarkup(unitTrend)} ${offre.prixHTUnite ? euro(offre.prixHTUnite) : '—'}</span></div>
          <div class="offer-price-line"><span class="detail-label">Prix HT colis</span><span class="offer-price-line__value">${trendArrowMarkup(colisTrend)} ${offre.prixHTColis ? euro(offre.prixHTColis) : '—'}</span></div>
        </div>
      </div>`;
    };
    const offersMarkup = primaryOffer ? `
      <div class="supplier-primary-block">
        <div class="detail-label">Fournisseur principal</div>
        ${renderOfferCard(primaryOffer, { primary: true })}
      </div>
      ${otherOffers.length ? `<details class="details supplier-expandable"><summary>Autres fournisseurs (${otherOffers.length})</summary><div class="details-content"><div class="list">${otherOffers.map(offre => renderOfferCard(offre)).join('')}</div></div></details>` : ''}
    ` : '<div class="notice">Aucune offre enregistrée.</div>';
    detailContent.innerHTML = `
      <section class="detail-panel">
        <div class="detail-actions-row">
          <button class="icon-square-btn" type="button" data-detail-action="edit" aria-label="Modifier" title="Modifier">✏️</button>
          <button class="icon-square-btn" type="button" data-detail-action="print" aria-label="Imprimer" title="Imprimer">🖨️</button>
          <button class="icon-square-btn" type="button" data-detail-action="duplicate" aria-label="Dupliquer" title="Dupliquer">📄</button>
          <button class="icon-square-btn danger" type="button" data-detail-action="delete" aria-label="Supprimer" title="Supprimer">🗑️</button>
        </div>

        <div class="detail-tabs" role="tablist" aria-label="Sections produit">
          <button class="detail-tab active" type="button" data-detail-tab="infos" aria-selected="true">Infos</button>
          <button class="detail-tab" type="button" data-detail-tab="historique" aria-selected="false">Historique</button>
          <button class="detail-tab" type="button" data-detail-tab="utilisation" aria-selected="false">Utilisation</button>
          <button class="detail-tab" type="button" data-detail-tab="tracabilites" aria-selected="false">Traçabilités</button>
        </div>

        <div class="detail-tab-panel active" data-detail-panel="infos">
          <section class="card compact-card">
            <div class="detail-info-stack">
              <div>
                <div class="detail-label">Nom du produit</div>
                <div class="detail-value detail-title-value">${esc(ingredient.nom || '-')}</div>
              </div>
              <div>
                <div class="detail-label">Catégorie</div>
                <div class="toolbar chip-row">${categoryChip(category)}</div>
              </div>
            </div>
          </section>

          <section class="card compact-card">
            <h4>Fournisseurs</h4>
            <div class="list">${offersMarkup}</div>
          </section>

          <section class="card compact-card">
            <h4>Allergènes</h4>
            <div class="toolbar chip-row">${allergenesLabels.length ? allergenesLabels.map(item => `<span class="tag">${esc(item)}</span>`).join('') : '<span class="muted">Aucun allergène renseigné.</span>'}</div>
          </section>

          <section class="card compact-card">
            <details class="details nutrition-details">
              <summary>Nutrition <span class="muted">(pour 100g)</span></summary>
              <div class="details-content nutrition-grid-detail">
                ${nutritionRows.map(([label, value]) => `<div><strong>${esc(label)}</strong><div class="muted">${esc(value || '-')}</div></div>`).join('')}
              </div>
            </details>
          </section>

          <section class="card compact-card detail-note-card">
            <h4>Note</h4>
            <textarea id="ingredient-note-inline" class="detail-note-input" rows="4" placeholder="Ajouter une note rapide...">${esc(ingredient.note || '')}</textarea>
            <div class="toolbar toolbar-end" style="margin-top:10px">
              <button class="btn secondary" type="button" data-detail-action="save-note">Enregistrer la note</button>
            </div>
          </section>
        </div>

        <div class="detail-tab-panel" data-detail-panel="historique">
          <section class="card compact-card">
            <div class="item-top">
              <h4>Historique des prix</h4>
              <div class="toolbar">
                <button class="btn secondary active" type="button" data-history-mode="graphique">Graphique</button>
                <button class="btn secondary" type="button" data-history-mode="liste">Liste</button>
              </div>
            </div>
            <div data-history-panel="graphique" class="history-panel active">
              ${buildPriceHistoryChart(historyEntries.slice().reverse(), fournisseurs)}
            </div>
            <div data-history-panel="liste" class="history-panel hidden">
              ${buildPriceHistoryList(historyEntries, fournisseurs)}
            </div>
          </section>

          <section class="card compact-card">
            <div class="item-top">
              <h4>Historique des achats</h4>
              <div class="toolbar">
                <button class="btn secondary active" type="button" disabled>Graphique</button>
                <button class="btn secondary" type="button" disabled>Liste</button>
              </div>
            </div>
            <div class="notice">En cours de développement.</div>
          </section>
        </div>

        <div class="detail-tab-panel" data-detail-panel="utilisation">
          <section class="card compact-card placeholder-card">
            <h4>Utilisation</h4>
            <p class="muted">À venir. Cet onglet accueillera les usages en recettes, productions et associations produit.</p>
          </section>
        </div>

        <div class="detail-tab-panel" data-detail-panel="tracabilites">
          <section class="card compact-card placeholder-card">
            <h4>Traçabilités</h4>
            <p class="muted">À venir. Cet onglet accueillera lots, DLC, documents et suivi de provenance.</p>
          </section>
        </div>
      </section>`;

    qsa('[data-detail-tab]', detailContent).forEach(btn => {
      btn.onclick = () => {
        qsa('[data-detail-tab]', detailContent).forEach(item => {
          item.classList.toggle('active', item === btn);
          item.setAttribute('aria-selected', item === btn ? 'true' : 'false');
        });
        qsa('[data-detail-panel]', detailContent).forEach(panel => {
          panel.classList.toggle('active', panel.dataset.detailPanel === btn.dataset.detailTab);
        });
      };
    });

    qsa('[data-history-mode]', detailContent).forEach(btn => {
      btn.onclick = () => {
        qsa('[data-history-mode]', detailContent).forEach(item => item.classList.toggle('active', item === btn));
        qsa('[data-history-panel]', detailContent).forEach(panel => panel.classList.toggle('hidden', panel.dataset.historyPanel !== btn.dataset.historyMode));
      };
    });

    qsa('[data-detail-action]', detailContent).forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.detailAction;
        if (action === 'save-note') {
          const textarea = qs('#ingredient-note-inline', detailContent);
          ingredient.note = textarea?.value || '';
          await AppDB.put('ingredients', ingredient);
          const idx = ingredients.findIndex(item => item.id === ingredient.id);
          if (idx >= 0) ingredients[idx] = ingredient;
          renderIngredients();
          return;
        }
        if (action === 'edit') {
          closeSheet(detailSheet, detailBackdrop);
          openIngredientSheetWithData(ingredient);
          return;
        }
        if (action === 'print') {
          openProductPrintChooser(ingredient, category, fournisseurs);
          return;
        }
        if (action === 'duplicate') {
          if (!confirm(`Dupliquer ${ingredient.nom} ?`)) return;
          if (!confirm('Confirmer la duplication du produit ?')) return;
          const duplicate = ingredientCloneForDuplicate(ingredient);
          await AppDB.put('ingredients', duplicate);
          ingredients.unshift(duplicate);
          renderIngredients();
          renderDashboard();
          showIngredientDetail(duplicate.id);
          return;
        }
        if (action === 'delete') {
          if (!confirm(`Supprimer ${ingredient.nom} ?`)) return;
          if (!confirm('Confirmer la suppression définitive ?')) return;
          await AppDB.delete('ingredients', ingredient.id);
          const idx = ingredients.findIndex(item => item.id === ingredient.id);
          if (idx >= 0) ingredients.splice(idx, 1);
          closeSheet(detailSheet, detailBackdrop);
          renderIngredients();
          renderDashboard();
          return;
        }
      };
    });

    openSheet(detailSheet, detailBackdrop);
  }

  function renderCategoriesManager(){
    categoriesList.innerHTML = categories.length ? categories.map(cat => `
      <article class="item compact-item">
        <div class="item-top">
          <div class="toolbar chip-row"><span class="tag category-chip" style="--chip-color:${esc(cat.couleur || '#8b5e34')}">${esc(cat.nom)}</span></div>
          <div class="toolbar">
            <button class="btn secondary" type="button" data-edit-categorie="${cat.id}">Modifier</button>
            <button class="btn danger" type="button" data-delete-categorie="${cat.id}">Supprimer</button>
          </div>
        </div>
      </article>`).join('') : '<div class="notice">Aucune catégorie créée.</div>';

    qsa('[data-edit-categorie]').forEach(btn => {
      btn.onclick = () => {
        const cat = categories.find(item => item.id === btn.dataset.editCategorie);
        if (!cat) return;
        categoriesForm.id.value = cat.id;
        categoriesForm.nom.value = cat.nom;
        categoriesForm.couleur.value = cat.couleur || '#8b5e34';
        colorPreview.style.setProperty('--chip-color', cat.couleur || '#8b5e34');
        colorPreview.textContent = cat.nom;
      };
    });

    qsa('[data-delete-categorie]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.deleteCategorie;
        categories = categories.filter(item => item.id !== id);
        await saveMercurialeCategories(categories);
        renderCategoriesManager();
        renderCategorySelect('');
        const impacted = ingredients.filter(item => item.categorieId === id);
        for (const ingredient of impacted){
          ingredient.categorieId = '';
          await AppDB.put('ingredients', ingredient);
        }
        renderIngredients();
      };
    });
  }

  function resetCategorieForm(){
    categoriesForm.reset();
    categoriesForm.id.value = '';
    categoriesForm.couleur.value = '#8b5e34';
    colorPreview.style.setProperty('--chip-color', '#8b5e34');
    colorPreview.textContent = categoriesForm.nom.value || 'Nouvelle catégorie';
  }

  categoriesForm.nom.addEventListener('input', () => {
    colorPreview.textContent = categoriesForm.nom.value || 'Nouvelle catégorie';
  });
  categoriesForm.couleur.addEventListener('input', () => {
    colorPreview.style.setProperty('--chip-color', categoriesForm.couleur.value || '#8b5e34');
  });

  ingredientBackdrop.onclick = () => closeSheet(ingredientSheet, ingredientBackdrop);
  categoriesBackdrop.onclick = () => closeSheet(categoriesSheet, categoriesBackdrop);
  detailBackdrop.onclick = () => closeSheet(detailSheet, detailBackdrop);
  qs('#close-ingredient-sheet-btn').onclick = () => {
    ingredientDraft = getIngredientDraft(ingredientForm, currentIngredientId);
    ingredientDraft.offres = JSON.parse(JSON.stringify(offres));
    closeSheet(ingredientSheet, ingredientBackdrop);
  };
  qs('#close-categories-sheet-btn').onclick = () => closeSheet(categoriesSheet, categoriesBackdrop);
  qs('#close-ingredient-detail-sheet-btn').onclick = () => closeSheet(detailSheet, detailBackdrop);
  const printBtn = qs('#print-mercuriale-btn');
  if (printBtn) printBtn.onclick = () => printMercuriale(ingredients, categories, fournisseurs);

const printSelectionBtn = qs('#print-selection-btn');
const deleteSelectionBtn = qs('#delete-selection-btn');
const clearSelectionBtn = qs('#clear-selection-btn');
if (printSelectionBtn) printSelectionBtn.onclick = () => {
  const selected = ingredients.filter(item => selectedIngredientIds.has(item.id));
  if (!selected.length) return;
  printMercuriale(selected, categories, fournisseurs);
};
if (deleteSelectionBtn) deleteSelectionBtn.onclick = async () => {
  const selected = ingredients.filter(item => selectedIngredientIds.has(item.id));
  if (!selected.length) return;
  if (!confirm(`Supprimer ${selected.length} produit(s) ?`)) return;
  if (!confirm('Confirmer la suppression définitive de la sélection ?')) return;
  for (const ingredient of selected) {
    await AppDB.delete('ingredients', ingredient.id);
  }
  for (let i = ingredients.length - 1; i >= 0; i -= 1) {
    if (selectedIngredientIds.has(ingredients[i].id)) ingredients.splice(i, 1);
  }
  clearSelection();
  renderDashboard();
};
if (clearSelectionBtn) clearSelectionBtn.onclick = () => clearSelection();

  renderMercurialeFilterControls();
  updateFiltersToggleState();
  if (filterToggleBtn && filtersPanel) filterToggleBtn.onclick = () => {
    filtersPanel.classList.toggle('hidden');
    updateFiltersToggleState();
  };
  if (searchInput) searchInput.addEventListener('input', (e) => { filters.search = e.target.value || ''; renderIngredients(); });
  if (filterCategorySelect) filterCategorySelect.addEventListener('change', (e) => { filters.categorieId = e.target.value || ''; renderIngredients(); });
  if (filterSupplierSelect) filterSupplierSelect.addEventListener('change', (e) => { filters.fournisseurId = e.target.value || ''; renderIngredients(); });
  if (sortSelect) sortSelect.addEventListener('change', (e) => { filters.sort = e.target.value || 'az'; renderIngredients(); });

  qs('#open-categories-btn').onclick = () => {
    resetCategorieForm();
    renderCategoriesManager();
    openSheet(categoriesSheet, categoriesBackdrop);
  };
  qs('#open-ingredient-sheet-btn').onclick = () => {
    if (ingredientDraft) openIngredientSheetWithData({ ...ingredientDraft, offres: ingredientDraft.offres || [] });
    else openIngredientSheetWithData(null);
  };

  qs('#cancel-ingredient-btn').onclick = () => {
    resetIngredientForm();
    closeSheet(ingredientSheet, ingredientBackdrop);
  };

  function appendOfferDraft(){
    if (!Array.isArray(offres)) offres = [];
    offres.push({
      id: `offre_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fournisseurId: '',
      marque: '',
      ean: '',
      reference: '',
      tva: 5.5,
      quantiteColis: 1,
      uniteColis: ingredientForm?.uniteBase?.value || 'kg',
      prixHTUnite: 0,
      prixTTCUnite: 0,
      prixHTColis: 0,
      prixTTCColis: 0,
      sourcePrincipale: offres.length === 0,
    });
    renderOffers();
  }

  const addOfferBtn = qs('#add-offre-btn');
  if (addOfferBtn) {
    addOfferBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      appendOfferDraft();
    });
  }

  if (ingredientSheet) {
    ingredientSheet.addEventListener('click', (e) => {
      const trigger = e.target.closest('#add-offre-btn, [data-action="add-offre"]');
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();
      appendOfferDraft();
    });
  }

  offersEditor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-offre]');
    if (!btn) return;
    offres.splice(Number(btn.dataset.removeOffre), 1);
    renderOffers();
  });
  offersEditor.addEventListener('input', (e) => {
    const field = e.target.dataset.offreField;
    const idx = Number(e.target.dataset.index);
    if (field == null || Number.isNaN(idx) || !offres[idx]) return;
    if (field === 'sourcePrincipale') return;
    offres[idx][field] = ['quantiteColis','prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','tva'].includes(field)
      ? e.target.value
      : e.target.value;
  });
  offersEditor.addEventListener('change', (e) => {
    const field = e.target.dataset.offreField;
    const idx = Number(e.target.dataset.index);
    if (field == null || Number.isNaN(idx) || !offres[idx]) return;
    if (field === 'sourcePrincipale') {
      offres.forEach((offre, index) => { offre.sourcePrincipale = index === idx; });
      renderOffers();
      return;
    }
    const numericFields = ['quantiteColis','prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','tva'];
    offres[idx][field] = numericFields.includes(field) ? num(String(e.target.value).replace(',', '.')) : e.target.value;
    if (numericFields.includes(field)) {
      computeOffreFromField(offres[idx], field);
      const card = e.target.closest('[data-offre-index]');
      if (card) {
        ['prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','quantiteColis'].forEach(key => {
          const target = qs(`[data-offre-field="${key}"][data-index="${idx}"]`, card);
          if (target && target !== e.target) target.value = formatNumberInput(offres[idx][key]);
        });
        const tvaSelect = qs(`[data-offre-field="tva"][data-index="${idx}"]`, card);
        if (tvaSelect) tvaSelect.value = String(offres[idx].tva ?? 5.5);
      }
      return;
    }
  });

  categoriesForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(categoriesForm).entries());
    const payload = { id: data.id || `cat_${Date.now()}`, nom: data.nom.trim(), couleur: data.couleur || '#8b5e34' };
    if (!payload.nom) return;
    const existingIndex = categories.findIndex(item => item.id === payload.id);
    if (existingIndex >= 0) categories[existingIndex] = payload;
    else categories.push(payload);
    await saveMercurialeCategories(categories);
    renderCategoriesManager();
    renderCategorySelect(ingredientForm.categorieId?.value || '');
    renderIngredients();
    resetCategorieForm();
  };
  qs('#reset-categorie-btn').onclick = resetCategorieForm;

  ingredientForm.onsubmit = async (e) => {
    e.preventDefault();
    const previous = ingredients.find(item => item.id === currentIngredientId) || null;
    const draft = getIngredientDraft(ingredientForm, currentIngredientId);
    draft.offres = JSON.parse(JSON.stringify(offres)).map((offre, idx) => ({
      ...offre,
      id: offre.id || `offre_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      ean: getOfferDisplayEan(offre),
      tva: num(offre.tva),
      quantiteColis: num(offre.quantiteColis),
      prixHTUnite: num(offre.prixHTUnite),
      prixTTCUnite: num(offre.prixTTCUnite),
      prixHTColis: num(offre.prixHTColis),
      prixTTCColis: num(offre.prixTTCColis),
      sourcePrincipale: Boolean(offre.sourcePrincipale)
    }));
    if (!draft.offres.some(offre => offre.sourcePrincipale) && draft.offres[0]) draft.offres[0].sourcePrincipale = true;
    draft.priceHistory = appendPriceHistory(previous, draft);
    await AppDB.put('ingredients', draft);
    const existingIndex = ingredients.findIndex(item => item.id === draft.id);
    if (existingIndex >= 0) ingredients[existingIndex] = draft;
    else ingredients.unshift(draft);
    resetIngredientForm();
    closeSheet(ingredientSheet, ingredientBackdrop);
    renderIngredients();
    updateSelectionBar();
    renderDashboard();
  };

  renderCategorySelect('');
  renderAllergenes([]);
  resetCategorieForm();
  renderOffers();
  renderIngredients();
}

async function renderRecettes(){
  const [recettes, ingredients] = await Promise.all([AppDB.getAll('recettes'), AppDB.getAll('ingredients')]);
  const list = qs('#recettes-list');
  list.innerHTML = recettes.length ? recettes.map(r => `<div class="item"><div class="item-top"><div><strong>${esc(r.nom)}</strong><div class="muted">${(r.lignes||[]).length} ingrédient(s)</div></div><button class="btn danger" type="button" data-delete-recette="${r.id}">Supprimer</button></div></div>`).join('') : '<div class="notice">Aucune recette enregistrée.</div>';
  qsa('[data-delete-recette]').forEach(btn => btn.onclick = async()=>{ await AppDB.delete('recettes', btn.dataset.deleteRecette); renderRecettes(); renderDashboard(); });

  const lineWrap = qs('#recette-lignes');
  const lignes = [];
  function draw(){
    lineWrap.innerHTML = lignes.map((l,idx)=>`<div class="item"><div class="form-grid"><div class="field"><label>Ingrédient</label><select data-ligne="ingredientId" data-index="${idx}"><option value="">Sélectionner</option>${ingredients.map(i=>`<option value="${i.id}" ${l.ingredientId===i.id?'selected':''}>${esc(i.nom)}</option>`).join('')}</select></div><div class="field"><label>Quantité</label><input type="number" step="0.001" data-ligne="quantite" data-index="${idx}" value="${num(l.quantite)}" /></div></div><div class="toolbar" style="margin-top:10px"><button class="btn danger" type="button" data-remove-ligne="${idx}">Supprimer la ligne</button></div></div>`).join('');
    qsa('[data-remove-ligne]', lineWrap).forEach(btn => btn.onclick = ()=>{ lignes.splice(Number(btn.dataset.removeLigne),1); draw(); });
  }
  qs('#add-ligne-btn').onclick = ()=>{ lignes.push({ ingredientId:'', quantite:0 }); draw(); };
  lineWrap.addEventListener('input', e=>{ const i=Number(e.target.dataset.index); const k=e.target.dataset.ligne; if(lignes[i]) lignes[i][k]=k==='quantite'?num(e.target.value):e.target.value; });
  lineWrap.addEventListener('change', e=>{ const i=Number(e.target.dataset.index); const k=e.target.dataset.ligne; if(lignes[i]) lignes[i][k]=k==='quantite'?num(e.target.value):e.target.value; });

  qs('#recette-form').onsubmit = async (e)=>{
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    await AppDB.put('recettes',{ nom:data.nom, rendement:data.rendement, lignes });
    e.target.reset(); lignes.splice(0,lignes.length); draw(); renderRecettes(); renderDashboard();
  };
  draw();
}

async function renderSimulation(){
  const recettes = await AppDB.getAll('recettes');
  const select = qs('#simulation-recette');
  select.innerHTML = '<option value="">Sélectionner</option>' + recettes.map(r=>`<option value="${r.id}">${esc(r.nom)}</option>`).join('');
  qs('#simulation-form').onsubmit = async(e)=>{
    e.preventDefault();
    const recette = recettes.find(r=>r.id===select.value);
    if(!recette){ qs('#simulation-resultat').innerHTML = '<div class="notice">Choisissez une recette.</div>'; return; }
    const ingredients = await AppDB.getAll('ingredients');
    const total = (recette.lignes||[]).reduce((sum,l)=>{
      const ing = ingredients.find(i=>i.id===l.ingredientId);
      const offre = ing && (ing.offres||[])[0];
      if(!offre || !offre.prixHTUnite) return sum;
      return sum + num(offre.prixHTUnite) * num(l.quantite);
    },0);
    const qte = num(qs('#simulation-quantite').value||1);
    qs('#simulation-resultat').innerHTML = `<div class="metric"><div class="label">Coût matière estimé</div><div class="value">${euro(total*qte)}</div></div>`;
  };
}

async function renderParametres(){
  qs('#export-btn').onclick = async()=>{
    const payload = await AppDB.exportAll();
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `copilot-boulangerie-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };
  qs('#import-file').onchange = async(e)=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text();
    await AppDB.importAll(JSON.parse(text));
    alert('Import terminé.');
    loadRoute('dashboard');
  };
  qs('#reset-btn').onclick = async()=>{
    if(!confirm('Tout effacer ?')) return;
    for(const s of AppDB.stores) await AppDB.clear(s);
    alert('Base locale réinitialisée.');
    loadRoute('dashboard');
  };
}

function initCurrentPage(){
  if(state.route==='dashboard') return renderDashboard();
  if(state.route==='mercuriale') return renderMercuriale();
  if(state.route==='recettes') return renderRecettes();
  if(state.route==='fournisseurs'){
    qs('#fournisseur-form').onsubmit = async(e)=>{
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      await AppDB.put('fournisseurs', data);
      e.target.reset(); renderFournisseurs(); renderDashboard();
    };
    return renderFournisseurs();
  }
  if(state.route==='simulation') return renderSimulation();
  if(state.route==='parametres') return renderParametres();
}

function initShell(){
  qs('#footerVersion').textContent = APP_VERSION;
  qsa('.nav-link').forEach(btn => btn.onclick = ()=>loadRoute(btn.dataset.route));
  qs('#menuToggle').onclick = openSidebar;
  qs('#overlay').onclick = closeSidebar;
  const initial = (location.hash || '#dashboard').replace('#','');
  loadRoute(initial);
}

document.addEventListener('DOMContentLoaded', initShell);
/* Patch v2.3.2 — impression Mercuriale : code-barres par source, sans EAN texte */
function buildMercurialePrintMarkup(ingredients, categories, fournisseurs){
  let lastCategoryKey = null;
  const sortedIngredients = [...ingredients].sort((a, b) => {
    const catA = getCategoryById(categories, a.categorieId)?.nom || 'Sans catégorie';
    const catB = getCategoryById(categories, b.categorieId)?.nom || 'Sans catégorie';
    const byCategory = catA.localeCompare(catB, 'fr', { sensitivity: 'base' });
    if (byCategory !== 0) return byCategory;
    return (a.nom || '').localeCompare(b.nom || '', 'fr', { sensitivity: 'base' });
  });

  const rows = sortedIngredients.map(ingredient => {
    const category = getCategoryById(categories, ingredient.categorieId);
    const categoryName = category?.nom || 'Sans catégorie';
    const categoryColor = category?.couleur || '#d9d2c3';
    const categoryKey = `${categoryName}__${categoryColor}`;
    const offres = (ingredient.offres || []).length ? (ingredient.offres || []) : [null];

    let block = '';
    if (categoryKey !== lastCategoryKey) {
      block += `<tr class="print-category-row"><td colspan="7"><div class="print-category-band" style="--cat-color:${esc(categoryColor)}"><span class="print-category-band__dot"></span><span class="print-category-band__label">${esc(categoryName)}</span></div></td></tr>`;
      lastCategoryKey = categoryKey;
    }

    block += offres.map((offre, idx) => {
      const supplier = offre ? fournisseurs.find(f => f.id === offre.fournisseurId) : null;
      const sourceEan = normalizeEan13(offre?.ean || '') || normalizeEan13(getIngredientPrimaryEan(ingredient) || '');
      const eanMarkup = sourceEan
        ? `<div class="print-ean-block print-ean-block--compact">${ean13Svg(sourceEan)}</div>`
        : `<div class="muted">-</div>`;

      return `<tr class="${idx === 0 ? 'product-first-row' : 'product-sub-row'}">
        <td>${idx === 0 ? esc(ingredient.nom || '-') : ''}</td>
        <td>${eanMarkup}</td>
        <td>${esc(supplier?.nom || '-')}</td>
        <td>${esc(offre?.marque || '-')}</td>
        <td>${esc(offre?.reference || '-')}</td>
        <td>${offre?.prixHTUnite ? euro(offre.prixHTUnite) : '-'}</td>
        <td>${offre?.prixHTColis ? euro(offre.prixHTColis) : '-'}</td>
      </tr>`;
    }).join('');

    return block;
  }).join('');

  return `
    <div class="print-page mercuriale-print-page">
      <header class="print-header">
        <div>
          <div class="print-app-name">Copilot boulangerie</div>
          <h1>Mercuriale</h1>
          <div class="print-subtitle">Édition du ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
      </header>
      <section class="print-card">
        <table class="print-table mercuriale-print-table">
          <thead>
            <tr>
              <th>Produit</th><th>Code-barres</th><th>Fournisseur</th><th>Marque</th><th>Référence</th><th>HT unité</th><th>HT colis</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7">Aucun produit enregistré.</td></tr>'}</tbody>
        </table>
      </section>
    </div>`;
}
