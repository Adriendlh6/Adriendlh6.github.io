const APP_VERSION = 'v2.0.4';
const ROUTES = {
  dashboard: { title: 'Dashboard', file: 'pages/dashboard.html', subtitle: 'Vue d’ensemble de l’activité' },
  mercuriale: { title: 'Mercuriale', file: 'pages/mercuriale.html', subtitle: 'Gestion des produits acheté' },
  recettes: { title: 'Recettes', file: 'pages/recettes.html', subtitle: 'Fiches recettes et coûts' },
  fournisseurs: { title: 'Fournisseurs', file: 'pages/fournisseurs.html', subtitle: 'Référentiel fournisseurs' },
  simulation: { title: 'Simulation', file: 'pages/simulation.html', subtitle: 'Estimation des coûts et marges' },
  parametres: { title: 'Paramètres', file: 'pages/parametres.html', subtitle: 'Sauvegarde et réglages' },
};

const state = { route: 'dashboard' };
const mercurialeState = {
  fournisseurs: [],
  ingredients: [],
  categories: [],
  draft: null,
  currentIngredientId: null,
};

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function euro(v) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v || 0)); }
function num(v) { return Number(v || 0); }
function round2(v) { return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100; }
function esc(s = '') { return String(s).replace(/[&<>\"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

async function loadRoute(route) {
  state.route = ROUTES[route] ? route : 'dashboard';
  const cfg = ROUTES[state.route];
  const html = await fetch(cfg.file + '?v=' + encodeURIComponent(APP_VERSION)).then(r => r.text());
  qs('#app-content').innerHTML = html;
  qs('#pageTitle').textContent = cfg.title;
  qs('.subtitle').textContent = cfg.subtitle;
  qsa('.nav-link').forEach(btn => btn.classList.toggle('active', btn.dataset.route === state.route));
  initCurrentPage();
  closeSidebar();
  history.replaceState({}, '', '#' + state.route);
}

function openSidebar() { qs('#sidebar').classList.add('open'); qs('#overlay').classList.remove('hidden'); }
function closeSidebar() { qs('#sidebar').classList.remove('open'); qs('#overlay').classList.add('hidden'); }
let bodyScrollLockY = 0;
function lockBodyScroll() {
  if (document.body.classList.contains('no-scroll')) return;
  bodyScrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.style.top = `-${bodyScrollLockY}px`;
  document.body.classList.add('no-scroll');
}
function unlockBodyScroll() {
  if (!document.body.classList.contains('no-scroll')) return;
  document.body.classList.remove('no-scroll');
  document.body.style.top = '';
  window.scrollTo(0, bodyScrollLockY || 0);
}

async function renderDashboard() {
  const [ingredients, fournisseurs, recettes] = await Promise.all([
    AppDB.getAll('ingredients'), AppDB.getAll('fournisseurs'), AppDB.getAll('recettes')
  ]);
  qs('[data-kpi="ingredients"]').textContent = ingredients.length;
  qs('[data-kpi="fournisseurs"]').textContent = fournisseurs.length;
  qs('[data-kpi="recettes"]').textContent = recettes.length;
  qs('[data-kpi="offres"]').textContent = ingredients.reduce((acc, i) => acc + ((i.offres || []).length), 0);
}

async function renderFournisseurs() {
  const list = await AppDB.getAll('fournisseurs');
  const target = qs('#fournisseurs-list');
  if (!list.length) { target.innerHTML = '<div class="notice">Aucun fournisseur enregistré.</div>'; return; }
  target.innerHTML = list.map(f => `<div class="item"><div class="item-top"><div><strong>${esc(f.nom)}</strong><div class="muted">${esc(f.contact || '')}</div><div class="muted">${esc(f.telephone || '')}</div></div><button class="btn danger" type="button" data-delete-fournisseur="${f.id}">Supprimer</button></div></div>`).join('');
  qsa('[data-delete-fournisseur]').forEach(btn => btn.onclick = async () => { await AppDB.delete('fournisseurs', btn.dataset.deleteFournisseur); renderFournisseurs(); });
}

function fournisseurOptions(list, selected = '') {
  return ['<option value="">Sélectionner</option>']
    .concat(list.map(f => `<option value="${f.id}" ${f.id === selected ? 'selected' : ''}>${esc(f.nom)}</option>`))
    .join('');
}

async function getMercurialeCategories() {
  const row = await AppDB.get('parametres', 'mercurialeCategories');
  return (row && row.items) ? row.items : [];
}

async function saveMercurialeCategories(items) {
  await AppDB.put('parametres', { id: 'mercurialeCategories', items });
}

function createEmptyIngredientDraft() {
  return {
    nom: '',
    categorie: '',
    ean: '',
    uniteBase: 'kg',
    nutrition: { energie: '', matieresGrasses: '', acidesGrasSatures: '', glucides: '', sucres: '', proteines: '', sel: '', fibres: '' },
    allergenes: [],
    offres: []
  };
}

function createOffreDraft() {
  return {
    fournisseurId: '',
    marque: '',
    reference: '',
    quantiteColis: 1,
    uniteColis: 'kg',
    tva: 5.5,
    prixHTUnite: '',
    prixTTCUnite: '',
    prixHTColis: '',
    prixTTCColis: ''
  };
}

function getCategoryColor(name) {
  const found = mercurialeState.categories.find(c => c.nom === name);
  return found ? found.couleur : '#d8d2ca';
}

function categoryTag(name) {
  const label = name || 'Sans catégorie';
  const color = name ? getCategoryColor(name) : '#d8d2ca';
  return `<span class="tag category-chip" style="--chip:${esc(color)}">${esc(label)}</span>`;
}

function syncCategorySelect() {
  const select = qs('select[name="categorie"]');
  if (!select) return;
  const current = mercurialeState.draft?.categorie || '';
  const options = ['<option value="">Sans catégorie</option>']
    .concat(mercurialeState.categories.map(c => `<option value="${esc(c.nom)}" ${c.nom === current ? 'selected' : ''}>${esc(c.nom)}</option>`));
  select.innerHTML = options.join('');
}

function fillIngredientFormFromDraft() {
  const form = qs('#ingredient-form');
  if (!form || !mercurialeState.draft) return;
  const draft = mercurialeState.draft;
  form.nom.value = draft.nom || '';
  form.ean.value = draft.ean || '';
  form.uniteBase.value = draft.uniteBase || 'kg';
  syncCategorySelect();
  form.categorie.value = draft.categorie || '';
  const n = draft.nutrition || {};
  form.energie.value = n.energie || '';
  form.matieresGrasses.value = n.matieresGrasses || '';
  form.acidesGrasSatures.value = n.acidesGrasSatures || '';
  form.glucides.value = n.glucides || '';
  form.sucres.value = n.sucres || '';
  form.proteines.value = n.proteines || '';
  form.sel.value = n.sel || '';
  form.fibres.value = n.fibres || '';
  qsa('input[name="allergenes"]', form).forEach(input => {
    input.checked = (draft.allergenes || []).includes(input.value);
  });
}

function collectIngredientFormIntoDraft() {
  const form = qs('#ingredient-form');
  if (!form || !mercurialeState.draft) return;
  mercurialeState.draft.nom = form.nom.value.trim();
  mercurialeState.draft.categorie = form.categorie.value;
  mercurialeState.draft.ean = form.ean.value.trim();
  mercurialeState.draft.uniteBase = form.uniteBase.value;
  mercurialeState.draft.nutrition = {
    energie: form.energie.value.trim(),
    matieresGrasses: form.matieresGrasses.value.trim(),
    acidesGrasSatures: form.acidesGrasSatures.value.trim(),
    glucides: form.glucides.value.trim(),
    sucres: form.sucres.value.trim(),
    proteines: form.proteines.value.trim(),
    sel: form.sel.value.trim(),
    fibres: form.fibres.value.trim(),
  };
  mercurialeState.draft.allergenes = qsa('input[name="allergenes"]:checked', form).map(i => i.value);
}

function renderOffresEditor() {
  const container = qs('#offres-editor');
  if (!container) return;
  const offres = mercurialeState.draft?.offres || [];
  if (!offres.length) {
    container.innerHTML = '<div class="notice">Aucune offre. Ajoutez-en une pour calculer les prix automatiquement.</div>';
    return;
  }
  container.innerHTML = offres.map((offre, idx) => `
    <div class="item offre-card" data-offre-card="${idx}">
      <div class="form-grid">
        <div class="field"><label>Fournisseur</label><select data-offre="fournisseurId" data-index="${idx}">${fournisseurOptions(mercurialeState.fournisseurs, offre.fournisseurId)}</select></div>
        <div class="field"><label>Marque</label><input data-offre="marque" data-index="${idx}" value="${esc(offre.marque || '')}" autocomplete="off"></div>
        <div class="field"><label>Référence</label><input data-offre="reference" data-index="${idx}" value="${esc(offre.reference || '')}" autocomplete="off"></div>
        <div class="field"><label>TVA</label><select data-offre="tva" data-index="${idx}">
          <option value="0" ${Number(offre.tva) === 0 ? 'selected' : ''}>0 %</option>
          <option value="2.1" ${Number(offre.tva) === 2.1 ? 'selected' : ''}>2,1 %</option>
          <option value="5.5" ${Number(offre.tva) === 5.5 ? 'selected' : ''}>5,5 %</option>
          <option value="10" ${Number(offre.tva) === 10 ? 'selected' : ''}>10 %</option>
          <option value="20" ${Number(offre.tva) === 20 ? 'selected' : ''}>20 %</option>
        </select></div>
        <div class="field"><label>Quantité colis</label><input type="number" step="0.001" min="0" data-offre="quantiteColis" data-index="${idx}" value="${esc(offre.quantiteColis ?? 1)}" inputmode="decimal"></div>
        <div class="field"><label>Unité colis</label><select data-offre="uniteColis" data-index="${idx}"><option value="kg" ${offre.uniteColis === 'kg' ? 'selected' : ''}>kg</option><option value="piece" ${offre.uniteColis === 'piece' ? 'selected' : ''}>pièce</option><option value="l" ${offre.uniteColis === 'l' ? 'selected' : ''}>litre</option></select></div>
        <div class="field"><label>Prix HT unité</label><input type="number" step="0.0001" min="0" data-price="prixHTUnite" data-index="${idx}" value="${esc(offre.prixHTUnite)}" inputmode="decimal"></div>
        <div class="field"><label>Prix TTC unité</label><input type="number" step="0.0001" min="0" data-price="prixTTCUnite" data-index="${idx}" value="${esc(offre.prixTTCUnite)}" inputmode="decimal"></div>
        <div class="field"><label>Prix HT colis</label><input type="number" step="0.0001" min="0" data-price="prixHTColis" data-index="${idx}" value="${esc(offre.prixHTColis)}" inputmode="decimal"></div>
        <div class="field"><label>Prix TTC colis</label><input type="number" step="0.0001" min="0" data-price="prixTTCColis" data-index="${idx}" value="${esc(offre.prixTTCColis)}" inputmode="decimal"></div>
      </div>
      <div class="toolbar end compact"><button class="btn danger" type="button" data-remove-offre="${idx}">Supprimer l’offre</button></div>
    </div>
  `).join('');
}

function recalcOffre(offre, sourceKey) {
  const qte = Math.max(num(offre.quantiteColis) || 1, 1);
  const taux = 1 + (num(offre.tva) / 100);
  let htUnite = 0;

  if (sourceKey === 'prixHTUnite') htUnite = num(offre.prixHTUnite);
  else if (sourceKey === 'prixTTCUnite') htUnite = num(offre.prixTTCUnite) / taux;
  else if (sourceKey === 'prixHTColis') htUnite = num(offre.prixHTColis) / qte;
  else if (sourceKey === 'prixTTCColis') htUnite = num(offre.prixTTCColis) / taux / qte;
  else if (num(offre.prixHTUnite)) htUnite = num(offre.prixHTUnite);
  else if (num(offre.prixTTCUnite)) htUnite = num(offre.prixTTCUnite) / taux;
  else if (num(offre.prixHTColis)) htUnite = num(offre.prixHTColis) / qte;
  else if (num(offre.prixTTCColis)) htUnite = num(offre.prixTTCColis) / taux / qte;

  const ttcUnite = htUnite * taux;
  const htColis = htUnite * qte;
  const ttcColis = ttcUnite * qte;

  offre.prixHTUnite = htUnite ? round2(htUnite).toString() : '';
  offre.prixTTCUnite = ttcUnite ? round2(ttcUnite).toString() : '';
  offre.prixHTColis = htColis ? round2(htColis).toString() : '';
  offre.prixTTCColis = ttcColis ? round2(ttcColis).toString() : '';
}

function renderCategoriesList() {
  const target = qs('#categories-list');
  if (!target) return;
  const items = mercurialeState.categories;
  if (!items.length) {
    target.innerHTML = '<div class="notice">Aucune catégorie. Les ingrédients iront alors en Sans catégorie.</div>';
    return;
  }
  target.innerHTML = items.map(c => `
    <div class="item category-row">
      <div class="item-top">
        <div class="category-ident">
          <span class="tag category-chip" style="--chip:${esc(c.couleur)}">${esc(c.nom)}</span>
          <span class="muted">${esc(c.couleur)}</span>
        </div>
        <button class="btn danger" type="button" data-delete-category="${esc(c.nom)}">Supprimer</button>
      </div>
    </div>`).join('');

  qsa('[data-delete-category]').forEach(btn => btn.onclick = async () => {
    const name = btn.dataset.deleteCategory;
    mercurialeState.categories = mercurialeState.categories.filter(c => c.nom !== name);
    await saveMercurialeCategories(mercurialeState.categories);
    const ingredients = await AppDB.getAll('ingredients');
    for (const ing of ingredients.filter(i => i.categorie === name)) {
      ing.categorie = '';
      await AppDB.put('ingredients', ing);
    }
    if (mercurialeState.draft?.categorie === name) mercurialeState.draft.categorie = '';
    syncCategorySelect();
    renderCategoriesList();
    renderMercurialeList();
  });
}

function openSheet(id) {
  const sheet = qs(id);
  if (!sheet) return;
  sheet.classList.remove('hidden');
  sheet.setAttribute('aria-hidden', 'false');
  lockBodyScroll();
}

function closeSheet(id) {
  const sheet = qs(id);
  if (!sheet) return;
  sheet.classList.add('hidden');
  sheet.setAttribute('aria-hidden', 'true');
  if (qsa('.sheet:not(.hidden)').length === 0) unlockBodyScroll();
}

function bindSheetScrollGuards(sheetSel, panelSel) {
  const sheet = qs(sheetSel);
  const panel = qs(panelSel);
  if (!sheet || !panel) return;
  sheet.addEventListener('touchmove', (e) => {
    if (!panel.contains(e.target)) e.preventDefault();
  }, { passive: false });
  sheet.addEventListener('wheel', (e) => {
    if (!panel.contains(e.target)) e.preventDefault();
  }, { passive: false });
  let startY = 0;
  panel.addEventListener('touchstart', (e) => {
    startY = e.touches[0]?.clientY || 0;
  }, { passive: true });
  panel.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0]?.clientY || 0;
    const movingDown = currentY > startY;
    const atTop = panel.scrollTop <= 0;
    const atBottom = panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 1;
    if ((atTop && movingDown) || (atBottom && !movingDown)) e.preventDefault();
  }, { passive: false });
}

