const APP_VERSION = 'v2.0.2';
let mercurialeDraft = null;
const ROUTES = {
  dashboard: { title: 'Dashboard', file: 'pages/dashboard.html' },
  mercuriale: { title: 'Mercuriale', file: 'pages/mercuriale.html' },
  recettes: { title: 'Recettes', file: 'pages/recettes.html' },
  fournisseurs: { title: 'Fournisseurs', file: 'pages/fournisseurs.html' },
  simulation: { title: 'Simulation', file: 'pages/simulation.html' },
  parametres: { title: 'Paramètres', file: 'pages/parametres.html' },
};

const state = { route: 'dashboard' };
const TVA_OPTIONS = [0, 2.1, 5.5, 10, 20];
const DEFAULT_MERCURIALE_CATEGORIES = [
  { id: 'cat_farines', nom: 'Farines', couleur: '#d7b98c' },
  { id: 'cat_beurres', nom: 'Matières grasses', couleur: '#f0d86f' },
  { id: 'cat_cremerie', nom: 'Crèmerie', couleur: '#b7d8f7' },
  { id: 'cat_sucres', nom: 'Sucres', couleur: '#efc2d2' },
  { id: 'cat_levains', nom: 'Levains & levures', couleur: '#c2ddb4' },
  { id: 'cat_emballages', nom: 'Emballages', couleur: '#d4c4ff' },
];

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function euro(v) { return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v || 0)); }
function num(v) { return Number(v || 0); }
function round(v, digits = 4) { const f = 10 ** digits; return Math.round((Number(v || 0) + Number.EPSILON) * f) / f; }
function esc(s = '') { return String(s).replace(/[&<>\"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }
function slugify(s = '') { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function parseFormEntries(form) { return Object.fromEntries(new FormData(form).entries()); }

async function loadRoute(route) {
  state.route = ROUTES[route] ? route : 'dashboard';
  const cfg = ROUTES[state.route];
  const html = await fetch(cfg.file + '?v=' + encodeURIComponent(APP_VERSION)).then((r) => r.text());
  qs('#app-content').innerHTML = html;
  qs('#pageTitle').textContent = cfg.title;
  qsa('.nav-link').forEach((btn) => btn.classList.toggle('active', btn.dataset.route === state.route));
  initCurrentPage();
  closeSidebar();
  history.replaceState({}, '', '#' + state.route);
}

function openSidebar() { qs('#sidebar').classList.add('open'); qs('#overlay').classList.remove('hidden'); }
function closeSidebar() { qs('#sidebar').classList.remove('open'); qs('#overlay').classList.add('hidden'); }

function openSheet(id) {
  const sheet = qs(`#${id}`);
  if (!sheet) return;
  sheet.classList.remove('hidden');
  sheet.setAttribute('aria-hidden', 'false');
  document.body.classList.add('sheet-open');
}

function closeSheet(id) {
  const sheet = qs(`#${id}`);
  if (!sheet) return;
  sheet.classList.add('hidden');
  sheet.setAttribute('aria-hidden', 'true');
  if (!qsa('.bottom-sheet:not(.hidden)').length) document.body.classList.remove('sheet-open');
}

function bindSheetButtons(root = document) {
  qsa('[data-close-sheet]', root).forEach((btn) => {
    btn.onclick = () => closeSheet(btn.dataset.closeSheet);
  });
}

async function getMercurialeCategories() {
  const saved = await AppDB.get('parametres', 'mercuriale-categories');
  const categories = saved?.items?.length ? saved.items : DEFAULT_MERCURIALE_CATEGORIES;
  if (!saved) {
    await AppDB.put('parametres', { id: 'mercuriale-categories', items: categories });
  }
  return categories;
}

async function saveMercurialeCategories(items) {
  await AppDB.put('parametres', { id: 'mercuriale-categories', items });
}

function getCategory(categoryName, categories) {
  return categories.find((c) => c.nom === categoryName) || null;
}

function categoryChip(categoryName, categories) {
  const cat = getCategory(categoryName, categories);
  if (!cat) return `<span class="tag">${esc(categoryName || 'Sans catégorie')}</span>`;
  return `<span class="tag color-tag" style="--tag-color:${esc(cat.couleur)}">${esc(cat.nom)}</span>`;
}

function tvaOptions(selected = 5.5) {
  return TVA_OPTIONS.map((value) => `<option value="${value}" ${Number(selected) === value ? 'selected' : ''}>${String(value).replace('.', ',')}%</option>`).join('');
}

function fournisseurOptions(list, selected = '') {
  return ['<option value="">Sélectionner</option>']
    .concat(list.map((f) => `<option value="${f.id}" ${f.id === selected ? 'selected' : ''}>${esc(f.nom)}</option>`))
    .join('');
}

function createEmptyOffre() {
  return {
    fournisseurId: '',
    marque: '',
    reference: '',
    quantite: 1,
    unite: 'kg',
    tva: 5.5,
    prixUniteHT: 0,
    prixUniteTTC: 0,
    prixColisHT: 0,
    prixColisTTC: 0,
  };
}

function createEmptyNutrition() {
  return {
    energie: '',
    matieresGrasses: '',
    acidesGrasSatures: '',
    glucides: '',
    sucres: '',
    fibres: '',
    proteines: '',
    sel: '',
  };
}

function createEmptyIngredientDraft() {
  return {
    nom: '',
    ean: '',
    categorie: '',
    uniteBase: 'kg',
    notes: '',
    nutrition: createEmptyNutrition(),
    allergenes: [],
    offres: [createEmptyOffre()],
  };
}

function normalizeOffre(offre = {}) {
  return {
    fournisseurId: offre.fournisseurId || '',
    marque: offre.marque || '',
    reference: offre.reference || '',
    quantite: offre.quantite ?? 1,
    unite: offre.unite || 'kg',
    tva: offre.tva ?? 5.5,
    prixUniteHT: offre.prixUniteHT ?? 0,
    prixUniteTTC: offre.prixUniteTTC ?? 0,
    prixColisHT: offre.prixColisHT ?? 0,
    prixColisTTC: offre.prixColisTTC ?? 0,
  };
}

function cloneMercurialeDraft(draft = createEmptyIngredientDraft()) {
  return {
    nom: draft.nom || '',
    ean: draft.ean || '',
    categorie: draft.categorie || '',
    uniteBase: draft.uniteBase || 'kg',
    notes: draft.notes || '',
    nutrition: { ...createEmptyNutrition(), ...(draft.nutrition || {}) },
    allergenes: [...(draft.allergenes || [])],
    offres: ((draft.offres || []).length ? draft.offres : [createEmptyOffre()]).map((o) => normalizeOffre(o)),
  };
}

function recalculateOffre(offre, changedKey) {
  const qty = Math.max(num(offre.quantite) || 1, 0.0001);
  const tvaRate = num(offre.tva) / 100;
  const divider = 1 + tvaRate;

  if (changedKey === 'prixUniteHT') {
    offre.prixColisHT = round(num(offre.prixUniteHT) * qty);
    offre.prixUniteTTC = round(num(offre.prixUniteHT) * divider);
    offre.prixColisTTC = round(num(offre.prixColisHT) * divider);
  } else if (changedKey === 'prixUniteTTC') {
    offre.prixUniteHT = round(num(offre.prixUniteTTC) / divider);
    offre.prixColisHT = round(num(offre.prixUniteHT) * qty);
    offre.prixColisTTC = round(num(offre.prixUniteTTC) * qty);
  } else if (changedKey === 'prixColisHT') {
    offre.prixUniteHT = round(num(offre.prixColisHT) / qty);
    offre.prixUniteTTC = round(num(offre.prixUniteHT) * divider);
    offre.prixColisTTC = round(num(offre.prixColisHT) * divider);
  } else if (changedKey === 'prixColisTTC') {
    offre.prixColisHT = round(num(offre.prixColisTTC) / divider);
    offre.prixUniteHT = round(num(offre.prixColisHT) / qty);
    offre.prixUniteTTC = round(num(offre.prixColisTTC) / qty);
  } else {
    recalculateOffre(offre, 'prixColisHT');
  }
}

function renderOffresEditor(container, offres, fournisseurs) {
  container.innerHTML = '';
  if (!offres.length) {
    container.innerHTML = '<div class="notice">Ajoute au moins une offre fournisseur pour calculer les coûts automatiquement.</div>';
    return;
  }

  offres.forEach((offre, idx) => {
    const block = document.createElement('div');
    block.className = 'item offre-card';
    block.innerHTML = `
      <div class="item-top item-top-stack">
        <div>
          <strong>Offre ${idx + 1}</strong>
          <div class="muted">Prix saisis ou recalculés automatiquement selon la quantité et la TVA.</div>
        </div>
        <button class="btn danger" type="button" data-remove-offre="${idx}">Supprimer l'offre</button>
      </div>
      <div class="form-grid compact-two">
        <div class="field"><label>Fournisseur</label><select data-offre="fournisseurId" data-index="${idx}">${fournisseurOptions(fournisseurs, offre.fournisseurId)}</select></div>
        <div class="field"><label>Marque</label><input data-offre="marque" data-index="${idx}" value="${esc(offre.marque || '')}"></div>
        <div class="field"><label>Référence</label><input data-offre="reference" data-index="${idx}" value="${esc(offre.reference || '')}"></div>
        <div class="field"><label>Quantité colis</label><input type="number" min="0.001" step="0.001" data-offre="quantite" data-index="${idx}" value="${offre.quantite ?? 1}"></div>
        <div class="field"><label>Unité colis</label><select data-offre="unite" data-index="${idx}"><option value="kg" ${offre.unite === 'kg' ? 'selected' : ''}>kg</option><option value="piece" ${offre.unite === 'piece' ? 'selected' : ''}>pièce</option><option value="l" ${offre.unite === 'l' ? 'selected' : ''}>litre</option></select></div>
        <div class="field"><label>TVA</label><select data-offre="tva" data-index="${idx}">${tvaOptions(offre.tva)}</select></div>
      </div>
      <div class="form-grid compact-two offer-pricing-grid">
        <div class="field"><label>Prix HT unité</label><input type="number" min="0" step="0.0001" inputmode="decimal" data-offre="prixUniteHT" data-index="${idx}" value="${offre.prixUniteHT ?? 0}"></div>
        <div class="field"><label>Prix TTC unité</label><input type="number" min="0" step="0.0001" inputmode="decimal" data-offre="prixUniteTTC" data-index="${idx}" value="${offre.prixUniteTTC ?? 0}"></div>
        <div class="field"><label>Prix HT colis</label><input type="number" min="0" step="0.0001" inputmode="decimal" data-offre="prixColisHT" data-index="${idx}" value="${offre.prixColisHT ?? 0}"></div>
        <div class="field"><label>Prix TTC colis</label><input type="number" min="0" step="0.0001" inputmode="decimal" data-offre="prixColisTTC" data-index="${idx}" value="${offre.prixColisTTC ?? 0}"></div>
      </div>`;
    container.appendChild(block);
  });

  qsa('[data-remove-offre]', container).forEach((btn) => {
    btn.onclick = () => {
      offres.splice(Number(btn.dataset.removeOffre), 1);
      if (!offres.length) offres.push(createEmptyOffre());
      renderOffresEditor(container, offres, fournisseurs);
    };
  });
}

function updateCategorySelect(select, categories) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Sans catégorie</option>' + categories.map((c) => `<option value="${esc(c.nom)}">${esc(c.nom)}</option>`).join('');
  if (categories.some((c) => c.nom === current)) select.value = current;
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
  target.innerHTML = list.map((f) => `<div class="item"><div class="item-top"><div><strong>${esc(f.nom)}</strong><div class="muted">${esc(f.contact || '')}</div><div class="muted">${esc(f.telephone || '')}</div></div><button class="btn danger" type="button" data-delete-fournisseur="${f.id}">Supprimer</button></div></div>`).join('');
  qsa('[data-delete-fournisseur]').forEach((btn) => btn.onclick = async () => { await AppDB.delete('fournisseurs', btn.dataset.deleteFournisseur); renderFournisseurs(); });
}


function populateIngredientForm(form, draft = createEmptyIngredientDraft()) {
  form.nom.value = draft.nom || '';
  form.ean.value = draft.ean || '';
  form.categorie.value = draft.categorie || '';
  form.uniteBase.value = draft.uniteBase || 'kg';
  form.notes.value = draft.notes || '';
  const nutrition = { ...createEmptyNutrition(), ...(draft.nutrition || {}) };
  Object.entries(nutrition).forEach(([key, value]) => {
    if (form[key]) form[key].value = value ?? '';
  });
  qsa('input[name="allergenes"]', form).forEach((input) => {
    input.checked = (draft.allergenes || []).includes(input.value);
  });
}

function captureIngredientDraft(form, offres) {
  const data = parseFormEntries(form);
  return {
    nom: data.nom || '',
    ean: data.ean || '',
    categorie: data.categorie || '',
    uniteBase: data.uniteBase || 'kg',
    notes: data.notes || '',
    nutrition: {
      energie: data.energie || '',
      matieresGrasses: data.matieresGrasses || '',
      acidesGrasSatures: data.acidesGrasSatures || '',
      glucides: data.glucides || '',
      sucres: data.sucres || '',
      fibres: data.fibres || '',
      proteines: data.proteines || '',
      sel: data.sel || '',
    },
    allergenes: new FormData(form).getAll('allergenes'),
    offres: offres.map((offre) => ({ ...offre })),
  };
}

async function clearCategoryFromIngredients(categoryName) {
  const ingredients = await AppDB.getAll('ingredients');
  const impacted = ingredients.filter((item) => item.categorie === categoryName);
  await Promise.all(impacted.map((item) => AppDB.put('ingredients', { ...item, categorie: '' })));
}

async function renderMercuriale() {
  const [ingredients, fournisseurs, categories] = await Promise.all([
    AppDB.getAll('ingredients'),
    AppDB.getAll('fournisseurs'),
    getMercurialeCategories(),
  ]);

  bindSheetButtons(qs('.mercuriale-page')?.parentElement || document);

  const list = qs('#ingredients-list');
  if (!ingredients.length) {
    list.innerHTML = '<div class="notice">Aucun produit enregistré.</div>';
  } else {
    list.innerHTML = ingredients.map((i) => {
      const offre = (i.offres || [])[0];
      const unitLabel = offre?.unite || i.uniteBase || 'unité';
      const unitCost = num(offre?.prixUniteHT);
      return `
        <div class="item">
          <div class="item-top item-top-stack">
            <div>
              <div class="item-title-row"><strong>${esc(i.nom)}</strong> ${categoryChip(i.categorie || 'Sans catégorie', categories)}</div>
              <div class="muted">EAN : ${esc(i.ean || '-')}</div>
              <div class="muted">${(i.offres || []).length} offre(s) · ${unitCost ? `${euro(unitCost)} HT / ${esc(unitLabel)}` : 'Sans prix renseigné'}</div>
            </div>
            <button class="btn danger" type="button" data-delete-ingredient="${i.id}">Supprimer</button>
          </div>
        </div>`;
    }).join('');
  }

  qsa('[data-delete-ingredient]').forEach((btn) => {
    btn.onclick = async () => {
      await AppDB.delete('ingredients', btn.dataset.deleteIngredient);
      renderMercuriale();
      renderDashboard();
    };
  });

  const ingredientForm = qs('#ingredient-form');
  const offreWrap = qs('#offres-editor');
  const categorySelect = qs('#ingredient-categorie-select');
  const ingredientSheetTitle = qs('#ingredient-sheet-title');
  const offres = cloneMercurialeDraft(mercurialeDraft || createEmptyIngredientDraft()).offres;
  updateCategorySelect(categorySelect, categories);
  populateIngredientForm(ingredientForm, cloneMercurialeDraft(mercurialeDraft || createEmptyIngredientDraft()));
  renderOffresEditor(offreWrap, offres, fournisseurs);

  const syncDraft = () => {
    mercurialeDraft = captureIngredientDraft(ingredientForm, offres);
  };

  const resetIngredientDraft = () => {
    mercurialeDraft = createEmptyIngredientDraft();
    updateCategorySelect(categorySelect, categories);
    populateIngredientForm(ingredientForm, mercurialeDraft);
    offres.splice(0, offres.length, ...mercurialeDraft.offres.map((offre) => normalizeOffre(offre)));
    renderOffresEditor(offreWrap, offres, fournisseurs);
  };

  if (!mercurialeDraft) {
    mercurialeDraft = createEmptyIngredientDraft();
  }

  qs('#open-ingredient-sheet').onclick = () => {
    ingredientSheetTitle.textContent = 'Ajouter un ingrédient';
    updateCategorySelect(categorySelect, categories);
    populateIngredientForm(ingredientForm, mercurialeDraft);
    offres.splice(0, offres.length, ...cloneMercurialeDraft(mercurialeDraft || createEmptyIngredientDraft()).offres);
    renderOffresEditor(offreWrap, offres, fournisseurs);
    openSheet('ingredient-sheet');
  };
  qs('#open-mercuriale-settings').onclick = () => openSheet('mercuriale-settings-sheet');

  qs('#add-offre-btn').onclick = () => {
    offres.push(createEmptyOffre());
    renderOffresEditor(offreWrap, offres, fournisseurs);
    syncDraft();
  };

  ingredientForm.oninput = (e) => {
    if (e.target.name === 'allergenes') {
      syncDraft();
      return;
    }
    if (!e.target.dataset.offre) syncDraft();
  };
  ingredientForm.onchange = () => syncDraft();

  offreWrap.oninput = (e) => {
    const key = e.target.dataset.offre;
    const idx = Number(e.target.dataset.index);
    if (!key || Number.isNaN(idx) || !offres[idx]) return;
    offres[idx][key] = e.target.value;
    if (!['quantite', 'tva', 'prixUniteHT', 'prixUniteTTC', 'prixColisHT', 'prixColisTTC'].includes(key)) {
      syncDraft();
    }
  };

  offreWrap.onchange = (e) => {
    const key = e.target.dataset.offre;
    const idx = Number(e.target.dataset.index);
    if (!key || Number.isNaN(idx) || !offres[idx]) return;
    const numericFields = ['quantite', 'tva', 'prixUniteHT', 'prixUniteTTC', 'prixColisHT', 'prixColisTTC'];
    offres[idx][key] = numericFields.includes(key) ? num(e.target.value) : e.target.value;
    if (numericFields.includes(key)) {
      const recalcKey = key === 'quantite' || key === 'tva' ? 'prixColisHT' : key;
      recalculateOffre(offres[idx], recalcKey);
      renderOffresEditor(offreWrap, offres, fournisseurs);
    }
    syncDraft();
  };

  ingredientForm.onsubmit = async (e) => {
    e.preventDefault();
    const draft = captureIngredientDraft(ingredientForm, offres);
    await AppDB.put('ingredients', {
      nom: draft.nom,
      categorie: draft.categorie,
      ean: draft.ean,
      uniteBase: draft.uniteBase,
      notes: draft.notes,
      nutrition: draft.nutrition,
      allergenes: draft.allergenes,
      offres: draft.offres.map((offre) => ({
        ...offre,
        quantite: num(offre.quantite),
        tva: num(offre.tva),
        prixUniteHT: num(offre.prixUniteHT),
        prixUniteTTC: num(offre.prixUniteTTC),
        prixColisHT: num(offre.prixColisHT),
        prixColisTTC: num(offre.prixColisTTC),
      })),
    });
    resetIngredientDraft();
    closeSheet('ingredient-sheet');
    renderMercuriale();
    renderDashboard();
  };

  const categorieForm = qs('#categorie-form');
  const categoriesList = qs('#categories-list');

  const drawCategories = async () => {
    const current = await getMercurialeCategories();
    categoriesList.innerHTML = current.map((cat) => `
      <div class="item category-item">
        <div class="item-top">
          <div class="item-title-row">
            <span class="tag color-tag" style="--tag-color:${esc(cat.couleur)}">${esc(cat.nom)}</span>
            <span class="muted">${esc(cat.couleur)}</span>
          </div>
          <button class="btn danger" type="button" data-delete-category="${cat.id}">Supprimer</button>
        </div>
      </div>`).join('') || '<div class="notice">Aucune catégorie.</div>';

    qsa('[data-delete-category]', categoriesList).forEach((btn) => {
      btn.onclick = async () => {
        const deleted = current.find((cat) => cat.id === btn.dataset.deleteCategory);
        const remaining = current.filter((cat) => cat.id !== btn.dataset.deleteCategory);
        await saveMercurialeCategories(remaining);
        if (deleted) await clearCategoryFromIngredients(deleted.nom);
        if (mercurialeDraft?.categorie === deleted?.nom) mercurialeDraft.categorie = '';
        updateCategorySelect(categorySelect, remaining);
        if (categorySelect.value === deleted?.nom) categorySelect.value = '';
        drawCategories();
        renderMercuriale();
      };
    });
  };

  categorieForm.onsubmit = async (e) => {
    e.preventDefault();
    const data = parseFormEntries(categorieForm);
    const current = await getMercurialeCategories();
    if (current.some((cat) => slugify(cat.nom) === slugify(data.nom))) {
      alert('Cette catégorie existe déjà.');
      return;
    }
    const next = [...current, { id: `cat_${slugify(data.nom) || Date.now()}`, nom: data.nom.trim(), couleur: data.couleur }];
    await saveMercurialeCategories(next);
    categorieForm.reset();
    qs('[name="couleur"]', categorieForm).value = '#8b5e34';
    updateCategorySelect(categorySelect, next);
    drawCategories();
  };

  drawCategories();
}

async function renderRecettes() {
  const [ingredients, recettes] = await Promise.all([AppDB.getAll('ingredients'), AppDB.getAll('recettes')]);
  const select = qs('#recette-ingredient-select');
  select.innerHTML = '<option value="">Sélectionner</option>' + ingredients.map((i) => `<option value="${i.id}">${esc(i.nom)}</option>`).join('');
  const lignes = [];
  const wrap = qs('#recette-lignes');
  function draw() {
    wrap.innerHTML = lignes.map((l, idx) => {
      const ing = ingredients.find((i) => i.id === l.ingredientId);
      return `<div class="item"><div class="item-top"><div><strong>${esc(ing?.nom || 'Ingrédient')}</strong><div class="muted">${num(l.quantite)} ${esc(ing?.uniteBase || '')}</div></div><button type="button" class="btn danger" data-remove-ligne="${idx}">Supprimer</button></div></div>`;
    }).join('') || '<div class="notice">Aucune ligne pour le moment.</div>';
    qsa('[data-remove-ligne]').forEach((btn) => btn.onclick = () => { lignes.splice(Number(btn.dataset.removeLigne), 1); draw(); });
  }
  qs('#add-ligne-recette').onclick = () => {
    if (!select.value) return;
    lignes.push({ ingredientId: select.value, quantite: num(qs('#recette-ingredient-quantite').value || 0) });
    draw();
  };
  qs('#recette-form').onsubmit = async (e) => {
    e.preventDefault();
    const data = parseFormEntries(e.target);
    await AppDB.put('recettes', { nom: data.nom, rendement: data.rendement, uniteRendement: data.uniteRendement, lignes: [...lignes] });
    e.target.reset(); lignes.splice(0, lignes.length); draw(); renderRecettes(); renderDashboard();
  };
  const list = qs('#recettes-list');
  if (!recettes.length) list.innerHTML = '<div class="notice">Aucune recette.</div>';
  else list.innerHTML = recettes.map((r) => `<div class="item"><div class="item-top"><div><strong>${esc(r.nom)}</strong><div class="muted">${(r.lignes || []).length} ingrédient(s)</div></div><button class="btn danger" type="button" data-delete-recette="${r.id}">Supprimer</button></div></div>`).join('');
  qsa('[data-delete-recette]').forEach((btn) => btn.onclick = async () => { await AppDB.delete('recettes', btn.dataset.deleteRecette); renderRecettes(); renderDashboard(); });
  draw();
}

async function renderSimulation() {
  const recettes = await AppDB.getAll('recettes');
  const select = qs('#simulation-recette');
  select.innerHTML = '<option value="">Sélectionner</option>' + recettes.map((r) => `<option value="${r.id}">${esc(r.nom)}</option>`).join('');
  qs('#simulation-form').onsubmit = async (e) => {
    e.preventDefault();
    const recette = recettes.find((r) => r.id === select.value);
    if (!recette) { qs('#simulation-resultat').innerHTML = '<div class="notice">Choisissez une recette.</div>'; return; }
    const ingredients = await AppDB.getAll('ingredients');
    const total = (recette.lignes || []).reduce((sum, l) => {
      const ing = ingredients.find((i) => i.id === l.ingredientId);
      const offre = ing && (ing.offres || [])[0];
      if (!offre || !offre.quantite) return sum;
      return sum + num(offre.prixUniteHT) * num(l.quantite);
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
      const data = parseFormEntries(e.target);
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
  qsa('.nav-link').forEach((btn) => btn.onclick = () => loadRoute(btn.dataset.route));
  qs('#menuToggle').onclick = openSidebar;
  qs('#overlay').onclick = closeSidebar;
  const initial = (location.hash || '#dashboard').replace('#', '');
  loadRoute(initial);
}

document.addEventListener('DOMContentLoaded', initShell);
