const STORAGE_KEY = 'pilotage-production-vierge-v4-4';
const BACKUP_WARNING_DAYS = 7;
const APP_VERSION = 'v1.5.6';

const VAT_RATES = [0, 2.1, 5.5, 10, 20];
const ALLERGENS = [
  'Gluten', 'Crustacés', 'Œufs', 'Poissons', 'Arachides', 'Soja', 'Lait', 'Fruits à coque',
  'Céleri', 'Moutarde', 'Sésame', 'Sulfites', 'Lupin', 'Mollusques'
];
const NUTRITION_FIELDS = ['calories', 'fat', 'saturatedFat', 'carbs', 'sugars', 'protein', 'fiber', 'salt'];
let scannerStream = null;
let scannerAnimationFrame = null;

let openDialogCount = 0;

function syncModalState() {
  const anyOpen = [...document.querySelectorAll('dialog')].some(d => d.open);
  document.body.classList.toggle('modal-open', anyOpen);
}
function markDialogOpened() { openDialogCount += 1; syncModalState(); }
function markDialogClosed() { openDialogCount = Math.max(0, openDialogCount - 1); syncModalState(); }
function isAnyDialogOpen() { return [...document.querySelectorAll('dialog')].some(d => d.open); }
function isScannerOpen() { return !!document.getElementById('scannerDialog')?.open; }
let pendingScannedCode = '';
let isScannerRunning = false;
let html5QrInstance = null;

const seedData = {
  meta: {
    appVersion: APP_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastLocalSaveAt: null,
    lastBackupAt: null,
    lastBackupName: null,
    backupCount: 0
  },
  settings: {
    laborHourlyCost: 0,
    energyHourlyCost: 0,
    overheadRate: 0,
    categoryMemory: []
  },
  accountingFacts: [],
  suppliers: [],
  ingredients: [],
  recipes: []
};

let state = loadState();
let currentRecipeId = state.recipes[0]?.id || null;
let saveTimer = null;

function normalizeOffer(offer = {}, ingredient = {}) {
  const baseUnit = ingredient.baseUnit || offer.baseUnit || 'kg';
  const purchaseQty = Number(offer.purchaseQty ?? ingredient.purchaseQty ?? 0);
  const purchasePrice = Number(offer.purchasePrice ?? ingredient.purchasePrice ?? 0);
  return {
    id: offer.id || crypto.randomUUID(),
    supplierId: offer.supplierId || '',
    supplierRef: offer.supplierRef || '',
    purchaseUnit: offer.purchaseUnit || ingredient.purchaseUnit || '',
    purchaseQty,
    purchasePrice,
    vatRate: Number(offer.vatRate ?? ingredient.vatRate ?? 5.5),
    isDefault: Boolean(offer.isDefault)
  };
}

function normalizeNutrition(raw = {}) {
  return {
    calories: Number(raw.calories || 0),
    fat: Number(raw.fat || 0),
    saturatedFat: Number(raw.saturatedFat || 0),
    carbs: Number(raw.carbs || 0),
    sugars: Number(raw.sugars || 0),
    protein: Number(raw.protein || 0),
    fiber: Number(raw.fiber || 0),
    salt: Number(raw.salt || 0)
  };
}

function normalizeIngredient(raw = {}) {
  const baseUnit = raw.baseUnit || 'kg';
  let offers = Array.isArray(raw.offers) ? raw.offers.map(o => normalizeOffer(o, raw)) : [];
  if (!offers.length && (raw.purchaseQty || raw.purchasePrice || raw.purchaseUnit || raw.supplierId || raw.vatRate !== undefined)) {
    offers = [normalizeOffer({
      supplierId: raw.supplierId,
      purchaseUnit: raw.purchaseUnit,
      purchaseQty: raw.purchaseQty,
      purchasePrice: raw.purchasePrice,
      vatRate: raw.vatRate,
      isDefault: true
    }, raw)];
  }
  if (offers.length && !offers.some(o => o.isDefault)) offers[0].isDefault = true;
  return {
    id: raw.id || crypto.randomUUID(),
    name: raw.name || '',
    category: raw.category || '',
    ean: raw.ean || '',
    baseUnit,
    offers,
    nutrition: normalizeNutrition(raw.nutrition || {}),
    allergens: Array.isArray(raw.allergens) ? raw.allergens.filter(x => ALLERGENS.includes(x)) : []
  };
}

function collectCategoryMemory(ingredients = [], existing = []) {
  const categories = new Set((existing || []).filter(Boolean).map(x => String(x).trim()).filter(Boolean));
  ingredients.forEach(i => {
    const category = String(i?.category || '').trim();
    if (category) categories.add(category);
  });
  return [...categories].sort((a, b) => a.localeCompare(b, 'fr'));
}

function normalizeState(candidate) {
  const merged = structuredClone(seedData);
  if (!candidate || typeof candidate !== 'object') {
    merged.settings.categoryMemory = collectCategoryMemory(merged.ingredients, merged.settings.categoryMemory);
    return merged;
  }

  merged.settings = { ...merged.settings, ...(candidate.settings || {}) };
  merged.accountingFacts = Array.isArray(candidate.accountingFacts) ? candidate.accountingFacts : merged.accountingFacts;
  merged.suppliers = Array.isArray(candidate.suppliers) ? candidate.suppliers.map(s => ({
    id: s.id || crypto.randomUUID(),
    name: s.name || '',
    contact: s.contact || '',
    phone: s.phone || '',
    email: s.email || '',
    notes: s.notes || ''
  })) : [];
  merged.ingredients = Array.isArray(candidate.ingredients) ? candidate.ingredients.map(normalizeIngredient) : merged.ingredients;
  merged.recipes = Array.isArray(candidate.recipes) ? candidate.recipes : merged.recipes;
  merged.meta = { ...merged.meta, ...(candidate.meta || {}) };

  merged.settings.categoryMemory = collectCategoryMemory(merged.ingredients, merged.settings.categoryMemory);
  if (!merged.meta.createdAt) merged.meta.createdAt = new Date().toISOString();
  if (!merged.meta.updatedAt) merged.meta.updatedAt = new Date().toISOString();
  if (!merged.meta.appVersion) merged.meta.appVersion = APP_VERSION;
  return merged;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : normalizeState(seedData);
  } catch {
    return normalizeState(seedData);
  }
}

