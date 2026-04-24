/* Mon entreprise page module */
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function esc(s=''){ return String(s ?? '').replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
  function num(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Number.isFinite(v)?v:0; const p=Number(String(v).replace(/\s+/g,'').replace(',','.').replace(/[^0-9.\-]/g,'')); return Number.isFinite(p)?p:0; }
  function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
  function pct(v){ return Number.isFinite(Number(v)) ? `${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(v))} %` : 'N/C'; }

  const STORE='entreprise';
  const ID='mon-entreprise';
  let company=null;

  function normalize(data={}){
    return {
      id:ID,
      nomCommercial:data.nomCommercial||'',
      raisonSociale:data.raisonSociale||'',
      siret:data.siret||'',
      tvaIntracom:data.tvaIntracom||'',
      telephone:data.telephone||'',
      mail:data.mail||'',
      adresse:data.adresse||'',
      validiteDevisJours:data.validiteDevisJours??'',
      delaiPaiement:data.delaiPaiement||'',
      tvaDefault:data.tvaDefault??'',
      prefixeDevis:data.prefixeDevis||'',
      mentionsDevis:data.mentionsDevis||'',
      caHT:data.caHT??'',
      achatsMatieresHT:data.achatsMatieresHT??'',
      fraisGeneraux:data.fraisGeneraux??'',
      masseSalarialeProduction:data.masseSalarialeProduction??'',
      heuresProductives:data.heuresProductives??'',
      baseRepartition:data.baseRepartition||'',
      note:data.note||'',
      updatedAt:data.updatedAt||new Date().toISOString()
    };
  }

  function empty(){ return normalize({}); }

  function baseAmount(c){
    const b=c.baseRepartition||'';
    if(b==='ca') return {label:'Chiffre d’affaires HT', amount:num(c.caHT)};
    if(b==='matiere') return {label:'Achats matières HT', amount:num(c.achatsMatieresHT)};
    if(b==='salaires') return {label:'Masse salariale production', amount:num(c.masseSalarialeProduction)};
    return {label:'Non renseignée', amount:0};
  }

  function compute(c){
    const frais=num(c.fraisGeneraux);
    const base=baseAmount(c);
    const rate=base.amount>0?(frais/base.amount)*100:0;
    const coefficient=base.amount>0?1+(frais/base.amount):0;
    const heures=num(c.heuresProductives);
    const salaires=num(c.masseSalarialeProduction);
    const coutHoraire=heures>0?(salaires+frais)/heures:0;
    return {frais,base,rate,coefficient,heures,salaires,coutHoraire};
  }

  function fill(c){
    const form=qs('#company-form');
    if(!form) return;
    Object.entries(c).forEach(([k,v])=>{ if(form.elements[k]) form.elements[k].value=v??''; });
  }

  function read(){
    const form=qs('#company-form');
    if(!form) return empty();
    const fd=new FormData(form);
    const obj={...company};
    ['nomCommercial','raisonSociale','siret','tvaIntracom','telephone','mail','adresse','validiteDevisJours','delaiPaiement','tvaDefault','prefixeDevis','mentionsDevis','caHT','achatsMatieresHT','fraisGeneraux','masseSalarialeProduction','heuresProductives','baseRepartition','note'].forEach(k=>obj[k]=String(fd.get(k)||'').trim());
    return normalize(obj);
  }

  function selectedBaseAdvice(base){
    if(base==='ca') return {title:'Chiffre d’affaires HT', text:'Base simple et globale. Utile si tu veux répartir les frais généraux proportionnellement au prix de vente. Moins précis pour comparer des produits très différents.'};
    if(base==='matiere') return {title:'Achats matières HT', text:'Base intéressante en boulangerie/pâtisserie quand le coût matière pilote beaucoup le prix de revient. Attention : elle pénalise davantage les produits riches en matières premières.'};
    if(base==='salaires') return {title:'Masse salariale production', text:'Base pertinente si la main-d’œuvre est le vrai facteur limitant : produits longs à fabriquer, façonnage, viennoiserie, traiteur, pièces montées.'};
    return {title:'Aucune base sélectionnée', text:'Choisis la base qui représente le mieux ce qui consomme tes frais généraux : vente, matière ou main-d’œuvre.'};
  }

  function buildBaseRecommendation(c){
    const ca=num(c.caHT), mat=num(c.achatsMatieresHT), sal=num(c.masseSalarialeProduction);
    if(!ca && !mat && !sal) return 'Renseigne tes montants financiers pour obtenir une recommandation plus fiable.';
    const matRatio=ca>0?mat/ca:0;
    const salRatio=ca>0?sal/ca:0;
    if(salRatio>=matRatio && sal>0) return 'Recommandation : commence par la masse salariale production si tes coûts dépendent surtout du temps de fabrication.';
    if(matRatio>salRatio && mat>0) return 'Recommandation : commence par les achats matières si tes produits sont surtout pilotés par le coût des ingrédients.';
    return 'Recommandation : le chiffre d’affaires HT reste une base simple si tu veux une méthode globale et rapide.';
  }

  function renderBaseHelp(c){
    const box=qs('#company-base-help');
    if(!box) return;
    const advice=selectedBaseAdvice(c.baseRepartition||'');
    box.innerHTML=`
      <div class="base-help-main">
        <span>Base actuellement choisie</span>
        <strong>${esc(advice.title)}</strong>
        <p>${esc(advice.text)}</p>
        <p class="base-help-reco">${esc(buildBaseRecommendation(c))}</p>
      </div>
      <div class="base-help-options">
        <article><strong>CA HT</strong><p>Simple, adapté pour une première approche.</p></article>
        <article><strong>Matières</strong><p>Adapté si les ingrédients pèsent lourd.</p></article>
        <article><strong>Salaires</strong><p>Adapté si le temps de production domine.</p></article>
      </div>`;
  }

  function renderCalc(){
    const c=read();
    const calc=compute(c);
    const coef=calc.coefficient?new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(calc.coefficient):'N/C';
    const rate=calc.base.amount?pct(calc.rate):'N/C';
    const hour=calc.coutHoraire?`${euro(calc.coutHoraire)} / h`:'N/C';
    const a=qs('#company-kpi-coef'), b=qs('#company-kpi-rate'), d=qs('#company-kpi-hour');
    if(a) a.textContent=coef;
    if(b) b.textContent=rate;
    if(d) d.textContent=hour;
    renderBaseHelp(c);
    const grid=qs('#company-calculation-grid');
    if(!grid) return;
    grid.innerHTML=`<div><span>Base utilisée</span><strong>${esc(calc.base.label)}</strong><small>${calc.base.amount?euro(calc.base.amount):'Non renseignée'}</small></div><div><span>Frais généraux</span><strong>${calc.frais?euro(calc.frais):'N/C'}</strong><small>Charges indirectes annuelles.</small></div><div><span>Coefficient</span><strong>${coef}</strong><small>1 + frais généraux / base.</small></div><div><span>Coût horaire repère</span><strong>${hour}</strong><small>MO production + frais généraux / heures.</small></div>`;
  }

  async function save(){
    company=read();
    await AppDB.put(STORE, company);
    renderCalc();
    const btn=qs('#save-company-top-btn');
    if(btn){ const old=btn.textContent; btn.textContent='✓'; setTimeout(()=>btn.textContent=old,700); }
  }

  async function reset(){
    if(!confirm('Réinitialiser les informations de Mon entreprise ?')) return;
    company=empty();
    await AppDB.put(STORE, company);
    fill(company);
    renderCalc();
  }

  async function render(){
    let stored=null;
    try{ stored=await AppDB.get(STORE, ID); }catch(e){ console.error('[mon-entreprise]', e); }
    company=stored?normalize(stored):empty();
    fill(company);
    renderCalc();
    const form=qs('#company-form');
    form?.addEventListener('input', renderCalc);
    form?.addEventListener('change', renderCalc);
    form?.addEventListener('submit', async e=>{ e.preventDefault(); await save(); });
    qs('#save-company-top-btn')?.addEventListener('click', save);
    qs('#reset-company-btn')?.addEventListener('click', reset);
  }

  window.MonEntreprisePage={render};
})();