function renderMercurialeList() {
  const list = qs('#ingredients-list');
  if (!list) return;
  if (!mercurialeState.ingredients.length) {
    list.innerHTML = '<div class="notice">Aucun ingrédient enregistré.</div>';
    return;
  }
  list.innerHTML = mercurialeState.ingredients.map(i => {
    const offre = (i.offres || [])[0];
    const labelPrix = offre?.prixHTUnite ? `${euro(offre.prixHTUnite)} HT / ${esc(offre.uniteColis || i.uniteBase || 'unité')}` : 'Sans prix';
    return `
      <div class="item">
        <div class="item-top">
          <div>
            <strong>${esc(i.nom)}</strong> ${categoryTag(i.categorie)}
            <div class="muted">EAN : ${esc(i.ean || '-')}</div>
            <div class="muted">${(i.offres || []).length} offre(s) · ${labelPrix}</div>
          </div>
          <button class="btn danger" type="button" data-delete-ingredient="${i.id}">Supprimer</button>
        </div>
      </div>`;
  }).join('');

  qsa('[data-delete-ingredient]').forEach(btn => btn.onclick = async () => {
    await AppDB.delete('ingredients', btn.dataset.deleteIngredient);
    mercurialeState.ingredients = await AppDB.getAll('ingredients');
    renderMercurialeList();
    renderDashboard();
  });
}

