const STORAGE_KEY = 'pilotage-production-vierge-v2';
const BACKUP_WARNING_DAYS = 7;
const APP_VERSION = '3.2-ultra-blank-pwa';

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
    overheadRate: 0
  },
  accountingFacts: [],
  ingredients: [],
  recipes: []
};

let state = loadState();
let currentRecipeId = state.recipes[0]?.id || null;
let saveTimer = null;

function normalizeState(candidate) {
  const merged = structuredClone(seedData);
  if (!candidate || typeof candidate !== 'object') return merged;

  merged.settings = { ...merged.settings, ...(candidate.settings || {}) };
  merged.accountingFacts = Array.isArray(candidate.accountingFacts) ? candidate.accountingFacts : merged.accountingFacts;
  merged.ingredients = Array.isArray(candidate.ingredients) ? candidate.ingredients : merged.ingredients;
  merged.recipes = Array.isArray(candidate.recipes) ? candidate.recipes : merged.recipes;
  merged.meta = { ...merged.meta, ...(candidate.meta || {}) };

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
function costPerBaseUnit(ingredient) {
  return ingredient.purchaseQty ? ingredient.purchasePrice / ingredient.purchaseQty : 0;
}
function getIngredient(id) {
  return state.ingredients.find(i => i.id === id);
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
  } catch {
    // download already done; sharing is optional
  }
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
  renderDashboard();
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

function renderDashboard() {
  const kpiCards = document.getElementById('kpiCards');
  const recipeCount = state.recipes.length;
  const ingredientCount = state.ingredients.length;
  const avgUnitCost = state.recipes.length ? state.recipes.map(r => computeRecipe(r).unitCost).reduce((a, b) => a + b, 0) / state.recipes.length : 0;
  const daysFromBackup = daysSince(state.meta.lastBackupAt);
  const data = [
    ['Ingrédients suivis', ingredientCount],
    ['Recettes actives', recipeCount],
    ['Coût moyen unitaire', euro(avgUnitCost)],
    ['Dernière sauvegarde externe', state.meta.lastBackupAt ? `${daysFromBackup} j` : 'Aucune']
  ];
  kpiCards.innerHTML = data.map(([label, value]) => `
    <div class="panel kpi">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join('');

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

function renderIngredients() {
  const query = document.getElementById('ingredientSearch').value?.trim().toLowerCase() || '';
  const rows = state.ingredients
    .filter(i => [i.name, i.category].join(' ').toLowerCase().includes(query))
    .map(i => `
      <tr>
        <td>${escapeHtml(i.name)}</td>
        <td>${escapeHtml(i.category || '')}</td>
        <td>${escapeHtml(i.purchaseUnit || '')}</td>
        <td>${num(i.purchaseQty, 3)} ${i.baseUnit}</td>
        <td>${euro(i.purchasePrice)}</td>
        <td>${euro(costPerBaseUnit(i))} / ${i.baseUnit}</td>
        <td>
          <button onclick="editIngredient('${i.id}')">Modifier</button>
          <button class="danger ghost" onclick="deleteIngredient('${i.id}')">Supprimer</button>
        </td>
      </tr>
    `).join('');
  document.getElementById('ingredientsTable').innerHTML = rows || '<tr><td colspan="7" class="muted">Aucun ingrédient</td></tr>';
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
    node.querySelector('.edit-recipe').onclick = () => { currentRecipeId = recipe.id; renderRecipeEditor(); queueSave(); };
    node.querySelector('.delete-recipe').onclick = () => {
      if (!confirm(`Supprimer la recette « ${recipe.name} » ?`)) return;
      state.recipes = state.recipes.filter(r => r.id !== recipe.id);
      if (currentRecipeId === recipe.id) currentRecipeId = state.recipes[0]?.id || null;
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
    </div>
  `;

  const lines = document.getElementById('recipeLines');
  recipe.items.forEach((item, index) => {
    const options = state.ingredients.map(i => `<option value="${i.id}" ${i.id === item.ingredientId ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');
    lines.insertAdjacentHTML('beforeend', `
      <div class="ingredient-line">
        <label>Ingrédient<select data-line="${index}" data-field="ingredientId">${options}</select></label>
        <label>Quantité<input data-line="${index}" data-field="quantity" type="number" min="0" step="0.001" value="${item.quantity}" /></label>
        <label>Unité<input data-line="${index}" data-field="unit" value="${escapeHtml(item.unit || '')}" /></label>
        <button class="danger ghost" onclick="removeRecipeLine(${index})">Retirer</button>
      </div>
    `);
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
}

function editIngredient(id) {
  const ingredient = state.ingredients.find(i => i.id === id);
  document.getElementById('ingredientDialogTitle').textContent = 'Modifier un ingrédient';
  document.getElementById('ingredientId').value = ingredient.id;
  document.getElementById('ingredientName').value = ingredient.name;
  document.getElementById('ingredientCategory').value = ingredient.category || '';
  document.getElementById('ingredientBaseUnit').value = ingredient.baseUnit;
  document.getElementById('ingredientPurchaseUnit').value = ingredient.purchaseUnit || '';
  document.getElementById('ingredientPurchaseQty').value = ingredient.purchaseQty;
  document.getElementById('ingredientPurchasePrice').value = ingredient.purchasePrice;
  document.getElementById('ingredientDialog').showModal();
}
function deleteIngredient(id) {
  const used = state.recipes.some(r => r.items.some(item => item.ingredientId === id));
  if (used) return alert('Impossible : cet ingrédient est utilisé dans au moins une recette.');
  state.ingredients = state.ingredients.filter(i => i.id !== id);
  renderAll();
}

function addRecipeLine() {
  const recipe = state.recipes.find(r => r.id === currentRecipeId);
  recipe.items.push({ ingredientId: state.ingredients[0]?.id || '', quantity: 0, unit: state.ingredients[0]?.baseUnit || 'kg' });
  renderRecipeEditor();
  queueSave();
}
function removeRecipeLine(index) {
  const recipe = state.recipes.find(r => r.id === currentRecipeId);
  recipe.items.splice(index, 1);
  renderRecipeEditor();
  queueSave();
}
function saveRecipeEdits() {
  const recipe = state.recipes.find(r => r.id === currentRecipeId);
  recipe.name = document.getElementById('recipeName').value.trim();
  recipe.batchYield = Number(document.getElementById('recipeYield').value || 0);
  recipe.unitLabel = document.getElementById('recipeUnitLabel').value.trim() || 'pièces';
  recipe.laborHours = Number(document.getElementById('recipeLabor').value || 0);
  recipe.energyHours = Number(document.getElementById('recipeEnergy').value || 0);
  recipe.notes = document.getElementById('recipeNotes').value.trim();
  recipe.items = [...document.querySelectorAll('#recipeLines .ingredient-line')].map(line => ({
    ingredientId: line.querySelector('[data-field="ingredientId"]').value,
    quantity: Number(line.querySelector('[data-field="quantity"]').value || 0),
    unit: line.querySelector('[data-field="unit"]').value.trim()
  }));
  renderAll();
}

function escapeHtml(text) {
  return String(text).replace(/[&<>\"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

window.editIngredient = editIngredient;
window.deleteIngredient = deleteIngredient;
window.addRecipeLine = addRecipeLine;
window.removeRecipeLine = removeRecipeLine;
window.saveRecipeEdits = saveRecipeEdits;

document.getElementById('ingredientSearch').addEventListener('input', renderIngredients);
document.getElementById('addIngredientBtn').addEventListener('click', () => {
  document.getElementById('ingredientDialogTitle').textContent = 'Ajouter un ingrédient';
  document.getElementById('ingredientForm').reset();
  document.getElementById('ingredientId').value = '';
  document.getElementById('ingredientDialog').showModal();
});
document.getElementById('cancelIngredientBtn').addEventListener('click', () => document.getElementById('ingredientDialog').close());
document.getElementById('ingredientForm').addEventListener('submit', e => {
  e.preventDefault();
  const payload = {
    id: document.getElementById('ingredientId').value || crypto.randomUUID(),
    name: document.getElementById('ingredientName').value.trim(),
    category: document.getElementById('ingredientCategory').value.trim(),
    baseUnit: document.getElementById('ingredientBaseUnit').value,
    purchaseUnit: document.getElementById('ingredientPurchaseUnit').value.trim(),
    purchaseQty: Number(document.getElementById('ingredientPurchaseQty').value || 0),
    purchasePrice: Number(document.getElementById('ingredientPurchasePrice').value || 0)
  };
  const idx = state.ingredients.findIndex(i => i.id === payload.id);
  if (idx >= 0) state.ingredients[idx] = payload; else state.ingredients.push(payload);
  document.getElementById('ingredientDialog').close();
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
    <p><strong>Taux de marge :</strong> ${num(marginRate, 1)} %</p>
  `;
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

window.addEventListener('beforeunload', () => {
  clearTimeout(saveTimer);
  persistState();
});

renderAll();


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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

window.addEventListener('appinstalled', () => {
  renderInstallHelp();
});
