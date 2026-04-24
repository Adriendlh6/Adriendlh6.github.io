/* Mon entreprise page module */
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function esc(s=''){ return String(s ?? '').replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
  function num(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Number.isFinite(v)?v:0; const p=Number(String(v).replace(/\s+/g,'').replace(',','.').replace(/[^0-9.\-]/g,'')); return Number.isFinite(p)?p:0; }
  function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
  function pct(v){ return Number.isFinite(Number(v)) ? `${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(v))} %` : 'N/C'; }
  function numberLabel(v, digits=1){ return Number(v||0) ? new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(Number(v||0)) : 'N/C'; }

  const STORE='entreprise';
  const ID='mon-entreprise';
  let company=null;

  function normalizeStaff(list){
    return Array.isArray(list) ? list.map(item=>({
      id:item.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      nom:item.nom || '',
      coutAnnuelEmployeur:item.coutAnnuelEmployeur ?? '',
      heuresSemaine:item.heuresSemaine ?? ''
    })) : [];
  }

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
      masseSalarialeVenteDirection:data.masseSalarialeVenteDirection ?? data.masseSalarialeVente ?? '',
      masseSalarialeProduction:data.masseSalarialeProduction??'',
      semainesProductives:data.semainesProductives??'',
      heuresProductives:data.heuresProductives??'',
      baseRepartition:data.baseRepartition||'',
      personnelProduction:normalizeStaff(data.personnelProduction),
      note:data.note||'',
      updatedAt:data.updatedAt||new Date().toISOString()
    };
  }

  function empty(){ return normalize({}); }

  function getStaffFromDom(){
    return qsa('[data-production-staff-row]').map(row=>({
      id: row.dataset.staffId || `staff_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      nom: String(qs('[data-staff-name]', row)?.value || '').trim(),
      coutAnnuelEmployeur: String(qs('[data-staff-cost]', row)?.value || '').trim(),
      heuresSemaine: String(qs('[data-staff-hours]', row)?.value || '').trim()
    })).filter(item => item.nom || item.coutAnnuelEmployeur || item.heuresSemaine);
  }

  function staffStats(list, semainesProductives){
    const staff=normalizeStaff(list).filter(item => item.nom || item.coutAnnuelEmployeur || item.heuresSemaine);
    const count=staff.length;
    const totalCost=staff.reduce((sum,item)=>sum+num(item.coutAnnuelEmployeur),0);
    const totalWeeklyHours=staff.reduce((sum,item)=>sum+num(item.heuresSemaine),0);
    const avgWeeklyHours=count ? totalWeeklyHours / count : 0;
    const weeks=num(semainesProductives);
    const annualHours=weeks>0 ? totalWeeklyHours * weeks : 0;
    return {staff,count,totalCost,totalWeeklyHours,avgWeeklyHours,weeks,annualHours};
  }

  function syncProductionFieldsFromStaff(){
    const form=qs('#company-form');
    if(!form) return;
    const staff=getStaffFromDom();
    const stats=staffStats(staff, form.elements.semainesProductives?.value || '');
    if(stats.count){
      if(form.elements.masseSalarialeProduction) form.elements.masseSalarialeProduction.value = stats.totalCost ? String(Math.round(stats.totalCost * 100) / 100) : '';
      if(form.elements.heuresProductives) form.elements.heuresProductives.value = stats.annualHours ? String(Math.round(stats.annualHours * 100) / 100) : '';
    }
    renderProductionSummary(staff);
  }

  function baseAmount(c){
    const b=c.baseRepartition||'';
    if(b==='ca') return {label:'Chiffre d’affaires HT', amount:num(c.caHT)};
    if(b==='matiere') return {label:'Achats matières HT', amount:num(c.achatsMatieresHT)};
    if(b==='salaires') return {label:'Rémunération production', amount:num(c.masseSalarialeProduction)};
    return {label:'Non renseignée', amount:0};
  }

  function compute(c){
    const frais=num(c.fraisGeneraux);
    const base=baseAmount(c);
    const rate=base.amount>0?(frais/base.amount)*100:0;
    const coefficient=base.amount>0?1+(frais/base.amount):0;
    const heures=num(c.heuresProductives);
    const salairesProduction=num(c.masseSalarialeProduction);
    const salairesVenteDirection=num(c.masseSalarialeVenteDirection);
    const coutHoraire=heures>0?(salairesProduction+frais)/heures:0;
    return {frais,base,rate,coefficient,heures,salairesProduction,salairesVenteDirection,coutHoraire};
  }

  function fill(c){
    const form=qs('#company-form');
    if(!form) return;
    Object.entries(c).forEach(([k,v])=>{ if(k !== 'personnelProduction' && form.elements[k]) form.elements[k].value=v??''; });
    renderProductionStaff(c.personnelProduction || []);
    renderProductionSummary(c.personnelProduction || []);
  }

  function read(){
    const form=qs('#company-form');
    if(!form) return empty();
    syncProductionFieldsFromStaff();
    const fd=new FormData(form);
    const obj={...company};
    ['nomCommercial','raisonSociale','siret','tvaIntracom','telephone','mail','adresse','validiteDevisJours','delaiPaiement','tvaDefault','prefixeDevis','mentionsDevis','caHT','achatsMatieresHT','fraisGeneraux','masseSalarialeVenteDirection','masseSalarialeProduction','semainesProductives','heuresProductives','baseRepartition','note'].forEach(k=>obj[k]=String(fd.get(k)||'').trim());
    obj.personnelProduction = getStaffFromDom();
    return normalize(obj);
  }

  function selectedBaseAdvice(base){
    if(base==='ca') return {title:'Chiffre d’affaires HT', text:'Base simple et globale. Utile pour répartir les frais généraux proportionnellement au niveau de vente. Moins précis pour comparer des produits très différents.'};
    if(base==='matiere') return {title:'Achats matières HT', text:'Base intéressante en boulangerie/pâtisserie quand le coût matière pilote beaucoup le prix de revient. Attention : elle pénalise davantage les produits riches en matières premières.'};
    if(base==='salaires') return {title:'Rémunération production', text:'Base pertinente si la main-d’œuvre de production est le vrai facteur limitant : produits longs à fabriquer, façonnage, viennoiserie, traiteur, pièces montées.'};
    return {title:'Aucune base sélectionnée', text:'Choisis la base qui représente le mieux ce qui consomme tes frais généraux : vente, matière ou main-d’œuvre de production.'};
  }

  function buildBaseRecommendation(c){
    const ca=num(c.caHT), mat=num(c.achatsMatieresHT), prod=num(c.masseSalarialeProduction);
    if(!ca && !mat && !prod) return 'Renseigne tes montants financiers pour obtenir une recommandation plus fiable.';
    const matRatio=ca>0?mat/ca:0;
    const prodRatio=ca>0?prod/ca:0;
    if(prodRatio>=matRatio && prod>0) return 'Recommandation : commence par la rémunération de production si tes coûts dépendent surtout du temps de fabrication.';
    if(matRatio>prodRatio && mat>0) return 'Recommandation : commence par les achats matières si tes produits sont surtout pilotés par le coût des ingrédients.';
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
        <article><strong>Production</strong><p>Adapté si le temps de fabrication domine.</p></article>
      </div>`;
  }

  function renderProductionStaff(list){
    const root=qs('#production-staff-list');
    if(!root) return;
    const staff=normalizeStaff(list);
    if(!staff.length){
      root.innerHTML='<div class="empty-state mini">Aucun salarié de production ajouté.</div>';
      return;
    }
    root.innerHTML=staff.map((item,idx)=>`
      <article class="production-staff-row" data-production-staff-row data-staff-id="${esc(item.id)}">
        <div class="field"><label>Nom du salarié</label><input data-staff-name value="${esc(item.nom)}"></div>
        <div class="field"><label>Coût annuel brut employeur</label><input data-staff-cost inputmode="decimal" value="${esc(item.coutAnnuelEmployeur)}"></div>
        <div class="field"><label>Temps de travail par semaine</label><input data-staff-hours inputmode="decimal" value="${esc(item.heuresSemaine)}"></div>
        <button type="button" class="icon-square-btn danger" data-remove-staff="${idx}" aria-label="Supprimer" title="Supprimer">🗑️</button>
      </article>`).join('');
  }

  function renderProductionSummary(list){
    const box=qs('#production-staff-summary');
    const form=qs('#company-form');
    if(!box || !form) return;
    const stats=staffStats(list, form.elements.semainesProductives?.value || '');
    box.innerHTML=`
      <div><span>Salariés production</span><strong>${stats.count || 'N/C'}</strong></div>
      <div><span>Coût annuel production</span><strong>${stats.totalCost ? euro(stats.totalCost) : 'N/C'}</strong></div>
      <div><span>Moyenne heures / semaine</span><strong>${stats.avgWeeklyHours ? `${numberLabel(stats.avgWeeklyHours)} h` : 'N/C'}</strong></div>
      <div><span>Heures annuelles calculées</span><strong>${stats.annualHours ? `${numberLabel(stats.annualHours)} h` : 'N/C'}</strong></div>`;
  }

  function renderCalc(){
    syncProductionFieldsFromStaff();
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
    grid.innerHTML=`<div><span>Base utilisée</span><strong>${esc(calc.base.label)}</strong><small>${calc.base.amount?euro(calc.base.amount):'Non renseignée'}</small></div><div><span>Frais généraux</span><strong>${calc.frais?euro(calc.frais):'N/C'}</strong><small>Charges indirectes annuelles.</small></div><div><span>Rémunération production</span><strong>${calc.salairesProduction?euro(calc.salairesProduction):'N/C'}</strong><small>Personnel directement productif.</small></div><div><span>Masse salariale vente / direction</span><strong>${calc.salairesVenteDirection?euro(calc.salairesVenteDirection):'N/C'}</strong><small>Vente, gestion, administratif, dirigeant.</small></div><div><span>Coefficient</span><strong>${coef}</strong><small>1 + frais généraux / base.</small></div><div><span>Coût horaire repère</span><strong>${hour}</strong><small>MO production + frais généraux / heures.</small></div>`;
  }

  function openInfo(title, text){
    closeInfo();
    const wrap=document.createElement('div');
    wrap.className='company-info-modal';
    wrap.innerHTML=`<div class="company-info-backdrop" data-info-close></div><section class="company-info-sheet" role="dialog" aria-modal="true"><header><h3>${esc(title||'Information')}</h3><button type="button" class="icon-square-btn" data-info-close aria-label="Fermer">×</button></header><p>${esc(text||'')}</p></section>`;
    document.body.appendChild(wrap);
    qsa('[data-info-close]', wrap).forEach(btn=>btn.addEventListener('click', closeInfo));
  }

  function closeInfo(){ qs('.company-info-modal')?.remove(); }

  async function save(){
    company=read();
    company.updatedAt=new Date().toISOString();
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

  function bindEvents(){
    const form=qs('#company-form');
    form?.addEventListener('input', renderCalc);
    form?.addEventListener('change', renderCalc);
    form?.addEventListener('submit', async e=>{ e.preventDefault(); await save(); });
    form?.addEventListener('click', e=>{
      const info=e.target.closest('.info-dot');
      if(info){ e.preventDefault(); openInfo(info.dataset.infoTitle, info.dataset.info); return; }
      const remove=e.target.closest('[data-remove-staff]');
      if(remove){
        e.preventDefault();
        const staff=getStaffFromDom();
        staff.splice(Number(remove.dataset.removeStaff),1);
        renderProductionStaff(staff);
        renderCalc();
      }
    });
    qs('#add-production-staff-btn')?.addEventListener('click', ()=>{
      const staff=getStaffFromDom();
      staff.push({id:`staff_${Date.now()}`, nom:'', coutAnnuelEmployeur:'', heuresSemaine:''});
      renderProductionStaff(staff);
      renderProductionSummary(staff);
    });
    qs('#save-company-top-btn')?.addEventListener('click', save);
    qs('#reset-company-btn')?.addEventListener('click', reset);
  }

  async function render(){
    let stored=null;
    try{ stored=await AppDB.get(STORE, ID); }catch(e){ console.error('[mon-entreprise]', e); }
    company=stored?normalize(stored):empty();
    fill(company);
    renderCalc();
    bindEvents();
  }

  window.MonEntreprisePage={render};
})();
