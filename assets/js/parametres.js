(function(){
  const DEFAULT_LOGODEV_PK = 'pk_DHXzHaieQNiOe8cU6Kxqjw';
  const STORE_LABELS = {
    ingredients: 'Mercuriale',
    fournisseurs: 'Fournisseurs',
    recettes: 'Recettes',
    parametres: 'Paramètres'
  };

  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }
  function esc(s=''){ return String(s).replace(/[&<>\"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
  function fmtDate(value){
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle:'short', timeStyle:'short' }).format(d);
  }
  function downloadText(filename, text, mime='application/json'){
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function getStats(){
    const stats = [];
    for (const store of (window.AppDB?.stores || [])) {
      const rows = await window.AppDB.getAll(store);
      const latest = rows
        .map(row => row?.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) || null;
      stats.push({
        store,
        label: STORE_LABELS[store] || store,
        count: rows.length,
        latest
      });
    }
    return stats;
  }

  function renderShell(stats){
    const root = qs('#parametres-root');
    if (!root) return;
    const total = stats.reduce((sum, item) => sum + item.count, 0);

    root.innerHTML = `
      <section class="card settings-hero">
        <div>
          <p class="eyebrow">Paramètres</p>
          <h2>Import / export de la base</h2>
          <p class="muted">Sauvegarde ou restaure la base locale de l'application sans réinjecter les anciens modules.</p>
        </div>
        <div class="settings-hero-badge">${total} enregistrements</div>
      </section>

      <section class="settings-grid">
        <article class="card settings-panel">
          <div class="panel-head">
            <div>
              <h3>Logo.dev</h3>
              <p class="muted">Clé publishable optionnelle pour récupérer automatiquement des logos depuis un domaine.</p>
            </div>
          </div>
          <div class="field field--full">
            <label>Clé publishable Logo.dev</label>
            <input class="input" id="settings-logodev-key" type="text" value="${esc(window.localStorage.getItem('copilot.logoDevPk') || DEFAULT_LOGODEV_PK || '')}" placeholder="pk_...">
          </div>
          <div class="settings-actions-row">
            <button type="button" class="btn" id="settings-logodev-clear-btn">Effacer</button>
            <button type="button" class="btn primary" id="settings-logodev-save-btn">Enregistrer la clé</button>
          </div>
          <p class="notice hidden" id="settings-logodev-notice"></p>
        </article>
      </section>

      <section class="card settings-panel">
        <div class="panel-head">
          <div>
            <h3>Contenu actuel de la base</h3>
            <p class="muted">Vue rapide des enregistrements présents par module.</p>
          </div>
        </div>
        <div class="settings-stats">
          ${stats.map(item => `
            <article class="settings-stat-card">
              <div class="settings-stat-top">
                <strong>${esc(item.label)}</strong>
                <span class="settings-stat-count">${item.count}</span>
              </div>
              <p class="muted">Dernière mise à jour : ${esc(fmtDate(item.latest))}</p>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function setNotice(id, message, kind='info'){
    const node = qs(id);
    if (!node) return;
    node.textContent = message;
    node.classList.remove('hidden', 'is-success', 'is-error');
    if (kind === 'success') node.classList.add('is-success');
    if (kind === 'error') node.classList.add('is-error');
  }

  function clearNotice(id){
    const node = qs(id);
    if (!node) return;
    node.textContent = '';
    node.classList.add('hidden');
    node.classList.remove('is-success', 'is-error');
  }

  async function bindEvents(){
    const exportBtn = qs('#settings-export-btn');
    const importInput = qs('#settings-import-input');
    const importBtn = qs('#settings-import-btn');
    const refreshBtn = qs('#settings-refresh-btn');
    const fileLabel = qs('#settings-import-file-label');

    exportBtn?.addEventListener('click', async () => {
      clearNotice('#settings-export-notice');
      try {
        const payload = await window.AppDB.exportAll();
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        downloadText(`copilot-boulangerie-backup-${stamp}.json`, JSON.stringify(payload, null, 2));
        setNotice('#settings-export-notice', 'Export terminé.', 'success');
      } catch (error) {
        setNotice('#settings-export-notice', `Export impossible : ${error?.message || error}`, 'error');
      }
    });

    importInput?.addEventListener('change', () => {
      clearNotice('#settings-import-notice');
      const file = importInput.files?.[0] || null;
      fileLabel.textContent = file ? file.name : 'Aucun fichier sélectionné';
      if (importBtn) importBtn.disabled = !file;
    });

    importBtn?.addEventListener('click', async () => {
      clearNotice('#settings-import-notice');
      const file = importInput?.files?.[0];
      if (!file) return;
      const ok = window.confirm('Cet import va remplacer toutes les données locales actuelles. Continuer ?');
      if (!ok) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        const stores = window.AppDB?.stores || [];
        const valid = payload && typeof payload === 'object' && stores.every(store => store in payload);
        if (!valid) throw new Error('Le fichier ne correspond pas à une sauvegarde valide.');
        await window.AppDB.importAll(payload);
        setNotice('#settings-import-notice', 'Import terminé. Les données locales ont été remplacées.', 'success');
        await render();
      } catch (error) {
        setNotice('#settings-import-notice', `Import impossible : ${error?.message || error}`, 'error');
      }
    });

    refreshBtn?.addEventListener('click', () => render());
  }

  async function render(){
    const stats = await getStats();
    renderShell(stats);
    await bindEvents();
  }

  window.ParametresPage = { render };
})();
