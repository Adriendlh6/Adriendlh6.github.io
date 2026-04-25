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
  function now(){ return new Date().toISOString(); }

  let recipes = [];
  let ingredients = [];
  let filters = { search:'', categorie:'', type:'', sort:'az' };
  let draft = null;

  const UNITS = ['g','kg','mg','ml','cl','l','pièce','unité'];
  const NUTRITION_KEYS = [
    ['energie','Énergie'],
    ['matieresGrasses','Matières grasses'],
    ['acidesGrasSatures','Acides gras saturés'],
    ['glucides','Glucides'],
    ['sucres','Sucres'],
    ['proteines','Protéines'],
    ['sel','Sel'],
  ];
  const ALLERGEN_LABELS = {
    gluten:'Gluten', crustaces:'Crustacés', oeufs:'Œufs', poissons:'Poissons', arachides:'Arachides', soja:'Soja', lait:'Lait', fruits_a_coque:'Fruits à coque', celeri:'Céleri', moutarde:'Moutarde', sesame:'Sésame', sulfites:'Sulfites', lupin:'Lupin', mollusques:'Mollusques'
  };
  const MOLD_TYPES = [
    ['cercle','Cercle'],
    ['cadre','Cadre / rectangle'],
    ['plaque','Plaque'],
    ['autre','Autre']
  ];
  const RECETTE_CATEGORIES_KEY = 'recette_categories';

  function normalizeFormat(format={}){
    return {
      forme: format.forme || 'cercle',
      diametre: format.diametre ?? '',
      longueur: format.longueur ?? '',
      largeur: format.largeur ?? '',
      hauteur: format.hauteur ?? '',
      unite: format.unite || 'cm'
    };
  }
  function moldTypeOptions(current='cercle'){
    return MOLD_TYPES.map(([value,label]) => `<option value="${value}" ${String(current)===value?'selected':''}>${label}</option>`).join('');
  }
  function formatDimension(value){
    const n = num(value);
    if (!n) return '';
    return String(Math.round(n * 100) / 100).replace('.',',');
  }
  function formatMold(format={}){
    const f = normalizeFormat(format);
    const unit = f.unite || 'cm';
    if (f.forme === 'cercle') {
      const d = formatDimension(f.diametre);
      const h = formatDimension(f.hauteur);
      return d ? `Cercle Ø${d}${h ? ` × H ${h}` : ''} ${unit}` : 'Taille non renseignée';
    }
    if (f.forme === 'cadre' || f.forme === 'plaque') {
      const l = formatDimension(f.longueur);
      const w = formatDimension(f.largeur);
      const h = formatDimension(f.hauteur);
      const label = f.forme === 'plaque' ? 'Plaque' : 'Cadre';
      return (l || w) ? `${label} ${[l,w,h].filter(Boolean).join(' × ')} ${unit}` : 'Taille non renseignée';
    }
    return 'Format personnalisé';
  }
  function moldVolume(format={}){
    const f = normalizeFormat(format);
    const h = num(f.hauteur) || 1;
    if (f.forme === 'cercle') {
      const d = num(f.diametre);
      return d > 0 ? Math.PI * Math.pow(d / 2, 2) * h : 0;
    }
    if (f.forme === 'cadre' || f.forme === 'plaque') {
      const l = num(f.longueur);
      const w = num(f.largeur);
      return l > 0 && w > 0 ? l * w * h : 0;
    }
    return 0;
  }
  function variationRatio(recipe={}, row={}){
    const base = moldVolume(recipe.baseFormat || {});
    const current = moldVolume(row || {});
    if (base > 0 && current > 0) return current / base;
    return 1;
  }
  function formatRatio(value){ return `${String(Math.round(num(value) * 100) / 100).replace('.',',')}×`; }
  function normalizeRecipeCategory(cat={}){
    if (typeof cat === 'string') return { id: uid('rcat'), nom:cat.trim(), couleur:'#8b5e34' };
    return {
      id: String(cat.id || cat.slug || uid('rcat')),
      nom: String(cat.nom || cat.name || '').trim(),
      couleur: String(cat.couleur || cat.color || '#8b5e34').trim() || '#8b5e34'
    };
  }
  function getRecipeCategories(){
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(RECETTE_CATEGORIES_KEY) || '[]'); } catch { stored = []; }
    const normalized = Array.isArray(stored) ? stored.map(normalizeRecipeCategory).filter(cat => cat.nom) : [];
    const known = new Map(normalized.map(cat => [String(cat.id), cat]));
    recipes.forEach(recipe => {
      const id = String(recipe.categorieId || '').trim();
      const name = String(recipe.categorie || '').trim();
      if (id && !known.has(id)) known.set(id, { id, nom:name || 'Sans nom', couleur:'#8b5e34' });
      else if (!id && name && ![...known.values()].some(cat => cat.nom === name)) {
        const cat = { id: uid('rcat'), nom:name, couleur:'#8b5e34' };
        known.set(cat.id, cat);
      }
    });
    return [...known.values()].sort((a,b)=>a.nom.localeCompare(b.nom,'fr'));
  }
  function saveRecipeCategories(list=[]){
    try { localStorage.setItem(RECETTE_CATEGORIES_KEY, JSON.stringify(list.map(normalizeRecipeCategory).filter(cat => cat.nom))); } catch {}
  }
  function getRecipeCategoryById(id){
    return getRecipeCategories().find(cat => String(cat.id) === String(id));
  }
  function getRecipeCategoryFor(recipe={}){
    return getRecipeCategoryById(recipe.categorieId) || getRecipeCategories().find(cat => cat.nom === recipe.categorie) || null;
  }
  function recipeCategoryOptions(current=''){
    const cats = getRecipeCategories();
    const currentCat = getRecipeCategoryById(current) || cats.find(cat => cat.nom === current);
    return '<option value="">Sans catégorie</option>' + cats.map(cat => `<option value="${esc(cat.id)}" ${String(cat.id)===String(currentCat?.id || current)?'selected':''}>${esc(cat.nom)}</option>`).join('');
  }

  function normalizeLine(line={}){
    return { id: line.id || uid('line'), ingredientId: line.ingredientId || '', quantite: line.quantite ?? '', unite: line.unite || 'g' };
  }
  function normalizeBaseLine(line={}){
    return { id: line.id || uid('base'), recipeId: line.recipeId || '', quantite: line.quantite ?? '', unite: line.unite || 'kg' };
  }
  function normalizePrepLine(line={}){
    const type = line.type === 'base' || line.recipeId ? 'base' : 'ingredient';
    return {
      id: line.id || uid('pline'),
      type,
      refId: line.refId || line.ingredientId || line.recipeId || '',
      quantite: line.quantite ?? '',
      unite: line.unite || (type === 'base' ? 'kg' : 'g')
    };
  }
  function normalizePreparation(prep={}, fallbackIndex=0){
    let lines = [];
    if (Array.isArray(prep.lines)) lines = prep.lines.map(normalizePrepLine);
    else {
      const ingredientLines = Array.isArray(prep.ingredients) ? prep.ingredients.map(line => normalizePrepLine({ ...line, type:'ingredient', refId:line.ingredientId })) : [];
      const baseLines = Array.isArray(prep.bases) ? prep.bases.map(line => normalizePrepLine({ ...line, type:'base', refId:line.recipeId })) : [];
      lines = [...ingredientLines, ...baseLines];
    }
    return {
      id: prep.id || uid('prep'),
      nom: prep.nom || `Préparation ${fallbackIndex + 1}`,
      lines,
      procede: prep.procede || ''
    };
  }
  function emptyPreparation(index=0){ return normalizePreparation({ nom:`Préparation ${index + 1}`, lines:[emptyPrepLine()], procede:'' }, index); }
  function emptyPrepLine(type='ingredient'){ return normalizePrepLine({ type, quantite:'', unite:type === 'base' ? 'kg' : 'g' }); }
  function normalizeVariation(row={}){
    return {
      id: row.id || uid('var'),
      nom: row.nom || '',
      forme: row.forme || row.typeFormat || 'cercle',
      diametre: row.diametre ?? '',
      longueur: row.longueur ?? '',
      largeur: row.largeur ?? '',
      hauteur: row.hauteur ?? '',
      unite: row.unite || row.uniteFormat || 'cm',
      prixVenteHT: row.prixVenteHT ?? '',
      tva: row.tva === undefined ? '5.5' : row.tva
    };
  }
  function normalizeRecipe(recipe={}){
    const oldLines = Array.isArray(recipe.lignes) ? recipe.lignes : [];
    return {
      id: recipe.id || uid('rec'),
      nom: recipe.nom || '',
      categorieId: recipe.categorieId || recipe.categoryId || '',
      categorie: recipe.categorie || '',
      isBase: Boolean(recipe.isBase),
      rendementQuantite: recipe.rendementQuantite ?? recipe.portions ?? '',
      rendementUnite: recipe.rendementUnite || recipe.uniteSortie || 'kg',
      baseFormat: normalizeFormat(recipe.baseFormat || recipe.formatBase || {}),
      tempsTravailMinutes: recipe.tempsTravailMinutes ?? recipe.tempsTravailEffectif ?? '',
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients.map(normalizeLine) : oldLines.map(normalizeLine),
      bases: Array.isArray(recipe.bases) ? recipe.bases.map(normalizeBaseLine) : [],
      preparations: (() => {
        if (Array.isArray(recipe.preparations) && recipe.preparations.length) return recipe.preparations.map(normalizePreparation);
        const legacyLines = [
          ...(Array.isArray(recipe.ingredients) ? recipe.ingredients.map(line => normalizePrepLine({ ...line, type:'ingredient', refId:line.ingredientId })) : oldLines.map(line => normalizePrepLine({ ...line, type:'ingredient', refId:line.ingredientId }))),
          ...(Array.isArray(recipe.bases) ? recipe.bases.map(line => normalizePrepLine({ ...line, type:'base', refId:line.recipeId })) : [])
        ];
        return [normalizePreparation({ nom:'Préparation 1', lines:legacyLines, procede:recipe.procede || '' }, 0)];
      })(),
      procede: recipe.procede || '',
      descriptionCommerciale: recipe.descriptionCommerciale || '',
      variations: Array.isArray(recipe.variations) ? recipe.variations.map(normalizeVariation) : [],
      note: recipe.note || '',
      archived: Boolean(recipe.archived),
      createdAt: recipe.createdAt || now(),
      updatedAt: recipe.updatedAt || recipe.createdAt || now(),
    };
  }
  function emptyRecipe(){ const r = normalizeRecipe({ rendementUnite:'kg', variations:[{ nom:'Standard', quantite:'', unite:'', prixVenteHT:'', tva:'5.5' }] }); r.preparations = [emptyPreparation(0)]; return r; }
  function emptyIngredientLine(){ return normalizeLine({ quantite:'', unite:'g' }); }
  function emptyBaseLine(){ return normalizeBaseLine({ quantite:'', unite:'kg' }); }
  function emptyVariation(){
    const base = normalizeFormat(draft?.baseFormat || {});
    return normalizeVariation({ nom:'', forme:base.forme, diametre:base.diametre, longueur:base.longueur, largeur:base.largeur, hauteur:base.hauteur, unite:base.unite, tva:'5.5' });
  }

  function ingredientById(id){ return ingredients.find(item => String(item.id) === String(id)); }
  function recipeById(id){ return recipes.find(item => String(item.id) === String(id)); }
  function unitOptions(current=''){
    const list = [...new Set([current, ...UNITS].filter(Boolean))];
    return list.map(u => `<option value="${esc(u)}" ${String(u)===String(current)?'selected':''}>${esc(u)}</option>`).join('');
  }
  function bestUnitPrice(ingredient){
    const offers = Array.isArray(ingredient?.offres) ? ingredient.offres : [];
    const primary = offers.find(o => o && o.sourcePrincipale && num(o.prixHTUnite) > 0);
    if (primary) return num(primary.prixHTUnite);
    const prices = offers.map(o => num(o?.prixHTUnite)).filter(v => v > 0);
    return prices.length ? Math.min(...prices) : 0;
  }
  function quantityToBase(quantity, unit, baseUnit){
    const q = num(quantity);
    const base = String(baseUnit || '').toLowerCase();
    const u = String(unit || '').toLowerCase();
    if (!q) return 0;
    if (base === 'kg') { if (u === 'kg') return q; if (u === 'g') return q/1000; if (u === 'mg') return q/1000000; }
    if (base === 'g') { if (u === 'kg') return q*1000; if (u === 'g') return q; if (u === 'mg') return q/1000; }
    if (base === 'l') { if (u === 'l') return q; if (u === 'cl') return q/100; if (u === 'ml') return q/1000; }
    if (base === 'ml') { if (u === 'l') return q*1000; if (u === 'cl') return q*10; if (u === 'ml') return q; }
    return q;
  }
  function ingredientQuantityToBase(quantity, unit, ingredient){
    const baseUnit = String(ingredient?.uniteBase || 'kg').toLowerCase();
    const u = String(unit || '').toLowerCase();
    const q = num(quantity);
    if (!q) return 0;
    if (baseUnit === 'piece' && ['g','kg','mg'].includes(u)) {
      const usableGrams = Math.max(num(ingredient?.poidsUtilisable), 0);
      if (!(usableGrams > 0)) return 0;
      const grams = quantityToBase(quantity, unit, 'g');
      return grams / usableGrams;
    }
    return quantityToBase(quantity, unit, baseUnit);
  }
  function qtyToGrams(quantity, unit){
    const q = num(quantity); const u = String(unit || '').toLowerCase();
    if (!q) return 0;
    if (u === 'kg') return q * 1000;
    if (u === 'g') return q;
    if (u === 'mg') return q / 1000;
    return 0;
  }
  function qtyToRecipeBase(quantity, unit, recipe){ return quantityToBase(quantity, unit, recipe?.rendementUnite || 'kg'); }

  function getRecipeComponentLines(recipe={}){
    if (Array.isArray(recipe.preparations) && recipe.preparations.length) {
      return recipe.preparations.flatMap((prep, prepIndex) => (prep.lines || []).map(line => ({ ...line, prepIndex, prepName:prep.nom || `Préparation ${prepIndex + 1}` })));
    }
    return [
      ...(recipe.ingredients || []).map(line => ({ type:'ingredient', refId:line.ingredientId, quantite:line.quantite, unite:line.unite, prepIndex:0, prepName:'Préparation 1' })),
      ...(recipe.bases || []).map(line => ({ type:'base', refId:line.recipeId, quantite:line.quantite, unite:line.unite, prepIndex:0, prepName:'Préparation 1' }))
    ];
  }
  function computeRecipe(recipe, visited=new Set()){
    const id = String(recipe?.id || '');
    if (id && visited.has(id)) return emptyComputed();
    if (id) visited.add(id);
    const componentLines = getRecipeComponentLines(recipe);
    const ingredientRows = componentLines.filter(line => line.type !== 'base').map(line => {
      const ingredient = ingredientById(line.refId || line.ingredientId);
      const unitPrice = bestUnitPrice(ingredient);
      const baseQty = ingredientQuantityToBase(line.quantite, line.unite, ingredient);
      const cost = unitPrice * baseQty;
      const grams = qtyToGrams(line.quantite, line.unite);
      return { type:'ingredient', line:{ ...line, ingredientId:line.refId || line.ingredientId }, label: ingredient?.nom || 'Ingrédient non renseigné', ingredient, unitPrice, baseQty, grams, cost, prepIndex:line.prepIndex, prepName:line.prepName };
    });
    const baseRows = componentLines.filter(line => line.type === 'base').map(line => {
      const baseRecipe = recipeById(line.refId || line.recipeId);
      const computed = baseRecipe ? computeRecipe(baseRecipe, new Set(visited)) : emptyComputed();
      const qty = qtyToRecipeBase(line.quantite, line.unite, baseRecipe);
      const baseYield = Math.max(num(baseRecipe?.rendementQuantite), 0);
      const costPerBaseUnit = baseYield ? computed.totalHT / baseYield : 0;
      const ratio = baseYield ? qty / baseYield : 0;
      const grams = String(baseRecipe?.rendementUnite || '').toLowerCase() === 'kg' ? qty * 1000 : (String(baseRecipe?.rendementUnite || '').toLowerCase() === 'g' ? qty : 0);
      return { type:'base', line:{ ...line, recipeId:line.refId || line.recipeId }, label: baseRecipe?.nom || 'Recette de base non renseignée', recipe: baseRecipe, qty, ratio, grams, cost: costPerBaseUnit * qty, computed, prepIndex:line.prepIndex, prepName:line.prepName };
    });
    const rows = [...ingredientRows, ...baseRows];
    const totalHT = rows.reduce((sum,row)=>sum+num(row.cost),0);
    const rendement = Math.max(num(recipe?.rendementQuantite),0);
    const costPerUnit = rendement ? totalHT / rendement : 0;
    const allergenes = new Set();
    const nutritionTotals = Object.fromEntries(NUTRITION_KEYS.map(([k])=>[k,0]));
    let totalGrams = 0;
    ingredientRows.forEach(row => {
      (row.ingredient?.allergenes || []).forEach(a => allergenes.add(a));
      if (row.grams > 0) {
        totalGrams += row.grams;
        const nutrition = row.ingredient?.nutrition || {};
        NUTRITION_KEYS.forEach(([key]) => { nutritionTotals[key] += num(nutrition[key]) * row.grams / 100; });
      }
    });
    baseRows.forEach(row => {
      row.computed.allergenes.forEach(a => allergenes.add(a));
      if (row.grams > 0) totalGrams += row.grams;
      NUTRITION_KEYS.forEach(([key]) => { nutritionTotals[key] += num(row.computed.nutritionTotals[key]) * num(row.ratio); });
    });
    const nutritionPer100 = Object.fromEntries(NUTRITION_KEYS.map(([key]) => [key, totalGrams ? nutritionTotals[key] / totalGrams * 100 : 0]));
    return { rows, ingredientRows, baseRows, totalHT, rendement, costPerUnit, allergenes:[...allergenes], nutritionTotals, nutritionPer100, totalGrams };
  }
  function emptyComputed(){ return { rows:[], ingredientRows:[], baseRows:[], totalHT:0, rendement:0, costPerUnit:0, allergenes:[], nutritionTotals:Object.fromEntries(NUTRITION_KEYS.map(([k])=>[k,0])), nutritionPer100:Object.fromEntries(NUTRITION_KEYS.map(([k])=>[k,0])), totalGrams:0 }; }

  function formatQuantity(q,u){ return `${num(q) || '-'} ${esc(u || '')}`.trim(); }
  function categoryChip(value, extra=''){
    const category = typeof value === 'object' && value ? value : (getRecipeCategoryById(value) || getRecipeCategories().find(cat => cat.nom === value));
    const label = category?.nom || value || 'Sans catégorie';
    const color = category?.couleur || '#8b5e34';
    return `<span class="tag category-chip recipe-chip ${extra}" style="--chip-color:${esc(color)}">${esc(label)}</span>`;
  }
  function baseChip(recipe){ return recipe?.isBase ? '<span class="tag recipe-chip recipe-chip-base">Base</span>' : ''; }
  function getVisibleRecipes(){
    const q = filters.search.trim().toLowerCase();
    let list = recipes.filter(r => !r.archived);
    if (q) list = list.filter(r => [r.nom,r.categorie,getRecipeCategoryFor(r)?.nom,r.descriptionCommerciale].join(' ').toLowerCase().includes(q));
    if (filters.categorie) list = list.filter(r => String(r.categorieId || '') === String(filters.categorie));
    if (filters.type === 'base') list = list.filter(r => r.isBase);
    if (filters.type === 'vente') list = list.filter(r => !r.isBase);
    list.sort((a,b) => {
      if (filters.sort === 'za') return String(b.nom).localeCompare(String(a.nom),'fr');
      if (filters.sort === 'cost-asc') return computeRecipe(a).costPerUnit - computeRecipe(b).costPerUnit;
      if (filters.sort === 'cost-desc') return computeRecipe(b).costPerUnit - computeRecipe(a).costPerUnit;
      if (filters.sort === 'updated-desc') return String(b.updatedAt).localeCompare(String(a.updatedAt));
      return String(a.nom).localeCompare(String(b.nom),'fr');
    });
    return list;
  }

  function renderCategoryFilter(){
    const cats = getRecipeCategories();
    const select = qs('#recipes-filter-category');
    if (select) select.innerHTML = '<option value="">Toutes les catégories</option>' + cats.map(c => `<option value="${esc(c.id)}" ${String(filters.categorie)===String(c.id)?'selected':''}>${esc(c.nom)}</option>`).join('');
    const formCategory = qs('#recipe-categorie');
    if (formCategory) formCategory.innerHTML = recipeCategoryOptions(draft?.categorieId || draft?.categorie || formCategory.value || '');
  }
  function renderList(){
    renderCategoryFilter();
    const list = qs('#recipes-list');
    const empty = qs('#recipes-empty');
    const visible = getVisibleRecipes();
    if (!list || !empty) return;
    if (!recipes.length || !visible.length) {
      empty.classList.remove('hidden');
      empty.textContent = recipes.length ? 'Aucune recette ne correspond à la recherche.' : 'Aucune recette enregistrée.';
      list.innerHTML = '';
      return;
    }
    empty.classList.add('hidden');
    list.innerHTML = visible.map(recipe => {
      const c = computeRecipe(recipe);
      const variation = (recipe.variations || [])[0] || {};
      const pv = num(variation.prixVenteHT);
      return `<article class="item product-card recipe-card" data-recipe-id="${esc(recipe.id)}" tabindex="0">
        <div class="item-top">
          <div class="recipe-list-main">
            <div class="recipe-list-title-row">
              <strong>${esc(recipe.nom || 'Sans nom')}</strong>
              <span class="recipe-list-price">${euro(c.costPerUnit)} HT / ${esc(recipe.rendementUnite || 'unité')}</span>
            </div>
            <div class="toolbar chip-row">${categoryChip(getRecipeCategoryFor(recipe))}${baseChip(recipe)}${pv ? `<span class="tag">PV ${euro(pv)} HT</span>` : ''}</div>
            <div class="muted small">Rendement : ${formatQuantity(recipe.rendementQuantite, recipe.rendementUnite)} · ${c.rows.length} composant(s)</div>
          </div>
        </div>
      </article>`;
    }).join('');
    qsa('.recipe-card', list).forEach(card => {
      card.onclick = () => openRecipeDetail(card.dataset.recipeId);
      card.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openRecipeDetail(card.dataset.recipeId); } };
    });
  }

  function syncDraftFromForm(){
    if (!draft) return;
    const form = qs('#recipe-form');
    if (!form) return;
    const fd = new FormData(form);
    draft.id = String(fd.get('id') || draft.id || uid('rec'));
    draft.nom = String(fd.get('nom') || '').trim();
    draft.categorieId = String(fd.get('categorie') || '').trim();
    draft.categorie = getRecipeCategoryById(draft.categorieId)?.nom || '';
    draft.isBase = Boolean(fd.get('isBase'));
    draft.rendementQuantite = String(fd.get('rendementQuantite') || '').trim();
    draft.rendementUnite = String(fd.get('rendementUnite') || '').trim() || 'kg';
    draft.tempsTravailMinutes = String(fd.get('tempsTravailMinutes') || '').trim();
    const baseFields = {};
    qsa('[data-base-size-field]').forEach(input => { baseFields[input.dataset.baseSizeField] = String(input.value || '').trim(); });
    draft.baseFormat = normalizeFormat({
      forme:baseFields.forme || String(fd.get('base_forme') || 'cercle'),
      diametre:baseFields.diametre ?? String(fd.get('base_diametre') || '').trim(),
      longueur:baseFields.longueur ?? String(fd.get('base_longueur') || '').trim(),
      largeur:baseFields.largeur ?? String(fd.get('base_largeur') || '').trim(),
      hauteur:baseFields.hauteur ?? String(fd.get('base_hauteur') || '').trim(),
      unite:baseFields.unite || String(fd.get('base_unite') || 'cm').trim() || 'cm'
    });
    if (fd.has('descriptionCommerciale')) draft.descriptionCommerciale = String(fd.get('descriptionCommerciale') || '').trim();
    if (fd.has('note')) draft.note = String(fd.get('note') || '').trim();
    draft.preparations = (draft.preparations || []).map((prep, prepIdx) => ({
      ...prep,
      nom:String(fd.get(`prep_nom_${prepIdx}`) || `Préparation ${prepIdx + 1}`).trim() || `Préparation ${prepIdx + 1}`,
      procede:String(fd.get(`prep_procede_${prepIdx}`) || '').trim(),
      lines:(prep.lines || []).map((line, lineIdx) => {
        const raw = String(fd.get(`prep_${prepIdx}_component_${lineIdx}`) || '');
        const [type, ...rest] = raw.split(':');
        const refId = rest.join(':');
        const safeType = type === 'base' ? 'base' : 'ingredient';
        return normalizePrepLine({
          ...line,
          type:safeType,
          refId,
          quantite:String(fd.get(`prep_${prepIdx}_quantite_${lineIdx}`) || '').trim(),
          unite:String(fd.get(`prep_${prepIdx}_unite_${lineIdx}`) || (safeType === 'base' ? 'kg' : 'g'))
        });
      })
    }));
    draft.ingredients = draft.preparations.flatMap(prep => (prep.lines || []).filter(line => line.type !== 'base').map(line => normalizeLine({ ingredientId:line.refId, quantite:line.quantite, unite:line.unite })));
    draft.bases = draft.preparations.flatMap(prep => (prep.lines || []).filter(line => line.type === 'base').map(line => normalizeBaseLine({ recipeId:line.refId, quantite:line.quantite, unite:line.unite })));
    draft.procede = (draft.preparations || []).map(prep => prep.procede).filter(Boolean).join('\n\n');
    draft.variations = (draft.variations || []).map((row, idx) => normalizeVariation({
      ...row,
      nom:String(fd.get(`var_nom_${idx}`) || '').trim(),
      forme:String(fd.get(`var_forme_${idx}`) || 'cercle'),
      diametre:String(fd.get(`var_diametre_${idx}`) || '').trim(),
      longueur:String(fd.get(`var_longueur_${idx}`) || '').trim(),
      largeur:String(fd.get(`var_largeur_${idx}`) || '').trim(),
      hauteur:String(fd.get(`var_hauteur_${idx}`) || '').trim(),
      unite:String(fd.get(`var_unite_${idx}`) || 'cm').trim() || 'cm',
      prixVenteHT:String(fd.get(`var_prix_${idx}`) || '').trim(),
      tva:String(fd.get(`var_tva_${idx}`) || '5.5')
    }));
  }


  function resetRecipeCategoryForm(){
    const form = qs('#recipe-category-form');
    if (!form) return;
    form.reset();
    form.elements.id.value = '';
    form.couleur.value = '#8b5e34';
    const preview = qs('#recipe-category-color-preview');
    if (preview) { preview.style.setProperty('--chip-color', '#8b5e34'); preview.textContent = 'Nouvelle catégorie'; }
  }
  function renderRecipeCategoriesManager(){
    const list = qs('#recipe-categories-list');
    if (!list) return;
    const cats = getRecipeCategories();
    list.innerHTML = cats.length ? cats.map(cat => `<article class="item compact-item">
      <div class="item-top">
        <div class="toolbar chip-row"><span class="tag category-chip recipe-chip" style="--chip-color:${esc(cat.couleur || '#8b5e34')}">${esc(cat.nom)}</span></div>
        <div class="toolbar">
          <button class="btn secondary" type="button" data-edit-recipe-category="${esc(cat.id)}">Modifier</button>
          <button class="btn danger" type="button" data-delete-recipe-category="${esc(cat.id)}">Supprimer</button>
        </div>
      </div>
    </article>`).join('') : '<div class="notice">Aucune catégorie créée.</div>';
    qsa('[data-edit-recipe-category]', list).forEach(btn => {
      btn.onclick = () => {
        const cat = cats.find(item => String(item.id) === String(btn.dataset.editRecipeCategory));
        const form = qs('#recipe-category-form');
        if (!cat || !form) return;
        form.elements.id.value = cat.id;
        form.nom.value = cat.nom;
        form.couleur.value = cat.couleur || '#8b5e34';
        const preview = qs('#recipe-category-color-preview');
        if (preview) { preview.style.setProperty('--chip-color', cat.couleur || '#8b5e34'); preview.textContent = cat.nom; }
      };
    });
    qsa('[data-delete-recipe-category]', list).forEach(btn => {
      btn.onclick = async () => {
        const id = String(btn.dataset.deleteRecipeCategory || '');
        if (!id || !confirm('Supprimer cette catégorie ?')) return;
        saveRecipeCategories(getRecipeCategories().filter(cat => String(cat.id) !== id));
        const impacted = recipes.filter(recipe => String(recipe.categorieId || '') === id);
        for (const recipe of impacted){ recipe.categorieId = ''; recipe.categorie = ''; await AppDB.put('recettes', recipe); }
        recipes = (await AppDB.getAll('recettes')).map(normalizeRecipe);
        renderRecipeCategoriesManager(); renderCategoryFilter(); renderList();
      };
    });
  }
  function openRecipeCategoriesSheet(){
    resetRecipeCategoryForm();
    renderRecipeCategoriesManager();
    openSheet(qs('#recipe-categories-sheet'), qs('#recipe-categories-sheet-backdrop'));
  }
  function closeRecipeCategoriesSheet(){ closeSheet(qs('#recipe-categories-sheet'), qs('#recipe-categories-sheet-backdrop')); }
  function openBaseSizeSheet(){
    renderBaseSizeFields();
    openSheet(qs('#recipe-base-size-sheet'), qs('#recipe-base-size-sheet-backdrop'));
  }
  function closeBaseSizeSheet(){
    syncDraftFromForm();
    renderBaseSizeFields();
    renderCostPreview();
    closeSheet(qs('#recipe-base-size-sheet'), qs('#recipe-base-size-sheet-backdrop'));
  }

  function ingredientOptions(selected=''){
    const sorted = [...ingredients].sort((a,b)=>String(a.nom).localeCompare(String(b.nom),'fr'));
    return '<option value="">Choisir un ingrédient</option>' + sorted.map(item => `<option value="${esc(item.id)}" ${String(item.id)===String(selected)?'selected':''}>${esc(item.nom || 'Sans nom')}</option>`).join('');
  }
  function baseRecipeOptions(selected=''){
    const currentId = draft?.id;
    const sorted = recipes.filter(r => r.isBase && String(r.id) !== String(currentId)).sort((a,b)=>String(a.nom).localeCompare(String(b.nom),'fr'));
    return '<option value="">Choisir une recette de base</option>' + sorted.map(item => `<option value="${esc(item.id)}" ${String(item.id)===String(selected)?'selected':''}>${esc(item.nom || 'Sans nom')}</option>`).join('');
  }
  function componentOptions(line={}){
    const selected = `${line.type === 'base' ? 'base' : 'ingredient'}:${line.refId || ''}`;
    const ing = [...ingredients].sort((a,b)=>String(a.nom).localeCompare(String(b.nom),'fr')).map(item => {
      const value = `ingredient:${item.id}`;
      return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(item.nom || 'Sans nom')}</option>`;
    }).join('');
    const currentId = draft?.id;
    const bases = recipes.filter(r => r.isBase && String(r.id) !== String(currentId)).sort((a,b)=>String(a.nom).localeCompare(String(b.nom),'fr')).map(item => {
      const value = `base:${item.id}`;
      return `<option value="${esc(value)}" ${value===selected?'selected':''}>${esc(item.nom || 'Sans nom')} [base]</option>`;
    }).join('');
    return `<option value="">Choisir un composant</option><optgroup label="Ingrédients mercuriale">${ing}</optgroup><optgroup label="Recettes de base">${bases}</optgroup>`;
  }
  function renderIngredientLines(){
    const target = qs('#recipe-ingredients-editor');
    if (!target || !draft) return;
    if (!draft.ingredients.length) target.innerHTML = '<p class="muted">Aucun ingrédient mercuriale.</p>';
    else target.innerHTML = draft.ingredients.map((line, idx) => {
      const ingredient = ingredientById(line.ingredientId);
      const unitPrice = bestUnitPrice(ingredient);
      const cost = unitPrice * ingredientQuantityToBase(line.quantite, line.unite, ingredient);
      return `<div class="recipe-line-row" data-line-index="${idx}">
        <div class="field"><label>Ingrédient</label><select name="ing_ingredient_${idx}" data-recipe-sync>${ingredientOptions(line.ingredientId)}</select></div>
        <div class="field"><label>Quantité</label><input name="ing_quantite_${idx}" value="${esc(line.quantite)}" inputmode="decimal" data-recipe-sync></div>
        <div class="field"><label>Unité</label><select name="ing_unite_${idx}" data-recipe-sync>${unitOptions(line.unite)}</select></div>
        <div class="recipe-line-cost"><span>Coût</span><strong>${euro(cost)}</strong></div>
        <button class="icon-square-btn danger" type="button" data-remove-ingredient-line="${idx}" title="Supprimer">✕</button>
      </div>`;
    }).join('');
  }
  function renderBaseLines(){
    const target = qs('#recipe-bases-editor');
    if (!target || !draft) return;
    if (!draft.bases.length) target.innerHTML = '<p class="muted">Aucune recette de base incluse.</p>';
    else target.innerHTML = draft.bases.map((line, idx) => {
      const base = recipeById(line.recipeId);
      const c = base ? computeRecipe(base) : emptyComputed();
      const qty = qtyToRecipeBase(line.quantite, line.unite, base);
      const cost = num(base?.rendementQuantite) ? c.totalHT / num(base.rendementQuantite) * qty : 0;
      return `<div class="recipe-line-row" data-base-index="${idx}">
        <div class="field"><label>Recette de base</label><select name="base_recipe_${idx}" data-recipe-sync>${baseRecipeOptions(line.recipeId)}</select></div>
        <div class="field"><label>Quantité</label><input name="base_quantite_${idx}" value="${esc(line.quantite)}" inputmode="decimal" data-recipe-sync></div>
        <div class="field"><label>Unité</label><select name="base_unite_${idx}" data-recipe-sync>${unitOptions(line.unite)}</select></div>
        <div class="recipe-line-cost"><span>Coût</span><strong>${euro(cost)}</strong></div>
        <button class="icon-square-btn danger" type="button" data-remove-base-line="${idx}" title="Supprimer">✕</button>
      </div>`;
    }).join('');
  }
  function renderPreparations(){
    const target = qs('#recipe-preparations-editor');
    if (!target || !draft) return;
    if (!Array.isArray(draft.preparations) || !draft.preparations.length) draft.preparations = [emptyPreparation(0)];
    target.innerHTML = draft.preparations.map((prep, prepIdx) => {
      const lines = Array.isArray(prep.lines) ? prep.lines : [];
      return `<section class="recipe-preparation-card" data-prep-index="${prepIdx}">
        <div class="recipe-preparation-head">
          <div class="field">
            <label>Nom de la préparation</label>
            <input name="prep_nom_${prepIdx}" value="${esc(prep.nom || `Préparation ${prepIdx + 1}`)}" placeholder="Ex : Biscuit / Crème / Montage" data-recipe-sync>
          </div>
          <button class="icon-square-btn danger" type="button" data-remove-preparation="${prepIdx}" title="Supprimer la préparation" ${draft.preparations.length <= 1 ? 'disabled' : ''}>✕</button>
        </div>
        <div class="recipe-lines-editor">
          ${lines.length ? lines.map((line, lineIdx) => {
            const isBase = line.type === 'base';
            const item = isBase ? recipeById(line.refId) : ingredientById(line.refId);
            const cost = isBase
              ? (() => { const c = item ? computeRecipe(item) : emptyComputed(); const qty = qtyToRecipeBase(line.quantite, line.unite, item); return num(item?.rendementQuantite) ? c.totalHT / num(item.rendementQuantite) * qty : 0; })()
              : (() => { const unitPrice = bestUnitPrice(item); return unitPrice * ingredientQuantityToBase(line.quantite, line.unite, item); })();
            return `<div class="recipe-line-row recipe-prep-line-row" data-prep-line-index="${lineIdx}">
              <div class="field"><label>Composant</label><select name="prep_${prepIdx}_component_${lineIdx}" data-recipe-sync>${componentOptions(line)}</select></div>
              <div class="field"><label>Quantité</label><input name="prep_${prepIdx}_quantite_${lineIdx}" value="${esc(line.quantite)}" inputmode="decimal" data-recipe-sync></div>
              <div class="field"><label>Unité</label><select name="prep_${prepIdx}_unite_${lineIdx}" data-recipe-sync>${unitOptions(line.unite)}</select></div>
              <div class="recipe-line-cost"><span>Coût</span><strong>${euro(cost)}</strong></div>
              <button class="icon-square-btn danger" type="button" data-remove-prep-line="${prepIdx}:${lineIdx}" title="Supprimer">✕</button>
            </div>`;
          }).join('') : '<p class="muted">Aucun composant dans cette préparation.</p>'}
        </div>
        <div class="toolbar toolbar-end"><button class="btn secondary" type="button" data-add-prep-line="${prepIdx}">Ajouter un composant</button></div>
        <div class="field">
          <label>Procédé</label>
          <textarea name="prep_procede_${prepIdx}" rows="5" placeholder="Étapes de cette préparation..." data-recipe-sync>${esc(prep.procede || '')}</textarea>
        </div>
      </section>`;
    }).join('');
  }

  function renderVariations(){
    const target = qs('#recipe-variations-editor');
    if (!target || !draft) return;
    if (!draft.variations.length) target.innerHTML = '<p class="muted">Aucune variation de vente.</p>';
    else target.innerHTML = draft.variations.map((row, idx) => {
      const ratio = variationRatio(draft, row);
      const c = computeRecipe(draft);
      const cost = c.totalHT * ratio;
      const produced = num(draft.rendementQuantite) ? num(draft.rendementQuantite) * ratio : 0;
      return `<div class="recipe-variation-card" data-variation-index="${idx}">
        <div class="recipe-variation-head">
          <div class="field"><label>Nom</label><input name="var_nom_${idx}" value="${esc(row.nom)}" placeholder="Ex : 6 parts / Ø18" data-recipe-sync></div>
          <button class="icon-square-btn danger" type="button" data-remove-variation="${idx}" title="Supprimer">✕</button>
        </div>
        <div class="recipe-size-grid">
          <div class="field"><label>Forme</label><select name="var_forme_${idx}" data-recipe-sync>${moldTypeOptions(row.forme)}</select></div>
          <div class="field"><label>Ø</label><input name="var_diametre_${idx}" value="${esc(row.diametre)}" inputmode="decimal" placeholder="cm" data-recipe-sync></div>
          <div class="field"><label>Longueur</label><input name="var_longueur_${idx}" value="${esc(row.longueur)}" inputmode="decimal" placeholder="cm" data-recipe-sync></div>
          <div class="field"><label>Largeur</label><input name="var_largeur_${idx}" value="${esc(row.largeur)}" inputmode="decimal" placeholder="cm" data-recipe-sync></div>
          <div class="field"><label>Hauteur</label><input name="var_hauteur_${idx}" value="${esc(row.hauteur)}" inputmode="decimal" placeholder="cm" data-recipe-sync></div>
          <div class="field"><label>Unité</label><input name="var_unite_${idx}" value="${esc(row.unite || 'cm')}" autocomplete="off" data-recipe-sync></div>
        </div>
        <div class="recipe-sale-grid">
          <div class="field"><label>PV HT</label><input name="var_prix_${idx}" value="${esc(row.prixVenteHT)}" inputmode="decimal" data-recipe-sync></div>
          <div class="field"><label>TVA</label><select name="var_tva_${idx}" data-recipe-sync>${['0','2.1','5.5','10','20'].map(v => `<option value="${v}" ${String(row.tva)===v?'selected':''}>${v.replace('.',',')} %</option>`).join('')}</select></div>
          <div class="recipe-variation-stat"><span>Coeff.</span><strong>${formatRatio(ratio)}</strong></div>
          <div class="recipe-variation-stat"><span>Quantité recette</span><strong>${produced ? formatQuantity(produced, draft.rendementUnite) : 'N/C'}</strong></div>
          <div class="recipe-variation-stat"><span>Coût matière</span><strong>${euro(cost)}</strong></div>
        </div>
      </div>`;
    }).join('');
  }
  function renderCostPreview(){
    const c = computeRecipe(draft || {});
    const preview = qs('#recipe-cost-preview');
    const sales = qs('#recipe-sales-preview');
    if (preview) preview.innerHTML = `<div class="recipe-cost-grid">
      <div><span>Coût matière total</span><strong>${euro(c.totalHT)}</strong></div>
      <div><span>Coût / ${esc(draft?.rendementUnite || 'unité')}</span><strong>${euro(c.costPerUnit)}</strong></div>
      <div><span>Rendement</span><strong>${formatQuantity(draft?.rendementQuantite, draft?.rendementUnite)}</strong></div>
      <div><span>Taille de base</span><strong>${esc(formatMold(draft?.baseFormat || {}))}</strong></div>
    </div>`;
    if (sales) sales.innerHTML = `<div class="recipe-info-grid">
      <div><span>Allergènes cumulés</span><strong>${c.allergenes.length ? c.allergenes.map(a => ALLERGEN_LABELS[a] || a).join(', ') : 'Aucun'}</strong></div>
      <div><span>Nutrition</span><strong>${c.totalGrams ? 'Calculée pour 100 g' : 'Non calculable'}</strong></div>
    </div>`;
  }
  function renderBaseSizeFields(){
    if (!draft) return;
    const form = qs('#recipe-form');
    if (!form) return;
    const base = normalizeFormat(draft.baseFormat || {});
    if (form.base_forme) form.base_forme.value = base.forme || 'cercle';
    if (form.base_diametre) form.base_diametre.value = base.diametre || '';
    if (form.base_longueur) form.base_longueur.value = base.longueur || '';
    if (form.base_largeur) form.base_largeur.value = base.largeur || '';
    if (form.base_hauteur) form.base_hauteur.value = base.hauteur || '';
    if (form.base_unite) form.base_unite.value = base.unite || 'cm';
    qsa('[data-base-size-field]').forEach(input => { input.value = base[input.dataset.baseSizeField] || (input.dataset.baseSizeField === 'forme' ? 'cercle' : input.dataset.baseSizeField === 'unite' ? 'cm' : ''); });
    const label = qs('#recipe-base-size-label');
    if (label) label.textContent = formatMold(base);
  }

  function drawForm(){
    if (!draft) return;
    const form = qs('#recipe-form');
    if (!form) return;
    if (form.elements.id) form.elements.id.value = draft.id || '';
    form.nom.value = draft.nom || '';
    renderCategoryFilter();
    if (form.categorie) form.categorie.value = draft.categorieId || getRecipeCategoryFor(draft)?.id || '';
    form.rendementQuantite.value = draft.rendementQuantite || '';
    form.rendementUnite.value = draft.rendementUnite || 'kg';
    if (form.tempsTravailMinutes) form.tempsTravailMinutes.value = draft.tempsTravailMinutes || '';

    form.isBase.checked = Boolean(draft.isBase);
    if (form.procede) form.procede.value = draft.procede || '';
    if (form.descriptionCommerciale) form.descriptionCommerciale.value = draft.descriptionCommerciale || '';
    if (form.note) form.note.value = draft.note || '';
    renderBaseSizeFields(); renderPreparations(); renderVariations(); renderCostPreview();
    qsa('[data-recipe-sync]', form).forEach(input => {
      input.oninput = () => { syncDraftFromForm(); renderCostPreview(); };
      input.onchange = () => { syncDraftFromForm(); drawForm(); };
    });
  }

  function openRecipeForm(id){
    const recipe = recipes.find(r => String(r.id) === String(id));
    draft = recipe ? JSON.parse(JSON.stringify(recipe)) : emptyRecipe();
    qs('#recipe-sheet-title').textContent = recipe ? 'Modifier une recette' : 'Ajouter une recette';
    drawForm();
    openSheet(qs('#recipe-sheet'), qs('#recipe-sheet-backdrop'));
  }
  function closeRecipeForm(){ draft = null; closeSheet(qs('#recipe-sheet'), qs('#recipe-sheet-backdrop')); }
  async function saveRecipe(e){
    e.preventDefault(); syncDraftFromForm();
    const form = qs('#recipe-form');
    if (!form.reportValidity()) return;
    draft.updatedAt = now();
    
    await AppDB.put('recettes', normalizeRecipe(draft));
    recipes = (await AppDB.getAll('recettes')).map(normalizeRecipe);
    closeRecipeForm(); renderList();
  }

  function recipeLinesTable(c){
    if (!c.rows.length) return '<p class="muted">Aucun composant renseigné.</p>';
    return `<div class="recipe-lines-table-wrap"><table class="recipe-lines-table"><thead><tr><th>Composant</th><th>Quantité</th><th>Coût</th></tr></thead><tbody>${c.rows.map(row => `<tr><td>${esc(row.label)}${row.type==='base'?' <span class="tag recipe-chip-base">Base</span>':''}</td><td>${formatQuantity(row.line.quantite,row.line.unite)}</td><td>${euro(row.cost)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function nutritionHtml(c){
    return `<div class="recipe-info-grid">${NUTRITION_KEYS.map(([key,label]) => `<div><span>${esc(label)}</span><strong>${c.totalGrams ? String(Math.round(c.nutritionPer100[key] * 100) / 100).replace('.',',') : 'N/C'}</strong></div>`).join('')}</div>`;
  }
  function variationsHtml(recipe,c){
    const rows = recipe.variations || [];
    if (!rows.length) return '<p class="muted">Aucune variation de vente.</p>';
    return `<div class="recipe-lines-table-wrap"><table class="recipe-lines-table"><thead><tr><th>Variation</th><th>Format</th><th>Coeff.</th><th>Quantité recette</th><th>Coût</th><th>PV HT</th><th>PV TTC</th><th>Marge indic.</th></tr></thead><tbody>${rows.map(row => {
      const ratio = variationRatio(recipe,row);
      const pv = num(row.prixVenteHT), tva = num(row.tva);
      const ttc = pv * (1 + tva/100);
      const cost = c.totalHT * ratio;
      const produced = num(recipe.rendementQuantite) ? num(recipe.rendementQuantite) * ratio : 0;
      const marge = pv ? pv - cost : 0;
      return `<tr><td>${esc(row.nom || 'Standard')}</td><td>${esc(formatMold(row))}</td><td>${formatRatio(ratio)}</td><td>${produced ? formatQuantity(produced, recipe.rendementUnite) : '-'}</td><td>${euro(cost)}</td><td>${pv ? euro(pv) : '-'}</td><td>${pv ? euro(ttc) : '-'}</td><td>${pv ? euro(marge) : '-'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function openRecipeDetail(id){
    const recipe = recipes.find(r => String(r.id) === String(id));
    if (!recipe) return;
    const c = computeRecipe(recipe);
    qs('#recipe-detail-title').textContent = recipe.nom || 'Détail recette';
    const content = qs('#recipe-detail-content');
    content.innerHTML = `<div class="detail-panel recipe-detail-panel">
      <div class="detail-actions-row">
        <button class="icon-square-btn" type="button" data-edit-recipe="${esc(recipe.id)}" title="Modifier">✎</button>
        <button class="icon-square-btn danger" type="button" data-delete-recipe="${esc(recipe.id)}" title="Supprimer">🗑️</button>
      </div>
      <section class="card compact-card">
        <div class="detail-label">${recipe.isBase ? 'Recette de base' : 'Recette de vente'}</div>
        <div class="detail-value detail-title-value">${esc(recipe.nom || 'Sans nom')}</div>
        <div class="toolbar chip-row">${categoryChip(getRecipeCategoryFor(recipe))}${baseChip(recipe)}</div>
        <div class="muted small">Taille de base : ${esc(formatMold(recipe.baseFormat || {}))}</div>
      </section>
      <div class="detail-tabs recipe-detail-tabs" role="tablist" aria-label="Sections recette">
        <button class="detail-tab active" type="button" data-recipe-tab="recette" aria-selected="true">Recette</button>
        <button class="detail-tab" type="button" data-recipe-tab="vente" aria-selected="false">Infos vente</button>
        <button class="detail-tab" type="button" data-recipe-tab="variations" aria-selected="false">Variations</button>
        <button class="detail-tab" type="button" data-recipe-tab="cout" aria-selected="false">Coût / Prix</button>
      </div>
      <div class="detail-tab-panel active" data-recipe-panel="recette">
        <section class="card compact-card"><h4>Ingrédients & bases</h4>${recipeLinesTable(c)}</section>
        <section class="card compact-card"><h4>Procédé</h4><p class="recipe-procedure-text">${esc(recipe.procede || 'Aucun procédé renseigné.').replace(/\n/g,'<br>')}</p></section>
      </div>
      <div class="detail-tab-panel" data-recipe-panel="vente">
        <section class="card compact-card"><h4>Allergènes cumulés</h4><div class="toolbar chip-row">${c.allergenes.length ? c.allergenes.map(a => `<span class="tag">${esc(ALLERGEN_LABELS[a] || a)}</span>`).join('') : '<span class="muted">Aucun allergène renseigné.</span>'}</div></section>
        <section class="card compact-card"><h4>Valeurs nutritionnelles cumulées / 100 g</h4>${nutritionHtml(c)}</section>
        <section class="card compact-card"><h4>Description commerciale courte</h4><p>${esc(recipe.descriptionCommerciale || 'Aucune description commerciale.').replace(/\n/g,'<br>')}</p></section>
      </div>
      <div class="detail-tab-panel" data-recipe-panel="variations"><section class="card compact-card"><h4>Prix par variation</h4>${variationsHtml(recipe,c)}</section></div>
      <div class="detail-tab-panel" data-recipe-panel="cout">
        <section class="card compact-card"><h4>Synthèse coût</h4><div class="recipe-cost-grid"><div><span>Coût matière total</span><strong>${euro(c.totalHT)}</strong></div><div><span>Coût / ${esc(recipe.rendementUnite || 'unité')}</span><strong>${euro(c.costPerUnit)}</strong></div><div><span>Rendement</span><strong>${formatQuantity(recipe.rendementQuantite, recipe.rendementUnite)}</strong></div><div><span>Temps travail</span><strong>${num(recipe.tempsTravailMinutes) ? num(recipe.tempsTravailMinutes) + ' min' : 'N/C'}</strong></div></div></section>
        <section class="card compact-card"><h4>Note interne</h4><p>${esc(recipe.note || 'Aucune note interne.').replace(/\n/g,'<br>')}</p></section>
      </div>
    </div>`;
    qsa('[data-recipe-tab]', content).forEach(btn => btn.onclick = () => {
      const tab = btn.dataset.recipeTab;
      qsa('[data-recipe-tab]', content).forEach(b => { b.classList.toggle('active', b.dataset.recipeTab === tab); b.setAttribute('aria-selected', b.dataset.recipeTab === tab ? 'true' : 'false'); });
      qsa('[data-recipe-panel]', content).forEach(panel => panel.classList.toggle('active', panel.dataset.recipePanel === tab));
    });
    qs('[data-edit-recipe]', content).onclick = () => { closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop')); openRecipeForm(recipe.id); };
    qs('[data-delete-recipe]', content).onclick = async () => { if (!confirm('Supprimer cette recette ?')) return; await AppDB.delete('recettes', recipe.id); recipes = (await AppDB.getAll('recettes')).map(normalizeRecipe); closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop')); renderList(); };
    openSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop'));
  }

  function printRecipes(){ window.print(); }

  async function render(){
    ingredients = (await AppDB.getAll('ingredients')).filter(Boolean);
    recipes = (await AppDB.getAll('recettes')).map(normalizeRecipe);
    qs('#open-recipe-sheet-btn')?.addEventListener('click', () => openRecipeForm());
    qs('#close-recipe-sheet-btn')?.addEventListener('click', closeRecipeForm);
    qs('#recipe-sheet-backdrop')?.addEventListener('click', closeRecipeForm);
    qs('#cancel-recipe-btn')?.addEventListener('click', closeRecipeForm);
    qs('#recipe-form')?.addEventListener('submit', saveRecipe);
    qs('#close-recipe-detail-sheet-btn')?.addEventListener('click', () => closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop')));
    qs('#recipe-detail-sheet-backdrop')?.addEventListener('click', () => closeSheet(qs('#recipe-detail-sheet'), qs('#recipe-detail-sheet-backdrop')));
    qs('#toggle-recipes-filters-btn')?.addEventListener('click', () => { const p=qs('#recipes-filters-panel'); p.classList.toggle('hidden'); qs('#toggle-recipes-filters-btn').setAttribute('aria-expanded', String(!p.classList.contains('hidden'))); });
    qs('#recipes-search')?.addEventListener('input', e => { filters.search = e.target.value || ''; renderList(); });
    qs('#recipes-filter-category')?.addEventListener('change', e => { filters.categorie = e.target.value || ''; renderList(); });
    qs('#recipes-filter-type')?.addEventListener('change', e => { filters.type = e.target.value || ''; renderList(); });
    qs('#recipes-sort')?.addEventListener('change', e => { filters.sort = e.target.value || 'az'; renderList(); });
    qs('#print-recipes-btn')?.addEventListener('click', printRecipes);
    qs('#manage-recipe-categories-btn')?.addEventListener('click', openRecipeCategoriesSheet);
    qs('#close-recipe-categories-sheet-btn')?.addEventListener('click', closeRecipeCategoriesSheet);
    qs('#recipe-categories-sheet-backdrop')?.addEventListener('click', closeRecipeCategoriesSheet);
    qs('#reset-recipe-category-btn')?.addEventListener('click', resetRecipeCategoryForm);
    qs('#recipe-category-couleur')?.addEventListener('input', e => {
      const preview = qs('#recipe-category-color-preview');
      if (preview) { preview.style.setProperty('--chip-color', e.target.value || '#8b5e34'); preview.textContent = qs('#recipe-category-nom')?.value || 'Nouvelle catégorie'; }
    });
    qs('#recipe-category-nom')?.addEventListener('input', e => {
      const preview = qs('#recipe-category-color-preview');
      if (preview) preview.textContent = e.target.value || 'Nouvelle catégorie';
    });
    qs('#recipe-category-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      if (!form.reportValidity()) return;
      const cats = getRecipeCategories();
      const id = form.elements.id.value || uid('rcat');
      const item = { id, nom:String(form.nom.value || '').trim(), couleur:form.couleur.value || '#8b5e34' };
      const idx = cats.findIndex(cat => String(cat.id) === String(id));
      if (idx >= 0) cats[idx] = item; else cats.push(item);
      saveRecipeCategories(cats);
      recipes.forEach(recipe => { if (String(recipe.categorieId || '') === String(id)) recipe.categorie = item.nom; });
      renderRecipeCategoriesManager(); renderCategoryFilter(); renderList(); resetRecipeCategoryForm();
    });
    qs('#close-recipe-base-size-sheet-btn')?.addEventListener('click', closeBaseSizeSheet);
    qs('#recipe-base-size-sheet-backdrop')?.addEventListener('click', closeBaseSizeSheet);
    qs('#save-recipe-base-size-btn')?.addEventListener('click', closeBaseSizeSheet);
    document.addEventListener('click', e => {
      if (!draft) return;
      const openSize = e.target.closest('#open-base-size-btn');
      const addPrep = e.target.closest('#add-recipe-preparation-btn');
      const addPrepLine = e.target.closest('[data-add-prep-line]');
      const remPrep = e.target.closest('[data-remove-preparation]');
      const remPrepLine = e.target.closest('[data-remove-prep-line]');
      const addVar = e.target.closest('#add-recipe-variation-btn');
      const remVar = e.target.closest('[data-remove-variation]');
      if (openSize) {
        openBaseSizeSheet();
      }
      if (addPrep) {
        syncDraftFromForm();
        draft.preparations.push(emptyPreparation(draft.preparations.length));
        drawForm();
      }
      if (addPrepLine) {
        syncDraftFromForm();
        const idx = Number(addPrepLine.dataset.addPrepLine);
        if (draft.preparations[idx]) draft.preparations[idx].lines.push(emptyPrepLine());
        drawForm();
      }
      if (remPrep) {
        syncDraftFromForm();
        const idx = Number(remPrep.dataset.removePreparation);
        if (draft.preparations.length > 1) draft.preparations.splice(idx, 1);
        drawForm();
      }
      if (remPrepLine) {
        syncDraftFromForm();
        const [prepIdx, lineIdx] = String(remPrepLine.dataset.removePrepLine).split(':').map(Number);
        if (draft.preparations[prepIdx]) draft.preparations[prepIdx].lines.splice(lineIdx, 1);
        drawForm();
      }
      if (addVar) { syncDraftFromForm(); draft.variations.push(emptyVariation()); drawForm(); }
      if (remVar) { syncDraftFromForm(); draft.variations.splice(Number(remVar.dataset.removeVariation),1); drawForm(); }
    });
    renderList();
  }

  window.RecettesPage = { render };
})();
