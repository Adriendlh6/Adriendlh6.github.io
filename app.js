const APP_VERSION = 'v1.6.2';
const STORAGE_KEY = 'copilot-boulangerie-v1-6-2';
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

const $ = (id) => document.getElementById(id);
const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const clone = (v) => JSON.parse(JSON.stringify(v));
const num = (v, d=2) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(v || 0));
const euro = (v) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));
const esc = (v='') => String(v).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const trimEan = (v='') => String(v).replace(/\D/g, '').slice(0, 14);

function normalizeSupplier(raw={}) {
  return { id: raw.id || uid(), name: raw.name || '', contact: raw.contact || '', phone: raw.phone || '', email: raw.email || '', notes: raw.notes || '' };
}
function normalizeOffer(raw={}) {
  return {
    id: raw.id || uid(),
    supplierId: raw.supplierId || '',
    supplierRef: raw.supplierRef || '',
    purchaseUnit: raw.purchaseUnit || '',
    purchaseQty: Number(raw.purchaseQty || 0),
    purchasePrice: Number(raw.purchasePrice || 0),
    vatRate: Number(raw.vatRate ?? 5.5),
    isDefault: Boolean(raw.isDefault)
  };
}
function normalizeNutrition(raw={}) {
  return Object.fromEntries(NUTRITION_FIELDS.map((k) => [k, Number(raw[k] || 0)]));
}
function normalizeIngredient(raw={}) {
  const offers = Array.isArray(raw.offers) ? raw.offers.map(normalizeOffer) : [];
  if (offers.length && !offers.some((o) => o.isDefault)) offers[0].isDefault = true;
  return {
    id: raw.id || uid(),
    name: raw.name || '',
    category: raw.category || '',
    ean: trimEan(raw.ean || ''),
    baseUnit: raw.baseUnit || 'kg',
    offers,
    nutrition: normalizeNutrition(raw.nutrition || {}),
    allergens: Array.isArray(raw.allergens) ? raw.allergens.filter((a) => ALLERGENS.includes(a)) : []
  };
}
function normalizeRecipe(raw={}) {
  return {
    id: raw.id || uid(),
    name: raw.name || '',
    batchYield: Number(raw.batchYield || 1),
    unitLabel: raw.unitLabel || 'pièce',
    laborHours: Number(raw.laborHours || 0),
    ovenHours: Number(raw.ovenHours || 0),
    items: Array.isArray(raw.items) ? raw.items.map((it) => ({ id: it.id || uid(), ingredientId: it.ingredientId || '', quantity: Number(it.quantity || 0) })) : []
  };
}
function normalizeState(raw) {
  const out = clone(seed);
  if (!raw || typeof raw !== 'object') return out;
  out.meta = { ...out.meta, ...(raw.meta || {}) };
  out.settings = { ...out.settings, ...(raw.settings || {}) };
  out.suppliers = Array.isArray(raw.suppliers) ? raw.suppliers.map(normalizeSupplier) : [];
  out.ingredients = Array.isArray(raw.ingredients) ? raw.ingredients.map(normalizeIngredient) : [];
  out.recipes = Array.isArray(raw.recipes) ? raw.recipes.map(normalizeRecipe) : [];
  return out;
}
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState(seed);
  } catch {
    return normalizeState(seed);
  }
}
function collectCategories() {
  const set = new Set(state.settings.categoryMemory || []);
  state.ingredients.forEach((i) => { if (i.category?.trim()) set.add(i.category.trim()); });
  state.settings.categoryMemory = [...set].sort((a,b) => a.localeCompare(b, 'fr'));
}
function saveState(markBackup=false) {
  collectCategories();
  state.meta.version = APP_VERSION;
  state.meta.updatedAt = new Date().toISOString();
  if (markBackup) state.meta.lastBackupAt = state.meta.updatedAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function supplierName(id) {
  return state.suppliers.find((s) => s.id === id)?.name || '—';
}
function getDefaultOffer(ingredient) {
  return ingredient.offers.find((o) => o.isDefault) || ingredient.offers[0] || null;
}
function computeOfferCosts(offer) {
  if (!offer || !offer.purchaseQty || !offer.purchasePrice) return { ht: 0, ttc: 0 };
  const ht = Number(offer.purchasePrice) / Number(offer.purchaseQty);
  const ttc = ht * (1 + Number(offer.vatRate || 0) / 100);
  return { ht, ttc };
}
function computeRecipe(recipe) {
  const materialCost = recipe.items.reduce((sum, item) => {
    const ingredient = state.ingredients.find((i) => i.id === item.ingredientId);
    const offer = ingredient ? getDefaultOffer(ingredient) : null;
    return sum + computeOfferCosts(offer).ht * Number(item.quantity || 0);
  }, 0);
  const laborCost = Number(state.settings.laborHourlyCost || 0) * Number(recipe.laborHours || 0);
  const energyCost = Number(state.settings.energyHourlyCost || 0) * Number(recipe.ovenHours || 0);
  const subtotal = materialCost + laborCost + energyCost;
  const overhead = subtotal * Number(state.settings.overheadRate || 0) / 100;
  const totalCost = subtotal + overhead;
  const unitCost = recipe.batchYield ? totalCost / recipe.batchYield : 0;
  return { materialCost, laborCost, energyCost, overhead, totalCost, unitCost };
}

function setVersionLabels() {
  ['versionLabel','mobileVersionLabel','footerVersionLabel'].forEach((id) => { if ($(id)) $(id).textContent = APP_VERSION; });
}
function setTab(tabId) {
  document.querySelectorAll('.tab-page').forEach((tab) => tab.classList.toggle('active', tab.id === tabId));
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabId));
  $('sidebar').classList.remove('open');
}
function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
}
function closeModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  if (![...document.querySelectorAll('.modal')].some((m) => !m.classList.contains('hidden'))) {
    document.body.classList.remove('no-scroll');
  }
}

