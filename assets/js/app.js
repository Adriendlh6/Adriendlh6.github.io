const APP_VERSION = 'v2.0.5';
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

  function renderAllergenes(selected=[]){
    const grid = qs('#allergenes-grid');
    grid.innerHTML = MERCURIALE_ALLERGENES.map(name => {
      const slug = slugify(name);
      return `<label class="allergene-item"><input type="checkbox" name="allergenes" value="${esc(slug)}" ${selected.includes(slug)?'checked':''}><span>${esc(name)}</span></label>`;
    }).join('');
  }

  function renderIngredients(){
    if (!ingredients.length){
      emptyState.classList.remove('hidden');
      ingredientsList.innerHTML = '';
      return;
    }
    emptyState.classList.add('hidden');
    ingredientsList.innerHTML = ingredients.map(ingredient => {
      const cat = getCategoryById(categories, ingredient.categorieId);
      const firstOffre = (ingredient.offres || [])[0];
      const supplier = firstOffre ? fournisseurs.find(f => f.id === firstOffre.fournisseurId) : null;
      const sub = firstOffre ? `${esc(firstOffre.marque || supplier?.nom || 'Sans fournisseur')} · ${firstOffre.prixHTUnite ? euro(firstOffre.prixHTUnite) + ' HT / ' + esc(firstOffre.uniteColis || ingredient.uniteBase || 'unité') : 'Sans prix'}` : 'Aucune offre fournisseur';
      return `
        <article class="item product-card" data-product-id="${ingredient.id}" tabindex="0">
          <div class="item-top">
            <div>
              <strong>${esc(ingredient.nom)}</strong>
              <div class="toolbar chip-row">${categoryChip(cat)}</div>
              <div class="muted">EAN : ${esc(ingredient.ean || '-')}</div>
              <div class="muted">${sub}</div>
            </div>
            <button class="btn danger" type="button" data-delete-ingredient="${ingredient.id}">Supprimer</button>
          </div>
        </article>`;
    }).join('');

    qsa('[data-delete-ingredient]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        await AppDB.delete('ingredients', btn.dataset.deleteIngredient);
        const idx = ingredients.findIndex(item => item.id === btn.dataset.deleteIngredient);
        if (idx >= 0) ingredients.splice(idx, 1);
        renderIngredients();
        renderDashboard();
      };
    });

    qsa('.product-card').forEach(card => {
      card.onclick = () => showIngredientDetail(card.dataset.productId);
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showIngredientDetail(card.dataset.productId);
        }
      };
    });
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
    renderOffres();
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
    renderOffres();
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
    detailContent.innerHTML = `
      <section class="card compact-card">
        <div class="toolbar chip-row">${categoryChip(category)}</div>
        <div class="detail-grid">
          <div><strong>EAN</strong><div class="muted">${esc(ingredient.ean || '-')}</div></div>
          <div><strong>Unité de base</strong><div class="muted">${esc(ingredient.uniteBase || '-')}</div></div>
        </div>
      </section>
      <section class="card compact-card">
        <h4>Offres fournisseurs</h4>
        <div class="list">${(ingredient.offres || []).length ? ingredient.offres.map(offre => {
          const supplier = fournisseurs.find(f => f.id === offre.fournisseurId);
          return `<div class="item compact-item"><strong>${esc(supplier?.nom || 'Sans fournisseur')}</strong><div class="muted">${esc(offre.marque || '-')} · ${esc(offre.reference || '-')}</div><div class="muted">${euro(offre.prixHTUnite || 0)} HT / ${esc(offre.uniteColis || ingredient.uniteBase || 'unité')}</div></div>`;
        }).join('') : '<div class="notice">Aucune offre enregistrée.</div>'}</div>
      </section>
      <section class="card compact-card">
        <h4>Nutrition</h4>
        <div class="detail-grid">
          <div><strong>Énergie</strong><div class="muted">${esc(nutrition.energie || '-')}</div></div>
          <div><strong>Matières grasses</strong><div class="muted">${esc(nutrition.matieresGrasses || '-')}</div></div>
          <div><strong>Acides gras saturés</strong><div class="muted">${esc(nutrition.acidesGrasSatures || '-')}</div></div>
          <div><strong>Glucides</strong><div class="muted">${esc(nutrition.glucides || '-')}</div></div>
          <div><strong>Sucres</strong><div class="muted">${esc(nutrition.sucres || '-')}</div></div>
          <div><strong>Protéines</strong><div class="muted">${esc(nutrition.proteines || '-')}</div></div>
          <div><strong>Sel</strong><div class="muted">${esc(nutrition.sel || '-')}</div></div>
        </div>
      </section>
      <section class="card compact-card">
        <h4>Allergènes</h4>
        <div class="toolbar chip-row">${(ingredient.allergenes || []).length ? ingredient.allergenes.map(item => `<span class="tag">${esc(item)}</span>`).join('') : '<span class="muted">Aucun allergène renseigné.</span>'}</div>
      </section>`;
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
    renderOffres();
  };

  offersEditor.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-offre]');
    if (!btn) return;
    offres.splice(Number(btn.dataset.removeOffre), 1);
    renderOffres();
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
    renderOffres();
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
