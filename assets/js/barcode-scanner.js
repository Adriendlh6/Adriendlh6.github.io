/*
  Copilot Boulangerie - BarcodeScanner indépendant
  Version iPhone/Safari renforcée

  API:
    const result = await BarcodeScanner.open({ title: 'Scanner un code-barres' });

  Stratégie:
    - iPhone/iPad: démarrage caméra explicite par bouton, puis ZXing prioritaire.
    - Autres navigateurs: BarcodeDetector natif si disponible, sinon ZXing.
    - Fallback permanent: image + saisie manuelle.
*/
(function(){
  'use strict';

  const ZXING_LIBRARY_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const ZXING_BROWSER_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/index.min.js';
  const DEFAULT_FORMATS = [
    'ean_13', 'ean_8', 'upc_a', 'upc_e',
    'code_128', 'code_39', 'code_93', 'itf',
    'qr_code', 'data_matrix', 'pdf417'
  ];

  let active = null;
  let zxingPromise = null;

  const qs = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
    }[c]));
  }

  function normalizeCode(value){
    return String(value || '').trim().replace(/\s+/g, '');
  }

  function isIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isSecureCameraContext(){
    return location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  }

  function canUseNativeDetector(){
    return typeof window.BarcodeDetector === 'function';
  }

  function mapNativeFormatsToZXing(formats, ZXing){
    if (!ZXing?.BarcodeFormat) return undefined;
    const map = {
      ean_13: ZXing.BarcodeFormat.EAN_13,
      ean_8: ZXing.BarcodeFormat.EAN_8,
      upc_a: ZXing.BarcodeFormat.UPC_A,
      upc_e: ZXing.BarcodeFormat.UPC_E,
      code_128: ZXing.BarcodeFormat.CODE_128,
      code_39: ZXing.BarcodeFormat.CODE_39,
      code_93: ZXing.BarcodeFormat.CODE_93,
      itf: ZXing.BarcodeFormat.ITF,
      qr_code: ZXing.BarcodeFormat.QR_CODE,
      data_matrix: ZXing.BarcodeFormat.DATA_MATRIX,
      pdf417: ZXing.BarcodeFormat.PDF_417
    };
    return formats.map(f => map[f]).filter(Boolean);
  }

  function injectScript(src, datasetKey){
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-${datasetKey}]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once:true });
        existing.addEventListener('error', reject, { once:true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.dataset[datasetKey] = 'true';
      script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
      script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
      document.head.appendChild(script);
    });
  }

  async function injectZxing(){
    if (window.ZXing?.BrowserMultiFormatReader) return { type:'library', api: window.ZXing };
    if (window.ZXingBrowser?.BrowserMultiFormatReader) return { type:'browser', api: window.ZXingBrowser };
    if (zxingPromise) return zxingPromise;

    zxingPromise = (async () => {
      try {
        await injectScript(ZXING_LIBRARY_CDN, 'barcodeZxingLibrary');
        if (window.ZXing?.BrowserMultiFormatReader) return { type:'library', api: window.ZXing };
      } catch (error) {
        console.warn('[BarcodeScanner] ZXing library indisponible', error);
      }
      await injectScript(ZXING_BROWSER_CDN, 'barcodeZxingBrowser');
      if (window.ZXingBrowser?.BrowserMultiFormatReader) return { type:'browser', api: window.ZXingBrowser };
      throw new Error('ZXing indisponible');
    })();

    return zxingPromise;
  }

  function beep(){
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close?.(); }, 90);
    } catch {}
  }

  function vibrate(){
    try { navigator.vibrate?.(45); } catch {}
  }

  function buildOverlay(options){
    const root = document.createElement('div');
    root.className = 'barcode-scanner-root';
    root.innerHTML = `
      <div class="barcode-scanner-backdrop" data-barcode-close></div>
      <section class="barcode-scanner-sheet" role="dialog" aria-modal="true" aria-label="Scanner de code-barres">
        <header class="barcode-scanner-header">
          <div>
            <p class="barcode-scanner-kicker">Scanner</p>
            <h2>${escapeHtml(options.title || 'Scanner un code-barres')}</h2>
          </div>
          <button type="button" class="barcode-scanner-icon" data-barcode-close aria-label="Fermer">✕</button>
        </header>

        <div class="barcode-scanner-camera">
          <video class="barcode-scanner-video" playsinline webkit-playsinline muted autoplay disablepictureinpicture></video>
          <button type="button" class="barcode-scanner-start" data-barcode-start>
            <strong>Démarrer la caméra</strong>
            <span>Autorisez l’accès caméra puis pointez le code-barres</span>
          </button>
          <div class="barcode-scanner-frame" aria-hidden="true">
            <span></span><span></span><span></span><span></span>
            <i></i>
          </div>
          <p class="barcode-scanner-status" data-barcode-status>Prêt. Touchez “Démarrer la caméra”.</p>
        </div>

        <div class="barcode-scanner-actions">
          <button type="button" class="barcode-scanner-btn" data-barcode-switch>Changer caméra</button>
          <button type="button" class="barcode-scanner-btn" data-barcode-torch hidden>Lampe</button>
          <label class="barcode-scanner-btn barcode-scanner-file">
            Image
            <input type="file" accept="image/*" capture="environment" data-barcode-file hidden>
          </label>
        </div>

        <details class="barcode-scanner-manual">
          <summary>Saisie manuelle</summary>
          <form data-barcode-manual-form>
            <input class="barcode-scanner-input" data-barcode-manual-input inputmode="numeric" autocomplete="off" placeholder="Saisir le code-barres">
            <button type="submit" class="barcode-scanner-primary">Valider</button>
          </form>
        </details>
      </section>
    `;
    document.body.appendChild(root);
    return root;
  }

  async function getVideoDevices(){
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(d => d.kind === 'videoinput');
    } catch { return []; }
  }

  function setStatus(ctx, text){
    const el = qs('[data-barcode-status]', ctx.root);
    if (el) el.textContent = text;
  }

  function setStartVisible(ctx, visible){
    const btn = qs('[data-barcode-start]', ctx.root);
    if (btn) btn.hidden = !visible;
  }

  function stopStream(ctx){
    if (ctx?.stream) {
      ctx.stream.getTracks().forEach(t => t.stop());
      ctx.stream = null;
    }
    if (ctx?.video) ctx.video.srcObject = null;
  }

  function stopReader(ctx){
    try { ctx.zxingControls?.stop?.(); } catch {}
    try { ctx.zxingReader?.reset?.(); } catch {}
    ctx.zxingControls = null;
    ctx.zxingReader = null;
    if (ctx.raf) cancelAnimationFrame(ctx.raf);
    ctx.raf = null;
    stopStream(ctx);
  }

  function updateTorchAvailability(ctx){
    const torchBtn = qs('[data-barcode-torch]', ctx.root);
    const track = ctx.stream?.getVideoTracks?.()[0] || ctx.video?.srcObject?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    if (caps && caps.torch) torchBtn.hidden = false;
    else torchBtn.hidden = true;
  }

  async function toggleTorch(ctx){
    const track = ctx.stream?.getVideoTracks?.()[0] || ctx.video?.srcObject?.getVideoTracks?.()[0];
    if (!track?.getCapabilities?.().torch) return;
    ctx.torchOn = !ctx.torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: ctx.torchOn }] });
      qs('[data-barcode-torch]', ctx.root)?.classList.toggle('active', ctx.torchOn);
    } catch {}
  }

  async function startCameraForNative(ctx){
    stopReader(ctx);
    const primary = {
      video: ctx.deviceId
        ? { deviceId: { exact: ctx.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: ctx.facingMode || 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    };
    const fallback = { video: { facingMode: 'environment' }, audio:false };

    try { ctx.stream = await navigator.mediaDevices.getUserMedia(primary); }
    catch { ctx.stream = await navigator.mediaDevices.getUserMedia(fallback); }

    ctx.video.setAttribute('playsinline', '');
    ctx.video.setAttribute('webkit-playsinline', '');
    ctx.video.muted = true;
    ctx.video.srcObject = ctx.stream;
    await ctx.video.play();
    setStartVisible(ctx, false);
    updateTorchAvailability(ctx);
    setStatus(ctx, ctx.engineLabel ? `${ctx.engineLabel} actif — pointez le code-barres` : 'Scanner actif — pointez le code-barres');
  }

  function finish(ctx, result){
    const code = normalizeCode(result?.text || result?.rawValue || result);
    if (!code || ctx.finished) return;
    ctx.finished = true;
    beep();
    vibrate();
    const payload = {
      text: code,
      rawValue: code,
      format: result?.format || result?.barcodeFormat || result?.formatName || 'unknown',
      source: result?.source || ctx.engine || 'unknown'
    };
    try { ctx.options.onResult?.(payload); } catch (error) { console.error('[BarcodeScanner:onResult]', error); }
    ctx.resolve?.(payload);
    if (ctx.options.closeOnResult !== false) close();
  }

  async function startNativeLoop(ctx){
    ctx.engine = 'native';
    ctx.engineLabel = 'Détection native';
    const formats = Array.isArray(ctx.options.formats) && ctx.options.formats.length ? ctx.options.formats : DEFAULT_FORMATS;
    try { ctx.detector = new BarcodeDetector({ formats }); }
    catch { ctx.detector = new BarcodeDetector(); }
    await startCameraForNative(ctx);

    const loop = async () => {
      if (!active || ctx.finished || ctx.stopped) return;
      try {
        if (ctx.video.readyState >= 2) {
          const found = await ctx.detector.detect(ctx.video);
          if (found?.length) {
            finish(ctx, { text: found[0].rawValue, format: found[0].format, source: 'native' });
            return;
          }
        }
      } catch {}
      ctx.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  async function startZxing(ctx){
    ctx.engine = 'zxing';
    ctx.engineLabel = 'ZXing';
    setStatus(ctx, 'Chargement du moteur scanner…');
    const loaded = await injectZxing();
    const devices = await getVideoDevices();
    const preferred = ctx.deviceId || devices.find(d => /back|rear|environment|arrière|dos/i.test(d.label))?.deviceId || devices[devices.length - 1]?.deviceId || devices[0]?.deviceId;
    ctx.deviceId = preferred || undefined;

    ctx.video.setAttribute('playsinline', '');
    ctx.video.setAttribute('webkit-playsinline', '');
    ctx.video.muted = true;

    if (loaded.type === 'library') {
      const ZXing = loaded.api;
      const formats = Array.isArray(ctx.options.formats) && ctx.options.formats.length ? ctx.options.formats : DEFAULT_FORMATS;
      const zxingFormats = mapNativeFormatsToZXing(formats, ZXing);
      let hints;
      if (ZXing.DecodeHintType && zxingFormats?.length) {
        hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, zxingFormats);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      }
      ctx.zxingReader = new ZXing.BrowserMultiFormatReader(hints, 250);
      await ctx.zxingReader.decodeFromVideoDevice(ctx.deviceId || undefined, ctx.video, (result) => {
        if (!result || ctx.finished) return;
        const text = typeof result.getText === 'function' ? result.getText() : result.text;
        const format = typeof result.getBarcodeFormat === 'function' ? String(result.getBarcodeFormat()) : 'unknown';
        finish(ctx, { text, format, source: 'zxing' });
      });
    } else {
      const ZXingBrowser = loaded.api;
      ctx.zxingReader = new ZXingBrowser.BrowserMultiFormatReader();
      ctx.zxingControls = await ctx.zxingReader.decodeFromVideoDevice(ctx.deviceId, ctx.video, (result) => {
        if (!result || ctx.finished) return;
        const text = typeof result.getText === 'function' ? result.getText() : result.text;
        const format = typeof result.getBarcodeFormat === 'function' ? String(result.getBarcodeFormat()) : 'unknown';
        finish(ctx, { text, format, source: 'zxing' });
      });
    }

    setStartVisible(ctx, false);
    setStatus(ctx, 'Scanner actif — pointez le code-barres');
    setTimeout(() => {
      ctx.stream = ctx.video?.srcObject || null;
      updateTorchAvailability(ctx);
    }, 450);
  }

  async function startBestEngine(ctx){
    if (ctx.starting) return;
    ctx.starting = true;
    ctx.finished = false;
    ctx.stopped = false;

    try {
      if (!isSecureCameraContext()) {
        setStatus(ctx, 'La caméra nécessite HTTPS. Utilisez GitHub Pages ou la saisie manuelle.');
        setStartVisible(ctx, true);
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus(ctx, 'Caméra indisponible. Utilisez une image ou la saisie manuelle.');
        setStartVisible(ctx, true);
        return;
      }

      setStatus(ctx, 'Ouverture de la caméra…');

      // Sur iPhone/Safari, ZXing est plus fiable que BarcodeDetector pour EAN/UPC.
      if (!isIOS() && canUseNativeDetector() && ctx.options.preferNative !== false) {
        try { return await startNativeLoop(ctx); }
        catch (nativeError) { console.warn('[BarcodeScanner] détection native indisponible', nativeError); }
      }

      return await startZxing(ctx);
    } catch (error) {
      console.warn('[BarcodeScanner] caméra indisponible', error);
      setStartVisible(ctx, true);
      const message = error?.name === 'NotAllowedError'
        ? 'Accès caméra refusé. Autorisez la caméra ou utilisez Image / Saisie manuelle.'
        : 'Scanner caméra indisponible. Essayez Image ou Saisie manuelle.';
      setStatus(ctx, message);
    } finally {
      ctx.starting = false;
    }
  }

  function loadImage(url){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
      if (img.decode) img.decode().then(() => resolve(img)).catch(() => {});
    });
  }

  async function scanImageFile(ctx, file){
    if (!file) return;
    setStatus(ctx, 'Analyse de l’image…');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);

      if (!isIOS() && canUseNativeDetector()) {
        try {
          const detector = ctx.detector || new BarcodeDetector({ formats: DEFAULT_FORMATS });
          const found = await detector.detect(img);
          if (found?.length) return finish(ctx, { text: found[0].rawValue, format: found[0].format, source: 'image-native' });
        } catch {}
      }

      try {
        const loaded = await injectZxing();
        if (loaded.type === 'library') {
          const ZXing = loaded.api;
          const reader = new ZXing.BrowserMultiFormatReader();
          const result = await reader.decodeFromImageElement(img);
          if (result) {
            const text = typeof result.getText === 'function' ? result.getText() : result.text;
            const format = typeof result.getBarcodeFormat === 'function' ? String(result.getBarcodeFormat()) : 'unknown';
            return finish(ctx, { text, format, source: 'image-zxing' });
          }
        } else {
          const reader = new loaded.api.BrowserMultiFormatReader();
          const result = await reader.decodeFromImageElement(img);
          if (result) {
            const text = typeof result.getText === 'function' ? result.getText() : result.text;
            const format = typeof result.getBarcodeFormat === 'function' ? String(result.getBarcodeFormat()) : 'unknown';
            return finish(ctx, { text, format, source: 'image-zxing' });
          }
        }
      } catch {}

      setStatus(ctx, 'Aucun code détecté dans l’image. Essayez une photo plus nette.');
    } finally {
      URL.revokeObjectURL(url);
      const input = qs('[data-barcode-file]', ctx.root);
      if (input) input.value = '';
    }
  }

  async function switchCamera(ctx){
    const devices = await getVideoDevices();
    if (devices.length < 2) return setStatus(ctx, 'Aucune autre caméra détectée.');
    const currentIndex = Math.max(0, devices.findIndex(d => d.deviceId === ctx.deviceId));
    const next = devices[(currentIndex + 1) % devices.length];
    ctx.deviceId = next.deviceId;
    stopReader(ctx);
    await startBestEngine(ctx);
  }

  function bindEvents(ctx){
    qsa('[data-barcode-close]', ctx.root).forEach(btn => btn.addEventListener('click', close));
    qs('[data-barcode-start]', ctx.root)?.addEventListener('click', () => startBestEngine(ctx));
    qs('[data-barcode-switch]', ctx.root)?.addEventListener('click', () => switchCamera(ctx));
    qs('[data-barcode-torch]', ctx.root)?.addEventListener('click', () => toggleTorch(ctx));
    qs('[data-barcode-file]', ctx.root)?.addEventListener('change', e => scanImageFile(ctx, e.target.files?.[0]));
    qs('[data-barcode-manual-form]', ctx.root)?.addEventListener('submit', e => {
      e.preventDefault();
      const input = qs('[data-barcode-manual-input]', ctx.root);
      finish(ctx, { text: input?.value, format: 'manual', source: 'manual' });
    });
    ctx.escapeHandler = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', ctx.escapeHandler);
  }

  function close(){
    const ctx = active;
    if (!ctx) return;
    ctx.stopped = true;
    stopReader(ctx);
    document.removeEventListener('keydown', ctx.escapeHandler);
    ctx.root?.remove();
    active = null;
    try { ctx.options.onClose?.(); } catch {}
  }

  function open(options = {}){
    if (active) close();
    return new Promise(resolve => {
      const root = buildOverlay(options);
      const ctx = {
        root,
        video: qs('.barcode-scanner-video', root),
        options,
        resolve,
        facingMode: options.facingMode || 'environment',
        deviceId: options.deviceId || '',
        finished: false,
        stopped: false,
        starting: false,
        torchOn: false
      };
      active = ctx;
      bindEvents(ctx);

      // iPhone/iPad: démarrage explicite fiable. Autres navigateurs: auto-start autorisé.
      if (!isIOS() && options.autoStart !== false) startBestEngine(ctx);
      else setStatus(ctx, 'Prêt. Touchez “Démarrer la caméra”.');
    });
  }

  function attachToButton(selector, callback, options = {}){
    const el = typeof selector === 'string' ? qs(selector) : selector;
    if (!el) return null;
    const handler = () => open({ ...options, onResult: callback });
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }

  window.BarcodeScanner = {
    open,
    scan: open,
    close,
    attachToButton,
    isSupported(){
      return Boolean(navigator.mediaDevices?.getUserMedia || canUseNativeDetector() || window.ZXing || window.ZXingBrowser);
    },
    hasNativeDetector: canUseNativeDetector,
    isIOS
  };
})();