async function renderMercuriale() {
  const [ingredients, fournisseurs, categories] = await Promise.all([
    AppDB.getAll('ingredients'),
    AppDB.getAll('fournisseurs'),
    getMercurialeCategories()
  ]);
  mercurialeState.ingredients = ingredients;
  mercurialeState.fournisseurs = fournisseurs;
  mercurialeState.categories = categories;
  mercurialeState.draft = mercurialeState.draft || createEmptyIngredientDraft();
  mercurialeState.currentIngredientId = null;

  renderMercurialeList();
  fillIngredientFormFromDraft();
  renderOffresEditor();
  renderCategoriesList();

  qs('#open-ingredient-sheet-btn').onclick = () => {
    fillIngredientFormFromDraft();
    renderOffresEditor();
    openSheet('#ingredient-sheet');
  };
  qs('#close-ingredient-sheet-btn').onclick = () => { collectIngredientFormIntoDraft(); closeSheet('#ingredient-sheet'); };
  qs('#cancel-ingredient-btn').onclick = () => { collectIngredientFormIntoDraft(); closeSheet('#ingredient-sheet'); };
  qs('#sheet-backdrop').onclick = () => { collectIngredientFormIntoDraft(); closeSheet('#ingredient-sheet'); };

  qs('#open-categories-btn').onclick = () => { renderCategoriesList(); openSheet('#categories-sheet'); };
  qs('#close-categories-sheet-btn').onclick = () => closeSheet('#categories-sheet');
  qs('#categories-backdrop').onclick = () => closeSheet('#categories-sheet');

  bindSheetScrollGuards('#ingredient-sheet', '#ingredient-sheet .sheet-panel');
  bindSheetScrollGuards('#categories-sheet', '#categories-sheet .sheet-panel');

  const form = qs('#ingredient-form');
  form.oninput = (e) => {
    if (e.target.name === 'allergenes') return collectIngredientFormIntoDraft();
    if (e.target.name && ['nom', 'ean', 'uniteBase', 'categorie', 'energie', 'matieresGrasses', 'acidesGrasSatures', 'glucides', 'sucres', 'proteines', 'sel', 'fibres'].includes(e.target.name)) {
      collectIngredientFormIntoDraft();
    }
  };
  form.onchange = () => collectIngredientFormIntoDraft();

  qs('#add-offre-btn').onclick = () => {
    mercurialeState.draft.offres.push(createOffreDraft());
    renderOffresEditor();
  };

  const offreWrap = qs('#offres-editor');
  offreWrap.addEventListener('input', (e) => {
    const idx = Number(e.target.dataset.index);
    if (Number.isNaN(idx) || !mercurialeState.draft.offres[idx]) return;
    const key = e.target.dataset.offre || e.target.dataset.price;
    if (!key) return;
    mercurialeState.draft.offres[idx][key] = e.target.value;
  });
  const recalcHandler = (e) => {
    const idx = Number(e.target.dataset.index);
    if (Number.isNaN(idx) || !mercurialeState.draft.offres[idx]) return;
    const offre = mercurialeState.draft.offres[idx];
    const dataKey = e.target.dataset.offre || e.target.dataset.price;
    if (!dataKey) return;
    offre[dataKey] = e.target.value;
    if (['prixHTUnite', 'prixTTCUnite', 'prixHTColis', 'prixTTCColis', 'quantiteColis', 'tva'].includes(dataKey)) {
      recalcOffre(offre, ['quantiteColis', 'tva'].includes(dataKey) ? null : dataKey);
      renderOffresEditor();
    }
  };
  offreWrap.addEventListener('change', recalcHandler);
  offreWrap.addEventListener('blur', recalcHandler, true);
  offreWrap.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-offre]');
    if (!btn) return;
    mercurialeState.draft.offres.splice(Number(btn.dataset.removeOffre), 1);
    renderOffresEditor();
  });

  qs('#category-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const nom = (data.nom || '').trim();
    if (!nom) return;
    const existing = mercurialeState.categories.find(c => c.nom.toLowerCase() === nom.toLowerCase());
    if (existing) {
      existing.couleur = data.couleur || existing.couleur;
      existing.nom = nom;
    } else {
      mercurialeState.categories.push({ nom, couleur: data.couleur || '#8b5e34' });
    }
    mercurialeState.categories.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    await saveMercurialeCategories(mercurialeState.categories);
    e.target.reset();
    e.target.couleur.value = '#8b5e34';
    syncCategorySelect();
    renderCategoriesList();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    collectIngredientFormIntoDraft();
    const payload = structuredClone(mercurialeState.draft);
    payload.id = mercurialeState.currentIngredientId || undefined;
    payload.offres = (payload.offres || []).map(o => ({
      ...o,
      quantiteColis: num(o.quantiteColis) || 1,
      tva: num(o.tva),
      prixHTUnite: o.prixHTUnite,
      prixTTCUnite: o.prixTTCUnite,
      prixHTColis: o.prixHTColis,
      prixTTCColis: o.prixTTCColis,
    }));
    await AppDB.put('ingredients', payload);
    mercurialeState.draft = createEmptyIngredientDraft();
    mercurialeState.currentIngredientId = null;
    form.reset();
    syncCategorySelect();
    renderOffresEditor();
    closeSheet('#ingredient-sheet');
    mercurialeState.ingredients = await AppDB.getAll('ingredients');
    renderMercurialeList();
    renderDashboard();
  };
}