function persistState() {
  syncCategoryMemory();
  state.meta.updatedAt = new Date().toISOString();
  state.meta.lastLocalSaveAt = state.meta.updatedAt;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistState();
    renderBackupStatus();
  }, 150);
}

function euro(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value || 0);
}
function num(value, digits = 2) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}
function formatDateTime(value) {
  if (!value) return 'jamais';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
function daysSince(value) {
  if (!value) return Infinity;
  const diff = Date.now() - new Date(value).getTime();
  return Math.floor(diff / 86400000);
}
function unitLabel(baseUnit) {
  return baseUnit === 'piece' ? 'pièce' : baseUnit;
}

function legalVatLabel(rate) {
  return `${String(rate).replace('.', ',')} %`;
}
function renderVatOptions(selected = 5.5) {
  return VAT_RATES.map(rate => `<option value="${rate}" ${Number(selected) === Number(rate) ? 'selected' : ''}>${legalVatLabel(rate)}</option>`).join('');
}
function trimEan(value = '') {
  return String(value).replace(/\D/g, '').slice(0, 14);
}
function renderAllergenChecklist(selected = []) {
  const container = document.getElementById('allergenChecklist');
  if (!container) return;
  const selectedSet = new Set(selected || []);
  container.innerHTML = ALLERGENS.map(name => `
    <label class="checkbox-line"><input type="checkbox" value="${escapeHtml(name)}" ${selectedSet.has(name) ? 'checked' : ''}/> ${escapeHtml(name)}</label>
  `).join('');
}
function fillNutritionFields(nutrition = {}) {
  NUTRITION_FIELDS.forEach(key => {
    const el = document.getElementById(`nutrition${key.charAt(0).toUpperCase()}${key.slice(1)}`);
    if (el) el.value = Number(nutrition[key] || 0) || '';
  });
}
function readNutritionFields() {
  return {
    calories: Number(document.getElementById('nutritionCalories').value || 0),
    fat: Number(document.getElementById('nutritionFat').value || 0),
    saturatedFat: Number(document.getElementById('nutritionSaturatedFat').value || 0),
    carbs: Number(document.getElementById('nutritionCarbs').value || 0),
    sugars: Number(document.getElementById('nutritionSugars').value || 0),
    protein: Number(document.getElementById('nutritionProtein').value || 0),
    fiber: Number(document.getElementById('nutritionFiber').value || 0),
    salt: Number(document.getElementById('nutritionSalt').value || 0)
  };
}
function readSelectedAllergens() {
  return [...document.querySelectorAll('#allergenChecklist input[type="checkbox"]:checked')].map(el => el.value);
}
function formatAllergens(ingredient) {
  return ingredient.allergens?.length ? ingredient.allergens.join(', ') : '—';
}
function setEANStatus(message, tone = 'muted') {
  const el = document.getElementById('eanScanStatus');
  if (!el) return;
  el.className = `${tone} scan-status`;
  el.textContent = message;
}
function setScannerFeedback(message, tone = 'muted') {
  const el = document.getElementById('scannerFeedback');
  if (!el) return;
  el.innerHTML = `<span class="${tone}">${escapeHtml(message)}</span>`;
}
function computeUnitCosts(offer) {
  const qty = Number(offer?.purchaseQty || 0);
  const ht = Number(offer?.purchasePrice || 0);
  const vatRate = Number(offer?.vatRate || 0);
  const ttc = ht * (1 + vatRate / 100);
  return {
    unitHt: qty ? ht / qty : 0,
    unitTtc: qty ? ttc / qty : 0,
    totalTtc: ttc
  };
}
function getDefaultOffer(ingredient) {
  if (!ingredient?.offers?.length) return null;
  return ingredient.offers.find(o => o.isDefault) || ingredient.offers[0];
}
function costPerBaseUnit(ingredient) {
  return computeUnitCosts(getDefaultOffer(ingredient)).unitHt;
}
function getIngredient(id) {
  return state.ingredients.find(i => i.id === id);
}
function getSupplier(id) {
  return state.suppliers.find(s => s.id === id);
}
function supplierName(id) {
  return getSupplier(id)?.name || '—';
}
function syncCategoryMemory() {
  const categories = new Set((state.settings.categoryMemory || []).filter(Boolean));
  state.ingredients.forEach(i => i.category && categories.add(i.category.trim()));
  state.settings.categoryMemory = [...categories].sort((a, b) => a.localeCompare(b, 'fr'));
}
function computeRecipe(recipe) {
  const materialCost = recipe.items.reduce((sum, item) => {
    const ingredient = getIngredient(item.ingredientId);
    if (!ingredient) return sum;
    return sum + costPerBaseUnit(ingredient) * item.quantity;
  }, 0);
  const laborCost = (recipe.laborHours || 0) * state.settings.laborHourlyCost;
  const energyCost = (recipe.energyHours || 0) * state.settings.energyHourlyCost;
  const directCost = materialCost + laborCost + energyCost;
  const overheadCost = directCost * (state.settings.overheadRate / 100);
  const totalCost = directCost + overheadCost;
  const unitCost = recipe.batchYield ? totalCost / recipe.batchYield : 0;
  return { materialCost, laborCost, energyCost, overheadCost, totalCost, unitCost };
}
function backupFileName() {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}-${String(d.getMinutes()).padStart(2, '0')}`;
  return `sauvegarde-app-${stamp}.json`;
}
function makeExportPayload() {
  return JSON.stringify(state, null, 2);
}
function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 250);
  return blob;
}
async function shareBackup(blob, filename) {
  try {
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })) {
      const file = new File([blob], filename, { type: 'application/json' });
      await navigator.share({ files: [file], title: 'Sauvegarde application' });
    }
  } catch {}
}
function markBackup(filename) {
  state.meta.lastBackupAt = new Date().toISOString();
  state.meta.lastBackupName = filename;
  state.meta.backupCount = (state.meta.backupCount || 0) + 1;
  persistState();
  renderBackupStatus();
  renderDashboard();
}
function validateImport(data) {
  if (!data || typeof data !== 'object') throw new Error('Fichier illisible.');
  if (!Array.isArray(data.ingredients) || !Array.isArray(data.recipes) || !data.settings) {
    throw new Error('Le fichier ne ressemble pas à une sauvegarde valide.');
  }
}

function renderAll() {
  renderTabs();
  renderCategoryMemory();
  renderDashboard();
  renderSuppliers();
  renderIngredients();
  renderRecipesList();
  renderRecipeEditor();
  renderProductionSelect();
  renderSettings();
  renderBackupStatus();
  renderInstallHelp();
  queueSave();
}

function renderTabs() {
  document.querySelectorAll('.nav').forEach(btn => btn.onclick = () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
}

function renderCategoryMemory() {
  const datalist = document.getElementById('categorySuggestions');
  if (datalist) {
    datalist.innerHTML = state.settings.categoryMemory.map(cat => `<option value="${escapeHtml(cat)}"></option>`).join('');
  }
}

function renderDashboard() {
  const kpiCards = document.getElementById('kpiCards');
  const recipeCount = state.recipes.length;
  const ingredientCount = state.ingredients.length;
  const supplierCount = state.suppliers.length;
  const avgUnitCost = state.recipes.length ? state.recipes.map(r => computeRecipe(r).unitCost).reduce((a, b) => a + b, 0) / state.recipes.length : 0;
  const daysFromBackup = daysSince(state.meta.lastBackupAt);
  const data = [
    ['Ingrédients suivis', ingredientCount],
    ['Fournisseurs mémorisés', supplierCount],
    ['Recettes actives', recipeCount],
    ['Coût moyen unitaire', euro(avgUnitCost)],
    ['Dernière sauvegarde externe', state.meta.lastBackupAt ? `${daysFromBackup} j` : 'Aucune']
  ];
  kpiCards.innerHTML = data.map(([label, value]) => `<div class="panel kpi"><div class="label">${label}</div><div class="value">${value}</div></div>`).join('');

  const facts = document.getElementById('accountingFacts');
  facts.innerHTML = state.accountingFacts.map(x => `<li>${x}</li>`).join('') || '<li>Aucun repère enregistré.</li>';

  const backupHealth = document.getElementById('backupHealth');
  let badgeClass = 'status-good';
  let headline = 'Vos données sont correctement sécurisées.';
  if (!state.meta.lastBackupAt) {
    badgeClass = 'status-bad';
    headline = 'Aucune sauvegarde externe n’a encore été faite.';
  } else if (daysFromBackup >= BACKUP_WARNING_DAYS) {
    badgeClass = 'status-warn';
    headline = `Votre dernière sauvegarde externe date de ${daysFromBackup} jours.`;
  }

  backupHealth.innerHTML = `
    <p class="${badgeClass}"><strong>${headline}</strong></p>
    <p>Dernier enregistrement local : <strong>${formatDateTime(state.meta.lastLocalSaveAt)}</strong></p>
    <p>Dernière sauvegarde externe : <strong>${formatDateTime(state.meta.lastBackupAt)}</strong></p>
    <p>Nom du dernier fichier : <strong>${state.meta.lastBackupName || 'aucun'}</strong></p>
    <p>Nombre de sauvegardes exportées : <strong>${state.meta.backupCount || 0}</strong></p>
  `;
}

function renderBackupStatus() {
  const el = document.getElementById('saveStatus');
  const backupAge = daysSince(state.meta.lastBackupAt);
  let backupText = 'aucune sauvegarde externe';
  let className = 'status-bad';
  if (state.meta.lastBackupAt && backupAge < BACKUP_WARNING_DAYS) {
    backupText = `sauvegarde externe du ${formatDateTime(state.meta.lastBackupAt)}`;
    className = 'status-good';
  } else if (state.meta.lastBackupAt) {
    backupText = `sauvegarde externe ancienne (${backupAge} jours)`;
    className = 'status-warn';
  }
  el.innerHTML = `Local : <strong>${formatDateTime(state.meta.lastLocalSaveAt)}</strong> • <span class="${className}">${backupText}</span>`;
}

function renderSuppliers() {
  const query = document.getElementById('supplierSearch')?.value?.trim().toLowerCase() || '';
  const rows = state.suppliers
    .filter(s => [s.name, s.contact, s.email, s.phone, s.notes].join(' ').toLowerCase().includes(query))
    .map(s => {
      const linkedIngredients = state.ingredients.filter(i => i.offers.some(o => o.supplierId === s.id)).length;
      return `
        <tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${escapeHtml(s.contact || '')}</td>
          <td>${escapeHtml(s.phone || '')}</td>
          <td>${escapeHtml(s.email || '')}</td>
          <td>${linkedIngredients}</td>
          <td>
            <button onclick="editSupplier('${s.id}')">Modifier</button>
            <button class="danger ghost" onclick="deleteSupplier('${s.id}')">Supprimer</button>
          </td>
        </tr>`;
    }).join('');
  const target = document.getElementById('suppliersTable');
  if (target) target.innerHTML = rows || '<tr><td colspan="6" class="muted">Aucun fournisseur</td></tr>';
}

function renderIngredients() {
  const query = document.getElementById('ingredientSearch').value?.trim().toLowerCase() || '';
  const rows = state.ingredients
    .filter(i => [i.name, i.category, i.ean, supplierName(getDefaultOffer(i)?.supplierId), formatAllergens(i)].join(' ').toLowerCase().includes(query))
    .map(i => {
      const offer = getDefaultOffer(i);
      const costs = computeUnitCosts(offer);
      return `
      <tr>
        <td>${escapeHtml(i.name)}</td>
        <td>${escapeHtml(i.category || '')}</td>
        <td>${escapeHtml(i.ean || '')}</td>
        <td>${escapeHtml(supplierName(offer?.supplierId))}</td>
        <td>${num(offer?.purchaseQty, 3)} ${escapeHtml(i.baseUnit === 'piece' ? 'pièce(s)' : i.baseUnit)}</td>
        <td>${euro(offer?.purchasePrice || 0)} HT</td>
        <td>${legalVatLabel(offer?.vatRate || 0)}</td>
        <td>${euro(costs.unitHt)} / ${unitLabel(i.baseUnit)}</td>
        <td>${euro(costs.unitTtc)} / ${unitLabel(i.baseUnit)}</td>
        <td>${escapeHtml(formatAllergens(i))}</td>
        <td>${i.offers.length}</td>
        <td>
          <button onclick="editIngredient('${i.id}')">Modifier</button>
          <button class="danger ghost" onclick="deleteIngredient('${i.id}')">Supprimer</button>
        </td>
      </tr>`;
    }).join('');
  document.getElementById('ingredientsTable').innerHTML = rows || '<tr><td colspan="12" class="muted">Aucun ingrédient</td></tr>';
}

function renderRecipesList() {
  const container = document.getElementById('recipesList');
  const tpl = document.getElementById('recipeCardTemplate');
  container.innerHTML = '';
  state.recipes.forEach(recipe => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const totals = computeRecipe(recipe);
    node.querySelector('.recipe-name').textContent = recipe.name;
    node.querySelector('.recipe-meta').textContent = `${recipe.batchYield} ${recipe.unitLabel} • coût unitaire ${euro(totals.unitCost)}`;
    node.querySelector('.edit-recipe').onclick = () => {
      currentRecipeId = recipe.id;
      renderAll();
    };
    node.querySelector('.delete-recipe').onclick = () => {
      if (!confirm(`Supprimer la recette « ${recipe.name} » ?`)) return;
      state.recipes = state.recipes.filter(r => r.id !== recipe.id);
      currentRecipeId = state.recipes[0]?.id || null;
      renderAll();
    };
    container.appendChild(node);
  });
  if (!state.recipes.length) container.innerHTML = '<p class="muted">Aucune recette.</p>';
}

function renderRecipeEditor() {
  const wrap = document.getElementById('recipeEditor');
  const recipe = state.recipes.find(r => r.id === currentRecipeId);
  if (!recipe) {
    wrap.innerHTML = '<p class="muted">Créez une recette pour commencer.</p>';
    document.getElementById('recipeEditorTitle').textContent = 'Éditeur recette';
    return;
  }
  const totals = computeRecipe(recipe);
  document.getElementById('recipeEditorTitle').textContent = `Éditeur recette — ${recipe.name}`;
  wrap.innerHTML = `
    <div class="recipe-editor-grid">
      <label>Nom<input id="recipeName" value="${escapeHtml(recipe.name)}" /></label>
      <label>Rendement du lot<input id="recipeYield" type="number" min="1" step="1" value="${recipe.batchYield}" /></label>
      <label>Libellé unité<input id="recipeUnitLabel" value="${escapeHtml(recipe.unitLabel || 'pièces')}" /></label>
      <label>Temps main-d'œuvre (h)<input id="recipeLabor" type="number" min="0" step="0.1" value="${recipe.laborHours || 0}" /></label>
      <label>Temps énergie/four (h)<input id="recipeEnergy" type="number" min="0" step="0.1" value="${recipe.energyHours || 0}" /></label>
      <label>Notes<textarea id="recipeNotes">${escapeHtml(recipe.notes || '')}</textarea></label>

      <div class="subpanel">
        <div class="section-head"><h4>Composition</h4><button onclick="addRecipeLine()">Ajouter une ligne</button></div>
        <div id="recipeLines"></div>
      </div>

      <div class="summary-box small">
        <div>Coût matière : <strong>${euro(totals.materialCost)}</strong></div>
        <div>Main-d'œuvre : <strong>${euro(totals.laborCost)}</strong></div>
        <div>Énergie : <strong>${euro(totals.energyCost)}</strong></div>
        <div>Charges indirectes : <strong>${euro(totals.overheadCost)}</strong></div>
        <div>Coût total lot : <strong>${euro(totals.totalCost)}</strong></div>
        <div>Coût unitaire : <strong>${euro(totals.unitCost)}</strong></div>
      </div>

      <button onclick="saveRecipeEdits()">Enregistrer la recette</button>
    </div>`;

  const lines = document.getElementById('recipeLines');
  recipe.items.forEach((item, index) => {
    const options = state.ingredients.map(i => `<option value="${i.id}" ${i.id === item.ingredientId ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');
    lines.insertAdjacentHTML('beforeend', `
      <div class="ingredient-line">
        <label>Ingrédient<select data-line="${index}" data-field="ingredientId">${options}</select></label>
        <label>Quantité<input data-line="${index}" data-field="quantity" type="number" min="0" step="0.001" value="${item.quantity}" /></label>
        <label>Unité<input data-line="${index}" data-field="unit" value="${escapeHtml(item.unit || '')}" /></label>
        <button class="danger ghost" onclick="removeRecipeLine(${index})">Retirer</button>
      </div>`);
  });
}