function renderKpis() {
  const cards = [
    ['Ingrédients', state.ingredients.length],
    ['Fournisseurs', state.suppliers.length],
    ['Recettes', state.recipes.length],
    ['Catégories', state.settings.categoryMemory.length]
  ];
  $('kpiGrid').innerHTML = cards.map(([label, value]) => `<article class="kpi-card"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${esc(value)}</div></article>`).join('');
}
function renderBackup() {
  const text = state.meta.lastBackupAt ? `Dernière sauvegarde externe : ${new Date(state.meta.lastBackupAt).toLocaleString('fr-FR')}` : 'Aucune sauvegarde externe enregistrée.';
  $('backupSummary').textContent = text;
  $('backupHealth').textContent = text;
}
function renderCategoryMemory() {
  const data = state.settings.categoryMemory || [];
  $('categoryMemoryList').innerHTML = data.length ? data.map((v) => `<span class="chip">${esc(v)}</span>`).join('') : '<span class="muted">Aucune catégorie mémorisée.</span>';
  $('categorySuggestions').innerHTML = data.map((v) => `<option value="${esc(v)}"></option>`).join('');
}
function renderIngredients() {
  const q = $('ingredientSearch').value.trim().toLowerCase();
  const rows = state.ingredients.filter((i) => !q || [i.name, i.category, i.ean].join(' ').toLowerCase().includes(q)).map((ingredient) => {
    const offer = getDefaultOffer(ingredient);
    const costs = computeOfferCosts(offer);
    return `<tr>
      <td>${esc(ingredient.name)}</td>
      <td>${esc(ingredient.category || '—')}</td>
      <td>${esc(ingredient.ean || '—')}</td>
      <td>${esc(offer ? supplierName(offer.supplierId) : '—')}</td>
      <td>${offer ? `${euro(costs.ht)}/${esc(ingredient.baseUnit === 'piece' ? 'pièce' : ingredient.baseUnit)}` : '—'}</td>
      <td>${offer ? `${euro(costs.ttc)}/${esc(ingredient.baseUnit === 'piece' ? 'pièce' : ingredient.baseUnit)}` : '—'}</td>
      <td class="table-actions">
        <button type="button" class="secondary" data-edit-ingredient="${ingredient.id}">Modifier</button>
        <button type="button" class="secondary" data-delete-ingredient="${ingredient.id}">Supprimer</button>
      </td>
    </tr>`;
  }).join('');
  $('ingredientsTable').innerHTML = rows || '<tr><td colspan="7" class="muted">Aucun ingrédient.</td></tr>';
}
function renderSuppliers() {
  const q = $('supplierSearch').value.trim().toLowerCase();
  const rows = state.suppliers.filter((s) => !q || [s.name, s.contact, s.phone, s.email].join(' ').toLowerCase().includes(q)).map((supplier) => {
    const linked = state.ingredients.reduce((n, ingredient) => n + ingredient.offers.filter((o) => o.supplierId === supplier.id).length, 0);
    return `<tr>
      <td>${esc(supplier.name)}</td>
      <td>${esc(supplier.contact || '—')}</td>
      <td>${esc(supplier.phone || '—')}</td>
      <td>${esc(supplier.email || '—')}</td>
      <td>${linked}</td>
      <td class="table-actions">
        <button type="button" class="secondary" data-edit-supplier="${supplier.id}">Modifier</button>
        <button type="button" class="secondary" data-delete-supplier="${supplier.id}">Supprimer</button>
      </td>
    </tr>`;
  }).join('');
  $('suppliersTable').innerHTML = rows || '<tr><td colspan="6" class="muted">Aucun fournisseur.</td></tr>';
}
function renderRecipes() {
  $('recipesList').innerHTML = state.recipes.length ? state.recipes.map((recipe) => {
    const totals = computeRecipe(recipe);
    return `<article class="recipe-card ${recipe.id === currentRecipeId ? 'active' : ''}">
      <strong>${esc(recipe.name)}</strong>
      <div class="muted">${num(recipe.batchYield, 2)} ${esc(recipe.unitLabel)}</div>
      <div class="muted">Coût unitaire : ${euro(totals.unitCost)}</div>
      <div class="recipe-actions">
        <button type="button" class="secondary" data-select-recipe="${recipe.id}">Voir</button>
        <button type="button" class="secondary" data-edit-recipe="${recipe.id}">Modifier</button>
        <button type="button" class="secondary" data-delete-recipe="${recipe.id}">Supprimer</button>
      </div>
    </article>`;
  }).join('') : '<div class="muted">Aucune recette.</div>';
  const recipe = state.recipes.find((r) => r.id === currentRecipeId);
  if (!recipe) {
    $('recipeDetail').innerHTML = '<div class="muted">Sélectionnez une recette.</div>';
    return;
  }
  const totals = computeRecipe(recipe);
  $('recipeDetail').innerHTML = `<div class="stack">
    <div><strong>${esc(recipe.name)}</strong></div>
    <div>Coût matière : ${euro(totals.materialCost)}</div>
    <div>Main-d’œuvre : ${euro(totals.laborCost)}</div>
    <div>Énergie : ${euro(totals.energyCost)}</div>
    <div>Charges indirectes : ${euro(totals.overhead)}</div>
    <div>Coût complet : ${euro(totals.totalCost)}</div>
    <div>Coût unitaire : ${euro(totals.unitCost)}</div>
    <hr />
    <div class="stack">${recipe.items.map((item) => {
      const ingredient = state.ingredients.find((i) => i.id === item.ingredientId);
      return `<div><strong>${esc(ingredient?.name || 'Ingrédient supprimé')}</strong><div class="muted">${num(item.quantity, 3)} ${esc(ingredient?.baseUnit === 'piece' ? 'pièce' : ingredient?.baseUnit || '')}</div></div>`;
    }).join('') || '<div class="muted">Aucune ligne.</div>'}</div>
  </div>`;
}
function renderSimulationSelect() {
  $('simulationRecipe').innerHTML = state.recipes.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
}
function renderSettings() {
  $('laborHourlyCost').value = state.settings.laborHourlyCost || '';
  $('energyHourlyCost').value = state.settings.energyHourlyCost || '';
  $('overheadRate').value = state.settings.overheadRate || '';
}
function renderAll() {
  saveState(false);
  renderKpis();
  renderBackup();
  renderCategoryMemory();
  renderIngredients();
  renderSuppliers();
  renderRecipes();
  renderSimulationSelect();
  renderSettings();
}

