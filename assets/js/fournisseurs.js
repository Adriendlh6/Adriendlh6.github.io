/* Fournisseurs page module */
(function(){
  const PAGE_ID = 'fournisseurs-module-root';
  const DEFAULT_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
      <rect width='120' height='120' rx='28' fill='#f4ede3'/>
      <circle cx='60' cy='42' r='18' fill='#caa277' opacity='0.9'/>
      <path d='M30 88c5-17 17-26 30-26s25 9 30 26' fill='none' stroke='#94663d' stroke-width='10' stroke-linecap='round'/>
      <path d='M60 24v36' stroke='#94663d' stroke-width='6' stroke-linecap='round' opacity='0.6'/>
    </svg>
  `)}`;

  function uid(prefix='id'){
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  function emptyContact(){
    return { id: uid('contact'), nom: '', prenom: '', qualite: '', mail: '', telephone: '', principal: false };
  }

  const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const DELIVERY_RECURRENCES = [
    { value: 'all', label: 'Toutes les semaines' },
    { value: 'odd', label: 'Semaines impaires' },
    { value: 'even', label: 'Semaines paires' },
  ];

  function emptyDeliveryRule(){
    return { id: uid('delivery'), jourCommande: '', jourLivraison: '', heureLimite: '', recurrence: 'all' };
  }

  function normalizeWeekdays(value){
    const list = Array.isArray(value) ? value : String(value || '').split(',');
    return list.map(v => String(v || '').trim()).filter(Boolean).filter(v => WEEKDAYS.includes(v));
  }

  function normalizeDeliveryRules(row){
    if (Array.isArray(row?.livraisons) && row.livraisons.length) {
      return row.livraisons.map(rule => ({ ...emptyDeliveryRule(), ...rule, id: rule.id || uid('delivery'), heureLimite: rule.heureLimite || rule.heureLimiteCommande || '' }));
    }
    if (row?.joursCommande || row?.joursLivraison) {
      return [{ ...emptyDeliveryRule(), jourCommande: row.joursCommande || '', jourLivraison: row.joursLivraison || '', heureLimite: row.heureLimite || row.heureLimiteCommande || '', recurrence: row.recurrence || 'all' }];
    }
    return [];
  }

  function summarizeWeekdays(days){
    const list = normalizeWeekdays(days);
    return list.length ? list.join(', ') : '';
  }

  function recurrenceLabel(value){
    return DELIVERY_RECURRENCES.find(item => item.value === value)?.label || 'Toutes les semaines';
  }

  function summarizeDeliveryRules(rules){
    if (!Array.isArray(rules) || !rules.length) return '';
    return rules.map(rule => {
      const parts = [];
      if (rule.jourCommande) parts.push(`Commande ${rule.jourCommande}`);
      if (rule.heureLimite) parts.push(`avant ${rule.heureLimite}`);
      if (rule.jourLivraison) parts.push(`→ Livraison ${rule.jourLivraison}`);
      if (rule.recurrence && rule.recurrence !== 'all') parts.push(`(${recurrenceLabel(rule.recurrence)})`);
      return parts.join(' ');
    }).join(' · ');
  }

  function firstNonEmpty(...values){
    for (const value of values){
      const clean = String(value || '').trim();
      if (clean) return clean;
    }
    return '';
  }

  function getPrincipalContact(item){
    const contacts = Array.isArray(item?.contacts) ? item.contacts : [];
    return contacts.find(contact => contact && contact.principal) || null;
  }

  function getSupplierDisplayContact(item){
    const principal = getPrincipalContact(item);
    if (principal){
      const fullName = firstNonEmpty([principal.prenom, principal.nom].filter(Boolean).join(' '), principal.nom, principal.prenom, 'N/C');
      const qualite = firstNonEmpty(principal.qualite, 'N/C');
      return `${fullName} (${qualite})`;
    }
    const entreprise = firstNonEmpty(item?.entrepriseNom, item?.nom);
    return entreprise ? `${entreprise} (Entreprise)` : 'N/C';
  }

  function getSupplierDisplayPhone(item){
    const principal = getPrincipalContact(item);
    return firstNonEmpty(principal?.telephone, item?.entrepriseTelephone, item?.telephone, 'N/C');
  }

  function getCallablePhone(item){
    const value = getSupplierDisplayPhone(item);
    if (!value || value === 'N/C') return '';
    return String(value).replace(/[^+\d]/g, '');
  }

  function getLinkedProductsForSupplier(item){
    const supplierId = String(item?.id || '');
    if (!supplierId) return [];
    return (ingredientsIndex || []).filter(ingredient => Array.isArray(ingredient?.offres) && ingredient.offres.some(offre => String(offre?.fournisseurId || '') === supplierId))
      .map(ingredient => {
        const linkedOffers = (ingredient.offres || []).filter(offre => String(offre?.fournisseurId || '') === supplierId);
        const bestOffer = linkedOffers.find(offre => offre?.sourcePrincipale) || linkedOffers[0] || null;
        return { ingredient, offer: bestOffer };
      })
      .sort((a, b) => String(a.ingredient?.nom || '').localeCompare(String(b.ingredient?.nom || ''), 'fr', { sensitivity: 'base' }));
  }

  function openLinkedProductDetail(productId){
    if (!productId) return;
    try { sessionStorage.setItem('copilot_open_product_id', String(productId)); } catch {}
    if ((location.hash || '').replace('#','') !== 'mercuriale') location.hash = '#mercuriale';
    else window.MercurialePage?.openDetailById?.(String(productId));
  }


  function getLocalCategoryById(id){
    return (categoriesIndex || []).find(cat => String(cat?.id || '') === String(id || '')) || null;
  }

  function categoryChipMarkup(category){
    if (!category) return '<span class="tag supplier-category-chip">Sans catégorie</span>';
    const bg = category.couleur || '#8b5e34';
    return `<span class="tag supplier-category-chip" style="--chip-color:${esc(bg)}">${esc(category.nom || 'Sans catégorie')}</span>`;
  }

  function sanitizeMail(value=''){
    const mail = String(value || '').trim();
    return /.+@.+\..+/.test(mail) ? mail : '';
  }

  function buildMapsUrl(value=''){
    const address = String(value || '').trim();
    return address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : '';
  }

  function bindLongPressAction(node, config){
    if (!node || !config?.value) return;
    let pressTimer = null;
    let longPressTriggered = false;
    const openAction = () => {
      let href = '';
      let prompt = '';
      const label = config.label || config.value;
      if (config.type === 'tel') {
        href = `tel:${config.value}`;
        prompt = `Appeler ${label} ?`;
      } else if (config.type === 'mail') {
        href = `mailto:${config.value}`;
        prompt = `Envoyer un mail à ${label} ?`;
      } else if (config.type === 'map') {
        href = buildMapsUrl(config.value);
        prompt = `Ouvrir l'adresse dans le GPS ?`;
      }
      if (!href) return;
      if (window.confirm(prompt)) window.location.href = href;
    };
    const start = () => {
      clearTimeout(pressTimer);
      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        openAction();
      }, 550);
    };
    const cancel = () => clearTimeout(pressTimer);
    node.addEventListener('mousedown', start);
    node.addEventListener('touchstart', start, { passive: true });
    ['mouseup','mouseleave','touchend','touchcancel','touchmove'].forEach(evt => node.addEventListener(evt, cancel, { passive: true }));
    node.addEventListener('click', (e) => {
      if (!longPressTriggered) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = false;
    });
    node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openAction();
    });
  }

  function getSupplierLogoSrc(item){
    return item?.logoDataUrl || DEFAULT_LOGO_DATA_URL;
  }

  const DEFAULT_LOGODEV_PK = 'pk_DHXzHaieQNiOe8cU6Kxqjw';

  function getLogoDevPublishableKey(){
    return String(window.localStorage.getItem('copilot.logoDevPk') || DEFAULT_LOGODEV_PK || '').trim();
  }

  function normalizeDomain(value=''){
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const hostname = new URL(withProtocol).hostname.replace(/^www\./i, '').trim().toLowerCase();
      return hostname;
    } catch {
      return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim().toLowerCase();
    }
  }

  function inferLogoDomain(draft){
    const explicit = normalizeDomain(draft.logoDomain || draft.siteWeb || '');
    if (explicit) return explicit;
    const mailDomain = String(draft.entrepriseMail || '').split('@')[1] || '';
    if (mailDomain) return normalizeDomain(mailDomain);
    const logoDomain = normalizeDomain(draft.logoUrl || '');
    if (logoDomain) return logoDomain;
    return '';
  }

  function buildLogoDevUrl(domain, token){
    const cleanDomain = normalizeDomain(domain);
    const cleanToken = String(token || '').trim();
    if (!cleanDomain) throw new Error('Domaine manquant');
    if (!cleanToken) throw new Error('Clé Logo.dev manquante');
    return `https://img.logo.dev/${encodeURIComponent(cleanDomain)}?token=${encodeURIComponent(cleanToken)}&size=256&format=png&retina=true&fallback=monogram`;
  }

  async function fetchLogoAsDataUrl(url){
    const cleanUrl = String(url || '').trim();
    if (!cleanUrl) throw new Error('URL manquante');
    const response = await fetch(cleanUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`Impossible de récupérer le logo (${response.status})`);
    const blob = await response.blob();
    if (!String(blob.type || '').startsWith('image/')) throw new Error("Le fichier récupéré n'est pas une image");
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Conversion du logo impossible'));
      reader.readAsDataURL(blob);
    });
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
      entrepriseSiret: row.entrepriseSiret || row.siret || '',
      commercial: row.commercial || row.contact || '',
      contacts: Array.isArray(row.contacts) && row.contacts.length
        ? row.contacts.map((contact) => ({ ...emptyContact(), ...contact, id: contact.id || uid('contact'), principal: Boolean(contact?.principal) }))
        : (row.contact || row.telephone || row.mail
          ? [{ ...emptyContact(), nom: row.contact || '', qualite: 'Commercial', mail: row.mail || '', telephone: row.telephone || '', principal: false }]
          : []),
      joursCommande: row.joursCommande || '',
      joursLivraison: row.joursLivraison || '',
      magasinPhysiqueJours: normalizeWeekdays(row.magasinPhysiqueJours || row.joursMagasin || ''),
      livraisons: normalizeDeliveryRules(row),
      noteInterne: row.noteInterne || row.notes || '',
      archived: Boolean(row.archived),
      historique: Array.isArray(row.historique) ? row.historique : [],
      produits: Array.isArray(row.produits) ? row.produits : [],
      factures: Array.isArray(row.factures) ? row.factures : [],
      logoUrl: row.logoUrl || '',
      logoDomain: row.logoDomain || row.siteWeb || '',
      siteWeb: row.siteWeb || row.logoDomain || '',
      logoDataUrl: row.logoDataUrl || '',
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
    const principalContact = getPrincipalContact(draft) || null;
    const record = {
      ...existing,
      ...draft,
      nom: draft.entrepriseNom,
      contact: principalContact ? ([principalContact.prenom, principalContact.nom].filter(Boolean).join(' ').trim() || draft.commercial || '') : (draft.commercial || ''),
      telephone: principalContact?.telephone || draft.entrepriseTelephone || '',
      mail: principalContact?.mail || draft.entrepriseMail || '',
      adresse: draft.entrepriseAdresse || '',
      siret: draft.entrepriseSiret || '',
      entrepriseSiret: draft.entrepriseSiret || '',
      siteWeb: draft.siteWeb || draft.logoDomain || '',
      logoDomain: draft.logoDomain || draft.siteWeb || '',
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
        <section class="item suppliers-shell-card">
          <div class="suppliers-shell-head">
            <div class="suppliers-shell-copy">
              <h2 class="suppliers-title">Gestion des fournisseurs</h2>
              <p class="suppliers-subtitle">Référentiel fournisseurs, contacts et informations de gestion.</p>
            </div>
            <div class="mercuriale-actions suppliers-shell-actions">
              <button type="button" class="icon-square-btn" id="suppliers-print-btn" title="Imprimer">🖨️</button>
              <button type="button" class="icon-square-btn suppliers-archive-toggle" id="suppliers-archived-toggle" aria-pressed="false" title="Voir les archivés" aria-label="Voir les archivés">🗂️</button>
              <button type="button" class="icon-square-btn primary" id="suppliers-add-btn" title="Ajouter">＋</button>
            </div>
          </div>

          <div id="suppliers-selection-bar" class="suppliers-selection-bar hidden"></div>

          <section class="card mercuriale-toolbar-card suppliers-search-card">
            <div class="mercuriale-toolbar-topline suppliers-search-row">
              <div class="field mercuriale-search-field suppliers-search-field">
                <label for="suppliers-search-input">Recherche</label>
                <input id="suppliers-search-input" class="input" type="search" placeholder="Nom, commercial ou téléphone" autocomplete="off">
              </div>
            </div>
          </section>

          <div id="suppliers-list" class="suppliers-list"></div>
        </section>
      </section>

      <div id="supplier-sheet-backdrop" class="sheet-backdrop hidden"></div>
      <aside id="supplier-sheet" class="bottom-sheet supplier-sheet hidden" aria-hidden="true"></aside>
    `;
  }

  function supplierRowMarkup(item, options={}){
    const contactLabel = getSupplierDisplayContact(item);
    const phone = getSupplierDisplayPhone(item);
    const callable = getCallablePhone(item);
    const selected = Boolean(options.selected);
    return `
      <article class="item product-card supplier-card-lite ${item.archived ? 'is-archived' : ''} ${selected ? 'is-selected' : ''}" data-supplier-open="${item.id}" data-supplier-phone="${esc(callable)}" tabindex="0" aria-selected="${selected ? 'true' : 'false'}">
        <div class="item-top supplier-row-main">
          <div class="supplier-row-branding">
            <img class="supplier-logo-thumb" src="${getSupplierLogoSrc(item)}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_DATA_URL}'" alt="Logo ${esc(item.entrepriseNom || item.nom || 'fournisseur')}">
            <div>
              <strong>${esc(item.entrepriseNom || item.nom || 'Sans nom')}</strong>
              <div class="muted">${esc(contactLabel)}</div>
              <div class="muted">${esc(phone)}</div>
            </div>
          </div>
          ${item.archived ? '<span class="supplier-row__badge">Archivé</span>' : ''}
        </div>
      </article>
    `;
  }

  function infoLine(label, value){
    return `<div class="supplier-info-line"><span class="supplier-info-line__label">${label}</span><span class="supplier-info-line__value">${esc(value || '—')}</span></div>`;
  }

  function infoActionLine(label, value, actionType, naked = false){
    const clean = String(value || '').trim();
    if (!clean) return naked ? '<span class="muted">N/C</span>' : infoLine(label, '—');
    const button = `<button type="button" class="supplier-info-line__value supplier-action-link" data-action-type="${esc(actionType)}" data-action-value="${esc(clean)}">${esc(clean)}</button>`;
    if (naked) return button;
    return `<div class="supplier-info-line"><span class="supplier-info-line__label">${label}</span>${button}</div>`;
  }

  function renderReadSheet(item){
    const sheet = qs('#supplier-sheet');
    const backdrop = qs('#supplier-sheet-backdrop');
    const contacts = Array.isArray(item.contacts) ? item.contacts : [];
    const primaryContact = contacts.find(contact => contact?.principal) || null;
    const identityLine = primaryContact
      ? [ [primaryContact.prenom, primaryContact.nom].filter(Boolean).join(' ').trim(), primaryContact.qualite ? `(${primaryContact.qualite})` : '' ].filter(Boolean).join(' ')
      : (item.entrepriseNom || 'N/C');
    const contactsMarkup = contacts.length ? contacts.map((contact, idx) => `
      <section class="card compact-card supplier-detail-card supplier-contact-card">
        <div class="item-top supplier-contact-top">
          <h4><span class="supplier-contact-index">Contact ${idx + 1}</span>${contact.qualite ? ` <span class="supplier-contact-role">(${esc(contact.qualite)})</span>` : ''}</h4>
          ${contact.principal ? '<span class="tag">Principal</span>' : ''}
        </div>
        <div class="detail-grid supplier-detail-grid">
          <div>
            <div class="detail-label">Nom / prénom</div>
            <div class="detail-value">${esc([contact.prenom, contact.nom].filter(Boolean).join(' ') || 'N/C')}</div>
          </div>
          <div>
            <div class="detail-label">Téléphone</div>
            <div class="detail-value">${infoActionLine('', contact.telephone, 'tel', true)}</div>
          </div>
          <div class="field--full">
            <div class="detail-label">Mail</div>
            <div class="detail-value">${infoActionLine('', contact.mail, 'mail', true)}</div>
          </div>
        </div>
      </section>
    `).join('') : `<section class="card compact-card placeholder-card"><div class="supplier-block-title"><span class="supplier-block-title__icon">👥</span><span>Contacts</span></div><p class="muted">Aucun contact renseigné.</p></section>`;
    sheet.innerHTML = `
      <div class="sheet-header supplier-sheet-header supplier-sheet-header--detail">
        <div class="supplier-sheet-identity">
          <img class="supplier-logo-large" src="${getSupplierLogoSrc(item)}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_DATA_URL}'" alt="Logo ${esc(item.entrepriseNom || 'fournisseur')}">
          <div>
            <h3>${esc(item.entrepriseNom || 'Sans nom')}</h3>
            <div class="muted supplier-detail-subtitle">Fiche fournisseur</div>
          </div>
        </div>
        <button type="button" class="icon-btn" data-supplier-close>✕</button>
      </div>

      <section class="detail-panel supplier-detail-panel">
        <div class="detail-actions-row">
          <button class="icon-square-btn" type="button" data-supplier-edit="${item.id}" aria-label="Modifier" title="Modifier">✏️</button>
          <button class="icon-square-btn" type="button" data-supplier-print aria-label="Imprimer" title="Imprimer">🖨️</button>
          <button class="icon-square-btn ${item.archived ? '' : 'danger'}" type="button" data-supplier-archive="${item.id}" aria-label="${item.archived ? 'Réactiver' : 'Archiver'}" title="${item.archived ? 'Réactiver' : 'Archiver'}">${item.archived ? '↩️' : '🗂️'}</button>
        </div>

        <div class="detail-tabs" role="tablist" aria-label="Sections fournisseur">
          <button class="detail-tab active" type="button" data-supplier-tab="infos" aria-selected="true">Infos</button>
          <button class="detail-tab" type="button" data-supplier-tab="historique" aria-selected="false">Historique</button>
          <button class="detail-tab" type="button" data-supplier-tab="produits" aria-selected="false">Produits</button>
          <button class="detail-tab" type="button" data-supplier-tab="facture" aria-selected="false">Facture</button>
        </div>

        <div class="detail-tab-panel active" data-supplier-panel="infos">
          <section class="card compact-card supplier-detail-card">
            <div class="supplier-block-title"><span class="supplier-block-title__icon">🏢</span><span>Entreprise</span></div>
            <div class="detail-grid supplier-detail-grid">
              <div>
                <div class="detail-label">Nom</div>
                <div class="detail-value detail-title-value">${esc(item.entrepriseNom || 'N/C')}</div>
              </div>
              <div>
                <div class="detail-label">SIRET</div>
                <div class="detail-value">${esc(item.entrepriseSiret || item.siret || 'N/C')}</div>
              </div>
              <div>
                <div class="detail-label">Téléphone</div>
                <div class="detail-value">${infoActionLine('', item.entrepriseTelephone, 'tel', true)}</div>
              </div>
              <div>
                <div class="detail-label">Mail</div>
                <div class="detail-value">${infoActionLine('', item.entrepriseMail, 'mail', true)}</div>
              </div>
              <div class="field--full supplier-detail-address-block">
                <div class="detail-label">Adresse</div>
                <div class="detail-value">${infoActionLine('', item.entrepriseAdresse, 'map', true)}</div>
              </div>
            </div>
          </section>

          <details class="details supplier-read-details" data-read-details="contacts">
            <summary><span class="supplier-block-title"><span class="supplier-block-title__icon">👥</span><span>Contacts</span></span></summary>
            <div class="details-content supplier-read-details__content">
              ${contactsMarkup}
            </div>
          </details>

          <details class="details supplier-read-details" data-read-details="approvisionnement">
            <summary><span class="supplier-block-title"><span class="supplier-block-title__icon">📦</span><span>Approvisionnement</span></span></summary>
            <div class="details-content supplier-read-details__content">
              <section class="card compact-card supplier-detail-card supplier-inner-card">
                <div class="detail-grid supplier-detail-grid">
                  <div>
                    <div class="detail-label">Magasin physique</div>
                    <div class="detail-value">${esc(summarizeWeekdays(item.magasinPhysiqueJours) || 'N/C')}</div>
                  </div>
                  <div>
                    <div class="detail-label">Livraisons</div>
                    <div class="detail-value">${esc(summarizeDeliveryRules(item.livraisons) || 'N/C')}</div>
                  </div>
                </div>
              </section>
            </div>
          </details>

          <section class="card compact-card detail-note-card supplier-detail-card">
            <div class="supplier-block-title"><span class="supplier-block-title__icon">📝</span><span>Note interne</span></div>
            ${item.noteInterne ? `<div class="detail-value supplier-detail-note">${esc(item.noteInterne)}</div>` : '<p class="muted">Aucune note interne.</p>'}
          </section>
        </div>

        <div class="detail-tab-panel" data-supplier-panel="historique">
          <section class="card compact-card supplier-detail-card">
            <h4>Historique</h4>
            ${(item.historique || []).length ? `<div class="supplier-history-list">${item.historique.slice(0, 20).map(entry => `
              <div class="supplier-history-item">
                <strong>${esc(entry.label || entry.action || 'Événement')}</strong>
                <span>${new Date(entry.date).toLocaleDateString('fr-FR')}</span>
              </div>`).join('')}</div>` : '<p class="muted">Historique à venir.</p>'}
          </section>
        </div>

        <div class="detail-tab-panel" data-supplier-panel="produits">
          <section class="card compact-card supplier-detail-card">
            <h4>Produits</h4>
            ${(() => {
              const linkedProducts = getLinkedProductsForSupplier(item);
              if (!linkedProducts.length) return '<p class="muted">Aucun produit lié à ce fournisseur.</p>';
              return `<div class="supplier-linked-products">${linkedProducts.map(({ ingredient, offer }) => {
                const category = getLocalCategoryById(ingredient.categorieId);
                const price = offer && Number.isFinite(Number(offer.prixHTUnite)) && Number(offer.prixHTUnite) > 0 ? euro(offer.prixHTUnite) : 'N/C';
                return `
                  <button type="button" class="item product-card supplier-product-row" data-linked-product-open="${esc(ingredient.id)}">
                    <div class="supplier-product-row__main">
                      <strong>${esc(ingredient.nom || 'N/C')}</strong>
                      <div class="toolbar chip-row">${categoryChipMarkup(category)}</div>
                    </div>
                    <div class="supplier-product-row__price">${esc(price)} HT</div>
                  </button>`;
              }).join('')}</div>`;
            })()}
          </section>
        </div>

        <div class="detail-tab-panel" data-supplier-panel="facture">
          <section class="card compact-card placeholder-card">
            <h4>Facture</h4>
            <p class="muted">À venir. Cet onglet accueillera les documents et factures du fournisseur.</p>
          </section>
        </div>
      </section>
    `;
    qsa('[data-supplier-close]', sheet).forEach(btn => btn.onclick = () => closeSheet(sheet, backdrop));
    qsa('.detail-tab', sheet).forEach(btn => {
      btn.onclick = () => {
        qsa('.detail-tab', sheet).forEach(tab => {
          const active = tab === btn;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        qsa('[data-supplier-panel]', sheet).forEach(panel => panel.classList.toggle('active', panel.dataset.supplierPanel === btn.dataset.supplierTab));
      };
    });
    qs('[data-supplier-edit]', sheet)?.addEventListener('click', () => renderEditSheet(item));
    qs('[data-supplier-print]', sheet)?.addEventListener('click', () => alert("Impression fournisseur à venir."));
    qs('[data-supplier-archive]', sheet)?.addEventListener('click', async () => {
      await archiveSupplier(item.id);
      closeSheet(sheet, backdrop);
      await render();
    });
    qsa('[data-linked-product-open]', sheet).forEach(node => {
      node.addEventListener('click', () => openLinkedProductDetail(node.dataset.linkedProductOpen));
    });
    qsa('[data-action-type]', sheet).forEach(node => {
      const type = node.dataset.actionType;
      const rawValue = node.dataset.actionValue || '';
      const value = type === 'tel' ? String(rawValue).replace(/[^+\d]/g, '') : (type === 'mail' ? sanitizeMail(rawValue) : rawValue);
      bindLongPressAction(node, { type, value, label: rawValue });
    });
    openSheet(sheet, backdrop);
  }

  function contactFields(contact, idx){
    return `
      <section class="supplier-card supplier-card--edit">
        <div class="supplier-card__head">
          <h4>Contact ${idx + 1}${contact.principal ? ' · Principal' : ''}</h4>
          ${idx > 0 ? `<button type="button" class="text-btn danger" data-contact-remove="${idx}">Supprimer</button>` : ''}
        </div>
        <div class="form-grid">
          <div class="field"><label>Nom</label><input class="input" type="text" name="contact_nom_${idx}" value="${esc(contact.nom)}"></div>
          <div class="field"><label>Prénom</label><input class="input" type="text" name="contact_prenom_${idx}" value="${esc(contact.prenom)}"></div>
          <div class="field"><label>Qualité</label><input class="input" type="text" name="contact_qualite_${idx}" value="${esc(contact.qualite)}"></div>
          <div class="field"><label>Mail</label><input class="input" type="email" name="contact_mail_${idx}" value="${esc(contact.mail)}"></div>
          <div class="field"><label>Téléphone</label><input class="input" type="tel" name="contact_telephone_${idx}" value="${esc(contact.telephone)}"></div>
          <label class="supplier-principal-toggle field--full">
            <input type="checkbox" name="contact_principal_${idx}" ${contact.principal ? 'checked' : ''}>
            <span>Interlocuteur principal</span>
          </label>
        </div>
      </section>
    `;
  }

  function weekdaySelectOptions(selectedValue){
    return ['<option value="">Choisir</option>'].concat(WEEKDAYS.map(day => `<option value="${day}" ${selectedValue === day ? 'selected' : ''}>${day}</option>`)).join('');
  }

  function recurrenceSelectOptions(selectedValue){
    return DELIVERY_RECURRENCES.map(item => `<option value="${item.value}" ${selectedValue === item.value ? 'selected' : ''}>${item.label}</option>`).join('');
  }

  function multiDayDropdownMarkup(selectedDays){
    const selected = normalizeWeekdays(selectedDays);
    const label = selected.length ? selected.join(', ') : 'Choisir les jours';
    return `
      <details class="multi-select" data-multi-select>
        <summary class="input multi-select__summary">${esc(label)}</summary>
        <div class="multi-select__menu">
          ${WEEKDAYS.map(day => `
            <label class="multi-select__option">
              <input type="checkbox" name="magasinPhysiqueJours" value="${day}" ${selected.includes(day) ? 'checked' : ''}>
              <span>${day}</span>
            </label>
          `).join('')}
        </div>
      </details>
    `;
  }

  function deliveryRuleFields(rule, idx){
    return `
      <section class="supplier-card supplier-card--edit supplier-card--delivery">
        <div class="supplier-card__head">
          <h4>Livraison ${idx + 1}</h4>
          <button type="button" class="text-btn danger" data-delivery-remove="${idx}">Supprimer</button>
        </div>
        <div class="form-grid supplier-organization-grid">
          <div class="field">
            <label>Jour de commande</label>
            <select class="input" name="livraison_commande_${idx}">${weekdaySelectOptions(rule.jourCommande)}</select>
          </div>
          <div class="field">
            <label>Jour de livraison</label>
            <select class="input" name="livraison_livraison_${idx}">${weekdaySelectOptions(rule.jourLivraison)}</select>
          </div>
          <div class="field">
            <label>Heure limite de commande</label>
            <input class="input" type="time" name="livraison_heure_${idx}" value="${esc(rule.heureLimite || '')}">
          </div>
          <div class="field">
            <label>Récurrence</label>
            <select class="input" name="livraison_recurrence_${idx}">${recurrenceSelectOptions(rule.recurrence)}</select>
          </div>
        </div>
      </section>
    `;
  }

  function bindMultiSelectSummary(sheet){
    qsa('[data-multi-select]', sheet).forEach(block => {
      const summary = qs('.multi-select__summary', block);
      const updateLabel = () => {
        const selected = qsa('input[type="checkbox"]:checked', block).map(input => input.value);
        summary.textContent = selected.length ? selected.join(', ') : 'Choisir les jours';
      };
      qsa('input[type="checkbox"]', block).forEach(input => input.addEventListener('change', updateLabel));
      updateLabel();
    });
  }

  function renderEditSheet(item = null){
    const sheet = qs('#supplier-sheet');
    const backdrop = qs('#supplier-sheet-backdrop');
    const draft = structuredClone(item || normalizeSupplier({ id: uid('supplier') }));
    draft.contacts = Array.isArray(draft.contacts) && draft.contacts.length ? draft.contacts : [];
    draft.magasinPhysiqueJours = normalizeWeekdays(draft.magasinPhysiqueJours);
    draft.livraisons = Array.isArray(draft.livraisons) && draft.livraisons.length ? draft.livraisons : [];
    const uiState = {
      logoOpen: false,
      contactsOpen: false,
      approvisionnementOpen: false,
      noteOpen: false,
      logoError: '',
      logoUrlOpen: false,
      logoDevOpen: false,
      logoUrlInput: draft.logoUrl || '',
      logoDevDomain: draft.logoDomain || draft.siteWeb || '',
      logoDevName: draft.entrepriseNom || ''
    };

    function syncDraftFromForm(){
      const form = qs('#supplier-edit-form', sheet);
      if (!form) return;
      const fd = new FormData(form);
      draft.entrepriseNom = String(fd.get('entrepriseNom') || '').trim();
      draft.nom = draft.entrepriseNom;
      draft.entrepriseTelephone = String(fd.get('entrepriseTelephone') || '').trim();
      draft.telephone = draft.entrepriseTelephone;
      draft.entrepriseMail = String(fd.get('entrepriseMail') || '').trim();
      draft.entrepriseAdresse = String(fd.get('entrepriseAdresse') || '').trim();
      draft.entrepriseSiret = String(fd.get('entrepriseSiret') || '').trim();
      draft.logoUrl = String(fd.get('logoUrl') || '').trim();
      draft.logoDomain = normalizeDomain(fd.get('logoDomain') || '');
      draft.siteWeb = draft.logoDomain;
      draft.magasinPhysiqueJours = normalizeWeekdays(fd.getAll('magasinPhysiqueJours'));
      draft.livraisons = draft.livraisons.map((rule, idx) => ({
        ...rule,
        jourCommande: String(fd.get(`livraison_commande_${idx}`) || '').trim(),
        jourLivraison: String(fd.get(`livraison_livraison_${idx}`) || '').trim(),
        heureLimite: String(fd.get(`livraison_heure_${idx}`) || '').trim(),
        recurrence: String(fd.get(`livraison_recurrence_${idx}`) || 'all').trim() || 'all'
      }));
      draft.joursCommande = draft.livraisons.map(rule => rule.jourCommande).filter(Boolean).join(', ');
      draft.joursLivraison = draft.livraisons.map(rule => rule.jourLivraison).filter(Boolean).join(', ');
      draft.noteInterne = String(fd.get('noteInterne') || '').trim();
      draft.contacts = draft.contacts.map((contact, idx) => ({
        ...contact,
        nom: String(fd.get(`contact_nom_${idx}`) || '').trim(),
        prenom: String(fd.get(`contact_prenom_${idx}`) || '').trim(),
        qualite: String(fd.get(`contact_qualite_${idx}`) || '').trim(),
        mail: String(fd.get(`contact_mail_${idx}`) || '').trim(),
        telephone: String(fd.get(`contact_telephone_${idx}`) || '').trim(),
        principal: fd.get(`contact_principal_${idx}`) === 'on'
      }));
      const firstPrincipalIndex = draft.contacts.findIndex(contact => contact.principal);
      if (firstPrincipalIndex > -1) {
        draft.contacts = draft.contacts.map((contact, idx) => ({ ...contact, principal: idx == firstPrincipalIndex }));
      }
    }

    const draw = () => {
      sheet.innerHTML = `
        <form id="supplier-edit-form" class="grid sheet-form" novalidate>
          <div class="sheet-header">
            <div>
              <h3>${item ? 'Modifier un fournisseur' : 'Ajouter un fournisseur'}</h3>
              <p class="muted">Entreprise, contacts et organisation fournisseur.</p>
            </div>
            <button type="button" class="icon-close-btn" data-supplier-close aria-label="Fermer">✕</button>
          </div>

          <div class="form-grid">
            <div class="field"><label>Nom de l'entreprise</label><input class="input" type="text" name="entrepriseNom" value="${esc(draft.entrepriseNom)}" required></div>
            <div class="field"><label>Téléphone</label><input class="input" type="tel" name="entrepriseTelephone" value="${esc(draft.entrepriseTelephone)}"></div>
            <div class="field"><label>Mail</label><input class="input" type="email" name="entrepriseMail" value="${esc(draft.entrepriseMail)}"></div>
            <div class="field"><label>SIRET</label><input class="input" type="text" inputmode="numeric" name="entrepriseSiret" value="${esc(draft.entrepriseSiret)}" placeholder="Optionnel"></div>
            <div class="field field--full"><label>Adresse</label><textarea class="input" name="entrepriseAdresse" rows="3">${esc(draft.entrepriseAdresse)}</textarea></div>
          </div>

          <details class="details" ${uiState.logoOpen ? 'open' : ''} data-details-section="logo">
            <summary>Logo</summary>
            <div class="details-content grid">
              <section class="supplier-card supplier-card--edit supplier-logo-card">
                <div class="supplier-logo-editor">
                  <img class="supplier-logo-preview" src="${getSupplierLogoSrc(draft)}" onerror="this.onerror=null;this.src='${DEFAULT_LOGO_DATA_URL}'" alt="Aperçu du logo">
                  <div class="supplier-logo-controls">
                    <div class="supplier-logo-actions">
                      <button type="button" class="btn secondary" data-logo-open-url>Importer depuis l'URL</button>
                      <button type="button" class="btn secondary" data-logo-open-dev>Récupérer via Logo.dev</button>
                      <button type="button" class="btn secondary" data-logo-reset>Logo par défaut</button>
                    </div>
                    <p class="muted supplier-logo-help">Le logo reste affiché ici après import. Les URLs sont masquées du formulaire principal.</p>
                    ${uiState.logoError ? `<p class="form-error">${esc(uiState.logoError)}</p>` : ''}
                  </div>
                </div>
              </section>
            </div>
          </details>

          <details class="details" ${uiState.contactsOpen ? 'open' : ''} data-details-section="contacts">
            <summary>Contacts</summary>
            <div class="details-content grid">
              <div class="supplier-inline-head supplier-inline-head--contacts">
                <p class="muted">Contacts facultatifs pour ce fournisseur.</p>
                <button type="button" class="icon-square-btn primary" data-contact-add title="Ajouter un contact" aria-label="Ajouter un contact">＋</button>
              </div>
              <div id="supplier-contacts-wrap" class="list">
                ${draft.contacts.length ? draft.contacts.map((contact, idx) => contactFields(contact, idx)).join('') : '<p class="muted">Aucun contact ajouté.</p>'}
              </div>
            </div>
          </details>

          <details class="details" ${uiState.approvisionnementOpen ? 'open' : ''} data-details-section="approvisionnement">
            <summary>Approvisionnement</summary>
            <div class="details-content grid">
              <section class="supplier-card supplier-card--edit">
                <div class="supplier-dot-title"><span class="supplier-dot"></span><h4>Magasin physique</h4></div>
                <div class="field field--full">
                  <label>Jours d'ouverture / réception</label>
                  ${multiDayDropdownMarkup(draft.magasinPhysiqueJours)}
                </div>
              </section>

              <section class="supplier-card supplier-card--edit">
                <div class="supplier-inline-head supplier-inline-head--contacts">
                  <div class="supplier-dot-title"><span class="supplier-dot"></span><h4>Livraison</h4></div>
                  <button type="button" class="icon-square-btn primary" data-delivery-add title="Ajouter un paramètre de livraison" aria-label="Ajouter un paramètre de livraison">＋</button>
                </div>
                <div id="supplier-delivery-wrap" class="list">
                  ${draft.livraisons.length ? draft.livraisons.map((rule, idx) => deliveryRuleFields(rule, idx)).join('') : '<p class="muted">Aucun paramètre de livraison ajouté.</p>'}
                </div>
              </section>
            </div>
          </details>

          <details class="details" ${uiState.noteOpen ? 'open' : ''} data-details-section="note">
            <summary>Note interne</summary>
            <div class="details-content grid">
              <div class="field field--full supplier-note-field"><textarea class="input" name="noteInterne" rows="4" placeholder="Ajouter une note interne">${esc(draft.noteInterne)}</textarea></div>
            </div>
          </details>

          <div class="sheet-footer-actions supplier-form-footer">
            <button type="button" class="btn secondary" data-supplier-cancel>Annuler</button>
            <button type="submit" class="btn primary">Enregistrer le fournisseur</button>
          </div>

          ${uiState.logoUrlOpen ? `
            <div class="supplier-mini-modal-backdrop" data-logo-dialog-close></div>
            <div class="supplier-mini-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-logo-url-title">
              <div class="supplier-mini-modal__head">
                <div>
                  <div class="sheet-kicker">Logo</div>
                  <h4 id="supplier-logo-url-title">Importer depuis une URL</h4>
                </div>
                <button type="button" class="icon-close-btn" data-logo-dialog-close aria-label="Fermer">✕</button>
              </div>
              <div class="supplier-mini-modal__body grid">
                <div class="field field--full">
                  <label>URL du logo</label>
                  <input class="input" type="url" data-logo-url-input value="${esc(uiState.logoUrlInput || '')}" placeholder="https://...">
                </div>
              </div>
              <div class="sheet-footer-actions supplier-mini-modal__actions">
                <button type="button" class="btn secondary" data-logo-dialog-close>Annuler</button>
                <button type="button" class="btn primary" data-logo-import-confirm>Importer</button>
              </div>
            </div>
          ` : ''}

          ${uiState.logoDevOpen ? `
            <div class="supplier-mini-modal-backdrop" data-logo-dev-close></div>
            <div class="supplier-mini-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-logo-dev-title">
              <div class="supplier-mini-modal__head">
                <div>
                  <div class="sheet-kicker">Logo</div>
                  <h4 id="supplier-logo-dev-title">Récupérer via Logo.dev</h4>
                </div>
                <button type="button" class="icon-close-btn" data-logo-dev-close aria-label="Fermer">✕</button>
              </div>
              <div class="supplier-mini-modal__body grid">
                <div class="field field--full">
                  <label>Domaine</label>
                  <input class="input" type="text" data-logo-dev-domain value="${esc(uiState.logoDevDomain || '')}" placeholder="puratos.fr">
                </div>
                <div class="field field--full">
                  <label>Nom de l’entreprise</label>
                  <input class="input" type="text" data-logo-dev-name value="${esc(uiState.logoDevName || draft.entrepriseNom || '')}" placeholder="Puratos">
                </div>
                <p class="muted supplier-logo-help">Si un domaine est renseigné, il est prioritaire. Sinon, la recherche se fait avec le nom de l’entreprise.</p>
              </div>
              <div class="sheet-footer-actions supplier-mini-modal__actions">
                <button type="button" class="btn secondary" data-logo-dev-close>Annuler</button>
                <button type="button" class="btn primary" data-logo-dev-confirm>Récupérer</button>
              </div>
            </div>
          ` : ''}
        </form>
      `;
      bindMultiSelectSummary(sheet);
      qsa('[data-supplier-close], [data-supplier-cancel]', sheet).forEach(btn => btn.onclick = () => item ? renderReadSheet(item) : closeSheet(sheet, backdrop));
      qsa('[data-contact-remove]', sheet).forEach(btn => btn.onclick = () => {
        syncDraftFromForm();
        draft.contacts.splice(Number(btn.dataset.contactRemove), 1);
        uiState.contactsOpen = true;
        draw();
      });
      qs('[data-contact-add]', sheet)?.addEventListener('click', () => {
        syncDraftFromForm();
        draft.contacts.push({ ...emptyContact(), principal: false });
        uiState.contactsOpen = true;
        draw();
      });
      qsa('[data-delivery-remove]', sheet).forEach(btn => btn.onclick = () => {
        syncDraftFromForm();
        draft.livraisons.splice(Number(btn.dataset.deliveryRemove), 1);
        uiState.approvisionnementOpen = true;
        draw();
      });
      qs('[data-delivery-add]', sheet)?.addEventListener('click', () => {
        syncDraftFromForm();
        draft.livraisons.push(emptyDeliveryRule());
        uiState.approvisionnementOpen = true;
        draw();
      });
      qs('[data-logo-open-url]', sheet)?.addEventListener('click', () => {
        syncDraftFromForm();
        uiState.logoError = '';
        uiState.logoOpen = true;
        uiState.logoUrlInput = draft.logoUrl || '';
        uiState.logoUrlOpen = true;
        draw();
      });
      qsa('[data-logo-dialog-close]', sheet).forEach(btn => btn.addEventListener('click', () => {
        uiState.logoUrlOpen = false;
        draw();
      }));
      qs('[data-logo-import-confirm]', sheet)?.addEventListener('click', async () => {
        syncDraftFromForm();
        uiState.logoError = '';
        uiState.logoOpen = true;
        uiState.logoUrlInput = String(qs('[data-logo-url-input]', sheet)?.value || '').trim();
        try {
          if (!uiState.logoUrlInput) throw new Error('Ajoute une URL de logo.');
          draft.logoUrl = uiState.logoUrlInput;
          const imported = await fetchLogoAsDataUrl(draft.logoUrl);
          draft.logoDataUrl = imported;
          uiState.logoUrlOpen = false;
        } catch (error) {
          uiState.logoError = error?.message || 'Import du logo impossible';
        }
        draw();
      });
      qs('[data-logo-open-dev]', sheet)?.addEventListener('click', () => {
        syncDraftFromForm();
        uiState.logoError = '';
        uiState.logoOpen = true;
        uiState.logoDevDomain = draft.logoDomain || draft.siteWeb || '';
        uiState.logoDevName = draft.entrepriseNom || '';
        uiState.logoDevOpen = true;
        draw();
      });
      qsa('[data-logo-dev-close]', sheet).forEach(btn => btn.addEventListener('click', () => {
        uiState.logoDevOpen = false;
        draw();
      }));
      qs('[data-logo-dev-confirm]', sheet)?.addEventListener('click', async () => {
        syncDraftFromForm();
        uiState.logoError = '';
        uiState.logoOpen = true;
        uiState.logoDevDomain = normalizeDomain(qs('[data-logo-dev-domain]', sheet)?.value || '');
        uiState.logoDevName = String(qs('[data-logo-dev-name]', sheet)?.value || '').trim();
        try {
          const token = getLogoDevPublishableKey();
          if (!token) throw new Error('Clé Logo.dev indisponible.');
          const domain = uiState.logoDevDomain || inferLogoDomain(draft);
          const name = uiState.logoDevName || draft.entrepriseNom;
          let resolvedUrl = '';
          if (domain) {
            draft.logoDomain = domain;
            draft.siteWeb = domain;
            resolvedUrl = buildLogoDevUrl(domain, token);
          } else if (name) {
            resolvedUrl = buildLogoDevNameUrl(name, token);
          } else {
            throw new Error('Ajoute un domaine ou un nom d’entreprise.');
          }
          draft.logoUrl = resolvedUrl;
          draft.logoDataUrl = await fetchLogoAsDataUrl(resolvedUrl);
          uiState.logoDevOpen = false;
        } catch (error) {
          uiState.logoError = error?.message || 'Récupération automatique du logo impossible';
        }
        draw();
      });
      qs('[data-logo-reset]', sheet)?.addEventListener('click', () => {
        syncDraftFromForm();
        draft.logoDataUrl = '';
        draft.logoUrl = '';
        uiState.logoError = '';
        uiState.logoOpen = true;
        draw();
      });
      qsa('[data-details-section]', sheet).forEach(details => {
        details.addEventListener('toggle', () => {
          if (details.dataset.detailsSection === 'logo') uiState.logoOpen = details.open;
          if (details.dataset.detailsSection === 'contacts') uiState.contactsOpen = details.open;
          if (details.dataset.detailsSection === 'approvisionnement') uiState.approvisionnementOpen = details.open;
          if (details.dataset.detailsSection === 'note') uiState.noteOpen = details.open;
        });
      });
      qsa('input[name^="contact_principal_"]', sheet).forEach(input => {
        input.addEventListener('change', () => {
          if (input.checked) {
            qsa('input[name^="contact_principal_"]', sheet).forEach(other => {
              if (other !== input) other.checked = false;
            });
          }
        });
      });

      qs('#supplier-edit-form').onsubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        if (!form.reportValidity()) return;

        syncDraftFromForm();
        draft.contacts = draft.contacts.filter(contact => [contact.nom, contact.prenom, contact.qualite, contact.mail, contact.telephone].some(Boolean));

        const primaryContact = getPrincipalContact(draft) || null;
        draft.commercial = primaryContact
          ? [primaryContact.prenom, primaryContact.nom].filter(Boolean).join(' ').trim()
          : '';

        const saved = await saveSupplier(draft, item ? 'updated' : 'created');
        closeSheet(sheet, backdrop);
        await render();
        renderReadSheet(saved);
      };
      openSheet(sheet, backdrop);
    };

    draw();
  }


  function removeRowActionMenu(){
    document.querySelectorAll('.supplier-mini-modal-backdrop[data-row-menu], .supplier-mini-modal[data-row-menu]').forEach(node => node.remove());
  }

  function openRowActionMenu(item, handlers={}){
    removeRowActionMenu();
    const callable = getCallablePhone(item);
    const backdrop = document.createElement('div');
    backdrop.className = 'supplier-mini-modal-backdrop';
    backdrop.dataset.rowMenu = 'true';
    const modal = document.createElement('div');
    modal.className = 'supplier-mini-modal supplier-row-menu';
    modal.dataset.rowMenu = 'true';
    modal.innerHTML = `
      <div class="supplier-mini-modal__head">
        <div>
          <h4>Action rapide</h4>
          <p class="muted">${esc(item.entrepriseNom || item.nom || 'Fournisseur')}</p>
        </div>
        <button type="button" class="icon-btn" data-row-menu-close>✕</button>
      </div>
      <div class="supplier-mini-modal__body supplier-row-menu__body">
        <button type="button" class="btn secondary" data-row-select>✔️ Sélectionner</button>
        <button type="button" class="btn secondary" data-row-call ${callable ? '' : 'disabled'}>📞 Appeler</button>
      </div>
    `;
    const close = () => removeRowActionMenu();
    backdrop.addEventListener('click', close);
    qs('[data-row-menu-close]', modal)?.addEventListener('click', close);
    qs('[data-row-select]', modal)?.addEventListener('click', () => {
      close();
      handlers.onSelect?.();
    });
    qs('[data-row-call]', modal)?.addEventListener('click', () => {
      if (!callable) return;
      close();
      window.location.href = `tel:${callable}`;
    });
    document.body.append(backdrop, modal);
  }

  function printSuppliersSelection(items){
    if (!Array.isArray(items) || !items.length) return;
    const content = `
      <html>
        <head>
          <title>Impression fournisseurs</title>
          <style>
            body{font-family:Arial,sans-serif;padding:24px;color:#111}
            h1{font-size:22px;margin:0 0 18px}
            table{width:100%;border-collapse:collapse}
            th,td{border:1px solid #ddd;padding:10px;text-align:left;font-size:14px;vertical-align:top}
            th{background:#f6f6f6}
          </style>
        </head>
        <body>
          <h1>Fournisseurs sélectionnés</h1>
          <table>
            <thead><tr><th>Entreprise</th><th>Interlocuteur</th><th>Téléphone</th></tr></thead>
            <tbody>
              ${items.map(item => `<tr><td>${esc(item.entrepriseNom || item.nom || 'N/C')}</td><td>${esc(getSupplierDisplayContact(item))}</td><td>${esc(getSupplierDisplayPhone(item))}</td></tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!win) return;
    win.document.open();
    win.document.write(content);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 150);
  }

  function bindRowInteractions(node, item, handlers={}){
    let pressTimer = null;
    let longPressTriggered = false;
    const start = () => {
      clearTimeout(pressTimer);
      longPressTriggered = false;
      pressTimer = setTimeout(() => {
        longPressTriggered = true;
        openRowActionMenu(item, { onSelect: handlers.onSelect });
      }, 550);
    };
    const cancel = () => clearTimeout(pressTimer);
    node.addEventListener('mousedown', start);
    node.addEventListener('touchstart', start, { passive: true });
    ['mouseup','mouseleave','touchend','touchcancel','touchmove'].forEach(evt => node.addEventListener(evt, cancel, { passive: true }));
    node.addEventListener('click', (e) => {
      if (longPressTriggered) {
        e.preventDefault();
        e.stopPropagation();
        longPressTriggered = false;
        return;
      }
      handlers.onClick?.();
    });
    node.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openRowActionMenu(item, { onSelect: handlers.onSelect });
    });
  }


  async function render(){
    renderShell();
    const [suppliersList, loadedIngredients, categoriesRow] = await Promise.all([
      loadSuppliers(),
      AppDB.getAll('ingredients'),
      AppDB.get('parametres', 'mercuriale_categories')
    ]);
    let list = suppliersList;
    ingredientsIndex = Array.isArray(loadedIngredients) ? loadedIngredients : [];
    categoriesIndex = Array.isArray(categoriesRow?.categories) ? categoriesRow.categories : [];
    const searchInput = qs('#suppliers-search-input');
    const printBtn = qs('#suppliers-print-btn');
    const addBtn = qs('#suppliers-add-btn');
    const archivedToggle = qs('#suppliers-archived-toggle');
    const target = qs('#suppliers-list');
    const selectionBar = qs('#suppliers-selection-bar');
    let showArchived = false;
    let selectionMode = false;
    const selectedIds = new Set();

    const refreshList = async () => {
      list = await loadSuppliers();
      drawList();
    };

    const exitSelectionMode = () => {
      selectionMode = false;
      selectedIds.clear();
      drawSelectionBar();
      drawList();
    };

    const toggleSelection = (id) => {
      if (selectedIds.has(id)) selectedIds.delete(id);
      else selectedIds.add(id);
      if (!selectedIds.size) selectionMode = false;
      drawSelectionBar();
      drawList();
    };

    const enterSelectionMode = (id) => {
      selectionMode = true;
      if (id) selectedIds.add(id);
      drawSelectionBar();
      drawList();
    };

    const drawSelectionBar = () => {
      if (!selectionBar) return;
      if (!selectionMode || !selectedIds.size) {
        selectionBar.classList.add('hidden');
        selectionBar.innerHTML = '';
        return;
      }
      selectionBar.classList.remove('hidden');
      selectionBar.innerHTML = `
        <div class="suppliers-selection-bar__copy">${selectedIds.size} sélectionné${selectedIds.size > 1 ? 's' : ''}</div>
        <div class="suppliers-selection-bar__actions">
          <button type="button" class="icon-square-btn" data-selection-print title="Imprimer la sélection">🖨️</button>
          <button type="button" class="icon-square-btn" data-selection-archive title="Archiver la sélection">🗂️</button>
          <button type="button" class="btn secondary" data-selection-cancel>Annuler</button>
        </div>
      `;
      qs('[data-selection-cancel]', selectionBar)?.addEventListener('click', exitSelectionMode);
      qs('[data-selection-print]', selectionBar)?.addEventListener('click', () => {
        const items = list.filter(item => selectedIds.has(item.id));
        printSuppliersSelection(items);
      });
      qs('[data-selection-archive]', selectionBar)?.addEventListener('click', async () => {
        const items = list.filter(item => selectedIds.has(item.id));
        for (const item of items) await archiveSupplier(item.id);
        await refreshList();
        exitSelectionMode();
      });
    };

    const drawList = () => {
      const term = String(searchInput?.value || '').toLowerCase().trim();
      const filtered = list
        .filter(item => showArchived ? item.archived : !item.archived)
        .filter(item => {
          if (!term) return true;
          const principal = getPrincipalContact(item) || {};
          const contactBlob = (Array.isArray(item.contacts) ? item.contacts : []).flatMap(c => [c?.nom, c?.prenom, c?.telephone, c?.qualite, c?.mail]);
          return [
            item.entrepriseNom,
            item.nom,
            item.entrepriseTelephone,
            principal.nom,
            principal.prenom,
            principal.telephone,
            principal.qualite,
            ...contactBlob
          ].filter(Boolean).join(' ').toLowerCase().includes(term);
        });

      target.innerHTML = filtered.length
        ? filtered.map(item => supplierRowMarkup(item, { selected: selectedIds.has(item.id) })).join('')
        : `<div class="notice">${showArchived ? 'Aucun fournisseur archivé.' : 'Aucun fournisseur trouvé.'}</div>`;

      qsa('[data-supplier-open]', target).forEach(btn => {
        const item = list.find(entry => entry.id === btn.dataset.supplierOpen);
        if (!item) return;
        bindRowInteractions(btn, item, {
          onClick: () => {
            if (selectionMode) {
              toggleSelection(item.id);
              return;
            }
            renderReadSheet(item);
          },
          onSelect: () => {
            if (!selectionMode) enterSelectionMode(item.id);
            else toggleSelection(item.id);
          }
        });
        btn.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (selectionMode) toggleSelection(item.id);
            else renderReadSheet(item);
          }
        };
      });

      if (archivedToggle) {
        archivedToggle.textContent = showArchived ? '📂' : '🗂️';
        archivedToggle.setAttribute('title', showArchived ? 'Voir les actifs' : 'Voir les archivés');
        archivedToggle.setAttribute('aria-label', showArchived ? 'Voir les actifs' : 'Voir les archivés');
        archivedToggle.setAttribute('aria-pressed', String(showArchived));
        archivedToggle.classList.toggle('active', showArchived);
      }
    };

    searchInput?.addEventListener('input', drawList);
    addBtn?.addEventListener('click', () => renderEditSheet());
    printBtn?.addEventListener('click', () => {
      if (selectionMode && selectedIds.size) {
        const items = list.filter(item => selectedIds.has(item.id));
        printSuppliersSelection(items);
        return;
      }
      alert("Impression fournisseurs à venir.");
    });
    archivedToggle?.addEventListener('click', () => {
      showArchived = !showArchived;
      if (selectionMode) exitSelectionMode();
      drawList();
    });

    drawSelectionBar();
    drawList();
  }

  window.FournisseursPage = { render };
})();