function renderProductionSelect() {
  const select = document.getElementById('productionRecipe');
  select.innerHTML = state.recipes.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
}

function renderSettings() {
  document.getElementById('laborHourlyCost').value = state.settings.laborHourlyCost;
  document.getElementById('energyHourlyCost').value = state.settings.energyHourlyCost;
  document.getElementById('overheadRate').value = state.settings.overheadRate;
  const catList = document.getElementById('categoryMemoryList');
  if (catList) {
    catList.innerHTML = state.settings.categoryMemory.length
      ? state.settings.categoryMemory.map(cat => `<span class="chip">${escapeHtml(cat)}</span>`).join('')
      : '<span class="muted">Aucune catégorie mémorisée.</span>';
  }
}

function editSupplier(id) {
  const supplier = getSupplier(id);
  document.getElementById('supplierDialogTitle').textContent = 'Modifier un fournisseur';
  document.getElementById('supplierId').value = supplier.id;
  document.getElementById('supplierName').value = supplier.name;
  document.getElementById('supplierContact').value = supplier.contact || '';
  document.getElementById('supplierPhone').value = supplier.phone || '';
  document.getElementById('supplierEmail').value = supplier.email || '';
  document.getElementById('supplierNotes').value = supplier.notes || '';
  document.getElementById('supplierDialog').showModal();
  markDialogOpened();
}
function deleteSupplier(id) {
  const used = state.ingredients.some(i => i.offers.some(o => o.supplierId === id));
  if (used) return alert('Impossible : ce fournisseur est rattaché à au moins une offre d’achat.');
  state.suppliers = state.suppliers.filter(s => s.id !== id);
  renderAll();
}


