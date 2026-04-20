document.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('App init OK');

    initApp();

  } catch (e) {
    console.error('Erreur init globale:', e);
  }
});
function initApp() {
  bindGlobalEvents();
  renderApp();
}
function bindGlobalEvents() {
  document.addEventListener('click', (e) => {
    // debug global
    console.log('click détecté', e.target);
  });
}/*
  Correctif ciblé onglet Infos
  - supprime le "/kg" dans les valeurs nutritionnelles (g simples)
  - rétablit la pastille de couleur de catégorie/fournisseur dans l'onglet Infos
  À fusionner avec le fichier existant si besoin ; version livrée en remplacement ciblé.
*/

(function () {
  function formatNutritionValue(label, value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    const display = Number.isFinite(n) ? String(n) : String(value);
    return /energie|énergie/i.test(label) ? `${display} kcal` : `${display} g`;
  }

  // Expose helper for existing renderers
  window.formatNutritionValue = formatNutritionValue;

  // Patch common render helper names if they exist
  const candidateNames = [
    'renderNutritionRows',
    'renderNutritionBlock',
    'buildNutritionHtml',
    'formatNutritionRow'
  ];

  candidateNames.forEach((name) => {
    const original = window[name];
    if (typeof original === 'function') {
      window[name] = function (...args) {
        try {
          return original.apply(this, args);
        } catch (e) {
          return original.apply(this, args);
        }
      };
    }
  });

  // DOM-level fallback: clean visible "/kg" on nutrition lines only
  function patchNutritionUnitsInDom(root = document) {
    root.querySelectorAll('.nutrition-row, .detail-nutrition-row, [data-nutrition-row]').forEach((row) => {
      const valueEl = row.querySelector('.nutrition-value, [data-nutrition-value]') || row;
      if (!valueEl) return;
      const labelText = (row.querySelector('.nutrition-label, [data-nutrition-label]')?.textContent || row.textContent || '').trim();
      const txt = (valueEl.textContent || '').trim();
      if (!txt) return;
      if (/energie|énergie/i.test(labelText)) {
        valueEl.textContent = txt.replace(/\s*(g\/?kg|g\/kg)\b/gi, '').replace(/\s*kcal\s*kcal\b/i, ' kcal').trim();
        if (!/kcal$/i.test(valueEl.textContent)) valueEl.textContent = `${valueEl.textContent} kcal`.trim();
      } else {
        valueEl.textContent = txt.replace(/\s*(g\/?kg|g\/kg)\b/gi, '').replace(/\s*g\s*g\b/i, ' g').trim();
        if (/^\d+(?:[.,]\d+)?$/.test(valueEl.textContent)) valueEl.textContent = `${valueEl.textContent} g`;
      }
    });
  }

  // DOM-level fallback: restore colored dot/chip marker in infos tab
  function patchInfoDots(root = document) {
    root.querySelectorAll('.category-chip, .detail-category-chip, [data-category-chip]').forEach((chip) => {
      if (chip.querySelector('.category-dot, .detail-dot, [data-color-dot]')) return;
      const color = chip.getAttribute('data-color') || chip.dataset.color || chip.style.getPropertyValue('--chip-color') || '#999';
      const dot = document.createElement('span');
      dot.className = 'detail-dot';
      dot.setAttribute('data-color-dot', '1');
      dot.style.background = color.trim() || '#999';
      chip.prepend(dot);
    });
  }

  function runPatches(root = document) {
    patchNutritionUnitsInDom(root);
    patchInfoDots(root);
  }

  document.addEventListener('DOMContentLoaded', () => runPatches(document));
  document.addEventListener('click', () => setTimeout(() => runPatches(document), 0));
  document.addEventListener('input', () => setTimeout(() => runPatches(document), 0));

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) runPatches(node);
      });
    }
  });
  if (document.documentElement) {
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
