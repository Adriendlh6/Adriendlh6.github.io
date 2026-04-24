/* Mon entreprise page module - line + bottom sheet layout */
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function esc(s=''){ return String(s ?? '').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function num(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return Number.isFinite(v)?v:0; const p=Number(String(v).replace(/\s+/g,'').replace(',','.').replace(/[^0-9.\-]/g,'')); return Number.isFinite(p)?p:0; }
  function euro(v){ return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v||0)); }
  function pct(v){ return Number.isFinite(Number(v)) ? `${new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(v))} %` : 'N/C'; }
  function numberLabel(v, digits=1){ return Number(v||0) ? new Intl.NumberFormat('fr-FR',{maximumFractionDigits:digits}).format(Number(v||0)) : 'N/C'; }
  function cleanPhone(v){ return String(v || '').trim(); }
  function companyLogoSrc(c){ return (c && c.logoDataUrl) ? c.logoDataUrl : DEFAULT_COMPANY_LOGO; }

  const STORE='entreprise';
  const ID='mon-entreprise';
  const DEFAULT_COMPANY_LOGO='assets/img/print-logo.png';
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
      logoDataUrl:data.logoDataUrl||'',
      updatedAt:data.updatedAt||new Date().toISOString()
    };
  }

  function empty(){ return normalize({}); }

  function ensureDatabase(){
    if(!window.AppDB || typeof AppDB.get !== 'function' || typeof AppDB.put !== 'function'){
      throw new Error('Base de données indisponible : AppDB non chargé.');
    }
  }

  function cloneCompanyForStorage(c){
    return normalize(JSON.parse(JSON.stringify(c || empty())));
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

  function infoButton(title, text){
    return `<button type="button" class="info-dot" data-info-title="${esc(title)}" data-info="${esc(text)}" aria-label="Aide">i</button>`;
  }

  function field(name, label, value='', attrs='', helpTitle='', helpText=''){
    const help = helpTitle ? infoButton(helpTitle, helpText) : '';
    return `<div class="field"><label for="${esc(name)}">${esc(label)} ${help}</label><input id="${esc(name)}" name="${esc(name)}" value="${esc(value)}" ${attrs}></div>`;
  }

  function textarea(name, label, value='', rows=4){
    return `<div class="field form-grid-span-full"><label for="${esc(name)}">${esc(label)}</label><textarea id="${esc(name)}" name="${esc(name)}" rows="${rows}">${esc(value)}</textarea></div>`;
  }

  function ncl(v){ return String(v || '').trim() || 'N/C'; }

  function renderIdentitySummary(){
    const root=qs('#company-identity-summary');
    if(!root) return;
    const c=company || empty();
    const title=ncl(c.nomCommercial || c.raisonSociale);
    const legal=ncl(c.raisonSociale || c.nomCommercial);
    root.innerHTML=`
      <div class="company-identity-summary-logo">
        <img src="${esc(companyLogoSrc(c))}" alt="Logo entreprise">
      </div>
      <div class="company-identity-summary-main">
        <div class="company-identity-summary-head">
          <span>Carte d’identité</span>
          <strong>${esc(title)}</strong>
        </div>
        <div class="company-identity-summary-grid">
          <div><small>Raison sociale</small><b>${esc(legal)}</b></div>
          <div><small>SIRET</small><b>${esc(ncl(c.siret))}</b></div>
          <div><small>Téléphone</small><b>${esc(ncl(c.telephone))}</b></div>
          <div><small>Mail</small><b>${esc(ncl(c.mail))}</b></div>
          <div class="span-full"><small>Adresse</small><b>${esc(ncl(c.adresse))}</b></div>
        </div>
      </div>`;
  }

  function row({id, icon, title, subtitle, meta}){
    return `<button type="button" class="company-line" data-company-section="${esc(id)}">
      <span class="company-line-icon" aria-hidden="true">${esc(icon)}</span>
      <span class="company-line-main"><strong>${esc(title)}</strong><small>${esc(subtitle || 'À compléter')}</small></span>
      ${meta ? `<span class="company-line-meta">${esc(meta)}</span>` : ''}
      <span class="company-line-chevron" aria-hidden="true">›</span>
    </button>`;
  }

  function renderLines(){
    const root=qs('#company-lines');
    if(!root) return;
    const c=company || empty();
    const stats=staffStats(c.personnelProduction, c.semainesProductives);
    const calc=compute(c);
    const identity=[c.nomCommercial, c.raisonSociale].filter(Boolean).join(' · ');
    const quote=[c.prefixeDevis ? `Préfixe ${c.prefixeDevis}` : '', c.tvaDefault ? `TVA ${c.tvaDefault} %` : '', c.validiteDevisJours ? `${c.validiteDevisJours} j` : ''].filter(Boolean).join(' · ');
    const financial=[c.caHT ? `CA ${euro(num(c.caHT))}` : '', c.fraisGeneraux ? `FG ${euro(num(c.fraisGeneraux))}` : ''].filter(Boolean).join(' · ');
    const coef=calc.coefficient?new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(calc.coefficient):'N/C';
    root.innerHTML=`
      ${row({id:'identity', icon:'🏢', title:'Infos entreprise', subtitle:identity || 'Nom, SIRET, téléphone, mail, adresse', meta:c.siret || ''})}
      ${row({id:'quote', icon:'🧾', title:'Réglage devis', subtitle:quote || 'Validité, paiement, TVA, mentions', meta:''})}
      ${row({id:'staff', icon:'👨‍🍳', title:'Salariés de production', subtitle:stats.count ? `${stats.count} salarié(s) · ${euro(stats.totalCost)} · ${numberLabel(stats.totalWeeklyHours)} h/semaine` : 'Personnel directement affecté à la production', meta:stats.annualHours ? `${numberLabel(stats.annualHours)} h/an` : ''})}
      ${row({id:'financial', icon:'📊', title:'Données financières', subtitle:financial || 'CA, matières, frais généraux, masses salariales', meta:calc.base.label !== 'Non renseignée' ? calc.base.label : ''})}
      ${row({id:'calculation', icon:'🧮', title:'Coefficient frais généraux', subtitle:`Coefficient : ${coef} · Taux : ${calc.base.amount ? pct(calc.rate) : 'N/C'}`, meta:calc.coutHoraire ? `${euro(calc.coutHoraire)} / h` : ''})}
      ${row({id:'note', icon:'📝', title:'Note interne', subtitle:c.note ? 'Note renseignée' : 'Aucune note', meta:''})}
    `;
    renderIdentitySummary();
  }

  function openSheet(title, icon, body, onSave, options={}){
    closeSheet();
    const wrap=document.createElement('div');
    wrap.className='company-sheet-modal';
    wrap.innerHTML=`
      <div class="company-sheet-backdrop" data-sheet-close></div>
      <section class="company-bottom-sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="company-sheet-handle"></div>
        <header class="company-sheet-header">
          <div class="company-sheet-title"><span>${esc(icon)}</span><div><h3>${esc(title)}</h3><p>${esc(options.subtitle || 'Mon entreprise')}</p></div></div>
          <button type="button" class="icon-square-btn" data-sheet-close aria-label="Fermer">×</button>
        </header>
        <form class="company-sheet-body" id="company-sheet-form">${body}</form>
        <footer class="sheet-footer-actions company-sheet-footer">
          <button type="button" class="btn secondary" data-sheet-close>Annuler</button>
          ${options.readonly ? '' : '<button type="submit" class="btn primary">Enregistrer</button>'}
        </footer>
      </section>`;
    document.body.appendChild(wrap);
    qsa('[data-sheet-close]', wrap).forEach(btn=>btn.addEventListener('click', closeSheet));
    const form=qs('#company-sheet-form', wrap);
    form?.addEventListener('click', handleSheetClick);
    form?.addEventListener('submit', async e=>{
      e.preventDefault();
      if(typeof onSave === 'function') await onSave(form, wrap);
      await persist();
      closeSheet();
      renderLines();
    });
    if(options.readonly){ form?.addEventListener('submit', e=>e.preventDefault()); }
    return wrap;
  }

  function closeSheet(){ qs('.company-sheet-modal')?.remove(); }

  function openInfo(title, text){
    closeInfo();
    const wrap=document.createElement('div');
    wrap.className='company-info-modal';
    wrap.innerHTML=`<div class="company-info-backdrop" data-info-close></div><section class="company-info-sheet" role="dialog" aria-modal="true"><header><h3>${esc(title||'Information')}</h3><button type="button" class="icon-square-btn" data-info-close aria-label="Fermer">×</button></header><p>${esc(text||'')}</p></section>`;
    document.body.appendChild(wrap);
    qsa('[data-info-close]', wrap).forEach(btn=>btn.addEventListener('click', closeInfo));
  }
  function closeInfo(){ qs('.company-info-modal')?.remove(); }

  function handleSheetClick(e){
    const info=e.target.closest('.info-dot');
    if(info){ e.preventDefault(); openInfo(info.dataset.infoTitle, info.dataset.info); return; }
  }

  function fd(form, name){ return String(new FormData(form).get(name) || '').trim(); }

  async function persist(){
    ensureDatabase();
    company = cloneCompanyForStorage({...company, id:ID, updatedAt:new Date().toISOString()});
    await AppDB.put(STORE, company);
    renderIdentitySummary();
  }

  function openIdentity(){
    const c=company || empty();
    const modal=openSheet('Infos entreprise', '🏢', `<div class="company-identity-card">
      <div class="company-identity-logo-wrap">
        <img class="company-identity-logo" data-company-logo-preview src="${esc(companyLogoSrc(c))}" alt="Logo entreprise">
      </div>
      <div class="company-identity-main">
        <strong>Carte d’identité de l’entreprise</strong>
        <small>Logo, informations légales et coordonnées utilisées pour les futurs devis.</small>
        <div class="company-logo-actions">
          <button type="button" class="btn secondary" data-company-logo-import>Importer un logo</button>
          <button type="button" class="btn secondary" data-company-logo-default>Logo par défaut</button>
        </div>
      </div>
      <input type="file" accept="image/*" data-company-logo-file hidden>
      <input type="hidden" name="logoDataUrl" value="${esc(c.logoDataUrl || '')}">
    </div>
    <div class="form-grid">
      ${field('nomCommercial','Nom commercial',c.nomCommercial,'autocomplete="organization"')}
      ${field('raisonSociale','Raison sociale',c.raisonSociale,'autocomplete="organization"')}
      ${field('siret','SIRET',c.siret,'inputmode="numeric" autocomplete="off"')}
      ${field('tvaIntracom','TVA intracommunautaire',c.tvaIntracom,'autocomplete="off"')}
      ${field('telephone','Téléphone',c.telephone,'inputmode="tel" autocomplete="tel"')}
      ${field('mail','Mail',c.mail,'type="email" autocomplete="email"')}
      ${textarea('adresse','Adresse',c.adresse,3)}
    </div>`, async form=>{
      Object.assign(company, {
        logoDataUrl:fd(form,'logoDataUrl'),
        nomCommercial:fd(form,'nomCommercial'), raisonSociale:fd(form,'raisonSociale'), siret:fd(form,'siret'), tvaIntracom:fd(form,'tvaIntracom'),
        telephone:cleanPhone(fd(form,'telephone')), mail:fd(form,'mail'), adresse:fd(form,'adresse')
      });
    });

    const fileInput=qs('[data-company-logo-file]', modal);
    const hidden=qs('input[name="logoDataUrl"]', modal);
    const preview=qs('[data-company-logo-preview]', modal);
    qs('[data-company-logo-import]', modal)?.addEventListener('click', ()=>fileInput?.click());
    qs('[data-company-logo-default]', modal)?.addEventListener('click', ()=>{
      if(hidden) hidden.value='';
      if(preview) preview.src=DEFAULT_COMPANY_LOGO;
    });
    fileInput?.addEventListener('change', ()=>{
      const file=fileInput.files && fileInput.files[0];
      if(!file) return;
      if(!file.type.startsWith('image/')){ alert('Le fichier choisi doit être une image.'); return; }
      const reader=new FileReader();
      reader.onload=()=>{
        const value=String(reader.result || '');
        if(hidden) hidden.value=value;
        if(preview) preview.src=value || DEFAULT_COMPANY_LOGO;
      };
      reader.readAsDataURL(file);
    });
  }


  function openQuote(){
    const c=company || empty();
    openSheet('Réglage devis', '🧾', `<div class="form-grid">
      ${field('validiteDevisJours','Validité des devis',c.validiteDevisJours,'inputmode="numeric"')}
      ${field('delaiPaiement','Délai de paiement',c.delaiPaiement)}
      <div class="field"><label for="tvaDefault">TVA par défaut</label><select id="tvaDefault" name="tvaDefault"><option value=""></option>${['0','2.1','5.5','10','20'].map(v=>`<option value="${v}" ${String(c.tvaDefault)===v?'selected':''}>${v.replace('.',',')} %</option>`).join('')}</select></div>
      ${field('prefixeDevis','Préfixe devis',c.prefixeDevis)}
      ${textarea('mentionsDevis','Mentions / conditions par défaut',c.mentionsDevis,5)}
    </div>`, async form=>{
      Object.assign(company, {validiteDevisJours:fd(form,'validiteDevisJours'), delaiPaiement:fd(form,'delaiPaiement'), tvaDefault:fd(form,'tvaDefault'), prefixeDevis:fd(form,'prefixeDevis'), mentionsDevis:fd(form,'mentionsDevis')});
    });
  }

  function readStaffFromForm(form){
    return qsa('[data-production-staff-row]', form).map(row=>({
      id:row.dataset.staffId || `staff_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      nom:String(qs('[data-staff-name]', row)?.value || '').trim(),
      coutAnnuelEmployeur:String(qs('[data-staff-cost]', row)?.value || '').trim(),
      heuresSemaine:String(qs('[data-staff-hours]', row)?.value || '').trim()
    })).filter(item=>item.nom || item.coutAnnuelEmployeur || item.heuresSemaine);
  }

  function staffRow(item, idx){
    return `<article class="production-staff-row" data-production-staff-row data-staff-id="${esc(item.id)}">
      <div class="field"><label>Nom du salarié</label><input data-staff-name value="${esc(item.nom)}"></div>
      <div class="field"><label>Coût annuel brut employeur</label><input data-staff-cost inputmode="decimal" value="${esc(item.coutAnnuelEmployeur)}"></div>
      <div class="field"><label>Temps de travail par semaine</label><input data-staff-hours inputmode="decimal" value="${esc(item.heuresSemaine)}"></div>
      <button type="button" class="icon-square-btn danger" data-remove-staff="${idx}" aria-label="Supprimer" title="Supprimer">🗑️</button>
    </article>`;
  }

  function renderStaffList(form, list){
    const root=qs('#production-staff-list', form);
    if(!root) return;
    const staff=normalizeStaff(list);
    root.innerHTML = staff.length ? staff.map(staffRow).join('') : '<div class="empty-state mini">Aucun salarié de production ajouté.</div>';
    renderStaffSummary(form);
  }

  function renderStaffSummary(form){
    const box=qs('#production-staff-summary', form);
    if(!box) return;
    const staff=readStaffFromForm(form);
    const weeks=fd(form,'semainesProductives');
    const stats=staffStats(staff, weeks);
    box.innerHTML=`
      <div><span>Salariés</span><strong>${stats.count || 'N/C'}</strong></div>
      <div><span>Coût production</span><strong>${stats.totalCost ? euro(stats.totalCost) : 'N/C'}</strong></div>
      <div><span>Moyenne / salarié</span><strong>${stats.avgWeeklyHours ? `${numberLabel(stats.avgWeeklyHours)} h/sem` : 'N/C'}</strong></div>
      <div><span>Total hebdo</span><strong>${stats.totalWeeklyHours ? `${numberLabel(stats.totalWeeklyHours)} h/sem` : 'N/C'}</strong></div>
      <div><span>Heures annuelles</span><strong>${stats.annualHours ? `${numberLabel(stats.annualHours)} h` : 'N/C'}</strong></div>`;
  }

  function openStaff(){
    const c=company || empty();
    openSheet('Salariés de production', '👨‍🍳', `<div class="company-sheet-intro"><p>Ajoute uniquement le personnel directement affecté à la production. Le coût annuel employeur inclut salaire, charges et primes.</p></div>
      <div class="form-grid compact-form-grid">
        ${field('semainesProductives','Semaines productives annuelles',c.semainesProductives,'inputmode="decimal"','Semaines productives','Nombre de semaines réellement travaillées en production sur l’année, après congés, fermetures, absences prévisibles et formations.')}
      </div>
      <div class="production-staff-actions"><button type="button" class="btn secondary small" id="add-production-staff-btn">+ Ajouter un salarié</button></div>
      <div id="production-staff-list" class="production-staff-list"></div>
      <div class="production-staff-summary" id="production-staff-summary"></div>
      <details class="details helper-details production-hours-help"><summary><span class="section-icon">⏱️</span> Méthode pour calculer les heures productives annuelles</summary><div class="details-content hours-method-content"><p><strong>Méthode recommandée :</strong> partir du personnel réellement en production, puis multiplier les heures hebdomadaires par les semaines productives de l’année.</p><div class="hours-formula">Heures productives annuelles = somme des heures hebdomadaires production × semaines productives annuelles</div><ul><li>Retirer congés, jours fériés, fermetures, absences prévisibles et formations.</li><li>Retirer le temps non productif : commandes, administratif, réception fournisseur, pauses longues, gestion.</li><li>La moyenne des heures par salarié est calculée automatiquement.</li></ul></div></details>`, async form=>{
      const staff=readStaffFromForm(form);
      const stats=staffStats(staff, fd(form,'semainesProductives'));
      Object.assign(company, {personnelProduction:staff, semainesProductives:fd(form,'semainesProductives'), masseSalarialeProduction: stats.totalCost ? String(Math.round(stats.totalCost*100)/100) : '', heuresProductives: stats.annualHours ? String(Math.round(stats.annualHours*100)/100) : ''});
    });
    const form=qs('#company-sheet-form');
    renderStaffList(form, c.personnelProduction || []);
    form?.addEventListener('input', ()=>renderStaffSummary(form));
    qs('#add-production-staff-btn', form)?.addEventListener('click', ()=>{
      const staff=readStaffFromForm(form);
      staff.push({id:`staff_${Date.now()}`, nom:'', coutAnnuelEmployeur:'', heuresSemaine:''});
      renderStaffList(form, staff);
    });
    form?.addEventListener('click', e=>{
      const remove=e.target.closest('[data-remove-staff]');
      if(remove){
        e.preventDefault();
        const staff=readStaffFromForm(form);
        staff.splice(Number(remove.dataset.removeStaff),1);
        renderStaffList(form, staff);
      }
    });
  }

  function openFinancial(){
    const c=company || empty();
    openSheet('Données financières', '📊', `<div class="form-grid">
      ${field('caHT','Chiffre d’affaires HT annuel',c.caHT,'inputmode="decimal"','Chiffre d’affaires HT','Total des ventes hors taxes sur une année complète.')}
      ${field('achatsMatieresHT','Achats matières HT annuels',c.achatsMatieresHT,'inputmode="decimal"','Achats matières HT','Total annuel des achats de matières premières hors taxes.')}
      ${field('fraisGeneraux','Frais généraux annuels',c.fraisGeneraux,'inputmode="decimal"','Frais généraux','Charges indirectes annuelles : loyer, énergie, assurance, entretien, petit matériel, administratif, comptabilité, abonnements, etc.')}
      ${field('masseSalarialeVenteDirection','Masse salariale vente / direction',c.masseSalarialeVenteDirection,'inputmode="decimal"','Masse salariale vente / direction','Salaires, charges, primes et rémunérations liées à la vente, l’administratif, la gestion et la direction.')}
      ${field('masseSalarialeProduction','Rémunération production annuelle',c.masseSalarialeProduction,'inputmode="decimal"','Rémunération production','Coût annuel employeur des personnes qui produisent directement. Le menu Salariés peut remplir ce montant automatiquement.')}
      ${field('heuresProductives','Heures productives annuelles',c.heuresProductives,'inputmode="decimal"','Heures productives','Total annuel des heures réellement passées en production. Le menu Salariés peut remplir ce montant automatiquement.')}
      <div class="field form-grid-span-full"><label for="baseRepartition">Base de répartition ${infoButton('Base de répartition','Base utilisée pour répartir les frais généraux dans les futurs coûts de revient : chiffre d’affaires, matières ou rémunération de production.')}</label><select id="baseRepartition" name="baseRepartition"><option value=""></option><option value="ca" ${c.baseRepartition==='ca'?'selected':''}>Chiffre d’affaires HT</option><option value="matiere" ${c.baseRepartition==='matiere'?'selected':''}>Achats matières HT</option><option value="salaires" ${c.baseRepartition==='salaires'?'selected':''}>Rémunération production</option></select></div>
      <details class="details helper-details base-help-card form-grid-span-full"><summary><span class="section-icon">💡</span> Aide au choix de la base de répartition</summary><div class="details-content base-help-content" id="company-base-help-live"></div></details>
    </div>`, async form=>{
      Object.assign(company, {caHT:fd(form,'caHT'), achatsMatieresHT:fd(form,'achatsMatieresHT'), fraisGeneraux:fd(form,'fraisGeneraux'), masseSalarialeVenteDirection:fd(form,'masseSalarialeVenteDirection'), masseSalarialeProduction:fd(form,'masseSalarialeProduction'), heuresProductives:fd(form,'heuresProductives'), baseRepartition:fd(form,'baseRepartition')});
    });
    const form=qs('#company-sheet-form');
    const live=()=>renderBaseHelp({...company, caHT:fd(form,'caHT'), achatsMatieresHT:fd(form,'achatsMatieresHT'), masseSalarialeProduction:fd(form,'masseSalarialeProduction'), baseRepartition:fd(form,'baseRepartition')}, qs('#company-base-help-live', form));
    form?.addEventListener('input', live);
    form?.addEventListener('change', live);
    live();
  }

  function selectedBaseAdvice(base){
    if(base==='ca') return {title:'Chiffre d’affaires HT', text:'Base simple et globale. Utile pour répartir les frais généraux proportionnellement au niveau de vente. Moins précis pour comparer des produits très différents.'};
    if(base==='matiere') return {title:'Achats matières HT', text:'Base intéressante quand le coût matière pilote beaucoup le prix de revient. Elle pénalise davantage les produits riches en matières premières.'};
    if(base==='salaires') return {title:'Rémunération production', text:'Base pertinente si la main-d’œuvre de production est le vrai facteur limitant : produits longs à fabriquer, façonnage, viennoiserie, traiteur.'};
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

  function renderBaseHelp(c, box){
    if(!box) return;
    const advice=selectedBaseAdvice(c.baseRepartition||'');
    box.innerHTML=`<div class="base-help-main"><span>Base actuellement choisie</span><strong>${esc(advice.title)}</strong><p>${esc(advice.text)}</p><p class="base-help-reco">${esc(buildBaseRecommendation(c))}</p></div><div class="base-help-options"><article><strong>CA HT</strong><p>Simple, adapté pour une première approche.</p></article><article><strong>Matières</strong><p>Adapté si les ingrédients pèsent lourd.</p></article><article><strong>Production</strong><p>Adapté si le temps de fabrication domine.</p></article></div>`;
  }

  function openCalculation(){
    const c=company || empty();
    const calc=compute(c);
    const coef=calc.coefficient?new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(calc.coefficient):'N/C';
    const hour=calc.coutHoraire?`${euro(calc.coutHoraire)} / h`:'N/C';
    openSheet('Coefficient frais généraux', '🧮', `<div class="company-calculation-grid">
      <div><span>Base utilisée</span><strong>${esc(calc.base.label)}</strong><small>${calc.base.amount?euro(calc.base.amount):'Non renseignée'}</small></div>
      <div><span>Frais généraux</span><strong>${calc.frais?euro(calc.frais):'N/C'}</strong><small>Charges indirectes annuelles.</small></div>
      <div><span>Rémunération production</span><strong>${calc.salairesProduction?euro(calc.salairesProduction):'N/C'}</strong><small>Personnel directement productif.</small></div>
      <div><span>Masse salariale vente / direction</span><strong>${calc.salairesVenteDirection?euro(calc.salairesVenteDirection):'N/C'}</strong><small>Vente, gestion, administratif, dirigeant.</small></div>
      <div><span>Coefficient</span><strong>${coef}</strong><small>1 + frais généraux / base.</small></div>
      <div><span>Coût horaire repère</span><strong>${hour}</strong><small>MO production + frais généraux / heures.</small></div>
    </div>`, null, {readonly:true, subtitle:'Calcul automatique'});
  }

  function openNote(){
    const c=company || empty();
    openSheet('Note interne', '📝', `${textarea('note','Note interne',c.note,8)}`, async form=>{ company.note=fd(form,'note'); });
  }

  async function resetCompany(){
    if(!confirm('Réinitialiser les informations de Mon entreprise ?')) return;
    company=empty();
    await persist();
    renderLines();
  }

  function bindEvents(){
    qs('#company-lines')?.addEventListener('click', e=>{
      const row=e.target.closest('[data-company-section]');
      if(!row) return;
      const section=row.dataset.companySection;
      if(section==='identity') openIdentity();
      if(section==='quote') openQuote();
      if(section==='staff') openStaff();
      if(section==='financial') openFinancial();
      if(section==='calculation') openCalculation();
      if(section==='note') openNote();
    });
  }

  async function render(){
    let stored=null;
    try{
      ensureDatabase();
      stored=await AppDB.get(STORE, ID);
    }catch(e){
      console.error('[mon-entreprise]', e);
      const root=qs('#company-lines');
      if(root) root.innerHTML='<div class="card module-error"><h3>Base de données indisponible</h3><p>La page Mon entreprise ne peut pas lire ou écrire les données pour le moment.</p></div>';
    }
    company=stored?normalize(stored):empty();
    renderLines();
    bindEvents();
  }

  window.MonEntreprisePage={render};
})();