function resetIngredientSections() {
  const blocks=[...document.querySelectorAll('#ingredientForm .expand-block')];
  blocks.forEach((block, index) => { block.open = index === 0 || index === 1; });
}

function renderSupplierOptions(selectedId = '') {
  return `<option value="">Sélectionner</option>` + state.suppliers.map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('');
}

function editIngredient(id) {
  const ingredient = state.ingredients.find(i => i.id === id);
  document.getElementById('ingredientDialogTitle').textContent = 'Modifier un ingrédient';
  document.getElementById('ingredientId').value = ingredient.id;
  document.getElementById('ingredientName').value = ingredient.name;
  document.getElementById('ingredientCategory').value = ingredient.category || '';
  document.getElementById('ingredientEAN').value = ingredient.ean || '';
  document.getElementById('ingredientBaseUnit').value = ingredient.baseUnit;
  fillNutritionFields(ingredient.nutrition || {});
  renderAllergenChecklist(ingredient.allergens || []);
  setEANStatus(ingredient.ean ? `EAN enregistré : ${ingredient.ean}` : 'Aucun scan en cours.');
  pendingScannedCode = '';
  renderOfferLines(ingredient.offers);
  resetIngredientSections();
  document.getElementById('ingredientDialog').showModal();
}
function deleteIngredient(id) {
  const used = state.recipes.some(r => r.items.some(item => item.ingredientId === id));
  if (used) return alert('Impossible : cet ingrédient est utilisé dans au moins une recette.');
  state.ingredients = state.ingredients.filter(i => i.id !== id);
  renderAll();
}

