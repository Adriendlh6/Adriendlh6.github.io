const STORAGE_KEY = 'boulangerie-pilotage-v1';

const seedData = {
  settings: {
    laborHourlyCost: 18,
    energyHourlyCost: 4.5,
    overheadRate: 12
  },
  accountingFacts: [
    'Chiffre d\'affaires HT : 269 393 €',
    'Achats de matières premières : 87 352 €',
    'Autres achats et charges externes : 67 460 €',
    'Salaires : 82 778 €',
    'Cotisations sociales : 9 810 €',
    'Résultat net : 11 098 €',
    'Durée moyenne de rotation des stocks matières : 14 jours'
  ],
  ingredients: [
    { id: crypto.randomUUID(), name: 'Farine T55', category: 'Farine', baseUnit: 'kg', purchaseUnit: 'sac', purchaseQty: 25, purchasePrice: 22.50 },
    { id: crypto.randomUUID(), name: 'Levure boulangère', category: 'Levure', baseUnit: 'kg', purchaseUnit: 'paquet', purchaseQty: 0.5, purchasePrice: 4.80 },
    { id: crypto.randomUUID(), name: 'Sel fin', category: 'Assaisonnement', baseUnit: 'kg', purchaseUnit: 'sac', purchaseQty: 1, purchasePrice: 0.90 },
    { id: crypto.randomUUID(), name: 'Eau', category: 'Liquide', baseUnit: 'l', purchaseUnit: 'm³ estimé', purchaseQty: 1000, purchasePrice: 4.00 },
    { id: crypto.randomUUID(), name: 'Beurre', category: 'Matière grasse', baseUnit: 'kg', purchaseUnit: 'carton', purchaseQty: 5, purchasePrice: 42.00 },
    { id: crypto.randomUUID(), name: 'Sucre', category: 'Épicerie', baseUnit: 'kg', purchaseUnit: 'sac', purchaseQty: 5, purchasePrice: 6.20 },
    { id: crypto.randomUUID(), name: 'Chocolat bâtons', category: 'Viennoiserie', baseUnit: 'piece', purchaseUnit: 'boîte', purchaseQty: 500, purchasePrice: 27.50 }
  ],
  recipes: []
};

seedData.recipes = [
  {
    id: crypto.randomUUID(),
    name: 'Baguette tradition',
    batchYield: 40,
    unitLabel: 'pièces',
    laborHours: 1.4,
    energyHours: 1.1,
    notes: 'Recette exemple à adapter à vos pratiques.',
    items: [
      { ingredientId: seedData.ingredients[0].id, quantity: 5, unit: 'kg' },
      { ingredientId: seedData.ingredients[1].id, quantity: 0.08, unit: 'kg' },
      { ingredientId: seedData.ingredients[2].id, quantity: 0.09, unit: 'kg' },
      { ingredientId: seedData.ingredients[3].id, quantity: 3.3, unit: 'l' }
    ]
  },
  {
    id: crypto.randomUUID(),
    name: 'Pain au chocolat',
    batchYield: 50,
    unitLabel: 'pièces',
    laborHours: 2.2,
    energyHours: 1.3,
    notes: 'Base de simulation incluant beurre et bâtons chocolat.',
    items: [
      { ingredientId: seedData.ingredients[0].id, quantity: 3.8, unit: 'kg' },
      { ingredientId: seedData.ingredients[4].id, quantity: 1.5, unit: 'kg' },
      { ingredientId: seedData.ingredients[5].id, quantity: 0.45, unit: 'kg' },
      { ingredientId: seedData.ingredients[6].id, quantity: 100, unit: 'piece' },
      { ingredientId: seedData.ingredients[1].id, quantity: 0.06, unit: 'kg' },
      { ingredientId: seedData.ingredients[2].id, quantity: 0.05, unit: 'kg' }
    ]
  }
];

let state = loadState();
let currentRecipeId = state.recipes[0]?.id || null;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : structuredClone(seedData);
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function euro(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value || 0);
}
function num(value, digits = 2) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}
function costPerBaseUnit(ingredient) {
  return ingredient.purchasePrice / ingredient.purchaseQty;
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

function renderAll() {
  renderTabs();
  renderDashboard();
  renderIngredients();
  renderRecipesList();
  renderRecipeEditor();
  renderProductionSelect();
  renderSettings();
  saveState();
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
  const data = [
    ['Ingrédients suivis', ingredientCount],
    ['Recettes actives', recipeCount],
    ['Coût moyen unitaire', euro(avgUnitCost)],
    ['Coût horaire MO', euro(state.settings.laborHourlyCost)]
  ];
  kpiCards.innerHTML = data.map(([label, value]) => `
    <div class="panel kpi">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
    </div>
  `).join('');

  const facts = document.getElementById('accountingFacts');
  facts.innerHTML = state.accountingFacts.map(x => `<li>${x}</li>`).join('');
}

function renderIngredients() {
  const query = document.getElementById('ingredientSearch').value?.trim().toLowerCase() || '';
  const rows = state.ingredients
    .filter(i => [i.name, i.category].join(' ').toLowerCase().includes(query))
    .map(i => `
      <tr>
        <td>${i.name}</td>
        <td>${i.category || ''}</td>
        <td>${i.purchaseUnit || ''}</td>
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
    node.querySelector('.edit-recipe').onclick = () => { currentRecipeId = recipe.id; renderRecipeEditor(); };
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
    const options = state.ingredients.map(i => `<option value="${i.id}" ${i.id === item.ingredientId ? 'selected' : ''}>${i.name}</option>`).join('');
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
  select.innerHTML = state.recipes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
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
}
function removeRecipeLine(index) {
  const recipe = state.recipes.find(r => r.id === currentRecipeId);
  recipe.items.splice(index, 1);
  renderRecipeEditor();
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

// events
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
    <p><strong>Recette :</strong> ${recipe.name}</p>
    <p><strong>Lots :</strong> ${lots}</p>
    <p><strong>Production totale :</strong> ${totalUnits} ${recipe.unitLabel}</p>
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
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'boulangerie-pilotage-export.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  state = JSON.parse(text);
  currentRecipeId = state.recipes[0]?.id || null;
  renderAll();
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Réinitialiser toutes les données locales ?')) return;
  state = structuredClone(seedData);
  currentRecipeId = state.recipes[0]?.id || null;
  renderAll();
});

renderAll();
