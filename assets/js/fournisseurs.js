/* Fournisseurs page module */
(function(){
  const PAGE_ID = 'fournisseurs-module-root';

  function uid(prefix='id'){
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  function emptyContact(){
    return { id: uid('contact'), nom: '', prenom: '', qualite: '', mail: '', telephone: '' };
  }

  function normalizeSupplier(row){
    if (!row) return null;
    return {
      id: row.id || uid('supplier'),
      nom: row.nom || row.entrepriseNom || '',
      entrepriseNom: row.entrepriseNom || row.nom || '',
      telephone: row.telephone || row.entrepriseTelephone || '',
      entrepriseTelephone: row.entrepriseTelephone || row.telephone || '',
      entrepriseMail: row.entrepriseMail || row.mail || '',
      entrepriseAdresse: row.entrepriseAdresse || row.adresse || '',
      commercial: row.commercial || row.contact || '',
      contacts: Array.isArray(row.contacts) && row.contacts.length
        ? row.contacts.map(contact => ({ ...emptyContact(), ...contact, id: contact.id || uid('contact') }))
        : (row.contact || row.telephone || row.mail
          ? [{ ...emptyContact(), nom: row.contact || '', qualite: 'Commercial', mail: row.mail || '', telephone: row.telephone || '' }]
          : [emptyContact(), emptyContact()]),
      joursCommande: row.joursCommande || '',
      joursLivraison: row.joursLivraison || '',
      noteInterne: row.noteInterne || row.notes || '',
      archived: Boolean(row.archived),
      historique: Array.isArray(row.historique) ? row.historique : [],
      produits: Array.isArray(row.produits) ? row.produits : [],
      factures: Array.isArray(row.factures) ? row.factures : [],
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString()
    };
  }

  async function loadSuppliers(){
    const rows = await AppDB.getAll('fournisseurs');
    return rows.map(normalizeSupplier);
  }

  async function saveSupplier(draft, action='updated'){
    const now = new Date().toISOString();
    const existing = await AppDB.get('fournisseurs', draft.id).catch(() => null);
    const previousHistory = Array.isArray(existing?.historique) ? existing.historique : [];
    const contact1 = draft.contacts?.[0] || {};
    const record = {
      ...existing,
      ...draft,
      nom: draft.entrepriseNom,
      contact: [contact1.prenom, contact1.nom].filter(Boolean).join(' ').trim() || draft.commercial || '',
      telephone: draft.entrepriseTelephone || contact1.telephone || '',
      mail: draft.entrepriseMail || contact1.mail || '',
      adresse: draft.entrepriseAdresse || '',
      updatedAt: now,
      historique: [
        { id: uid('hist'), date: now, action, label: action === 'created' ? 'Création du fournisseur' : 'Modification de la fiche' },
        ...previousHistory
      ].slice(0, 50)
    };
    if (!existing) record.createdAt = now;
    await AppDB.put('fournisseurs', record);
    return normalizeSupplier(record);
  }

  async function archiveSupplier(id){
    const row = await AppDB.get('fournisseurs', id);
    if (!row) return;
    row.archived = !row.archived;
    row.updatedAt = new Date().toISOString();
    row.historique = [
      { id: uid('hist'), date: row.updatedAt, action: row.archived ? 'archived' : 'unarchived', label: row.archived ? 'Fournisseur archivé' : 'Fournisseur réactivé' },
      ...(Array.isArray(row.historique) ? row.historique : [])
    ].slice(0, 50);
    await AppDB.put('fournisseurs', row);
  }

  async function deleteSupplier(id){
    await AppDB.delete('fournisseurs', id);
  }

  function renderShell(){
    const host = qs('#app-content');
    host.innerHTML = `
      <section id="${PAGE_ID}" class="suppliers-page">
        <div class="suppliers-header-card">
          <div class="suppliers-header">
            <div>
              <h2 class="suppliers-title">Fournisseurs</h2>
              <p class="suppliers-subtitle">Gestion centralisée des partenaires et contacts.</p>
            </div>
            <div class="suppliers-actions">
              <button type="button" class="btn secondary" id="suppliers-print-btn">Imprimer</button>
              <button type="button" class="btn" id="suppliers-add-btn">Ajouter</button>
            </div>
          </div>
          <div class="suppliers-search-row">
            <input id="suppliers-search-input" class="input" type="search" placeholder="Rechercher un fournisseur, un commercial ou un téléphone">
          </div>
        </div>
        <div id="suppliers-list" class="suppliers-list"></div>
      </section>

      <div id="supplier-sheet-backdrop" class="sheet-backdrop hidden"></div>
      <aside id="supplier-sheet" class="bottom-sheet supplier-sheet hidden" aria-hidden="true"></aside>
    `;
  }

  function supplierRowMarkup(item){
    const contact = item.contacts?.[0] || {};
    const commercial = [contact.prenom, contact.nom].filter(Boolean).join(' ').trim() || item.commercial || '—';
    const phone = item.entrepriseTelephone || contact.telephone || '—';
    return `
      <button type="button" class="supplier-row ${item.archived ? 'is-archived' : ''}" data-supplier-open="${item.id}">
        <div class="supplier-row__main">
          <strong>${esc(item.entrepriseNom || item.nom || 'Sans nom')}</strong>
          <div class="supplier-row__meta">${esc(commercial)}</div>
          <div class="supplier-row__meta">${esc(phone)}</div>
        </div>
        ${item.archived ? '<span class="supplier-row__badge">Archivé</span>' : ''}
      </button>
    `;
  }

  function infoLine(label, value){
    return `<div class="supplier-info-line"><span class="supplier-info-line__label">${label}</span><span class="supplier-info-line__value">${esc(value || '—')}</span></div>`;
  }

  function renderReadSheet(item){
    const sheet = qs('#supplier-sheet');
    const backdrop = qs('#supplier-sheet-backdrop');
    const contacts = Array.isArray(item.contacts) ? item.contacts : [];
    sheet.innerHTML = `
      <div class="sheet-header">
        <div>
          <div class="sheet-kicker">Fournisseur</div>
          <h3>${esc(item.entrepriseNom || 'Sans nom')}</h3>
        </div>
        <button type="button" class="icon-btn" data-supplier-close>✕</button>
      </div>

      <div class="supplier-sheet-actions">
        <button type="button" class="btn secondary" data-supplier-edit="${item.id}">Modifier</button>
        <button type="button" class="btn secondary" data-supplier-print>Imprimer</button>
        <button type="button" class="btn danger" data-supplier-archive="${item.id}">${item.archived ? 'Réactiver' : 'Archiver'}</button>
      </div>

      <div class="supplier-tabs">
        <button type="button" class="supplier-tab active" data-supplier-tab="infos">Infos</button>
        <button type="button" class="supplier-tab" data-supplier-tab="historique">Historique</button>
        <button type="button" class="supplier-tab" data-supplier-tab="produits">Produits</button>
        <button type="button" class="supplier-tab" data-supplier-tab="facture">Facture</button>
      </div>

      <div class="supplier-tab-panel" data-supplier-panel="infos">
        <section class="supplier-card">
          <h4>Infos entreprise</h4>
          ${infoLine('Nom', item.entrepriseNom)}
          ${infoLine('Téléphone', item.entrepriseTelephone)}
          ${infoLine('Mail', item.entrepriseMail)}
          ${infoLine('Adresse', item.entrepriseAdresse)}
        </section>

        ${contacts.map((contact, idx) => `
          <section class="supplier-card">
            <h4>Contact ${idx + 1}</h4>
            ${infoLine('Nom / prénom', [contact.prenom, contact.nom].filter(Boolean).join(' '))}
            ${infoLine('Qualité', contact.qualite)}
            ${infoLine('Mail', contact.mail)}
            ${infoLine('Téléphone', contact.telephone)}
          </section>
        `).join('')}

        <section class="supplier-card">
          <h4>Organisation</h4>
          ${infoLine('Jours de commande', item.joursCommande)}
          ${infoLine('Jours de livraison', item.joursLivraison)}
          ${infoLine('Note interne', item.noteInterne)}
        </section>
      </div>

      <div class="supplier-tab-panel hidden" data-supplier-panel="historique">
        <section class="supplier-card">
          <h4>Historique</h4>
          ${(item.historique || []).length ? `<div class="supplier-history-list">${item.historique.slice(0, 20).map(entry => `
            <div class="supplier-history-item">
              <strong>${esc(entry.label || entry.action || 'Événement')}</strong>
              <span>${new Date(entry.date).toLocaleDateString('fr-FR')}</span>
            </div>`).join('')}</div>` : '<div class="notice">Historique à venir.</div>'}
        </section>
      </div>

      <div class="supplier-tab-panel hidden" data-supplier-panel="produits">
        <section class="supplier-card"><h4>Produits</h4><div class="notice">Section à venir.</div></section>
      </div>

      <div class="supplier-tab-panel hidden" data-supplier-panel="facture">
        <section class="supplier-card"><h4>Facture</h4><div class="notice">Section à venir.</div></section>
      </div>
    `;
    qsa('[data-supplier-close]', sheet).forEach(btn => btn.onclick = () => closeSheet(sheet, backdrop));
    qsa('.supplier-tab', sheet).forEach(btn => {
      btn.onclick = () => {
        qsa('.supplier-tab', sheet).forEach(tab => tab.classList.toggle('active', tab === btn));
        qsa('[data-supplier-panel]', sheet).forEach(panel => panel.classList.toggle('hidden', panel.dataset.supplierPanel !== btn.dataset.supplierTab));
      };
    });
    qs('[data-supplier-edit]', sheet)?.addEventListener('click', () => renderEditSheet(item));
    qs('[data-supplier-print]', sheet)?.addEventListener('click', () => alert("Impression fournisseur à venir."));
    qs('[data-supplier-archive]', sheet)?.addEventListener('click', async () => {
      await archiveSupplier(item.id);
      closeSheet(sheet, backdrop);
      await render();
    });
    openSheet(sheet, backdrop);
  }

  function contactFields(contact, idx){
    return `
      <section class="supplier-card supplier-card--edit">
        <div class="supplier-card__head">
          <h4>Contact ${idx + 1}</h4>
          ${idx > 0 ? `<button type="button" class="text-btn danger" data-contact-remove="${idx}">Supprimer</button>` : ''}
        </div>
        <div class="form-grid">
          <div class="field"><label>Nom</label><input class="input" type="text" name="contact_nom_${idx}" value="${esc(contact.nom)}"></div>
          <div class="field"><label>Prénom</label><input class="input" type="text" name="contact_prenom_${idx}" value="${esc(contact.prenom)}"></div>
          <div class="field"><label>Qualité</label><input class="input" type="text" name="contact_qualite_${idx}" value="${esc(contact.qualite)}"></div>
          <div class="field"><label>Mail</label><input class="input" type="email" name="contact_mail_${idx}" value="${esc(contact.mail)}"></div>
          <div class="field"><label>Téléphone</label><input class="input" type="tel" name="contact_telephone_${idx}" value="${esc(contact.telephone)}"></div>
        </div>
      </section>
    `;
  }

  function renderEditSheet(item = null){
    const sheet = qs('#supplier-sheet');
    const backdrop = qs('#supplier-sheet-backdrop');
    const draft = structuredClone(item || normalizeSupplier({ id: uid('supplier') }));
    draft.contacts = Array.isArray(draft.contacts) && draft.contacts.length ? draft.contacts : [emptyContact(), emptyContact()];

    const draw = () => {
      sheet.innerHTML = `
        <form id="supplier-edit-form">
          <div class="sheet-header">
            <div>
              <div class="sheet-kicker">${item ? 'Modifier le fournisseur' : 'Ajouter un fournisseur'}</div>
              <h3>${esc(draft.entrepriseNom || 'Nouvelle fiche fournisseur')}</h3>
            </div>
            <button type="button" class="icon-btn" data-supplier-close>✕</button>
          </div>

          <div class="supplier-sheet-actions">
            <button type="button" class="btn secondary" data-supplier-cancel>Annuler</button>
            <button type="submit" class="btn">Enregistrer</button>
          </div>

          <div class="supplier-tabs">
            <button type="button" class="supplier-tab active" data-supplier-tab="infos">Infos</button>
            <button type="button" class="supplier-tab" disabled>Historique</button>
            <button type="button" class="supplier-tab" disabled>Produits</button>
            <button type="button" class="supplier-tab" disabled>Facture</button>
          </div>

          <div class="supplier-tab-panel" data-supplier-panel="infos">
            <section class="supplier-card supplier-card--edit">
              <h4>Infos entreprise</h4>
              <div class="form-grid">
                <div class="field"><label>Nom</label><input class="input" type="text" name="entrepriseNom" value="${esc(draft.entrepriseNom)}" required></div>
                <div class="field"><label>Téléphone</label><input class="input" type="tel" name="entrepriseTelephone" value="${esc(draft.entrepriseTelephone)}"></div>
                <div class="field"><label>Mail</label><input class="input" type="email" name="entrepriseMail" value="${esc(draft.entrepriseMail)}"></div>
                <div class="field field--full"><label>Adresse</label><textarea class="input" name="entrepriseAdresse" rows="3">${esc(draft.entrepriseAdresse)}</textarea></div>
              </div>
            </section>

            <div id="supplier-contacts-wrap">
              ${draft.contacts.map((contact, idx) => contactFields(contact, idx)).join('')}
            </div>

            <div class="toolbar">
              <button type="button" class="btn secondary" data-contact-add>Ajouter un contact</button>
            </div>

            <section class="supplier-card supplier-card--edit">
              <h4>Organisation</h4>
              <div class="form-grid">
                <div class="field"><label>Jours de commande</label><input class="input" type="text" name="joursCommande" value="${esc(draft.joursCommande)}"></div>
                <div class="field"><label>Jours de livraison</label><input class="input" type="text" name="joursLivraison" value="${esc(draft.joursLivraison)}"></div>
                <div class="field field--full"><label>Note interne</label><textarea class="input" name="noteInterne" rows="4">${esc(draft.noteInterne)}</textarea></div>
              </div>
            </section>
          </div>
        </form>
      `;
      qsa('[data-supplier-close], [data-supplier-cancel]', sheet).forEach(btn => btn.onclick = () => item ? renderReadSheet(item) : closeSheet(sheet, backdrop));
      qsa('[data-contact-remove]', sheet).forEach(btn => btn.onclick = () => {
        draft.contacts.splice(Number(btn.dataset.contactRemove), 1);
        draw();
      });
      qs('[data-contact-add]', sheet)?.addEventListener('click', () => {
        draft.contacts.push(emptyContact());
        draw();
      });

      qs('#supplier-edit-form').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        draft.entrepriseNom = String(fd.get('entrepriseNom') || '').trim();
        draft.nom = draft.entrepriseNom;
        draft.entrepriseTelephone = String(fd.get('entrepriseTelephone') || '').trim();
        draft.telephone = draft.entrepriseTelephone;
        draft.entrepriseMail = String(fd.get('entrepriseMail') || '').trim();
        draft.entrepriseAdresse = String(fd.get('entrepriseAdresse') || '').trim();
        draft.joursCommande = String(fd.get('joursCommande') || '').trim();
        draft.joursLivraison = String(fd.get('joursLivraison') || '').trim();
        draft.noteInterne = String(fd.get('noteInterne') || '').trim();
        draft.contacts = draft.contacts.map((contact, idx) => ({
          ...contact,
          nom: String(fd.get(`contact_nom_${idx}`) || '').trim(),
          prenom: String(fd.get(`contact_prenom_${idx}`) || '').trim(),
          qualite: String(fd.get(`contact_qualite_${idx}`) || '').trim(),
          mail: String(fd.get(`contact_mail_${idx}`) || '').trim(),
          telephone: String(fd.get(`contact_telephone_${idx}`) || '').trim()
        })).filter(contact => [contact.nom, contact.prenom, contact.qualite, contact.mail, contact.telephone].some(Boolean));

        const saved = await saveSupplier(draft, item ? 'updated' : 'created');
        closeSheet(sheet, backdrop);
        await render();
        renderReadSheet(saved);
      };
      openSheet(sheet, backdrop);
    };

    draw();
  }

  async function render(){
    renderShell();
    const list = await loadSuppliers();
    const searchInput = qs('#suppliers-search-input');
    const printBtn = qs('#suppliers-print-btn');
    const addBtn = qs('#suppliers-add-btn');
    const target = qs('#suppliers-list');

    const drawList = () => {
      const term = String(searchInput?.value || '').toLowerCase().trim();
      const filtered = list
        .filter(item => !item.archived)
        .filter(item => {
          if (!term) return true;
          const c1 = item.contacts?.[0] || {};
          return [
            item.entrepriseNom,
            item.nom,
            item.entrepriseTelephone,
            c1.nom,
            c1.prenom,
            c1.telephone,
            c1.qualite
          ].filter(Boolean).join(' ').toLowerCase().includes(term);
        });

      target.innerHTML = filtered.length
        ? filtered.map(supplierRowMarkup).join('')
        : '<div class="notice">Aucun fournisseur trouvé.</div>';

      qsa('[data-supplier-open]', target).forEach(btn => {
        btn.onclick = () => {
          const item = list.find(entry => entry.id === btn.dataset.supplierOpen);
          if (item) renderReadSheet(item);
        };
      });
    };

    searchInput?.addEventListener('input', drawList);
    addBtn?.addEventListener('click', () => renderEditSheet());
    printBtn?.addEventListener('click', () => alert("Impression fournisseurs à venir."));
    drawList();
  }

  window.FournisseursPage = { render };
})();
