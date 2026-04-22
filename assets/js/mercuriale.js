/* Mercuriale isolated module - phase 2 */
(function(){
function ensureJSZipLoaded(){
  if (typeof JSZip !== 'undefined') return Promise.resolve(JSZip);
  if (window.__mercurialeJsZipPromise) return window.__mercurialeJsZipPromise;
  window.__mercurialeJsZipPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
    script.async = true;
    script.onload = () => {
      if (typeof JSZip !== 'undefined') resolve(JSZip);
      else reject(new Error('JSZip chargé mais indisponible'));
    };
    script.onerror = () => reject(new Error('Impossible de charger JSZip'));
    document.head.appendChild(script);
  });
  return window.__mercurialeJsZipPromise;
}


async function exportMercurialeXls(selectedCategoryIds = []){
  await ensureJSZipLoaded();

  const rawCategories = typeof getMercurialeCategories === 'function'
    ? await getMercurialeCategories()
    : [];
  const categories = Array.isArray(rawCategories) ? rawCategories : Object.values(rawCategories || {});
  const fournisseurs = typeof AppDB !== 'undefined' && AppDB?.getAll
    ? await AppDB.getAll('fournisseurs')
    : [];
  const ingredients = typeof AppDB !== 'undefined' && AppDB?.getAll
    ? await AppDB.getAll('ingredients')
    : [];

  const selectedSet = new Set((selectedCategoryIds || []).map(String));

  const getCategoryId = (ingredient) => String(
    ingredient?.categorieId
    ?? ingredient?.categoryId
    ?? 'uncategorized'
  );

  const findCategory = (ingredient) => {
    const ingredientCategoryId = getCategoryId(ingredient);
    return categories.find(cat => String(cat?.id ?? cat?.slug ?? '') === ingredientCategoryId);
  };

  const getCategoryName = (ingredient) => {
    const category = findCategory(ingredient);
    return category?.nom || category?.name || 'Sans catégorie';
  };

  const getCategoryColor = (ingredient) => {
    const category = findCategory(ingredient);
    return category?.couleur || category?.color || '#D6C6B4';
  };

  const filtered = !selectedSet.size
    ? ingredients
    : ingredients.filter(item => selectedSet.has(getCategoryId(item)));

  const escXml = (value='') => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const xmlSafeColor = (hex='D6C6B4') => {
    const value = String(hex || '').replace('#', '').trim();
    return /^[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : 'D6C6B4';
  };

  const colLetter = (index) => {
    let n = index + 1;
    let s = '';
    while (n > 0) {
      const mod = (n - 1) % 26;
      s = String.fromCharCode(65 + mod) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  const headers = ['Produit','Source principale','Fournisseur','Marque','EAN','Référence','Quantité colis','TVA','HT unité','TTC unité','HT colis','TTC colis'];
  const lastCol = colLetter(headers.length - 1);
  let rowIndex = 1;
  const rows = [];
  const merges = [];

  rows.push(`
    <row r="${rowIndex}" ht="24" customHeight="1">
      <c r="A${rowIndex}" t="inlineStr" s="1"><is><t>${escXml(`Mercuriale éditée le ${new Date().toLocaleDateString('fr-FR')}`)}</t></is></c>
    </row>
  `);
  merges.push(`<mergeCell ref="A1:${lastCol}1"/>`);
  rowIndex += 1;

  const headerRow = headers.map((header, idx) => {
    const col = colLetter(idx);
    return `<c r="${col}${rowIndex}" t="inlineStr" s="2"><is><t>${escXml(header)}</t></is></c>`;
  }).join('');
  rows.push(`<row r="${rowIndex}" ht="22" customHeight="1">${headerRow}</row>`);
  rowIndex += 1;

  let currentCategory = null;
  const categoryFillColors = [];
  const categoryStyleIdByKey = new Map();

  const ensureCategoryStyleId = (categoryId, colorHex) => {
    const key = `${String(categoryId)}__${colorHex}`;
    if (!categoryStyleIdByKey.has(key)) {
      categoryFillColors.push(colorHex);
      categoryStyleIdByKey.set(key, 4 + (categoryFillColors.length - 1));
    }
    return categoryStyleIdByKey.get(key);
  };

  filtered.forEach(ingredient => {
    const categoryId = getCategoryId(ingredient);
    const categoryName = getCategoryName(ingredient);
    const categoryColor = xmlSafeColor(getCategoryColor(ingredient));

    if (currentCategory !== categoryId) {
      currentCategory = categoryId;
      const categoryStyleId = ensureCategoryStyleId(categoryId, categoryColor);
      rows.push(`
        <row r="${rowIndex}" ht="20" customHeight="1">
          <c r="A${rowIndex}" t="inlineStr" s="${categoryStyleId}"><is><t>${escXml(categoryName)}</t></is></c>
        </row>
      `);
      merges.push(`<mergeCell ref="A${rowIndex}:${lastCol}${rowIndex}"/>`);
      rowIndex += 1;
    }

    const offers = Array.isArray(ingredient.offres) && ingredient.offres.length ? ingredient.offres : [{}];
    offers.forEach(offre => {
      const fournisseur = (fournisseurs || []).find(f => String(f.id) === String(offre.fournisseurId || ''));
      const values = [
        ingredient.nom || '',
        offre.sourcePrincipale ? 'Oui' : '',
        fournisseur?.nom || '',
        offre.marque || '',
        String(offre.ean || '').trim(),
        offre.reference || '',
        offre.quantiteColis ?? '',
        offre.tva ?? '',
        offre.prixHTUnite ?? '',
        offre.prixTTCUnite ?? '',
        offre.prixHTColis ?? '',
        offre.prixTTCColis ?? ''
      ];
      const cells = values.map((value, idx) => {
        const col = colLetter(idx);
        return `<c r="${col}${rowIndex}" t="inlineStr" s="0"><is><t>${escXml(value)}</t></is></c>`;
      }).join('');
      rows.push(`<row r="${rowIndex}" ht="21" customHeight="1">${cells}</row>`);
      rowIndex += 1;
    });
  });

  const fillsXml = categoryFillColors.map(color => `
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FF${color}"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  `).join('');

  const categoryXfsXml = categoryFillColors.map((color, idx) => {
    const fillId = 3 + idx;
    return `<xf numFmtId="0" fontId="1" fillId="${fillId}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>`;
  }).join('');

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <fonts count="2">
      <font><sz val="11"/><name val="Calibri"/></font>
      <font><b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/></font>
    </fonts>
    <fills count="${3 + categoryFillColors.length}">
      <fill><patternFill patternType="none"/></fill>
      <fill><patternFill patternType="gray125"/></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FFF3E7D7"/><bgColor indexed="64"/></patternFill></fill>
      ${fillsXml}
    </fills>
    <borders count="2">
      <border><left/><right/><top/><bottom/><diagonal/></border>
      <border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border>
    </borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="${4 + categoryFillColors.length}">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
      ${categoryXfsXml}
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  </styleSheet>`;

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
    <dimension ref="A1:${lastCol}${Math.max(rowIndex-1,1)}"/>
    <sheetViews><sheetView workbookViewId="0"/></sheetViews>
    <sheetFormatPr defaultRowHeight="18"/>
    <cols>
      <col min="1" max="1" width="26"/>
      <col min="2" max="2" width="14"/>
      <col min="3" max="3" width="18"/>
      <col min="4" max="4" width="16"/>
      <col min="5" max="5" width="16"/>
      <col min="6" max="6" width="16"/>
      <col min="7" max="7" width="12"/>
      <col min="8" max="8" width="7"/>
      <col min="9" max="9" width="10"/>
      <col min="10" max="10" width="10"/>
      <col min="11" max="11" width="10"/>
      <col min="12" max="12" width="10"/>
    </cols>
    <sheetData>${rows.join('')}</sheetData>
    <mergeCells count="${merges.length}">${merges.join('')}</mergeCells>
  </worksheet>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
    <sheets>
      <sheet name="Mercuriale" sheetId="1" r:id="rId1"/>
    </sheets>
  </workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  </Relationships>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  </Relationships>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  </Types>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.folder('_rels').file('.rels', rootRelsXml);
  zip.folder('xl').file('workbook.xml', workbookXml);
  zip.folder('xl').folder('_rels').file('workbook.xml.rels', workbookRelsXml);
  zip.folder('xl').folder('worksheets').file('sheet1.xml', sheetXml);
  zip.folder('xl').file('styles.xml', stylesXml);

  zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }).then(blob => {
    const xlsxBlob = new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(xlsxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mercuriale_${new Date().toISOString().slice(0,10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }).catch(error => {
    console.error('Export .xlsx impossible', error);
    alert("Impossible de générer le fichier .xlsx pour le moment.");
  });
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


function unloadRouteAssets(){
  qsa('[data-route-asset]').forEach(node => node.remove());
  delete window.MercurialePage;
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
  for (const src of (assets.js || [])) {
    await loadScriptAsset(src);
  }
}

async function loadRoute(route){
  state.route = ROUTES[route] ? route : 'dashboard';
  const cfg = ROUTES[state.route];
  const html = await fetch(cfg.file + '?v=' + encodeURIComponent(APP_VERSION)).then(r=>r.text());
  qs('#app-content').innerHTML = html;
  qs('#pageTitle').textContent = cfg.title;
  qsa('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.route === state.route));
  await ensureRouteAssets(state.route);
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
  if (!(q > 0)) return offre;
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
          <div class="field"><label>TVA</label><select data-offre-field="tva" data-index="${idx}">${TVA_OPTIONS.map(v => `<option value="${v}" ${Number(offre.tva ?? 5.5) === Number(v) ? 'selected' : ''}>${String(v).replace('.', ',')} %</option>`).join('')}</select></div>
          <div class="field"><label>Quantité colis</label><input type="text" inputmode="decimal" enterkeyhint="done" data-offre-field="quantiteColis" data-index="${idx}" value="${formatQuantityFieldValue(offre.quantiteColis)}" autocomplete="off" pattern="[0-9]+([\\.,][0-9]+)?"></div>
          <div class="field"><label>Unité colis</label><select data-offre-field="uniteColis" data-index="${idx}"><option value="kg" ${offre.uniteColis==='kg'?'selected':''}>kg</option><option value="piece" ${offre.uniteColis==='piece'?'selected':''}>pièce</option><option value="l" ${offre.uniteColis==='l'?'selected':''}>l</option></select></div>
          <div class="field"><label>Prix HT unité</label><input type="text" inputmode="decimal" enterkeyhint="done" data-offre-field="prixHTUnite" data-index="${idx}" value="${formatDecimalFieldValue(offre.prixHTUnite, 2)}" autocomplete="off" pattern="[0-9]+([\\.,][0-9]+)?"></div>
          <div class="field"><label>Prix TTC unité</label><input type="text" inputmode="decimal" enterkeyhint="done" data-offre-field="prixTTCUnite" data-index="${idx}" value="${formatDecimalFieldValue(offre.prixTTCUnite, 2)}" autocomplete="off" pattern="[0-9]+([\\.,][0-9]+)?"></div>
          <div class="field"><label>Prix HT colis</label><input type="text" inputmode="decimal" enterkeyhint="done" data-offre-field="prixHTColis" data-index="${idx}" value="${formatDecimalFieldValue(offre.prixHTColis, 2)}" autocomplete="off" pattern="[0-9]+([\\.,][0-9]+)?"></div>
          <div class="field"><label>Prix TTC colis</label><input type="text" inputmode="decimal" enterkeyhint="done" data-offre-field="prixTTCColis" data-index="${idx}" value="${formatDecimalFieldValue(offre.prixTTCColis, 2)}" autocomplete="off" pattern="[0-9]+([\\.,][0-9]+)?"></div>
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
    offres.forEach(offre => {
      if (!offre.lastEditedPriceField) {
        if (num(offre.prixHTUnite)) offre.lastEditedPriceField = 'prixHTUnite';
        else if (num(offre.prixTTCUnite)) offre.lastEditedPriceField = 'prixTTCUnite';
        else if (num(offre.prixHTColis)) offre.lastEditedPriceField = 'prixHTColis';
        else if (num(offre.prixTTCColis)) offre.lastEditedPriceField = 'prixTTCColis';
        else offre.lastEditedPriceField = 'prixHTUnite';
      }
    });
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
              ${buildScreenPriceHistoryList(historyEntries, fournisseurs)}
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

    qsa('[data-history-expand-all]', detailContent).forEach(btn => {
      btn.onclick = () => {
        const expand = btn.dataset.historyExpandAll !== '1';
        qsa('[data-history-more]', detailContent).forEach(item => { item.open = expand; });
        btn.dataset.historyExpandAll = expand ? '1' : '0';
        btn.textContent = expand ? 'Tout réduire' : 'Tout voir';
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
  if (printBtn) printBtn.onclick = () => openMercurialePrintChooser(ingredients, categories, fournisseurs);

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
      lastEditedPriceField: 'prixHTUnite',
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
  const amountFields = ['prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis','quantiteColis'];
  const selectAllIfNeeded = (event) => {
    const field = event.target?.dataset?.offreField;
    if (!amountFields.includes(field)) return;
    if (event.target.tagName !== 'INPUT') return;
    requestAnimationFrame(() => {
      try { event.target.select(); } catch (_) {}
    });
  };

  offersEditor.addEventListener('focusin', selectAllIfNeeded);
  offersEditor.addEventListener('click', selectAllIfNeeded);

  offersEditor.addEventListener('input', (e) => {
    const field = e.target.dataset.offreField;
    const idx = Number(e.target.dataset.index);
    if (field == null || Number.isNaN(idx) || !offres[idx]) return;
    if (field === 'sourcePrincipale') return;
    offres[idx][field] = e.target.value;
    if (['prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis'].includes(field)) {
      offres[idx].lastEditedPriceField = field;
    }
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
    if (numericFields.includes(field)) {
      const normalized = normalizeNumericInputValue(e.target.value);
      offres[idx][field] = normalized === '' ? 0 : normalized;
      if (['prixHTUnite','prixTTCUnite','prixHTColis','prixTTCColis'].includes(field)) {
        offres[idx].lastEditedPriceField = field;
      }
      updateOffreComputedValues(offres[idx], field);
      const card = e.target.closest('[data-offre-index]');
      syncOffreCardInputs(card, offres[idx], idx);
      return;
    }
    offres[idx][field] = e.target.value;
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

async

  const api = {
    ensureJSZipLoaded,
    exportMercurialeXls,
    printMercuriale,
    ingredientCloneForDuplicate,
    lockBodyScroll,
    unlockBodyScroll,
    openSheet,
    closeSheet,
    unloadRouteAssets,
    loadScriptAsset,
    ensureRouteAssets,
    loadRoute,
    openSidebar,
    closeSidebar,
    renderDashboard,
    renderFournisseurs,
    getMercurialeCategories,
    saveMercurialeCategories,
    getCategoryById,
    categoryChip,
    fournisseurOptions,
    categorieOptions,
    tvaOptions,
    computeOffreFromField,
    getIngredientDraft,
    renderMercuriale,
    renderAllergenes,
    updateSelectionBar,
    clearSelection,
    toggleIngredientSelection,
    startLongPress,
    cancelLongPress,
    renderIngredients,
    renderCategorySelect,
    renderMercurialeFilterControls,
    updateFiltersToggleState,
    ingredientUnitSortPrice,
    getVisibleIngredients,
    renderOffers,
    resetIngredientForm,
    populateIngredientForm,
    openIngredientSheetWithData,
    formatNutritionValue,
    showIngredientDetail,
    renderCategoriesManager,
    resetCategorieForm,
    appendOfferDraft,
  };

  window.MercurialePageFns = api;
  window.MercurialePage = {
    render: (...args) => renderMercuriale(...args),
    getMercurialeCategories: (...args) => getMercurialeCategories(...args),
    exportMercurialeXls: (...args) => exportMercurialeXls(...args)
  };
})();
