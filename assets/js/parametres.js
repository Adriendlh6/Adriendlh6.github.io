(function(){
  const TEST_DATA_URL = 'demo-data.json';
  const STORE_LABELS = {
    ingredients: 'Mercuriale',
    fournisseurs: 'Fournisseurs',
    recettes: 'Recettes',
    entreprise: 'Mon entreprise',
    parametres: 'Paramètres'
  };

  function qs(sel, root=document){ return root.querySelector(sel); }
  function esc(s=''){ return String(s ?? '').replace(/[&<>\"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m])); }
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

  function loadAssetOnce(type, url){
    return new Promise((resolve, reject) => {
      const selector = type === 'script' ? `script[src="${url}"]` : `link[href="${url}"]`;
      if (document.querySelector(selector)) return resolve();
      const node = document.createElement(type === 'script' ? 'script' : 'link');
      if (type === 'script') {
        node.src = url;
        node.defer = true;
      } else {
        node.rel = 'stylesheet';
        node.href = url;
      }
      node.onload = () => resolve();
      node.onerror = () => reject(new Error(`Impossible de charger ${url}`));
      document.head.appendChild(node);
    });
  }

  async function ensureBarcodeScanner(){
    if (!document.querySelector('link[href="assets/css/barcode-scanner.css"]')) {
      await loadAssetOnce('style', 'assets/css/barcode-scanner.css');
    }
    if (!window.BarcodeScanner) {
      await loadAssetOnce('script', 'assets/js/barcode-scanner.js');
    }
    if (!window.BarcodeScanner?.open) throw new Error('Module scanner indisponible.');
    return window.BarcodeScanner;
  }

  function ensureDb(){
    if (!window.AppDB || typeof AppDB.exportAll !== 'function' || typeof AppDB.importAll !== 'function') {
      throw new Error('Base de données indisponible.');
    }
  }

  async function getStats(){
    ensureDb();
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

  function validateBackupPayload(payload){
    const stores = window.AppDB?.stores || [];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Le fichier ne correspond pas à une sauvegarde valide.');
    }
    for (const store of stores) {
      if (!Array.isArray(payload[store])) {
        throw new Error(`Le store “${store}” est manquant ou invalide.`);
      }
    }
    return payload;
  }

  function renderShell(stats){
    const root = qs('#parametres-root');
    if (!root) return;
    const total = stats.reduce((sum, item) => sum + item.count, 0);

    root.innerHTML = `
      <section class="card settings-hero">
        <div>
          <p class="eyebrow">Paramètres</p>
          <h2>Gestion de la base de données</h2>
          <p class="muted">Sauvegarde, restauration et réinitialisation des données locales de l’application.</p>
        </div>
        <div class="settings-hero-badge">${total} enregistrements</div>
      </section>

      <section class="settings-grid">
        <article class="card settings-panel">
          <div class="panel-head">
            <div>
              <h3>Exporter les données</h3>
              <p class="muted">Télécharge une sauvegarde complète de la base locale au format JSON.</p>
            </div>
          </div>
          <div class="settings-actions-row">
            <button type="button" class="btn primary" id="settings-export-btn">Exporter la base</button>
          </div>
          <p class="notice hidden" id="settings-export-notice"></p>
        </article>

        <article class="card settings-panel">
          <div class="panel-head">
            <div>
              <h3>Importer une sauvegarde</h3>
              <p class="muted">Remplace toutes les données locales par le contenu d’un fichier JSON exporté.</p>
            </div>
          </div>
          <label class="file-dropzone">
            <input id="settings-import-input" type="file" accept="application/json,.json">
            <span class="file-dropzone-title">Choisir un fichier JSON</span>
            <span class="muted" id="settings-import-file-label">Aucun fichier sélectionné</span>
          </label>
          <div class="settings-actions-row">
            <button type="button" class="btn primary" id="settings-import-btn" disabled>Importer et remplacer</button>
          </div>
          <p class="notice hidden" id="settings-import-notice"></p>
        </article>
      </section>

      <section class="card settings-panel settings-reset-panel">
        <div class="panel-head">
          <div>
            <h3>Remettre à zéro avec données de test</h3>
            <p class="muted">Recharge la base à partir du fichier <strong>${esc(TEST_DATA_URL)}</strong> placé à la racine de l’hébergement.</p>
          </div>
        </div>
        <div class="notice settings-warning">
          Cette action remplace toute la base locale actuelle par des données de base/exemple : mercuriale, fournisseurs, recettes, entreprise et paramètres.
        </div>
        <div class="settings-actions-row">
          <button type="button" class="btn danger" id="settings-reset-demo-btn">Remettre à zéro et injecter les données de test</button>
        </div>
        <p class="notice hidden" id="settings-reset-notice"></p>
      </section>

      <section class="card settings-panel settings-scanner-panel">
        <div class="panel-head">
          <div>
            <h3>Test scanner code-barres</h3>
            <p class="muted">Ouvre le module scanner indépendant pour vérifier la caméra, l’import image et la saisie manuelle.</p>
          </div>
        </div>
        <div class="settings-actions-row">
          <button type="button" class="btn primary" id="settings-scan-test-btn">Tester le scanner</button>
        </div>
        <div class="scanner-test-result hidden" id="settings-scan-result"></div>
        <p class="notice hidden" id="settings-scan-notice"></p>
      </section>

      <section class="card settings-panel">
        <div class="panel-head">
          <div>
            <h3>Contenu actuel de la base</h3>
            <p class="muted">Vue rapide des enregistrements présents par module.</p>
          </div>
          <button type="button" class="btn" id="settings-refresh-btn">Actualiser</button>
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

  async function importPayload(payload){
    validateBackupPayload(payload);
    await window.AppDB.importAll(payload);
  }

  async function loadDemoPayload(){
    const res = await fetch(`${TEST_DATA_URL}?t=${Date.now()}`, { cache:'no-store' });
    if (!res.ok) throw new Error(`Fichier ${TEST_DATA_URL} introuvable à la racine.`);
    return validateBackupPayload(await res.json());
  }

  async function bindEvents(){
    const exportBtn = qs('#settings-export-btn');
    const importInput = qs('#settings-import-input');
    const importBtn = qs('#settings-import-btn');
    const refreshBtn = qs('#settings-refresh-btn');
    const resetBtn = qs('#settings-reset-demo-btn');
    const scanBtn = qs('#settings-scan-test-btn');
    const scanResult = qs('#settings-scan-result');
    const fileLabel = qs('#settings-import-file-label');

    scanBtn?.addEventListener('click', async () => {
      clearNotice('#settings-scan-notice');
      if (scanResult) {
        scanResult.classList.add('hidden');
        scanResult.innerHTML = '';
      }
      try {
        const Scanner = await ensureBarcodeScanner();
        const result = await Scanner.open({ title: 'Tester le scanner code-barres' });
        if (scanResult) {
          scanResult.classList.remove('hidden');
          scanResult.innerHTML = `
            <div><strong>Code détecté</strong><span>${esc(result?.text || 'N/C')}</span></div>
            <div><strong>Format</strong><span>${esc(result?.format || 'N/C')}</span></div>
            <div><strong>Source</strong><span>${esc(result?.source || 'N/C')}</span></div>
          `;
        }
        setNotice('#settings-scan-notice', 'Scanner testé avec succès.', 'success');
      } catch (error) {
        const message = error?.name === 'AbortError' || /annul/i.test(error?.message || '')
          ? 'Scanner fermé sans code détecté.'
          : `Test scanner impossible : ${error?.message || error}`;
        setNotice('#settings-scan-notice', message, error?.name === 'AbortError' ? 'info' : 'error');
      }
    });

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
      if (fileLabel) fileLabel.textContent = file ? file.name : 'Aucun fichier sélectionné';
      if (importBtn) importBtn.disabled = !file;
    });

    importBtn?.addEventListener('click', async () => {
      clearNotice('#settings-import-notice');
      const file = importInput?.files?.[0];
      if (!file) return;
      const ok = window.confirm('Cet import va remplacer toutes les données locales actuelles. Continuer ?');
      if (!ok) return;
      try {
        await importPayload(JSON.parse(await file.text()));
        setNotice('#settings-import-notice', 'Import terminé. Les données locales ont été remplacées.', 'success');
        await render();
      } catch (error) {
        setNotice('#settings-import-notice', `Import impossible : ${error?.message || error}`, 'error');
      }
    });

    resetBtn?.addEventListener('click', async () => {
      clearNotice('#settings-reset-notice');
      const ok = window.confirm('Cette action va remplacer toutes les données locales par les données de test. Continuer ?');
      if (!ok) return;
      try {
        const payload = await loadDemoPayload();
        await importPayload(payload);
        setNotice('#settings-reset-notice', 'Base réinitialisée avec les données de test.', 'success');
        await render();
      } catch (error) {
        setNotice('#settings-reset-notice', `Réinitialisation impossible : ${error?.message || error}`, 'error');
      }
    });

    refreshBtn?.addEventListener('click', () => render());
  }

  async function render(){
    try {
      const stats = await getStats();
      renderShell(stats);
      await bindEvents();
    } catch (error) {
      const root = qs('#parametres-root');
      if (root) root.innerHTML = `<section class="card"><h2>Paramètres indisponibles</h2><p class="notice is-error">${esc(error?.message || error)}</p></section>`;
    }
  }

  window.ParametresPage = { render };
})();
