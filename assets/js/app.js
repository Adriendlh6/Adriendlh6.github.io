const APP_VERSION = 'v2.0.10';
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
  const normalHeight = 84;
  const guardHeight = 96;
  const textY = 118;
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
  return `<svg class="ean-svg" viewBox="0 0 ${width} 124" role="img" aria-label="Code-barres EAN ${ean}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="124" fill="#fff"/>
    ${rects}
    <text x="0" y="${textY}" font-size="18" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#111">${ean[0]}</text>
    <text x="${quiet + 3*moduleWidth}" y="${textY}" font-size="18" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#111">${ean.slice(1,7)}</text>
    <text x="${quiet + (3+42+5)*moduleWidth}" y="${textY}" font-size="18" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#111">${ean.slice(7)}</text>
  </svg>`;
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

function buildProductPrintMarkup(ingredient, category, fournisseurs){
  const nutrition = ingredient.nutrition || {};
  const allergenes = (ingredient.allergenes || []).map(humanizeSlug);
  const offers = (ingredient.offres || []).map(offre => {
    const supplier = fournisseurs.find(f => f.id === offre.fournisseurId);
    return `<tr>
      <td>${esc(supplier?.nom || 'Sans fournisseur')}</td>
      <td>${esc(offre.marque || '-')}</td>
      <td>${esc(offre.reference || '-')}</td>
      <td>${esc(offre.quantiteColis || '-')} ${esc(offre.uniteColis || ingredient.uniteBase || 'u')}</td>
      <td>${String(offre.tva ?? 0).replace('.', ',')}%</td>
      <td>${offre.prixHTUnite ? euro(offre.prixHTUnite) : '-'}</td>
      <td>${offre.prixTTCUnite ? euro(offre.prixTTCUnite) : '-'}</td>
    </tr>`;
  }).join('');
  return `
    <div class="print-page">
      <header class="print-header">
        <div>
          <div class="print-app-name">Copilot boulangerie</div>
          <h1>Fiche produit</h1>
          <div class="print-subtitle">Édition du ${new Date().toLocaleDateString('fr-FR')}</div>
        </div>
        <div class="print-category-wrap">${categoryChip(category)}</div>
      </header>
      <section class="print-grid">
        <article class="print-card">
          <div class="detail-label">Nom du produit</div>
          <div class="detail-value detail-title-value">${esc(ingredient.nom || '-')}</div>
        </article>
        <article class="print-card">
          <div class="detail-label">EAN</div>
          <div class="print-barcode-wrap">${ean13Svg(ingredient.ean || '')}</div>
          <div class="print-ean-text monospace">${esc(normalizeEan13(ingredient.ean || '') || ingredient.ean || '-')}</div>
        </article>
      </section>
      <section class="print-card">
        <h2>Fournisseurs</h2>
        ${offers ? `<table class="print-table"><thead><tr><th>Fournisseur</th><th>Marque</th><th>Référence</th><th>Colis</th><th>TVA</th><th>HT unité</th><th>TTC unité</th></tr></thead><tbody>${offers}</tbody></table>` : '<div class="muted">Aucune offre enregistrée.</div>'}
      </section>
      <section class="print-two-col">
        <article class="print-card">
          <h2>Allergènes</h2>
          <div class="toolbar chip-row">${allergenes.length ? allergenes.map(a => `<span class="tag">${esc(a)}</span>`).join('') : '<span class="muted">Aucun allergène renseigné.</span>'}</div>
        </article>
        <article class="print-card">
          <h2>Nutrition pour 100 g</h2>
          <div class="print-nutrition-grid">
            <div><strong>Énergie</strong><span>${esc(nutrition.energie || '-')}</span></div>
            <div><strong>Matières grasses</strong><span>${esc(nutrition.matieresGrasses || '-')}</span></div>
            <div><strong>Acides gras saturés</strong><span>${esc(nutrition.acidesGrasSatures || '-')}</span></div>
            <div><strong>Glucides</strong><span>${esc(nutrition.glucides || '-')}</span></div>
            <div><strong>Sucres</strong><span>${esc(nutrition.sucres || '-')}</span></div>
            <div><strong>Protéines</strong><span>${esc(nutrition.proteines || '-')}</span></div>
            <div><strong>Sel</strong><span>${esc(nutrition.sel || '-')}</span></div>
          </div>
        </article>
      </section>
    </div>`;
}

function printProductSheet(ingredient, category, fournisseurs){
  const root = getOrCreatePrintRoot();
  root.innerHTML = buildProductPrintMarkup(ingredient, category, fournisseurs);
  root.classList.remove('hidden');
  document.body.classList.add('printing-product');
  setTimeout(() => window.print(), 50);
}