async function renderRecettes() {
  const [recettes, ingredients] = await Promise.all([AppDB.getAll('recettes'), AppDB.getAll('ingredients')]);
  const list = qs('#recettes-list');
  list.innerHTML = recettes.length ? recettes.map(r => `<div class="item"><div class="item-top"><div><strong>${esc(r.nom)}</strong><div class="muted">${(r.lignes || []).length} ingrédient(s)</div></div><button class="btn danger" type="button" data-delete-recette="${r.id}">Supprimer</button></div></div>`).join('') : '<div class="notice">Aucune recette enregistrée.</div>';
  qsa('[data-delete-recette]').forEach(btn => btn.onclick = async () => { await AppDB.delete('recettes', btn.dataset.deleteRecette); renderRecettes(); renderDashboard(); });

  const lineWrap = qs('#recette-lignes');
  const lignes = [];
  function draw() {
    lineWrap.innerHTML = lignes.map((l, idx) => `<div class="item"><div class="form-grid"><div class="field"><label>Ingrédient</label><select data-ligne="ingredientId" data-index="${idx}"><option value="">Sélectionner</option>${ingredients.map(i => `<option value="${i.id}" ${l.ingredientId === i.id ? 'selected' : ''}>${esc(i.nom)}</option>`).join('')}</select></div><div class="field"><label>Quantité</label><input type="number" step="0.001" data-ligne="quantite" data-index="${idx}" value="${num(l.quantite)}" /></div></div><div class="toolbar" style="margin-top:10px"><button class="btn danger" type="button" data-remove-ligne="${idx}">Supprimer la ligne</button></div></div>`).join('');
      qsa('[data-remove-ligne]', lineWrap).forEach(btn => btn.onclick = () => { lignes.splice(Number(btn.dataset.removeLigne), 1); draw(); });
  }
  qs('#add-ligne-btn').onclick = () => { lignes.push({ ingredientId: '', quantite: 0 }); draw(); };
  lineWrap.addEventListener('input', e => { const i = Number(e.target.dataset.index); const k = e.target.dataset.ligne; if (lignes[i]) lignes[i][k] = k === 'quantite' ? num(e.target.value) : e.target.value; });
  lineWrap.addEventListener('change', e => { const i = Number(e.target.dataset.index); const k = e.target.dataset.ligne; if (lignes[i]) lignes[i][k] = k === 'quantite' ? num(e.target.value) : e.target.value; });

  qs('#recette-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    await AppDB.put('recettes', { nom: data.nom, rendement: data.rendement, lignes });
    e.target.reset(); lignes.splice(0, lignes.length); draw(); renderRecettes(); renderDashboard();
  };
  draw();
}