function makeOfferRow(offer = {}) {
  const row = document.createElement('div');
  row.className = 'offer-line';
  row.innerHTML = `
    <label>Fournisseur<select data-field="supplierId">${renderSupplierOptions(offer.supplierId || '')}</select></label>
    <label>Réf. four.<input data-field="supplierRef" value="${escapeHtml(offer.supplierRef || '')}" placeholder="Référence / code" /></label>
    <label>Unité achat<input data-field="purchaseUnit" value="${escapeHtml(offer.purchaseUnit || '')}" placeholder="sac, carton..." /></label>
    <label>Qté achetée<input data-field="purchaseQty" type="number" min="0" step="0.001" value="${offer.purchaseQty ?? ''}" /></label>
    <label>Prix achat HT (€)<input data-field="purchasePrice" type="number" min="0" step="0.01" value="${offer.purchasePrice ?? ''}" /></label>
    <label>TVA<select data-field="vatRate">${renderVatOptions(offer.vatRate ?? 5.5)}</select></label>
    <label class="default-toggle"><input data-field="isDefault" type="radio" name="defaultOffer" ${offer.isDefault ? 'checked' : ''} /> Offre par défaut</label>
    <div class="offer-summary muted" data-summary></div>
    <button type="button" class="danger ghost" data-remove>Retirer</button>
  `;
  row.querySelectorAll('input, select').forEach(el => el.addEventListener('input', () => updateOfferRowSummary(row)));
  row.querySelector('[data-remove]').addEventListener('click', () => {
    row.remove();
    ensureOneDefaultOffer();
    updateAllOfferSummaries();
  });
  row.querySelector('[data-field="isDefault"]').addEventListener('change', () => ensureOneDefaultOffer(row));
  updateOfferRowSummary(row);
  return row;
}

function updateOfferRowSummary(row) {
  const offer = readOfferRow(row);
  const costs = computeUnitCosts(offer);
  const summary = row.querySelector('[data-summary]');
  summary.innerHTML = `Coût auto : <strong>${euro(costs.unitHt)}</strong> HT / ${unitLabel(document.getElementById('ingredientBaseUnit').value)} • <strong>${euro(costs.unitTtc)}</strong> TTC / ${unitLabel(document.getElementById('ingredientBaseUnit').value)} • total TTC ${euro(costs.totalTtc)}`;
}

function updateAllOfferSummaries() {
  document.querySelectorAll('#ingredientOffers .offer-line').forEach(updateOfferRowSummary);
}

function ensureOneDefaultOffer(preferredRow = null) {
  const radios = [...document.querySelectorAll('#ingredientOffers [data-field="isDefault"]')];
  if (!radios.length) return;
  if (preferredRow) {
    radios.forEach(r => { if (r !== preferredRow.querySelector('[data-field="isDefault"]')) r.checked = false; });
  }
  if (!radios.some(r => r.checked)) radios[0].checked = true;
}

function readOfferRow(row) {
  return {
    id: row.dataset.id || crypto.randomUUID(),
    supplierId: row.querySelector('[data-field="supplierId"]').value,
    supplierRef: row.querySelector('[data-field="supplierRef"]').value.trim(),
    purchaseUnit: row.querySelector('[data-field="purchaseUnit"]').value.trim(),
    purchaseQty: Number(row.querySelector('[data-field="purchaseQty"]').value || 0),
    purchasePrice: Number(row.querySelector('[data-field="purchasePrice"]').value || 0),
    vatRate: Number(row.querySelector('[data-field="vatRate"]').value || 0),
    isDefault: row.querySelector('[data-field="isDefault"]').checked
  };
}

function renderOfferLines(offers = []) {
  const container = document.getElementById('ingredientOffers');
  container.innerHTML = '';
  const safeOffers = offers.length ? offers : [normalizeOffer({ isDefault: true })];
  safeOffers.forEach(offer => {
    const row = makeOfferRow(offer);
    row.dataset.id = offer.id || crypto.randomUUID();
    container.appendChild(row);
  });
  ensureOneDefaultOffer();
  updateAllOfferSummaries();
}


