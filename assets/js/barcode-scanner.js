/*
  Copilot Boulangerie - BarcodeScanner indépendant
  Usage:
    BarcodeScanner.open({
      title: 'Scanner un code-barres',
      onResult: ({ text, format }) => console.log(text, format)
    });

  Le module privilégie BarcodeDetector natif, puis tente ZXing via CDN.
  Il reste autonome: camera, saisie manuelle et import image.
*/
(function(){
  'use strict';

  const ZXING_CDN = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/index.min.js';
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

  function canUseNativeDetector(){
    return typeof window.BarcodeDetector === 'function';
  }

  function injectZxing(){
    if (window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
    if (zxingPromise) return zxingPromise;

    zxingPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-barcode-zxing]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.ZXingBrowser));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = ZXING_CDN;
      script.async = true;
      script.defer = true;
      script.dataset.barcodeZxing = 'true';
      script.onload = () => window.ZXingBrowser ? resolve(window.ZXingBrowser) : reject(new Error('ZXing indisponible'));
      script.onerror = () => reject(new Error('Impossible de charger ZXing'));
      document.head.appendChild(script);
    });
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
      setTimeout(() => {
        osc.stop();
        ctx.close?.();
      }, 90);
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
          <video class="barcode-scanner-video" playsinline muted autoplay></video>
          <div class="barcode-scanner-frame">
            <span></span><span></span><span></span><span></span>
            <i></i>
          </div>
          <p class="barcode-scanner-status" data-barcode-status>Initialisation de la caméra…</p>
        </div>

        <div class="barcode-scanner-actions">
          <button type="button" class="barcode-scanner-btn" data-barcode-switch>Changer caméra</button>
          <button type="button" class="barcode-scanner-btn" data-barcode-torch hidden>Lampe</button>
          <label class="barcode-scanner-btn barcode-scanner-file">
            Image
            <input type="file" accept="image/*" data-barcode-file hidden>
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

  async function startCamera(ctx){
    stopStream(ctx);
    const constraints = {
      video: ctx.deviceId
        ? { deviceId: { exact: ctx.deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        : { facingMode: { ideal: ctx.facingMode || 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    };

    ctx.stream = await navigator.mediaDevices.getUserMedia(constraints);
    ctx.video.srcObject = ctx.stream;
    await ctx.video.play();
    updateTorchAvailability(ctx);
    setStatus(ctx, ctx.engineLabel ? `${ctx.engineLabel} actif — pointez le code-barres` : 'Scanner actif — pointez le code-barres');
  }

  function stopStream(ctx){
    if (ctx?.stream) {
      ctx.stream.getTracks().forEach(t => t.stop());
      ctx.stream = null;
    }
    if (ctx?.video) ctx.video.srcObject = null;
  }

  function updateTorchAvailability(ctx){
    const torchBtn = qs('[data-barcode-torch]', ctx.root);
    const track = ctx.stream?.getVideoTracks?.()[0];
    const caps = track?.getCapabilities?.();
    if (caps && caps.torch) torchBtn.hidden = false;
    else torchBtn.hidden = true;
  }

  async function toggleTorch(ctx){
    const track = ctx.stream?.getVideoTracks?.()[0];
    if (!track?.getCapabilities?.().torch) return;
    ctx.torchOn = !ctx.torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: ctx.torchOn }] });
      qs('[data-barcode-torch]', ctx.root).classList.toggle('active', ctx.torchOn);
    } catch {}
  }

  function setStatus(ctx, text){
    const el = qs('[data-barcode-status]', ctx.root);
    if (el) el.textContent = text;
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
    await startCamera(ctx);

    const loop = async () => {
      if (!active || ctx.finished || ctx.stopped) return;
      try {
        if (ctx.video.readyState >= 2) {
          const found = await ctx.detector.detect(ctx.video);
          if (found && found.length) {
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
    const ZXingBrowser = await injectZxing();
    ctx.engine = 'zxing';
    ctx.engineLabel = 'ZXing';
    setStatus(ctx, 'Chargement du moteur ZXing…');

    ctx.zxingReader = new ZXingBrowser.BrowserMultiFormatReader();
    const devices = await getVideoDevices();
    const preferred = ctx.deviceId || devices.find(d => /back|rear|environment/i.test(d.label))?.deviceId || devices[0]?.deviceId;
    ctx.deviceId = preferred || undefined;

    ctx.zxingControls = await ctx.zxingReader.decodeFromVideoDevice(ctx.deviceId, ctx.video, (result) => {
      if (result) {
        const text = typeof result.getText === 'function' ? result.getText() : result.text;
        const format = typeof result.getBarcodeFormat === 'function' ? String(result.getBarcodeFormat()) : 'unknown';
        finish(ctx, { text, format, source: 'zxing' });
      }
    });
    setStatus(ctx, 'ZXing actif — pointez le code-barres');
    setTimeout(() => updateTorchAvailability(ctx), 350);
  }

  async function startBestEngine(ctx){
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(ctx, 'Caméra indisponible. Utilisez la saisie manuelle ou une image.');
      return;
    }
    try {
      if (canUseNativeDetector()) return await startNativeLoop(ctx);
      return await startZxing(ctx);
    } catch (nativeError) {
      console.warn('[BarcodeScanner] moteur principal indisponible', nativeError);
      try { return await startZxing(ctx); }
      catch (zxingError) {
        console.warn('[BarcodeScanner] ZXing indisponible', zxingError);
        setStatus(ctx, 'Scanner caméra indisponible. Essayez une image ou la saisie manuelle.');
      }
    }
  }

  async function scanImageFile(ctx, file){
    if (!file) return;
    setStatus(ctx, 'Analyse de l’image…');
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();

      if (canUseNativeDetector()) {
        try {
          const detector = ctx.detector || new BarcodeDetector({ formats: DEFAULT_FORMATS });
          const found = await detector.detect(img);
          if (found?.length) return finish(ctx, { text: found[0].rawValue, format: found[0].format, source: 'image-native' });
        } catch {}
      }

      try {
        const ZXingBrowser = await injectZxing();
        const reader = new ZXingBrowser.BrowserMultiFormatReader();
        const result = await reader.decodeFromImageElement(img);
        if (result) {
          const text = typeof result.getText === 'function' ? result.getText() : result.text;
          const format = typeof result.getBarcodeFormat === 'function' ? String(result.getBarcodeFormat()) : 'unknown';
          return finish(ctx, { text, format, source: 'image-zxing' });
        }
      } catch {}

      setStatus(ctx, 'Aucun code détecté dans l’image.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function switchCamera(ctx){
    const devices = await getVideoDevices();
    if (devices.length < 2) return setStatus(ctx, 'Aucune autre caméra détectée.');
    const currentIndex = Math.max(0, devices.findIndex(d => d.deviceId === ctx.deviceId));
    const next = devices[(currentIndex + 1) % devices.length];
    ctx.deviceId = next.deviceId;
    ctx.finished = false;
    ctx.stopped = false;

    if (ctx.zxingControls?.stop) ctx.zxingControls.stop();
    if (ctx.raf) cancelAnimationFrame(ctx.raf);
    await startBestEngine(ctx);
  }

  function bindEvents(ctx){
    qsa('[data-barcode-close]', ctx.root).forEach(btn => btn.addEventListener('click', close));
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
    if (ctx.raf) cancelAnimationFrame(ctx.raf);
    try { ctx.zxingControls?.stop?.(); } catch {}
    try { ctx.zxingReader?.reset?.(); } catch {}
    stopStream(ctx);
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
        torchOn: false
      };
      active = ctx;
      bindEvents(ctx);
      startBestEngine(ctx);
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
      return Boolean(navigator.mediaDevices?.getUserMedia || canUseNativeDetector() || window.ZXingBrowser);
    },
    hasNativeDetector: canUseNativeDetector
  };
})();
