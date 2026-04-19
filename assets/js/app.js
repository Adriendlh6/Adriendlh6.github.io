const APP_VERSION = 'v2.0.0';
const ROUTES = {
  dashboard: { title: 'Dashboard', file: 'pages/dashboard.html' },
  mercuriale: { title: 'Mercuriale', file: 'pages/mercuriale.html' },
  recettes: { title: 'Recettes', file: 'pages/recettes.html' },
  fournisseurs: { title: 'Fournisseurs', file: 'pages/fournisseurs.html' },
  simulation: { title: 'Simulation', file: 'pages/simulation.html' },
  parametres: { title: 'Paramètres', file: 'pages/parametres.html' },
};

const state = { route: 'dashboard' };

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
function num(v){ return Number(v||0); }
function esc(s=''){ return String(s).replace(/[&<>\"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }

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

function fournisseurOptions(list, selected=''){
  return ['<option value="">Sélectionner</option>']
    .concat(list.map(f => `<option value="${f.id}" ${f.id===selected?'selected':''}>${esc(f.nom)}</option>`))
    .join('');
}

function renderOffresEditor(container, offres, fournisseurs){
  container.innerHTML = '';
  offres.forEach((offre, idx)=>{
    const block = document.createElement('div');
    block.className = 'item';
    block.innerHTML = `
      <div class="form-grid">
        <div class="field"><label>Fournisseur</label><select data-offre="fournisseurId" data-index="${idx}">${fournisseurOptions(fournisseurs, offre.fournisseurId)}</select></div>
        <div class="field"><label>Référence</label><input data-offre="reference" data-index="${idx}" value="${esc(offre.reference||'')}" /></div>
        <div class="field"><label>Conditionnement</label><input data-offre="conditionnement" data-index="${idx}" value="${esc(offre.conditionnement||'')}" placeholder="ex: sac 25 kg" /></div>
        <div class="field"><label>Prix HT</label><input type="number" step="0.01" data-offre="prixHT" data-index="${idx}" value="${num(offre.prixHT)}" /></div>
        <div class="field"><label>Quantité</label><input type="number" step="0.001" data-offre="quantite" data-index="${idx}" value="${num(offre.quantite)}" /></div>
        <div class="field"><label>Unité</label><select data-offre="unite" data-index="${idx}"><option ${offre.unite==='kg'?'selected':''}>kg</option><option ${offre.unite==='piece'?'selected':''}>piece</option><option ${offre.unite==='l'?'selected':''}>l</option></select></div>
      </div>
      <div class="toolbar" style="margin-top:10px"><button class="btn danger" type="button" data-remove-offre="${idx}">Supprimer l'offre</button></div>`;
    container.appendChild(block);
  });
  qsa('[data-remove-offre]', container).forEach(btn => btn.onclick = ()=>{
    offres.splice(Number(btn.dataset.removeOffre),1);
    renderOffresEditor(container, offres, fournisseurs);
  });
}

async function renderMercuriale(){
  const [ingredients, fournisseurs] = await Promise.all([AppDB.getAll('ingredients'), AppDB.getAll('fournisseurs')]);
  const list = qs('#ingredients-list');
  if (!ingredients.length) list.innerHTML = '<div class="notice">Aucun ingrédient enregistré.</div>';
  else list.innerHTML = ingredients.map(i => {
    const offre = (i.offres||[])[0];
    const cout = offre && offre.quantite ? num(offre.prixHT)/num(offre.quantite) : 0;
    return `<div class="item"><div class="item-top"><div><strong>${esc(i.nom)}</strong> <span class="tag">${esc(i.categorie||'Sans catégorie')}</span><div class="muted">EAN: ${esc(i.ean||'-')}</div><div class="muted">${(i.offres||[]).length} offre(s) · ${cout?euro(cout)+' / '+esc(offre.unite):'Sans prix'}</div></div><button class="btn danger" type="button" data-delete-ingredient="${i.id}">Supprimer</button></div></div>`;
  }).join('');
  qsa('[data-delete-ingredient]').forEach(btn => btn.onclick = async()=>{ await AppDB.delete('ingredients', btn.dataset.deleteIngredient); renderMercuriale(); renderDashboard(); });

  const form = qs('#ingredient-form');
  const offres = [];
  const offreWrap = qs('#offres-editor');
  renderOffresEditor(offreWrap, offres, fournisseurs);
  qs('#add-offre-btn').onclick = () => {
    offres.push({ fournisseurId:'', reference:'', conditionnement:'', prixHT:0, quantite:1, unite:'kg' });
    renderOffresEditor(offreWrap, offres, fournisseurs);
  };
  offreWrap.addEventListener('input', e => {
    const key = e.target.dataset.offre; const idx = Number(e.target.dataset.index);
    if (key == null || Number.isNaN(idx) || !offres[idx]) return;
    offres[idx][key] = ['prixHT','quantite'].includes(key) ? num(e.target.value) : e.target.value;
  });
  offreWrap.addEventListener('change', e => {
    const key = e.target.dataset.offre; const idx = Number(e.target.dataset.index);
    if (key == null || Number.isNaN(idx) || !offres[idx]) return;
    offres[idx][key] = ['prixHT','quantite'].includes(key) ? num(e.target.value) : e.target.value;
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    await AppDB.put('ingredients', {
      nom: data.nom,
      categorie: data.categorie,
      ean: data.ean,
      uniteBase: data.uniteBase,
      tva: data.tva,
      nutrition: {
        energie: data.energie, matieresGrasses: data.matieresGrasses, glucides: data.glucides,
        sucres: data.sucres, proteines: data.proteines, sel: data.sel
      },
      allergenes: qsa('input[name="allergenes"]:checked', form).map(i => i.value),
      offres
    });
    form.reset(); offres.splice(0, offres.length); renderOffresEditor(offreWrap, offres, fournisseurs); renderMercuriale(); renderDashboard();
  };
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
      if(!offre || !offre.quantite) return sum;
      return sum + (num(offre.prixHT)/num(offre.quantite))*num(l.quantite);
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
