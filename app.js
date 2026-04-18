const APP_VERSION = 'v1.6.1';
const STORAGE_KEY = 'copilot-boulangerie-v1-6-1';
const VAT_RATES = [0, 2.1, 5.5, 10, 20];
const ALLERGENS = ['Gluten','Crustacés','Œufs','Poissons','Arachides','Soja','Lait','Fruits à coque','Céleri','Moutarde','Sésame','Sulfites','Lupin','Mollusques'];
const NUTRITION_FIELDS = ['calories','fat','saturatedFat','carbs','sugars','protein','fiber','salt'];

const seed = {
  meta: { version: APP_VERSION, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), lastBackupAt: null },
  settings: { laborHourlyCost: 0, energyHourlyCost: 0, overheadRate: 0, categoryMemory: [] },
  suppliers: [],
  ingredients: [],
  recipes: []
};

let state = loadState();
let currentRecipeId = state.recipes[0]?.id || null;
let ingredientEditId = null;
let supplierEditId = null;
let recipeEditId = null;

function uid() { return (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2,9)}`); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function euro(v) { return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
function num(v,d=2){ return new Intl.NumberFormat('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v||0)); }
function esc(v=''){ return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function legalVatLabel(rate){ return `${String(rate).replace('.',',')} %`; }
function trimEan(v=''){ return String(v).replace(/\D/g,'').slice(0,14); }

function normalizeSupplier(raw={}) {
  return { id: raw.id || uid(), name: raw.name || '', contact: raw.contact || '', phone: raw.phone || '', email: raw.email || '', notes: raw.notes || '' };
}
function normalizeOffer(raw={}) {
  return {
    id: raw.id || uid(), supplierId: raw.supplierId || '', supplierRef: raw.supplierRef || '', purchaseUnit: raw.purchaseUnit || '',
    purchaseQty: Number(raw.purchaseQty || 0), purchasePrice: Number(raw.purchasePrice || 0), vatRate: Number(raw.vatRate ?? 5.5), isDefault: Boolean(raw.isDefault)
  };
}
function normalizeNutrition(raw={}) {
  return Object.fromEntries(NUTRITION_FIELDS.map(k => [k, Number(raw[k] || 0)]));
}
function normalizeIngredient(raw={}) {
  let offers = Array.isArray(raw.offers) ? raw.offers.map(normalizeOffer) : [];
  if (offers.length && !offers.some(o => o.isDefault)) offers[0].isDefault = true;
  return {
    id: raw.id || uid(), name: raw.name || '', category: raw.category || '', ean: trimEan(raw.ean || ''), baseUnit: raw.baseUnit || 'kg',
    offers, nutrition: normalizeNutrition(raw.nutrition || {}), allergens: Array.isArray(raw.allergens) ? raw.allergens.filter(a => ALLERGENS.includes(a)) : []
  };
}
function normalizeRecipe(raw={}) {
  return {
    id: raw.id || uid(), name: raw.name || '', batchYield: Number(raw.batchYield || 1), unitLabel: raw.unitLabel || 'pièce',
    laborHours: Number(raw.laborHours || 0), ovenHours: Number(raw.ovenHours || 0),
    items: Array.isArray(raw.items) ? raw.items.map(it => ({ id: it.id || uid(), ingredientId: it.ingredientId || '', quantity: Number(it.quantity || 0) })) : []
  };
}
function collectCategories() {
  const set = new Set(state.settings.categoryMemory || []);
  state.ingredients.forEach(i => { if (i.category?.trim()) set.add(i.category.trim()); });
  state.settings.categoryMemory = [...set].sort((a,b)=>a.localeCompare(b,'fr'));
}
function normalizeState(raw) {
  const out = clone(seed);
  if (!raw || typeof raw !== 'object') return out;
  out.meta = { ...out.meta, ...(raw.meta || {}) };
  out.settings = { ...out.settings, ...(raw.settings || {}) };
  out.suppliers = Array.isArray(raw.suppliers) ? raw.suppliers.map(normalizeSupplier) : [];
  out.ingredients = Array.isArray(raw.ingredients) ? raw.ingredients.map(normalizeIngredient) : [];
  out.recipes = Array.isArray(raw.recipes) ? raw.recipes.map(normalizeRecipe) : [];
  collectCategories.call({});
  return out;
}
function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? normalizeState(JSON.parse(raw)) : normalizeState(seed); }
  catch { return normalizeState(seed); }
}
function saveState(markBackup = false) {
  collectCategories();
  state.meta.updatedAt = new Date().toISOString();
  if (markBackup) state.meta.lastBackupAt = state.meta.updatedAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDefaultOffer(ingredient) { return ingredient.offers.find(o => o.isDefault) || ingredient.offers[0] || null; }
function computeOfferCosts(ingredient, offer) {
  if (!offer || !offer.purchaseQty || !offer.purchasePrice) return { ht: 0, ttc: 0 };
  const ht = offer.purchasePrice / offer.purchaseQty;
  const ttc = ht * (1 + offer.vatRate / 100);
  return { ht, ttc };
}
function linkedOfferCount(supplierId) { return state.ingredients.reduce((count, ingredient) => count + ingredient.offers.filter(o => o.supplierId === supplierId).length, 0); }
function computeRecipe(recipe) {
  const materialCost = recipe.items.reduce((sum, item) => {
    const ingredient = state.ingredients.find(i => i.id === item.ingredientId);
    const offer = ingredient ? getDefaultOffer(ingredient) : null;
    const { ht } = computeOfferCosts(ingredient, offer);
    return sum + (ht * Number(item.quantity || 0));
  }, 0);
  const laborCost = (Number(state.settings.laborHourlyCost || 0) * Number(recipe.laborHours || 0));
  const energyCost = (Number(state.settings.energyHourlyCost || 0) * Number(recipe.ovenHours || 0));
  const subtotal = materialCost + laborCost + energyCost;
  const overhead = subtotal * (Number(state.settings.overheadRate || 0) / 100);
  const totalCost = subtotal + overhead;
  const unitCost = recipe.batchYield ? totalCost / recipe.batchYield : 0;
  return { materialCost, laborCost, energyCost, overhead, totalCost, unitCost };
}

function bind(id, event, handler) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (!el) return;
  el.addEventListener(event, handler);
}
function openDialog(id) {
  const dlg = document.getElementById(id);
  if (dlg?.showModal) dlg.showModal();
  else dlg?.setAttribute('open','open');
  document.body.classList.add('modal-open');
}
function closeDialog(id) {
  const dlg = document.getElementById(id);
  if (dlg?.close) dlg.close();
  else dlg?.removeAttribute('open');
  if (![...document.querySelectorAll('dialog')].some(d => d.open)) document.body.classList.remove('modal-open');
}
function setTab(tabId) {
  document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.id === tabId));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.toggle('active', el.dataset.tab === tabId));
  document.querySelector('.sidebar')?.classList.remove('open');
}

function renderVersion() {
  document.querySelectorAll('#versionLabel,.mobile-version,.footer-version').forEach(el => {
    if (el.id === 'versionLabel') el.textContent = APP_VERSION;
    else el.textContent = `Version ${APP_VERSION}`;
  });
}
function renderKpis() {
  const grid = document.getElementById('kpiGrid');
  const cards = [
    ['Ingrédients', state.ingredients.length],
    ['Fournisseurs', state.suppliers.length],
    ['Recettes', state.recipes.length],
    ['Catégories', state.settings.categoryMemory.length]
  ];
  grid.innerHTML = cards.map(([label,value]) => `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div></div>`).join('');
}
function renderBackup() {
  const text = state.meta.lastBackupAt ? `Dernière sauvegarde externe : ${new Date(state.meta.lastBackupAt).toLocaleString('fr-FR')}` : 'Aucune sauvegarde externe enregistrée.';
  document.getElementById('backupSummary').textContent = text;
  document.getElementById('backupHealth').textContent = text;
}
function renderCategoryMemory() {
  const list = document.getElementById('categoryMemoryList');
  const data = state.settings.categoryMemory || [];
  list.innerHTML = data.length ? data.map(v => `<span class="chip">${esc(v)}</span>`).join('') : '<span class="muted">Aucune catégorie mémorisée.</span>';
  const datalist = document.getElementById('categorySuggestions');
  datalist.innerHTML = data.map(v => `<option value="${esc(v)}"></option>`).join('');
}
function renderIngredients() {
  const q = document.getElementById('ingredientSearch').value.trim().toLowerCase();
  const tbody = document.getElementById('ingredientsTable');
  const rows = state.ingredients.filter(i => !q || [i.name,i.category,i.ean].join(' ').toLowerCase().includes(q)).map(ingredient => {
    const offer = getDefaultOffer(ingredient);
    const supplier = offer ? state.suppliers.find(s => s.id === offer.supplierId) : null;
    const costs = computeOfferCosts(ingredient, offer);
    return `<tr>
      <td>${esc(ingredient.name)}</td>
      <td>${esc(ingredient.category || '—')}</td>
      <td>${esc(ingredient.ean || '—')}</td>
      <td>${esc(supplier?.name || '—')}</td>
      <td>${offer ? `${euro(costs.ht)}/${esc(ingredient.baseUnit === 'piece' ? 'pièce' : ingredient.baseUnit)}` : '—'}</td>
      <td>${offer ? `${euro(costs.ttc)}/${esc(ingredient.baseUnit === 'piece' ? 'pièce' : ingredient.baseUnit)}` : '—'}</td>
      <td>${esc(ingredient.allergens.join(', ') || '—')}</td>
      <td class="table-actions">
        <button type="button" class="small-btn secondary" data-edit-ingredient="${ingredient.id}">Modifier</button>
        <button type="button" class="small-btn secondary" data-delete-ingredient="${ingredient.id}">Supprimer</button>
      </td>
    </tr>`;
  }).join('');
  tbody.innerHTML = rows || '<tr><td colspan="8" class="muted">Aucun ingrédient.</td></tr>';
}
function renderSuppliers() {
  const q = document.getElementById('supplierSearch').value.trim().toLowerCase();
  const tbody = document.getElementById('suppliersTable');
  const rows = state.suppliers.filter(s => !q || [s.name,s.contact,s.email,s.phone].join(' ').toLowerCase().includes(q)).map(supplier => `<tr>
    <td>${esc(supplier.name)}</td><td>${esc(supplier.contact || '—')}</td><td>${esc(supplier.phone || '—')}</td><td>${esc(supplier.email || '—')}</td><td>${linkedOfferCount(supplier.id)}</td>
    <td class="table-actions"><button type="button" class="small-btn secondary" data-edit-supplier="${supplier.id}">Modifier</button><button type="button" class="small-btn secondary" data-delete-supplier="${supplier.id}">Supprimer</button></td></tr>`).join('');
  tbody.innerHTML = rows || '<tr><td colspan="6" class="muted">Aucun fournisseur.</td></tr>';
}
function renderRecipes() {
  const list = document.getElementById('recipesList');
  list.innerHTML = state.recipes.length ? state.recipes.map(recipe => {
    const totals = computeRecipe(recipe);
    return `<div class="recipe-card ${recipe.id===currentRecipeId?'active':''}">
      <strong>${esc(recipe.name)}</strong>
      <div class="muted">Rendement : ${num(recipe.batchYield,2)} ${esc(recipe.unitLabel)}</div>
      <div class="muted">Coût unitaire : ${euro(totals.unitCost)}</div>
      <div class="recipe-actions"><button type="button" class="small-btn secondary" data-select-recipe="${recipe.id}">Voir</button><button type="button" class="small-btn secondary" data-edit-recipe="${recipe.id}">Modifier</button><button type="button" class="small-btn secondary" data-delete-recipe="${recipe.id}">Supprimer</button></div>
    </div>`;
  }).join('') : '<div class="muted">Aucune recette.</div>';
  const detail = document.getElementById('recipeDetail');
  const recipe = state.recipes.find(r => r.id === currentRecipeId);
  if (!recipe) { detail.innerHTML = '<div class="muted">Sélectionnez une recette.</div>'; return; }
  const totals = computeRecipe(recipe);
  detail.innerHTML = `<div class="stack"><h3>${esc(recipe.name)}</h3>
    <div class="summary-box">
      <div>Rendement : ${num(recipe.batchYield,2)} ${esc(recipe.unitLabel)}</div>
      <div>Coût matière : ${euro(totals.materialCost)}</div>
      <div>Coût complet : ${euro(totals.totalCost)}</div>
      <div>Coût unitaire : ${euro(totals.unitCost)}</div>
    </div>
    <div class="stack">${recipe.items.map(item => {
      const ingredient = state.ingredients.find(i => i.id === item.ingredientId);
      return `<div class="recipe-line"><strong>${esc(ingredient?.name || 'Ingrédient supprimé')}</strong><div class="muted">${num(item.quantity,3)} ${esc(ingredient?.baseUnit === 'piece' ? 'pièce' : ingredient?.baseUnit || '')}</div></div>`;
    }).join('') || '<div class="muted">Aucune ligne.</div>'}</div>
  </div>`;
}
function renderSimulationSelect() {
  const sel = document.getElementById('simulationRecipe');
  sel.innerHTML = state.recipes.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}
function renderSettings() {
  document.getElementById('laborHourlyCost').value = state.settings.laborHourlyCost || '';
  document.getElementById('energyHourlyCost').value = state.settings.energyHourlyCost || '';
  document.getElementById('overheadRate').value = state.settings.overheadRate || '';
}
function renderAll() {
  collectCategories();
  saveState();
  renderVersion(); renderKpis(); renderBackup(); renderCategoryMemory(); renderIngredients(); renderSuppliers(); renderRecipes(); renderSimulationSelect(); renderSettings();
}

function supplierOptions(selected='') {
  return `<option value="">—</option>` + state.suppliers.map(s => `<option value="${s.id}" ${selected===s.id?'selected':''}>${esc(s.name)}</option>`).join('');
}
function vatOptions(selected=5.5) {
  return VAT_RATES.map(rate => `<option value="${rate}" ${Number(rate)===Number(selected)?'selected':''}>${legalVatLabel(rate)}</option>`).join('');
}
function addOfferRow(offer = normalizeOffer({})) {
  const container = document.getElementById('offersContainer');
  const wrap = document.createElement('div');
  wrap.className = 'offer-card';
  wrap.dataset.offerId = offer.id;
  wrap.innerHTML = `<div class="offer-head"><strong>Offre fournisseur</strong><button type="button" class="small-btn secondary" data-remove-offer="${offer.id}">Supprimer</button></div>
    <div class="offer-grid">
      <label>Fournisseur<select data-field="supplierId">${supplierOptions(offer.supplierId)}</select></label>
      <label>Référence fournisseur<input data-field="supplierRef" value="${esc(offer.supplierRef)}" /></label>
      <label>Unité d’achat<input data-field="purchaseUnit" value="${esc(offer.purchaseUnit)}" placeholder="sac 25 kg" /></label>
      <label>Quantité achetée<input data-field="purchaseQty" type="number" min="0" step="0.001" value="${offer.purchaseQty || ''}" /></label>
      <label>Prix HT achat<input data-field="purchasePrice" type="number" min="0" step="0.01" value="${offer.purchasePrice || ''}" /></label>
      <label>TVA<select data-field="vatRate">${vatOptions(offer.vatRate)}</select></label>
      <label class="checkbox-line"><input data-field="isDefault" type="checkbox" ${offer.isDefault ? 'checked' : ''}/> Offre par défaut</label>
    </div>`;
  container.appendChild(wrap);
}
function readOfferRows() {
  const rows = [...document.querySelectorAll('#offersContainer .offer-card')].map(card => ({
    id: card.dataset.offerId || uid(),
    supplierId: card.querySelector('[data-field="supplierId"]').value,
    supplierRef: card.querySelector('[data-field="supplierRef"]').value.trim(),
    purchaseUnit: card.querySelector('[data-field="purchaseUnit"]').value.trim(),
    purchaseQty: Number(card.querySelector('[data-field="purchaseQty"]').value || 0),
    purchasePrice: Number(card.querySelector('[data-field="purchasePrice"]').value || 0),
    vatRate: Number(card.querySelector('[data-field="vatRate"]').value || 0),
    isDefault: card.querySelector('[data-field="isDefault"]').checked
  }));
  if (rows.length && !rows.some(o => o.isDefault)) rows[0].isDefault = true;
  if (rows.filter(o => o.isDefault).length > 1) {
    let seen = false;
    rows.forEach(o => { if (o.isDefault && !seen) seen = true; else if (o.isDefault) o.isDefault = false; });
  }
  return rows;
}

function openIngredientDialog(id = null) {
  ingredientEditId = id;
  document.getElementById('ingredientForm').reset();
  document.getElementById('offersContainer').innerHTML = '';
  document.getElementById('ingredientId').value = id || '';
  renderCategoryMemory();
  document.getElementById('allergenChecklist').innerHTML = ALLERGENS.map(a => `<label class="checkbox-line"><input type="checkbox" value="${esc(a)}" /> ${esc(a)}</label>`).join('');
  if (id) {
    const ingredient = state.ingredients.find(i => i.id === id);
    document.getElementById('ingredientDialogTitle').textContent = 'Modifier un ingrédient';
    document.getElementById('ingredientName').value = ingredient.name;
    document.getElementById('ingredientCategory').value = ingredient.category;
    document.getElementById('ingredientEan').value = ingredient.ean;
    document.getElementById('ingredientBaseUnit').value = ingredient.baseUnit;
    NUTRITION_FIELDS.forEach(k => document.getElementById(`nutrition${k[0].toUpperCase()+k.slice(1)}`).value = ingredient.nutrition[k] || '');
    [...document.querySelectorAll('#allergenChecklist input')].forEach(chk => chk.checked = ingredient.allergens.includes(chk.value));
    (ingredient.offers || []).forEach(addOfferRow);
  } else {
    document.getElementById('ingredientDialogTitle').textContent = 'Ajouter un ingrédient';
    addOfferRow(normalizeOffer({ isDefault: true, vatRate: 5.5 }));
  }
  openDialog('ingredientDialog');
}
function openSupplierDialog(id = null) {
  supplierEditId = id;
  document.getElementById('supplierForm').reset();
  document.getElementById('supplierId').value = id || '';
  document.getElementById('supplierDialogTitle').textContent = id ? 'Modifier un fournisseur' : 'Ajouter un fournisseur';
  if (id) {
    const s = state.suppliers.find(x => x.id === id);
    document.getElementById('supplierName').value = s.name; document.getElementById('supplierContact').value = s.contact; document.getElementById('supplierPhone').value = s.phone; document.getElementById('supplierEmail').value = s.email; document.getElementById('supplierNotes').value = s.notes;
  }
  openDialog('supplierDialog');
}
function addRecipeLine(item = { id: uid(), ingredientId:'', quantity:0 }) {
  const wrap = document.createElement('div');
  wrap.className = 'recipe-line';
  wrap.dataset.itemId = item.id;
  wrap.innerHTML = `<div class="offer-head"><strong>Ligne recette</strong><button type="button" class="small-btn secondary" data-remove-recipe-item="${item.id}">Supprimer</button></div>
    <div class="offer-grid">
      <label>Ingrédient<select data-field="ingredientId"><option value="">—</option>${state.ingredients.map(i => `<option value="${i.id}" ${i.id===item.ingredientId?'selected':''}>${esc(i.name)}</option>`).join('')}</select></label>
      <label>Quantité<input data-field="quantity" type="number" min="0" step="0.001" value="${item.quantity || ''}" /></label>
    </div>`;
  document.getElementById('recipeItemsContainer').appendChild(wrap);
}
function openRecipeDialog(id = null) {
  recipeEditId = id;
  document.getElementById('recipeForm').reset();
  document.getElementById('recipeItemsContainer').innerHTML = '';
  document.getElementById('recipeId').value = id || '';
  document.getElementById('recipeDialogTitle').textContent = id ? 'Modifier une recette' : 'Créer une recette';
  if (id) {
    const r = state.recipes.find(x => x.id === id);
    document.getElementById('recipeName').value = r.name; document.getElementById('recipeYield').value = r.batchYield; document.getElementById('recipeUnitLabel').value = r.unitLabel; document.getElementById('recipeLaborHours').value = r.laborHours; document.getElementById('recipeOvenHours').value = r.ovenHours;
    (r.items || []).forEach(addRecipeLine);
  } else addRecipeLine();
  openDialog('recipeDialog');
}

function initEvents() {
  bind('menuToggle', 'click', () => document.querySelector('.sidebar').classList.toggle('open'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  bind('ingredientSearch', 'input', renderIngredients);
  bind('supplierSearch', 'input', renderSuppliers);
  bind('addIngredientBtn', 'click', () => openIngredientDialog());
  bind('quickAddIngredient', 'click', () => { setTab('ingredients'); openIngredientDialog(); });
  bind('addSupplierBtn', 'click', () => openSupplierDialog());
  bind('quickAddSupplier', 'click', () => { setTab('suppliers'); openSupplierDialog(); });
  bind('addRecipeBtn', 'click', () => openRecipeDialog());
  bind('quickAddRecipe', 'click', () => { setTab('recipes'); openRecipeDialog(); });
  bind('addOfferBtn', 'click', () => addOfferRow(normalizeOffer({ vatRate: 5.5 })));
  bind('addRecipeItemBtn', 'click', () => addRecipeLine());
  bind('saveSettingsBtn', 'click', () => {
    state.settings.laborHourlyCost = Number(document.getElementById('laborHourlyCost').value || 0);
    state.settings.energyHourlyCost = Number(document.getElementById('energyHourlyCost').value || 0);
    state.settings.overheadRate = Number(document.getElementById('overheadRate').value || 0);
    renderAll();
    alert('Paramètres enregistrés.');
  });
  bind('simulateBtn', 'click', () => {
    const recipe = state.recipes.find(r => r.id === document.getElementById('simulationRecipe').value);
    if (!recipe) return;
    const lots = Number(document.getElementById('simulationLots').value || 1);
    const price = Number(document.getElementById('simulationPrice').value || 0);
    const totals = computeRecipe(recipe);
    const totalCost = totals.totalCost * lots;
    const units = recipe.batchYield * lots;
    const revenue = units * price;
    const margin = revenue - totalCost;
    document.getElementById('simulationResult').innerHTML = `<div class="stack"><div><strong>Recette :</strong> ${esc(recipe.name)}</div><div><strong>Production :</strong> ${num(units,2)} ${esc(recipe.unitLabel)}</div><div><strong>Coût total :</strong> ${euro(totalCost)}</div><div><strong>Coût unitaire :</strong> ${euro(totals.unitCost)}</div><div><strong>CA théorique :</strong> ${euro(revenue)}</div><div><strong>Marge théorique :</strong> ${euro(margin)}</div></div>`;
  });
  bind('backupBtn', 'click', () => {
    const blob = new Blob([JSON.stringify(state,null,2)], { type: 'application/json' });
    const name = `copilot-boulangerie-${APP_VERSION}.json`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
    saveState(true); renderBackup();
  });
  bind('exportBtn', 'click', () => {
    const blob = new Blob([JSON.stringify(state,null,2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'copilot-boulangerie-export.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });
  bind('resetBtn', 'click', () => {
    if (!confirm('Réinitialiser toutes les données locales ?')) return;
    state = normalizeState(seed); currentRecipeId = null; renderAll();
  });
  bind('importFile', 'change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { state = normalizeState(JSON.parse(await file.text())); currentRecipeId = state.recipes[0]?.id || null; renderAll(); alert('Import réussi.'); }
    catch { alert('Import impossible.'); }
    e.target.value = '';
  });

  document.querySelectorAll('[data-close-dialog]').forEach(btn => btn.addEventListener('click', () => closeDialog(btn.dataset.closeDialog)));
  document.getElementById('offersContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-offer]'); if (!btn) return;
    btn.closest('.offer-card')?.remove();
  });
  document.getElementById('offersContainer').addEventListener('change', (e) => {
    if (e.target.matches('[data-field="isDefault"]') && e.target.checked) {
      document.querySelectorAll('#offersContainer [data-field="isDefault"]').forEach(chk => { if (chk !== e.target) chk.checked = false; });
    }
  });
  document.getElementById('recipeItemsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-recipe-item]'); if (!btn) return;
    btn.closest('.recipe-line')?.remove();
  });
  document.getElementById('ingredientsTable').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit-ingredient]');
    const del = e.target.closest('[data-delete-ingredient]');
    if (edit) openIngredientDialog(edit.dataset.editIngredient);
    if (del && confirm('Supprimer cet ingrédient ?')) { state.ingredients = state.ingredients.filter(i => i.id !== del.dataset.deleteIngredient); renderAll(); }
  });
  document.getElementById('suppliersTable').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit-supplier]');
    const del = e.target.closest('[data-delete-supplier]');
    if (edit) openSupplierDialog(edit.dataset.editSupplier);
    if (del && confirm('Supprimer ce fournisseur ?')) { state.suppliers = state.suppliers.filter(s => s.id !== del.dataset.deleteSupplier); state.ingredients.forEach(i => i.offers = i.offers.filter(o => o.supplierId !== del.dataset.deleteSupplier)); renderAll(); }
  });
  document.getElementById('recipesList').addEventListener('click', (e) => {
    const select = e.target.closest('[data-select-recipe]');
    const edit = e.target.closest('[data-edit-recipe]');
    const del = e.target.closest('[data-delete-recipe]');
    if (select) { currentRecipeId = select.dataset.selectRecipe; renderRecipes(); }
    if (edit) openRecipeDialog(edit.dataset.editRecipe);
    if (del && confirm('Supprimer cette recette ?')) { state.recipes = state.recipes.filter(r => r.id !== del.dataset.deleteRecipe); if (currentRecipeId === del.dataset.deleteRecipe) currentRecipeId = state.recipes[0]?.id || null; renderAll(); }
  });

  document.getElementById('ingredientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const offers = readOfferRows();
    const ingredient = normalizeIngredient({
      id: document.getElementById('ingredientId').value || uid(),
      name: document.getElementById('ingredientName').value.trim(),
      category: document.getElementById('ingredientCategory').value.trim(),
      ean: trimEan(document.getElementById('ingredientEan').value),
      baseUnit: document.getElementById('ingredientBaseUnit').value,
      offers,
      nutrition: Object.fromEntries(NUTRITION_FIELDS.map(k => [k, Number(document.getElementById(`nutrition${k[0].toUpperCase()+k.slice(1)}`).value || 0)])),
      allergens: [...document.querySelectorAll('#allergenChecklist input:checked')].map(i => i.value)
    });
    if (!ingredient.name) return alert('Le nom est obligatoire.');
    const idx = state.ingredients.findIndex(i => i.id === ingredient.id);
    if (idx >= 0) state.ingredients[idx] = ingredient; else state.ingredients.push(ingredient);
    closeDialog('ingredientDialog'); renderAll();
  });
  document.getElementById('supplierForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const supplier = normalizeSupplier({
      id: document.getElementById('supplierId').value || uid(), name: document.getElementById('supplierName').value.trim(),
      contact: document.getElementById('supplierContact').value.trim(), phone: document.getElementById('supplierPhone').value.trim(),
      email: document.getElementById('supplierEmail').value.trim(), notes: document.getElementById('supplierNotes').value.trim()
    });
    if (!supplier.name) return alert('Le nom est obligatoire.');
    const idx = state.suppliers.findIndex(s => s.id === supplier.id);
    if (idx >= 0) state.suppliers[idx] = supplier; else state.suppliers.push(supplier);
    closeDialog('supplierDialog'); renderAll();
  });
  document.getElementById('recipeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const items = [...document.querySelectorAll('#recipeItemsContainer .recipe-line')].map(line => ({
      id: line.dataset.itemId || uid(), ingredientId: line.querySelector('[data-field="ingredientId"]').value, quantity: Number(line.querySelector('[data-field="quantity"]').value || 0)
    })).filter(item => item.ingredientId && item.quantity > 0);
    const recipe = normalizeRecipe({
      id: document.getElementById('recipeId').value || uid(), name: document.getElementById('recipeName').value.trim(),
      batchYield: Number(document.getElementById('recipeYield').value || 0), unitLabel: document.getElementById('recipeUnitLabel').value.trim() || 'pièce',
      laborHours: Number(document.getElementById('recipeLaborHours').value || 0), ovenHours: Number(document.getElementById('recipeOvenHours').value || 0), items
    });
    if (!recipe.name) return alert('Le nom est obligatoire.');
    const idx = state.recipes.findIndex(r => r.id === recipe.id);
    if (idx >= 0) state.recipes[idx] = recipe; else state.recipes.push(recipe);
    currentRecipeId = recipe.id;
    closeDialog('recipeDialog'); renderAll();
  });
}

document.addEventListener('DOMContentLoaded', () => { initEvents(); renderAll(); setTab('dashboard'); });