async function openScannerDialog() {
  const dialog = document.getElementById('scannerDialog');
  const reader = document.getElementById('scannerReader');
  if (!dialog || !reader) return;
  pendingScannedCode = '';
  setScannerFeedback('Autorisez l’accès caméra puis visez le code-barres.', 'muted');
  try {
    if (!dialog.open) {
      const ingredientDialog = document.getElementById('ingredientDialog');
      if (ingredientDialog?.open) {
        dialog.show();
      } else {
        dialog.showModal();
      }
      markDialogOpened();
    }
  } catch {
    try { dialog.setAttribute('open', 'open'); markDialogOpened(); } catch {}
  }

  if (!window.Html5Qrcode || !reader) {
    setScannerFeedback('Le lecteur caméra n’est pas disponible ici. Saisissez l’EAN manuellement.', 'status-bad');
    return;
  }

  try {
    reader.innerHTML = '';
    if (html5QrInstance) {
      try {
        const state = html5QrInstance.getState?.();
        if (state === 2 || state === 1) await html5QrInstance.stop();
        await html5QrInstance.clear();
      } catch {}
      html5QrInstance = null;
    }
    html5QrInstance = new Html5Qrcode('scannerReader');
    isScannerRunning = true;
    const config = {
      fps: 12,
      qrbox: (w, h) => {
        const scanWidth = Math.max(220, Math.floor(Math.min(w * 0.88, 420)));
        const scanHeight = Math.floor(scanWidth * 0.55);
        return { width: scanWidth, height: scanHeight };
      },
      aspectRatio: 1.333,
      disableFlip: false,
      rememberLastUsedCamera: true,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128
      ],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true }
    };

    const onDecode = (decodedText) => {
      const code = trimEan(decodedText || '');
      if (code && code.length >= 8) handleScannedCode(code);
    };

    try {
      await html5QrInstance.start({ facingMode: { exact: 'environment' } }, config, onDecode, () => {});
    } catch {
      await html5QrInstance.start({ facingMode: 'environment' }, config, onDecode, () => {});
    }
  } catch (error) {
    isScannerRunning = false;
    setScannerFeedback('Impossible de démarrer le scanner caméra. Saisissez l’EAN manuellement.', 'status-bad');
  }
}

async function stopScanner() {
  isScannerRunning = false;
  if (scannerAnimationFrame) cancelAnimationFrame(scannerAnimationFrame);
  scannerAnimationFrame = null;
  if (html5QrInstance) {
    try {
      const state = html5QrInstance.getState?.();
      if (state === 2 || state === 1) await html5QrInstance.stop();
      await html5QrInstance.clear();
    } catch {}
    html5QrInstance = null;
  }
  const reader = document.getElementById('scannerReader');
  if (reader) reader.innerHTML = '';
}

function handleScannedCode(code) {

  if (!pendingScannedCode) {
    pendingScannedCode = code;
    setScannerFeedback(`Premier scan détecté : ${code}. Scannez une seconde fois pour vérifier.`, 'status-warn');
    setEANStatus(`Premier scan détecté : ${code}. En attente de vérification.`, 'status-warn');
    return;
  }
  if (pendingScannedCode !== code) {
    setScannerFeedback(`Le second scan (${code}) ne correspond pas au premier (${pendingScannedCode}). Recommencez.`, 'status-bad');
    setEANStatus('Les deux scans ne correspondent pas. Recommencez.', 'status-bad');
    pendingScannedCode = '';
    return;
  }
  document.getElementById('ingredientEAN').value = code;
  setScannerFeedback(`EAN validé : ${code}`, 'status-good');
  setEANStatus(`EAN validé par double scan : ${code}`, 'status-good');
  const scannerDialog = document.getElementById('scannerDialog');
  if (scannerDialog?.open) { try { scannerDialog.close(); } catch { scannerDialog.removeAttribute('open'); } markDialogClosed(); }
  stopScanner();
}



document.getElementById('addSupplierBtn').addEventListener('click', () => {
  document.getElementById('supplierDialogTitle').textContent = 'Ajouter un fournisseur';
  document.getElementById('supplierId').value = '';
  document.getElementById('supplierName').value = '';
  document.getElementById('supplierContact').value = '';
  document.getElementById('supplierPhone').value = '';
  document.getElementById('supplierEmail').value = '';
  document.getElementById('supplierNotes').value = '';
  document.getElementById('supplierDialog').showModal();
  markDialogOpened();
});

document.getElementById('supplierForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const payload = {
    id: document.getElementById('supplierId').value || crypto.randomUUID(),
    name: document.getElementById('supplierName').value.trim(),
    contact: document.getElementById('supplierContact').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    email: document.getElementById('supplierEmail').value.trim(),
    notes: document.getElementById('supplierNotes').value.trim()
  };
  if (!payload.name) {
    alert('Renseignez le nom du fournisseur.');
    return;
  }
  const idx = state.suppliers.findIndex(s => s.id === payload.id);
  if (idx >= 0) state.suppliers[idx] = payload; else state.suppliers.push(payload);
  document.getElementById('supplierDialog').close();
  markDialogClosed();
  renderAll();
});

