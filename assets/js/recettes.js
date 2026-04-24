/* Recettes page module */
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
  function esc(s=''){ return String(s ?? '').replace(/[&<>\"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;' }[m])); }
  function num(v){
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const parsed = Number(String(v).replace(/\s+/g,'').replace(',','.').replace(/[^0-9.\-]/g,''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
  function uid(prefix='rec'){ return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }

  let recipes = [];
  let ingredients = [];
  let filters = { search:'', categorie:'', sort:'az' };
  let draft = null;

  function normalizeRecipe(recipe={}){
    return {
      id: recipe.id || uid('rec'),
      nom: recipe.nom || '',
      categorie: recipe.categorie || '',
      portions: Math.max(1, Math.round(num(recipe.portions || 1))),
      uniteSortie: recipe.uniteSortie || 'pièces',
      prixVenteHT: num(recipe.prixVenteHT),
      tva: recipe.tva === undefined || recipe.tva === null || recipe.tva === '' ? 5.5 : num(recipe.tva),
      lignes: Array.isArray(recipe.lignes) ? recipe.lignes.map(normalizeLine) : [],
      note: recipe.note || '',
      archived: Boolean(recipe.archived),
      createdAt: recipe.createdAt || new Date().toISOString(),
      updatedAt: recipe.updatedAt || recipe.createdAt || new Date().toISOString(),
    };
  }

  function normalizeLine(line={}){
    return {
      id: line.id || uid('line'),
      ingredientId: line.ingredientId || '',
      quantite: line.quantite === undefined || line.quantite === null || line.quantite === '' ? '' : line.quantite,
      unite: line.unite || 'g',
    };
  }

  function emptyRecipe(){ return normalizeRecipe({ lignes: [] }); }
  function emptyLine(){ return normalizeLine({ quantite:'', unite:'g' }); }

  function bestUnitPrice(ingredient){
    const offers = Array.isArray(ingredient?.offres) ? ingredient.offres : [];
    const primary = offers.find(o => o && o.sourcePrincipale && num(o.prixHTUnite) > 0);
    if (primary) return num(primary.prixHTUnite);
    const prices = offers.map(o => num(o?.prixHTUnite)).filter(v => v > 0);
    return prices.length ? Math.min(...prices) : 0;
  }

  function quantityToBase(quantity, unit, ingredient){
    const q = num(quantity);
    const base = String(ingredient?.uniteBase || 'kg').toLowerCase();
    const u = String(unit || '').toLowerCase();
    if (!q) return 0;
    if (base === 'kg') {
      if (u === 'kg') return q;
      if (u === 'g') return q / 1000;
      if (u === 'mg') return q / 1000000;
    }
    if (base === 'l') {
      if (u === 'l') return q;
      if (u === 'ml') return q / 1000;
      if (u === 'cl') return q / 100;
    }
    return q;
  }

  function ingredientById(id){ return ingredients.find(item => String(item.id) === String(id)); }

  function computeRecipe(recipe){
    const lines = (recipe.lignes || []).map(line => {
      const ingredient = ingredientById(line.ingredientId);
      const unitPrice = bestUnitPrice(ingredient);
      const baseQty = quantityToBase(line.quantite, line.unite, ingredient);
      const cost = unitPrice * baseQty;
      return { line, ingredient, unitPrice, baseQty, cost };
    });
    const totalHT = lines.reduce((sum, row) => sum + row.cost, 0);
    const portions = Math.max(1, num(recipe.portions || 1));
    const costPerPortion = totalHT / portions;
    const pvHT = num(recipe.prixVenteHT);
    const pvTTC = pvHT * (1 + num(recipe.tva) / 100);
    const marginHT = pvHT ? pvHT - costPerPortion : 0;
    const marginRate = pvHT ? (marginHT / pvHT) * 100 : 0;
    return { lines, totalHT, portions, costPerPortion, pvHT, pvTTC, marginHT, marginRate };
  }

  function recipeCategories(){
    return [...new Set(recipes.map(r => String(r.categorie || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
  }

  function getFilteredRecipes(){
    const q = filters.search.trim().toLowerCase();
    let rows = recipes.filter(recipe => !recipe.archived).filter(recipe => {
      const haystack = [recipe.nom, recipe.categorie, recipe.note].join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesCat = !filters.categorie || recipe.categorie === filters.categorie;
      return matchesSearch && matchesCat;
    });
    rows.sort((a,b) => {
      if (filters.sort === 'cost-asc') return computeRecipe(a).costPerPortion - computeRecipe(b).costPerPortion;
      if (filters.sort === 'cost-desc') return computeRecipe(b).costPerPortion - computeRecipe(a).costPerPortion;
      if (filters.sort === 'updated-desc') return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
    });
    return rows;
  }

  function renderCategoryOptions(){
    const select = qs('#recipes-filter-category');
    const list = qs('#recipe-category-list');
    const categories = recipeCategories();
    if (select) {
      select.innerHTML = `<option value="">Toutes les catégories</option>` + categories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
      select.value = filters.categorie;
    }
    if (list) list.innerHTML = categories.map(cat => `<option value="${esc(cat)}"></option>`).join('');
  }

  function renderList(){
    renderCategoryOptions();
    const list = qs('#recipes-list');
    const empty = qs('#recipes-empty');
    if (!list || !empty) return;
    const rows = getFilteredRecipes();
    empty.classList.toggle('hidden', rows.length > 0);
    list.innerHTML = rows.map(recipe => {
      const computed = computeRecipe(recipe);
      return `<article class="recipe-card" data-recipe-id="${esc(recipe.id)}" role="button" tabindex="0">
        <div class="recipe-card-main">
          <div class="recipe-card-title-row">
            <h3>${esc(recipe.nom || 'Recette sans nom')}</h3>
            <strong>${euro(computed.costPerPortion)} HT</strong>
          </div>
          <div class="recipe-card-meta">
            <span class="recipe-chip">${esc(recipe.categorie || 'Sans catégorie')}</span>
            <span>${esc(recipe.portions)} ${esc(recipe.uniteSortie || 'portion(s)')}</span>
          </div>
        </div>
        <span class="recipe-card-arrow">›</span>
      </article>`;
    }).join('');
    qsa('[data-recipe-id]', list).forEach(card => {
      const open = () => openRecipeDetail(card.dataset.recipeId);
      card.addEventListener('click', open);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  function ingredientOptions(selectedId=''){
    const options = [`<option value="">Choisir un produit</option>`].concat(ingredients.map(ingredient => `<option value="${esc(ingredient.id)}" ${String(ingredient.id)===String(selectedId)?'selected':''}>${esc(ingredient.nom || 'Produit sans nom')}</option>`));
    return options.join('');
  }

  function unitOptions(selected='g'){
    const units = ['g','kg','mg','ml','cl','l','pièce'];
    return units.map(unit => `<option value="${esc(unit)}" ${unit===selected?'selected':''}>${esc(unit)}</option>`).join('');
  }

  function syncDraftFromForm(){
    const form = qs('#recipe-form');
    if (!form || !draft) return;
    const fd = new FormData(form);
    draft.id = fd.get('id') || draft.id;
    draft.nom = String(fd.get('nom') || '').trim();
    draft.categorie = String(fd.get('categorie') || '').trim();
    draft.portions = Math.max(1, Math.round(num(fd.get('portions') || 1)));
    draft.uniteSortie = String(fd.get('uniteSortie') || '').trim() || 'pièces';
    draft.prixVenteHT = num(fd.get('prixVenteHT'));
    draft.tva = num(fd.get('tva'));
    draft.note = String(fd.get('note') || '').trim();
    draft.lignes = (draft.lignes || []).map((line, idx) => ({
      ...line,
      ingredientId: String(fd.get(`line_ingredient_${idx}`) || ''),
      quantite: String(fd.get(`line_quantite_${idx}`) || '').trim(),
      unite: String(fd.get(`line_unite_${idx}`) || 'g'),
    }));
  }

  function renderCostPreview(){
    const root = qs('#recipe-cost-preview');
    if (!root || !draft) return;
    const computed = computeRecipe(draft);
    root.innerHTML = `<div class="recipe-cost-grid">
      <div><span>Coût total HT</span><strong>${euro(computed.totalHT)}</strong></div>
      <div><span>Coût par ${esc(draft.uniteSortie || 'portion')}</span><strong>${euro(computed.costPerPortion)}</strong></div>
      <div><span>Prix vente TTC</span><strong>${computed.pvHT ? euro(computed.pvTTC) : 'N/C'}</strong></div>
      <div><span>Marge HT</span><strong>${computed.pvHT ? `${euro(computed.marginHT)} · ${Math.round(computed.marginRate)} %` : 'N/C'}</strong></div>
    </div>`;
  }

  function drawRecipeForm(){
    const form = qs('#recipe-form');
    const editor = qs('#recipe-lines-editor');
    if (!form || !editor || !draft) return;
    form.elements.id.value = draft.id || '';
    form.elements.nom.value = draft.nom || '';
    form.elements.categorie.value = draft.categorie || '';
    form.elements.portions.value = draft.portions || 1;
    form.elements.uniteSortie.value = draft.uniteSortie || 'pièces';
    form.elements.prixVenteHT.value = draft.prixVenteHT ? String(draft.prixVenteHT).replace('.', ',') : '';
    form.elements.tva.value = String(draft.tva ?? 5.5);
    form.elements.note.value = draft.note || '';
    renderCategoryOptions();
    if (!draft.lignes.length) {
      editor.innerHTML = `<div class="notice">Aucun ingrédient dans cette recette.</div>`;
    } else {
      editor.innerHTML = draft.lignes.map((line, idx) => {
        const ingredient = ingredientById(line.ingredientId);
        const price = bestUnitPrice(ingredient);
        const lineCost = price * quantityToBase(line.quantite, line.unite, ingredient);
        return `<div class="recipe-line-row" data-line-index="${idx}">
          <div class="field"><label>Produit</label><select name="line_ingredient_${idx}" data-line-field="ingredientId" data-line-index="${idx}">${ingredientOptions(line.ingredientId)}</select></div>
          <div class="field"><label>Quantité</label><input name="line_quantite_${idx}" value="${esc(line.quantite)}" inputmode="decimal" data-line-field="quantite" data-line-index="${idx}" autocomplete="off"></div>
          <div class="field"><label>Unité</label><select name="line_unite_${idx}" data-line-field="unite" data-line-index="${idx}">${unitOptions(line.unite)}</select></div>
          <div class="recipe-line-cost"><span>Coût</span><strong>${lineCost ? euro(lineCost) : 'N/C'}</strong></div>
          <button class="icon-square-btn danger" type="button" data-remove-line="${idx}" aria-label="Supprimer la ligne">×</button>
        </div>`;
      }).join('');
    }
    renderCostPreview();
    qsa('[data-line-field]', editor).forEach(input => input.addEventListener('input', () => { syncDraftFromForm(); drawRecipeForm(); }));
    qsa('[data-line-field]', editor).forEach(input => input.addEventListener('change', () => { syncDraftFromForm(); drawRecipeForm(); }));
    qsa('[data-remove-line]', editor).forEach(btn => btn.addEventListener('click', () => {
      syncDraftFromForm();
      draft.lignes.splice(Number(btn.dataset.removeLine), 1);
      drawRecipeForm();
    }));
  }

  function openRecipeForm(recipe=null){
    draft = normalizeRecipe(recipe || emptyRecipe());
    qs('#recipe-sheet-title').textContent = recipe ? 'Modifier la recette' : 'Ajouter une recette';
    drawRecipeForm();
    openSheet(qs('#recipe-sheet'), qs('#recipe-sheet-backdrop'));
  }

  function closeRecipeForm(){ closeSheet(qs('#recipe-sheet'), qs('#recipe-sheet-backdrop')); draft = null; }

  async function saveRecipe(e){
    e.preventDefault();
    syncDraftFromForm();
    const form = qs('#recipe-form');
    if (!form.reportValidity()) return;
    draft.updatedAt = new Date().toISOString();
    await AppDB.put('recettes', normalizeRecipe(draft));
    recipes = (await AppDB.getAll('recettes')).map(normalizeRecipe);
    closeRecipeForm();
    renderList();
  }

  function openRecipeDetail(id){
    const recipe = recipes.find(r => String(r.id) === String(id));
    if (!recipe) return;
    const computed = computeRecipe(recipe);
    qs('#recipe-detail-title').textContent = recipe.nom || 'Détail recette';
    const content = qs('#recipe-detail-content');
    content.innerHTML = `<div class="detail-actions-row">
      <button class="icon-square-btn" type="button" data-edit-recipe="${esc(recipe.id)}" title="Modifier">✏️</button>
      <button class="icon-square-btn danger" type="button" data-delete-recipe="${esc(recipe.id)}" title="Supprimer">🗑️</button>
    </div>
    <div class="detail-tabs recipe-detail-tabs">
      <button class="detail-tab active" type="button" data-recipe-tab="infos">Infos</button>
      <button class="detail-tab" type="button" data-recipe-tab="ingredients">Ingrédients</button>
      <button class="detail-tab" type="button" data-recipe-tab="prix">Prix</button>
    </div>
    <div class="detail-tab-panel active" data-recipe-panel="infos">
      <section class="card compact-card"><h4>Recette</h4><div class="recipe-info-grid">
        <div><span>Nom</span><strong>${esc(recipe.nom || 'N/C')}</strong></div>
        <div><span>Catégorie</span><strong>${esc(recipe.categorie || 'N/C')}</strong></div>
        <div><span>Quantité produite</span><strong>${esc(recipe.portions)} ${esc(recipe.uniteSortie || '')}</strong></div>
        <div><span>Note</span><strong>${esc(recipe.note || 'N/C')}</strong></div>
      </div></section>
    </div>
    <div class="detail-tab-panel" data-recipe-panel="ingredients">
      <section class="card compact-card"><h4>Ingrédients</h4>${renderRecipeLinesTable(computed)}</section>
    </div>
    <div class="detail-tab-panel" data-recipe-panel="prix">
      <section class="card compact-card"><h4>Prix de revient</h4><div class="recipe-info-grid">
        <div><span>Coût total HT</span><strong>${euro(computed.totalHT)}</strong></div>
        <div><span>Coût par ${esc(recipe.uniteSortie || 'portion')}</span><strong>${euro(computed.costPerPortion)}</strong></div>
        <div><span>Prix vente HT</span><strong>${computed.pvHT ? euro(computed.pvHT) : 'N/C'}</strong></div>
        <div><span>Prix vente TTC</span><strong>${computed.pvHT ? euro(computed.pvTTC) : 'N/C'}</strong></div>
        <div><span>Marge HT</span><strong>${computed.pvHT ? euro(computed.marginHT) : 'N/C'}</strong></div>
        <div><span>Taux marge</span><strong>${computed.pvHT ? `${Math.round(computed.marginRate)} %` : 'N/C'}</strong></div>
      </div></section>
    </div>`;
    qsa('[data-recipe-tab]', content).forEach(btn => btn.addEventListener('click', () => {
      qsa('[data-recipe-tab]', content).forEach(b => b.classList.toggle('active', b === btn));
      qsa('[data-recipe-panel]', content).forEach(panel => panel.classList.toggle('active', panel.dataset.recipePanel === btn.dataset.recipeTab));
    }));
    qs('[data-edit-recipe]', content)?.addEventListener('click', () => openRecipeForm(recipe));
    qs('[data-delete-recipe]', content)?.addEventListener('click', async () => {
      if (!confirm('Supprimer cette recette ?')) return;
      await AppDB.delete('recettes', recipe.id);
      recipes = (await AppDB.getAll('recettes')).map(normalizeRecipe);
      closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop'));
      renderList();
    });
    openSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop'));
  }

  function renderRecipeLinesTable(computed){
    if (!computed.lines.length) return `<p class="muted">Aucun ingrédient renseigné.</p>`;
    return `<div class="recipe-lines-table-wrap"><table class="recipe-lines-table"><thead><tr><th>Produit</th><th>Quantité</th><th>Prix HT</th><th>Coût</th></tr></thead><tbody>${computed.lines.map(row => `<tr><td>${esc(row.ingredient?.nom || 'N/C')}</td><td>${esc(row.line.quantite || '0')} ${esc(row.line.unite || '')}</td><td>${row.unitPrice ? euro(row.unitPrice) : 'N/C'}</td><td>${row.cost ? euro(row.cost) : 'N/C'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  async function render(){
    [recipes, ingredients] = await Promise.all([AppDB.getAll('recettes'), AppDB.getAll('ingredients')]);
    recipes = recipes.map(normalizeRecipe);
    qs('#open-recipe-sheet-btn')?.addEventListener('click', () => openRecipeForm());
    qs('#close-recipe-sheet-btn')?.addEventListener('click', closeRecipeForm);
    qs('#cancel-recipe-btn')?.addEventListener('click', closeRecipeForm);
    qs('#recipe-sheet-backdrop')?.addEventListener('click', closeRecipeForm);
    qs('#close-recipe-detail-sheet-btn')?.addEventListener('click', () => closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop')));
    qs('#recipe-detail-sheet-backdrop')?.addEventListener('click', () => closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop')));
    qs('#recipe-form')?.addEventListener('submit', saveRecipe);
    qs('#add-recipe-line-btn')?.addEventListener('click', () => { syncDraftFromForm(); draft.lignes.push(emptyLine()); drawRecipeForm(); });
    ['input','change'].forEach(evt => qs('#recipe-form')?.addEventListener(evt, e => { if (e.target.matches('input[name="prixVenteHT"],select[name="tva"],input[name="portions"],input[name="uniteSortie"]')) { syncDraftFromForm(); renderCostPreview(); } }));
    qs('#recipes-search')?.addEventListener('input', e => { filters.search = e.target.value; renderList(); });
    qs('#recipes-filter-category')?.addEventListener('change', e => { filters.categorie = e.target.value; renderList(); });
    qs('#recipes-sort')?.addEventListener('change', e => { filters.sort = e.target.value; renderList(); });
    qs('#toggle-recipes-filters-btn')?.addEventListener('click', e => {
      const panel = qs('#recipes-filters-panel');
      panel.classList.toggle('hidden');
      e.currentTarget.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
    });
    renderList();
  }

  window.RecettesPage = { render };
})();