function offerRow(offer={}) {
  const wrap = document.createElement('div');
  wrap.className = 'offer-card';
  wrap.dataset.offerId = offer.id || uid();
  wrap.innerHTML = `<div class="offer-head"><strong>Offre fournisseur</strong><button type="button" class="secondary" data-remove-offer>Supprimer</button></div>
    <div class="offer-grid">
      <label>Fournisseur
        <select data-field="supplierId">
          <option value="">Sélectionner</option>
          ${state.suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
        </select>
      </label>
      <label>Référence fournisseur
        <input data-field="supplierRef" />
      </label>
      <label>Unité d’achat
        <input data-field="purchaseUnit" placeholder="carton, seau, lot..." />
      </label>
      <label>Quantité achat
        <input type="number" min="0" step="0.001" data-field="purchaseQty" />
      </label>
      <label>Prix HT achat (€)
        <input type="number" min="0" step="0.01" data-field="purchasePrice" />
      </label>
      <label>TVA
        <select data-field="vatRate">${VAT_RATES.map((rate) => `<option value="${rate}">${String(rate).replace('.', ',')} %</option>`).join('')}</select>
      </label>
      <label class="checkbox-line"><input type="checkbox" data-field="isDefault" /> Offre par défaut</label>
    </div>`;
  wrap.querySelector('[data-field="supplierId"]').value = offer.supplierId || '';
  wrap.querySelector('[data-field="supplierRef"]').value = offer.supplierRef || '';
  wrap.querySelector('[data-field="purchaseUnit"]').value = offer.purchaseUnit || '';
  wrap.querySelector('[data-field="purchaseQty"]').value = offer.purchaseQty || '';
  wrap.querySelector('[data-field="purchasePrice"]').value = offer.purchasePrice || '';
  wrap.querySelector('[data-field="vatRate"]').value = String(offer.vatRate ?? 5.5);
  wrap.querySelector('[data-field="isDefault"]').checked = !!offer.isDefault;
  return wrap;
}
function readOfferRows() {
  return [...document.querySelectorAll('#offersContainer .offer-card')].map((card) => ({
    id: card.dataset.offerId || uid(),
    supplierId: card.querySelector('[data-field="supplierId"]').value,
    supplierRef: card.querySelector('[data-field="supplierRef"]').value.trim(),
    purchaseUnit: card.querySelector('[data-field="purchaseUnit"]').value.trim(),
    purchaseQty: Number(card.querySelector('[data-field="purchaseQty"]').value || 0),
    purchasePrice: Number(card.querySelector('[data-field="purchasePrice"]').value || 0),
    vatRate: Number(card.querySelector('[data-field="vatRate"]').value || 0),
    isDefault: card.querySelector('[data-field="isDefault"]').checked
  })).filter((offer) => offer.supplierId || offer.purchasePrice || offer.purchaseQty || offer.purchaseUnit || offer.supplierRef);
}
function openIngredientModal(id='') {
  $('ingredientForm').reset();
  $('offersContainer').innerHTML = '';
  $('ingredientId').value = id || '';
  $('allergenChecklist').innerHTML = ALLERGENS.map((a) => `<label class="checkbox-line"><input type="checkbox" value="${esc(a)}" /> ${esc(a)}</label>`).join('');
  if (id) {
    const ingredient = state.ingredients.find((i) => i.id === id);
    if (!ingredient) return;
    $('ingredientModalTitle').textContent = 'Modifier un ingrédient';
    $('ingredientName').value = ingredient.name;
    $('ingredientCategory').value = ingredient.category;
    $('ingredientEan').value = ingredient.ean;
    $('ingredientBaseUnit').value = ingredient.baseUnit;
    ingredient.offers.forEach((offer) => $('offersContainer').appendChild(offerRow(offer)));
    NUTRITION_FIELDS.forEach((key) => { const input = $(`nutrition${key[0].toUpperCase()+key.slice(1)}`); if (input) input.value = ingredient.nutrition[key] || ''; });
    [...document.querySelectorAll('#allergenChecklist input')].forEach((input) => { input.checked = ingredient.allergens.includes(input.value); });
  } else {
    $('ingredientModalTitle').textContent = 'Ajouter un ingrédient';
    $('offersContainer').appendChild(offerRow({ isDefault: true, vatRate: 5.5 }));
  }
  openModal('ingredientModal');
}
function openSupplierModal(id='') {
  $('supplierForm').reset();
  $('supplierId').value = id || '';
  $('supplierModalTitle').textContent = id ? 'Modifier un fournisseur' : 'Ajouter un fournisseur';
  if (id) {
    const supplier = state.suppliers.find((s) => s.id === id);
    if (!supplier) return;
    $('supplierName').value = supplier.name;
    $('supplierContact').value = supplier.contact;
    $('supplierPhone').value = supplier.phone;
    $('supplierEmail').value = supplier.email;
    $('supplierNotes').value = supplier.notes;
  }
  openModal('supplierModal');
}
function recipeLine(item={}) {
  const wrap = document.createElement('div');
  wrap.className = 'recipe-item';
  wrap.dataset.itemId = item.id || uid();
  wrap.innerHTML = `<div class="offer-grid">
    <label>Ingrédient
      <select data-field="ingredientId">
        <option value="">Sélectionner</option>
        ${state.ingredients.map((i) => `<option value="${i.id}">${esc(i.name)}</option>`).join('')}
      </select>
    </label>
    <label>Quantité
      <input type="number" min="0" step="0.001" data-field="quantity" />
    </label>
  </div>
  <div class="table-actions"><button type="button" class="secondary" data-remove-recipe-item>Supprimer la ligne</button></div>`;
  wrap.querySelector('[data-field="ingredientId"]').value = item.ingredientId || '';
  wrap.querySelector('[data-field="quantity"]').value = item.quantity || '';
  return wrap;
}
function openRecipeModal(id='') {
  $('recipeForm').reset();
  $('recipeItemsContainer').innerHTML = '';
  $('recipeId').value = id || '';
  $('recipeModalTitle').textContent = id ? 'Modifier une recette' : 'Créer une recette';
  if (id) {
    const recipe = state.recipes.find((r) => r.id === id);
    if (!recipe) return;
    $('recipeName').value = recipe.name;
    $('recipeYield').value = recipe.batchYield;
    $('recipeUnitLabel').value = recipe.unitLabel;
    $('recipeLaborHours').value = recipe.laborHours;
    $('recipeOvenHours').value = recipe.ovenHours;
    recipe.items.forEach((item) => $('recipeItemsContainer').appendChild(recipeLine(item)));
  } else {
    $('recipeItemsContainer').appendChild(recipeLine());
  }
  openModal('recipeModal');
}