function openIngredientDialog() {
  const dialog = document.getElementById('ingredientDialog');
  if (!dialog) return;
  try {
    document.getElementById('ingredientDialogTitle').textContent = 'Ajouter un ingrédient';
    document.getElementById('ingredientId').value = '';
    document.getElementById('ingredientName').value = '';
    document.getElementById('ingredientCategory').value = '';
    document.getElementById('ingredientEAN').value = '';
    document.getElementById('ingredientBaseUnit').value = 'kg';
    try { fillNutritionFields({}); } catch {}
    try { renderAllergenChecklist([]); } catch {}
    try { setEANStatus('Aucun scan en cours.'); } catch {}
    pendingScannedCode = '';
    try { renderOfferLines([normalizeOffer({ vatRate: 5.5, isDefault: true })]); } catch {
      const offers = document.getElementById('ingredientOffers');
      if (offers) offers.innerHTML = '';
    }
    try { resetIngredientSections(); } catch {}
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) { dialog.showModal(); markDialogOpened(); }
    } else {
      dialog.setAttribute('open', 'open');
      markDialogOpened();
    }
  } catch (error) {
    console.error('openIngredientDialog failed', error);
    alert('Impossible d’ouvrir le formulaire ingrédient. Rechargez la page puis réessayez.');
  }
}
window.__openIngredientDialog = openIngredientDialog;
const addIngredientBtn = document.getElementById('addIngredientBtn');
if (addIngredientBtn) {
  addIngredientBtn.addEventListener('click', openIngredientDialog);
  addIngredientBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    openIngredientDialog();
  }, { passive: false });
}


const scanEANBtn = document.getElementById('scanEANBtn');
if (scanEANBtn) {
  scanEANBtn.addEventListener('click', openScannerDialog);
  scanEANBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    openScannerDialog();
  }, { passive: false });
}
const clearEANBtn = document.getElementById('clearEANBtn');
if (clearEANBtn) {
  clearEANBtn.addEventListener('click', () => {
    const input = document.getElementById('ingredientEAN');
    if (input) input.value = '';
    pendingScannedCode = '';
    setEANStatus('EAN effacé.');
  });
}
const closeScannerBtn = document.getElementById('closeScannerBtn');
if (closeScannerBtn) {
  closeScannerBtn.addEventListener('click', async () => {
    const dialog = document.getElementById('scannerDialog');
    await stopScanner();
    if (dialog?.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } markDialogClosed(); }
  });
}
const scannerDialogEl = document.getElementById('scannerDialog');
if (scannerDialogEl) {
  scannerDialogEl.addEventListener('close', () => { stopScanner(); markDialogClosed(); });
  scannerDialogEl.addEventListener('cancel', (e) => { e.preventDefault(); stopScanner().then(() => { try { scannerDialogEl.close(); } catch { scannerDialogEl.removeAttribute('open'); } markDialogClosed(); }); });
}

['ingredientDialog','supplierDialog'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('close', () => { markDialogClosed(); });
  el.addEventListener('cancel', (e) => { e.preventDefault(); try { el.close(); } catch { el.removeAttribute('open'); } markDialogClosed(); });
});

document.querySelectorAll('dialog .modal-form').forEach((el) => {
  el.addEventListener('touchmove', (event) => { event.stopPropagation(); }, { passive: true });
});

document.getElementById('addOfferBtn').addEventListener('click', () => {
  document.getElementById('ingredientOffers').appendChild(makeOfferRow(normalizeOffer({ vatRate: 5.5 })));
  ensureOneDefaultOffer();
  updateAllOfferSummaries();
});
document.getElementById('ingredientBaseUnit').addEventListener('change', updateAllOfferSummaries);
document.getElementById('ingredientForm').addEventListener('submit', e => {
  e.preventDefault();
  const offers = [...document.querySelectorAll('#ingredientOffers .offer-line')].map(readOfferRow).filter(o => o.purchaseQty || o.purchasePrice || o.purchaseUnit || o.supplierId || o.supplierRef);
  if (!offers.length) {
    alert('Ajoutez au moins une offre fournisseur pour cet ingrédient.');
    return;
  }
  if (!offers.some(o => o.isDefault)) offers[0].isDefault = true;
  const payload = normalizeIngredient({
    id: document.getElementById('ingredientId').value || crypto.randomUUID(),
    name: document.getElementById('ingredientName').value.trim(),
    category: document.getElementById('ingredientCategory').value.trim(),
    ean: trimEan(document.getElementById('ingredientEAN').value),
    baseUnit: document.getElementById('ingredientBaseUnit').value,
    nutrition: readNutritionFields(),
    allergens: readSelectedAllergens(),
    offers
  });
  const idx = state.ingredients.findIndex(i => i.id === payload.id);
  if (idx >= 0) state.ingredients[idx] = payload; else state.ingredients.push(payload);
  document.getElementById('ingredientDialog').close();
  markDialogClosed();
  renderAll();
});

document.getElementById('addRecipeBtn').addEventListener('click', () => {
  const recipe = {
    id: crypto.randomUUID(),
    name: 'Nouvelle recette',
    batchYield: 1,
    unitLabel: 'pièces',
    laborHours: 0,
    energyHours: 0,
    notes: '',
    items: []
  };
  state.recipes.push(recipe);
  currentRecipeId = recipe.id;
  renderAll();
});

document.getElementById('simulateBtn').addEventListener('click', () => {
  const recipe = state.recipes.find(r => r.id === document.getElementById('productionRecipe').value);
  if (!recipe) return;
  const lots = Number(document.getElementById('productionLots').value || 1);
  const sellingPrice = Number(document.getElementById('sellingPrice').value || 0);
  const totals = computeRecipe(recipe);
  const totalUnits = recipe.batchYield * lots;
  const totalCost = totals.totalCost * lots;
  const revenue = totalUnits * sellingPrice;
  const grossMargin = revenue - totalCost;
  const marginRate = revenue ? (grossMargin / revenue) * 100 : 0;
  document.getElementById('simulationResult').innerHTML = `
    <p><strong>Recette :</strong> ${escapeHtml(recipe.name)}</p>
    <p><strong>Lots :</strong> ${lots}</p>
    <p><strong>Production totale :</strong> ${totalUnits} ${escapeHtml(recipe.unitLabel)}</p>
    <hr />
    <p><strong>Coût matière total :</strong> ${euro(totals.materialCost * lots)}</p>
    <p><strong>Coût complet total :</strong> ${euro(totalCost)}</p>
    <p><strong>Coût unitaire :</strong> ${euro(totals.unitCost)}</p>
    <p><strong>CA théorique :</strong> ${euro(revenue)}</p>
    <p><strong>Marge brute théorique :</strong> ${euro(grossMargin)}</p>
    <p><strong>Taux de marge :</strong> ${num(marginRate, 1)} %</p>`;
});

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  state.settings.laborHourlyCost = Number(document.getElementById('laborHourlyCost').value || 0);
  state.settings.energyHourlyCost = Number(document.getElementById('energyHourlyCost').value || 0);
  state.settings.overheadRate = Number(document.getElementById('overheadRate').value || 0);
  renderAll();
});