async function renderSimulation() {
  const recettes = await AppDB.getAll('recettes');
  const select = qs('#simulation-recette');
  select.innerHTML = '<option value="">Sélectionner</option>' + recettes.map(r => `<option value="${r.id}">${esc(r.nom)}</option>`).join('');
  qs('#simulation-form').onsubmit = async (e) => {
    e.preventDefault();
    const recette = recettes.find(r => r.id === select.value);
    if (!recette) { qs('#simulation-resultat').innerHTML = '<div class="notice">Choisissez une recette.</div>'; return; }
    const ingredients = await AppDB.getAll('ingredients');
    const total = (recette.lignes || []).reduce((sum, l) => {
      const ing = ingredients.find(i => i.id === l.ingredientId);
      const offre = ing && (ing.offres || [])[0];
      if (!offre || !offre.quantiteColis || !offre.prixHTColis) return sum;
      return sum + (num(offre.prixHTColis) / num(offre.quantiteColis)) * num(l.quantite);
    }, 0);
    const qte = num(qs('#simulation-quantite').value || 1);
    qs('#simulation-resultat').innerHTML = `<div class="metric"><div class="label">Coût matière estimé</div><div class="value">${euro(total * qte)}</div></div>`;
  };
}

async function renderParametres() {
  qs('#export-btn').onclick = async () => {
    const payload = await AppDB.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `copilot-boulangerie-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  qs('#import-file').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const text = await file.text();
    await AppDB.importAll(JSON.parse(text));
    alert('Import terminé.');
    loadRoute('dashboard');
  };
  qs('#reset-btn').onclick = async () => {
    if (!confirm('Tout effacer ?')) return;
    for (const s of AppDB.stores) await AppDB.clear(s);
    alert('Base locale réinitialisée.');
    loadRoute('dashboard');
  };
}

function initCurrentPage() {
  if (state.route === 'dashboard') return renderDashboard();
  if (state.route === 'mercuriale') return renderMercuriale();
  if (state.route === 'recettes') return renderRecettes();
  if (state.route === 'fournisseurs') {
    qs('#fournisseur-form').onsubmit = async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      await AppDB.put('fournisseurs', data);
      e.target.reset(); renderFournisseurs(); renderDashboard();
    };
    return renderFournisseurs();
  }
  if (state.route === 'simulation') return renderSimulation();
  if (state.route === 'parametres') return renderParametres();
}

function initShell() {
  qs('#footerVersion').textContent = APP_VERSION;
  qsa('.nav-link').forEach(btn => btn.onclick = () => loadRoute(btn.dataset.route));
  qs('#menuToggle').onclick = openSidebar;
  qs('#overlay').onclick = closeSidebar;
  const initial = (location.hash || '#dashboard').replace('#', '');
  loadRoute(initial);
}

document.addEventListener('DOMContentLoaded', initShell);