function bindCoreEvents() {
  $('menuToggle').addEventListener('click', () => $('sidebar').classList.toggle('open'));
  document.addEventListener('click', (event) => {
    const nav = event.target.closest('.nav-btn');
    if (nav) setTab(nav.dataset.tab);
    const close = event.target.closest('[data-close]');
    if (close) closeModal(close.dataset.close);
  });

  $('quickAddIngredient').addEventListener('click', () => openIngredientModal());
  $('quickAddSupplier').addEventListener('click', () => openSupplierModal());
  $('quickAddRecipe').addEventListener('click', () => openRecipeModal());
  $('addIngredientBtn').addEventListener('click', () => openIngredientModal());
  $('addSupplierBtn').addEventListener('click', () => openSupplierModal());
  $('addRecipeBtn').addEventListener('click', () => openRecipeModal());
  $('addOfferBtn').addEventListener('click', () => $('offersContainer').appendChild(offerRow({ vatRate: 5.5 })));
  $('addRecipeItemBtn').addEventListener('click', () => $('recipeItemsContainer').appendChild(recipeLine()));

  $('offersContainer').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-offer]');
    if (remove) remove.closest('.offer-card')?.remove();
  });
  $('offersContainer').addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('[data-field="isDefault"]') && target.checked) {
      document.querySelectorAll('#offersContainer [data-field="isDefault"]').forEach((input) => { if (input !== target) input.checked = false; });
    }
  });
  $('recipeItemsContainer').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-recipe-item]');
    if (remove) remove.closest('.recipe-item')?.remove();
  });

  $('ingredientSearch').addEventListener('input', renderIngredients);
  $('supplierSearch').addEventListener('input', renderSuppliers);

  $('ingredientsTable').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-ingredient]');
    const del = event.target.closest('[data-delete-ingredient]');
    if (edit) openIngredientModal(edit.dataset.editIngredient);
    if (del && confirm('Supprimer cet ingrédient ?')) {
      state.ingredients = state.ingredients.filter((i) => i.id !== del.dataset.deleteIngredient);
      renderAll();
    }
  });
  $('suppliersTable').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-supplier]');
    const del = event.target.closest('[data-delete-supplier]');
    if (edit) openSupplierModal(edit.dataset.editSupplier);
    if (del && confirm('Supprimer ce fournisseur ?')) {
      state.suppliers = state.suppliers.filter((s) => s.id !== del.dataset.deleteSupplier);
      state.ingredients.forEach((ingredient) => ingredient.offers = ingredient.offers.filter((offer) => offer.supplierId !== del.dataset.deleteSupplier));
      renderAll();
    }
  });
  $('recipesList').addEventListener('click', (event) => {
    const select = event.target.closest('[data-select-recipe]');
    const edit = event.target.closest('[data-edit-recipe]');
    const del = event.target.closest('[data-delete-recipe]');
    if (select) { currentRecipeId = select.dataset.selectRecipe; renderRecipes(); }
    if (edit) openRecipeModal(edit.dataset.editRecipe);
    if (del && confirm('Supprimer cette recette ?')) {
      state.recipes = state.recipes.filter((r) => r.id !== del.dataset.deleteRecipe);
      currentRecipeId = state.recipes[0]?.id || null;
      renderAll();
    }
  });

  $('ingredientForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const ingredient = normalizeIngredient({
      id: $('ingredientId').value || uid(),
      name: $('ingredientName').value.trim(),
      category: $('ingredientCategory').value.trim(),
      ean: trimEan($('ingredientEan').value),
      baseUnit: $('ingredientBaseUnit').value,
      offers: readOfferRows(),
      nutrition: Object.fromEntries(NUTRITION_FIELDS.map((key) => [key, Number($(`nutrition${key[0].toUpperCase()+key.slice(1)}`).value || 0)])),
      allergens: [...document.querySelectorAll('#allergenChecklist input:checked')].map((input) => input.value)
    });
    if (!ingredient.name) return alert('Le nom est obligatoire.');
    const index = state.ingredients.findIndex((i) => i.id === ingredient.id);
    if (index >= 0) state.ingredients[index] = ingredient; else state.ingredients.push(ingredient);
    closeModal('ingredientModal');
    renderAll();
  });
  $('supplierForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const supplier = normalizeSupplier({
      id: $('supplierId').value || uid(),
      name: $('supplierName').value.trim(),
      contact: $('supplierContact').value.trim(),
      phone: $('supplierPhone').value.trim(),
      email: $('supplierEmail').value.trim(),
      notes: $('supplierNotes').value.trim()
    });
    if (!supplier.name) return alert('Le nom est obligatoire.');
    const index = state.suppliers.findIndex((s) => s.id === supplier.id);
    if (index >= 0) state.suppliers[index] = supplier; else state.suppliers.push(supplier);
    closeModal('supplierModal');
    renderAll();
  });
  $('recipeForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const items = [...document.querySelectorAll('#recipeItemsContainer .recipe-item')].map((line) => ({
      id: line.dataset.itemId || uid(),
      ingredientId: line.querySelector('[data-field="ingredientId"]').value,
      quantity: Number(line.querySelector('[data-field="quantity"]').value || 0)
    })).filter((item) => item.ingredientId && item.quantity > 0);
    const recipe = normalizeRecipe({
      id: $('recipeId').value || uid(),
      name: $('recipeName').value.trim(),
      batchYield: Number($('recipeYield').value || 0),
      unitLabel: $('recipeUnitLabel').value.trim() || 'pièce',
      laborHours: Number($('recipeLaborHours').value || 0),
      ovenHours: Number($('recipeOvenHours').value || 0),
      items
    });
    if (!recipe.name) return alert('Le nom est obligatoire.');
    const index = state.recipes.findIndex((r) => r.id === recipe.id);
    if (index >= 0) state.recipes[index] = recipe; else state.recipes.push(recipe);
    currentRecipeId = recipe.id;
    closeModal('recipeModal');
    renderAll();
  });

  $('saveSettingsBtn').addEventListener('click', () => {
    state.settings.laborHourlyCost = Number($('laborHourlyCost').value || 0);
    state.settings.energyHourlyCost = Number($('energyHourlyCost').value || 0);
    state.settings.overheadRate = Number($('overheadRate').value || 0);
    renderAll();
    alert('Paramètres enregistrés.');
  });
  $('simulateBtn').addEventListener('click', () => {
    const recipe = state.recipes.find((r) => r.id === $('simulationRecipe').value);
    if (!recipe) return;
    const lots = Number($('simulationLots').value || 1);
    const price = Number($('simulationPrice').value || 0);
    const totals = computeRecipe(recipe);
    const totalCost = totals.totalCost * lots;
    const units = recipe.batchYield * lots;
    const revenue = units * price;
    const margin = revenue - totalCost;
    $('simulationResult').innerHTML = `<div class="stack"><div><strong>Recette :</strong> ${esc(recipe.name)}</div><div><strong>Production :</strong> ${num(units, 2)} ${esc(recipe.unitLabel)}</div><div><strong>Coût total :</strong> ${euro(totalCost)}</div><div><strong>Coût unitaire :</strong> ${euro(totals.unitCost)}</div><div><strong>CA théorique :</strong> ${euro(revenue)}</div><div><strong>Marge théorique :</strong> ${euro(margin)}</div></div>`;
  });

  $('backupBtn').addEventListener('click', () => downloadJson(`copilot-boulangerie-${APP_VERSION}.json`, state, true));
  $('exportBtn').addEventListener('click', () => downloadJson('copilot-boulangerie-export.json', state, false));
  $('importFile').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state = normalizeState(JSON.parse(await file.text()));
      currentRecipeId = state.recipes[0]?.id || null;
      renderAll();
      alert('Import réussi.');
    } catch {
      alert('Import impossible.');
    }
    event.target.value = '';
  });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('Réinitialiser toutes les données locales ?')) return;
    state = normalizeState(seed);
    currentRecipeId = null;
    renderAll();
  });
}

function downloadJson(name, payload, markBackup) {
  if (markBackup) saveState(true);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  renderBackup();
}

function init() {
  setVersionLabels();
  bindCoreEvents();
  renderAll();
  setTab('dashboard');
}

document.addEventListener('DOMContentLoaded', init);