document.getElementById('exportBtn').addEventListener('click', () => {
  downloadTextFile(makeExportPayload(), 'app-export.json');
});

document.getElementById('backupBtn').addEventListener('click', async () => {
  const filename = backupFileName();
  const blob = downloadTextFile(makeExportPayload(), filename);
  markBackup(filename);
  await shareBackup(blob, filename);
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const imported = JSON.parse(text);
    validateImport(imported);
    state = normalizeState(imported);
    currentRecipeId = state.recipes[0]?.id || null;
    state.meta.lastBackupAt = new Date().toISOString();
    state.meta.lastBackupName = file.name;
    renderAll();
    alert('Sauvegarde restaurée avec succès.');
  } catch (error) {
    alert(error.message || 'Impossible d’importer ce fichier.');
  } finally {
    e.target.value = '';
  }
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Réinitialiser toutes les données locales ? Pensez à faire une sauvegarde complète avant.')) return;
  state = normalizeState(seedData);
  currentRecipeId = state.recipes[0]?.id || null;
  renderAll();
});


const cancelIngredientBtn = document.getElementById('cancelIngredientBtn');
if (cancelIngredientBtn) cancelIngredientBtn.addEventListener('click', () => {
  const dialog = document.getElementById('ingredientDialog');
  if (dialog?.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } markDialogClosed(); }
});
const cancelSupplierBtn = document.getElementById('cancelSupplierBtn');
if (cancelSupplierBtn) cancelSupplierBtn.addEventListener('click', () => {
  const dialog = document.getElementById('supplierDialog');
  if (dialog?.open) { try { dialog.close(); } catch { dialog.removeAttribute('open'); } markDialogClosed(); }
});

window.addEventListener('beforeunload', () => {
  clearTimeout(saveTimer);
  persistState();
});

renderAll();
renderVersionBadges();
installPullToRefresh();
syncModalState();

function renderVersionBadges() {
  const versionText = `Version ${APP_VERSION}`;
  const badge = document.getElementById('appVersionBadge');
  const footer = document.getElementById('appVersionFooter');
  if (badge) badge.textContent = versionText;
  if (footer) footer.textContent = APP_VERSION;
}

function renderInstallHelp() {
  const el = document.getElementById('installHelp');
  if (!el) return;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isStandalone) {
    el.innerHTML = '<p class="status-good"><strong>L’application est installée sur cet appareil.</strong></p><p>Vos données restent sur cet appareil. Pensez à faire une sauvegarde complète régulière.</p>';
    return;
  }
  if (isIOS) {
    el.innerHTML = '<p><strong>Pour l’installer sur iPhone :</strong></p><ol><li>Ouvrez cette page dans <strong>Safari</strong>.</li><li>Appuyez sur <strong>Partager</strong>.</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>.</li></ol><p class="muted">Ensuite, l’app s’ouvrira comme une vraie appli plein écran.</p>';
  } else {
    el.innerHTML = '<p><strong>Installation :</strong> ouvrez le menu du navigateur puis choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</p>';
  }
}


function setPullRefreshState(text, stateClass = '') {
  const indicator = document.getElementById('pullRefreshIndicator');
  const label = document.getElementById('pullRefreshText');
  if (!indicator || !label) return;
  label.textContent = text;
  indicator.className = 'pull-refresh-indicator visible' + (stateClass ? ` ${stateClass}` : '');
}
function hidePullRefreshState() {
  const indicator = document.getElementById('pullRefreshIndicator');
  if (!indicator) return;
  indicator.className = 'pull-refresh-indicator';
}
async function forceAppRefresh() {
  setPullRefreshState('Actualisation de l’application…', 'loading');
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.update().catch(() => {})));
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_APP_CACHE' });
      }
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch {}
  const bust = `v=${encodeURIComponent(APP_VERSION)}&r=${Date.now()}`;
  const clean = `${location.pathname}?${bust}${location.hash || ''}`;
  location.replace(clean);
}
function installPullToRefresh() {
  let startY = 0;
  let deltaY = 0;
  let tracking = false;
  let active = false;
  const threshold = 84;
  const maxPull = 130;
  const isAtTop = () => (window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0) <= 0;
  document.addEventListener('touchstart', (event) => {
    if (!isAtTop() || event.touches.length !== 1 || isAnyDialogOpen()) return;
    startY = event.touches[0].clientY;
    deltaY = 0;
    tracking = true;
    active = false;
  }, { passive: true });
  document.addEventListener('touchmove', (event) => {
    if (!tracking || isAnyDialogOpen()) return;
    const currentY = event.touches[0].clientY;
    deltaY = Math.max(0, currentY - startY);
    if (deltaY < 12) return;
    if (!isAtTop()) {
      tracking = false;
      hidePullRefreshState();
      return;
    }
    active = true;
    const progress = Math.min(deltaY, maxPull);
    if (progress >= threshold) {
      setPullRefreshState('Relâchez pour mettre à jour', 'ready');
    } else {
      setPullRefreshState('Tirez vers le bas pour actualiser');
    }
    event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', () => {
    if (!tracking && !active) return;
    const shouldRefresh = deltaY >= threshold && isAtTop() && !isAnyDialogOpen();
    tracking = false;
    active = false;
    if (shouldRefresh) {
      forceAppRefresh();
      return;
    }
    hidePullRefreshState();
  }, { passive: true });
  document.addEventListener('touchcancel', () => {
    tracking = false;
    active = false;
    hidePullRefreshState();
  }, { passive: true });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

window.addEventListener('appinstalled', () => {
  renderInstallHelp();
});


if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'CACHE_CLEARED') {
      setPullRefreshState('Cache vidé, rechargement…', 'loading');
    }
  });
}