window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing-product');
  document.body.classList.remove('printing-mercuriale');
  const root = document.getElementById('product-print-root');
  if (root) root.classList.add('hidden');
  const mercurialeRoot = document.getElementById('mercuriale-print-root');
  if (mercurialeRoot) mercurialeRoot.classList.add('hidden');
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
  const rows = ingredients.map(ingredient => {
    const category = getCategoryById(categories, ingredient.categorieId);
    const offres = (ingredient.offres || []).length ? (ingredient.offres || []) : [null];
    return offres.map((offre, idx) => {
      const supplier = offre ? fournisseurs.find(f => f.id === offre.fournisseurId) : null;
      return `<tr class="${idx === 0 ? 'product-first-row' : 'product-sub-row'}">
        <td>${idx === 0 ? esc(ingredient.nom || '-') : ''}</td>
        <td>${idx === 0 ? esc(category?.nom || 'Sans catégorie') : ''}</td>
        <td>${idx === 0 ? esc(normalizeEan13(ingredient.ean || '') || ingredient.ean || '-') : ''}</td>
        <td>${esc(supplier?.nom || '-')}</td>
        <td>${esc(offre?.marque || '-')}</td>
        <td>${esc(offre?.reference || '-')}</td>
        <td>${offre?.prixHTUnite ? euro(offre.prixHTUnite) : '-'}</td>
        <td>${offre?.prixTTCUnite ? euro(offre.prixTTCUnite) : '-'}</td>
        <td>${offre?.prixHTColis ? euro(offre.prixHTColis) : '-'}</td>
        <td>${offre?.prixTTCColis ? euro(offre.prixTTCColis) : '-'}</td>
      </tr>`;
    }).join('');
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
              <th>Produit</th><th>Catégorie</th><th>EAN</th><th>Fournisseur</th><th>Marque</th><th>Référence</th><th>HT unité</th><th>TTC unité</th><th>HT colis</th><th>TTC colis</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10">Aucun produit enregistré.</td></tr>'}</tbody>
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
    ean: data.ean || '',
    uniteBase: data.uniteBase || 'kg',
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
  if (!ingredients.length){
    emptyState.classList.remove('hidden');
    ingredientsList.innerHTML = '';
    updateSelectionBar();
    return;
  }
  emptyState.classList.add('hidden');
  ingredientsList.innerHTML = ingredients.map(ingredient => {
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
            <div class="muted">EAN : ${esc(ingredient.ean || '-')}</div>
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

  function renderOffers(){
    if (!offres.length){
      offersEditor.innerHTML = '<div class="notice">Aucune offre ajoutée.</div>';
      return;
    }
    offersEditor.innerHTML = offres.map((offre, idx) => `
      <div class="item offre-card" data-offre-index="${idx}">
        <div class="form-grid">
          <div class="field"><label>Fournisseur</label><select data-offre-field="fournisseurId" data-index="${idx}">${fournisseurOptions(fournisseurs, offre.fournisseurId)}</select></div>
          <div class="field"><label>Marque</label><input data-offre-field="marque" data-index="${idx}" value="${esc(offre.marque || '')}" autocomplete="off"></div>
          <div class="field"><label>Référence</label><input data-offre-field="reference" data-index="${idx}" value="${esc(offre.reference || '')}" autocomplete="off"></div>
          <div class="field"><label>TVA</label><select data-offre-field="tva" data-index="${idx}">${tvaOptions(offre.tva ?? '5.5')}</select></div>
          <div class="field"><label>Quantité colis</label><input type="number" min="0" step="0.001" data-offre-field="quantiteColis" data-index="${idx}" value="${formatNumberInput(offre.quantiteColis)}" inputmode="decimal"></div>
          <div class="field"><label>Unité colis</label><select data-offre-field="uniteColis" data-index="${idx}"><option value="kg" ${offre.uniteColis==='kg'?'selected':''}>kg</option><option value="piece" ${offre.uniteColis==='piece'?'selected':''}>pièce</option><option value="l" ${offre.uniteColis==='l'?'selected':''}>l</option></select></div>
          <div class="field"><label>Prix HT unité</label><input type="number" min="0" step="0.0001" data-offre-field="prixHTUnite" data-index="${idx}" value="${formatNumberInput(offre.prixHTUnite)}" inputmode="decimal"></div>
          <div class="field"><label>Prix TTC unité</label><input type="number" min="0" step="0.0001" data-offre-field="prixTTCUnite" data-index="${idx}" value="${formatNumberInput(offre.prixTTCUnite)}" inputmode="decimal"></div>
          <div class="field"><label>Prix HT colis</label><input type="number" min="0" step="0.0001" data-offre-field="prixHTColis" data-index="${idx}" value="${formatNumberInput(offre.prixHTColis)}" inputmode="decimal"></div>
          <div class="field"><label>Prix TTC colis</label><input type="number" min="0" step="0.0001" data-offre-field="prixTTCColis" data-index="${idx}" value="${formatNumberInput(offre.prixTTCColis)}" inputmode="decimal"></div>
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
    ingredientForm.ean.value = ingredient?.ean || '';
    ingredientForm.uniteBase.value = ingredient?.uniteBase || 'kg';
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

  
async function showIngredientDetail(id){
    const ingredient = ingredients.find(item => item.id === id);
    if (!ingredient) return;
    const category = getCategoryById(categories, ingredient.categorieId);
    detailTitle.textContent = ingredient.nom;
    const nutrition = ingredient.nutrition || {};
    const allergenesLabels = (ingredient.allergenes || []).map(humanizeSlug);
    const nutritionRows = [
      ['Énergie', nutrition.energie],
      ['Matières grasses', nutrition.matieresGrasses],
      ['Acides gras saturés', nutrition.acidesGrasSatures],
      ['Glucides', nutrition.glucides],
      ['Sucres', nutrition.sucres],
      ['Protéines', nutrition.proteines],
      ['Sel', nutrition.sel],
    ];
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
          <button class="detail-tab" type="button" data-detail-tab="utilisation" aria-selected="false">Utilisation</button>
          <button class="detail-tab" type="button" data-detail-tab="consommation" aria-selected="false">Consommation</button>
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
              <div>
                <div class="detail-label">EAN</div>
                <div class="ean-detail-row ean-visual-block">
                  <div class="ean-detail-code detail-value monospace">${esc(normalizeEan13(ingredient.ean || '') || ingredient.ean || '-')}</div>
                  <div class="ean-visual-wrap">${ean13Svg(ingredient.ean || '')}</div>
                </div>
              </div>
            </div>
          </section>

          <section class="card compact-card">
            <h4>Fournisseurs</h4>
            <div class="list">
              ${(ingredient.offres || []).length ? ingredient.offres.map(offre => {
                const supplier = fournisseurs.find(f => f.id === offre.fournisseurId);
                return `<div class="item compact-item fournisseur-detail-item">
                  <div class="detail-value">${esc(supplier?.nom || 'Sans fournisseur')}</div>
                  <div class="muted">${esc(offre.marque || '-')} · ${esc(offre.reference || '-')}</div>
                  <div class="muted">${esc(offre.quantiteColis || '-') } ${esc(offre.uniteColis || ingredient.uniteBase || 'unité')} · TVA ${String(offre.tva ?? 0).replace('.', ',')}%</div>
                  <div class="muted">${offre.prixHTUnite ? euro(offre.prixHTUnite) + ' HT / unité' : 'Sans prix unitaire'}${offre.prixTTCUnite ? ' · ' + euro(offre.prixTTCUnite) + ' TTC / unité' : ''}</div>
                </div>`;
              }).join('') : '<div class="notice">Aucune offre enregistrée.</div>'}
            </div>
          </section>

          <section class="card compact-card">
            <h4>Allergènes</h4>
            <div class="toolbar chip-row">${allergenesLabels.length ? allergenesLabels.map(item => `<span class="tag">${esc(item)}</span>`).join('') : '<span class="muted">Aucun allergène renseigné.</span>'}</div>
          </section>

          <section class="card compact-card">
            <details class="details nutrition-details">
              <summary>Nutrition</summary>
              <div class="details-content nutrition-grid-detail">
                ${nutritionRows.map(([label, value]) => `<div><strong>${esc(label)}</strong><div class="muted">${esc(value || '-')}</div></div>`).join('')}
              </div>
            </details>
          </section>
        </div>

        <div class="detail-tab-panel" data-detail-panel="utilisation">
          <section class="card compact-card placeholder-card">
            <h4>Utilisation</h4>
            <p class="muted">À venir. Cet onglet accueillera les usages en recettes, productions et associations produit.</p>
          </section>
        </div>

        <div class="detail-tab-panel" data-detail-panel="consommation">
          <section class="card compact-card placeholder-card">
            <h4>Consommation</h4>
            <p class="muted">À venir. Cet onglet accueillera les volumes consommés, historiques et tendances d’usage.</p>
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

    qsa('[data-detail-action]', detailContent).forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.detailAction;
        if (action === 'edit') {
          closeSheet(detailSheet, detailBackdrop);
          openIngredientSheetWithData(ingredient);
          return;
        }
        if (action === 'print') {
          printProductSheet(ingredient, category, fournisseurs);
          return;
        }
        if (action === 'duplicate') {
          if (!confirm(`Dupliquer ${ingredient.nom} ?`)) return;
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
        }      };
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

  qs('#add-offre-btn').onclick = () => {
    offres.push({
      fournisseurId: '', marque: '', reference: '', tva: 5.5, quantiteColis: 1,
      uniteColis: ingredientForm.uniteBase.value || 'kg', prixHTUnite: 0, prixTTCUnite: 0, prixHTColis: 0, prixTTCColis: 0,
    });
    renderOffers();
  };

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
    offres[idx][field] = ['quantiteColis','prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','tva'].includes(field) ? num(e.target.value) : e.target.value;
  });
  offersEditor.addEventListener('change', (e) => {
    const field = e.target.dataset.offreField;
    const idx = Number(e.target.dataset.index);
    if (field == null || Number.isNaN(idx) || !offres[idx]) return;
    offres[idx][field] = ['quantiteColis','prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','tva'].includes(field) ? num(e.target.value) : e.target.value;
    if (['prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','quantiteColis','tva'].includes(field)) computeOffreFromField(offres[idx], field);
    renderOffers();
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
    const draft = getIngredientDraft(ingredientForm, currentIngredientId);
    draft.offres = JSON.parse(JSON.stringify(offres));
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
