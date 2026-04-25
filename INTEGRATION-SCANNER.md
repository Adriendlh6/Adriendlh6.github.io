# Module scanner de code-barres indépendant

Fichiers à ajouter dans le projet :

- `assets/js/barcode-scanner.js`
- `assets/css/barcode-scanner.css`

Puis ajouter dans `index.html` :

```html
<link rel="stylesheet" href="assets/css/barcode-scanner.css" />
```

juste après `assets/css/app.css`, et :

```html
<script src="assets/js/barcode-scanner.js"></script>
```

juste après `assets/js/app.js` ou avant, au choix. Le module expose `window.BarcodeScanner`.

## Utilisation simple

```js
BarcodeScanner.open({
  title: 'Scanner un produit',
  onResult: ({ text, format, source }) => {
    console.log('Code détecté:', text, format, source);
  }
});
```

## Utilisation dans n’importe quelle page

```js
button.addEventListener('click', async () => {
  const result = await BarcodeScanner.open({ title: 'Scanner un EAN' });
  input.value = result.text;
});
```

## Fonctionnalités

- scanner caméra natif `BarcodeDetector` si disponible
- fallback ZXing chargé automatiquement depuis CDN
- changement de caméra
- lampe si le téléphone l’autorise
- import depuis image
- saisie manuelle
- vibration + bip à la détection
- API indépendante, utilisable sur n’importe quelle page

## Note

La caméra nécessite HTTPS ou localhost. Sur GitHub Pages, c’est OK.
