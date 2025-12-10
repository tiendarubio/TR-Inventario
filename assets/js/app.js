// app.js — Helpers para TRInventario (Vercel, llaves ocultas en backend)

// Cache de catálogo y proveedores
let CATALOGO_CACHE = null;
let PROVIDERS_CACHE = null;

// --- Catálogo de productos (Google Sheets -> /api/catalogo) ---
function preloadCatalog() {
  if (CATALOGO_CACHE) return Promise.resolve(CATALOGO_CACHE);

  return fetch('/api/catalogo')
    .then(r => {
      if (!r.ok) throw new Error('Error catálogo: ' + r.statusText);
      return r.json();
    })
    .then(data => {
      CATALOGO_CACHE = Array.isArray(data.values) ? data.values : [];
      try { window.CATALOGO_CACHE = CATALOGO_CACHE; } catch (_) {}
      return CATALOGO_CACHE;
    })
    .catch(err => {
      console.error('Error al cargar catálogo:', err);
      CATALOGO_CACHE = [];
      try { window.CATALOGO_CACHE = CATALOGO_CACHE; } catch (_) {}
      return CATALOGO_CACHE;
    });
}

function loadProductsFromGoogleSheets() {
  return preloadCatalog();
}

// --- Proveedores (Google Sheets -> /api/proveedores) ---
function preloadProviders() {
  if (PROVIDERS_CACHE) return Promise.resolve(PROVIDERS_CACHE);

  return fetch('/api/proveedores')
    .then(r => {
      if (!r.ok) throw new Error('Error proveedores: ' + r.statusText);
      return r.json();
    })
    .then(data => {
      const list = Array.isArray(data.providers) ? data.providers : [];
      PROVIDERS_CACHE = list;
      return PROVIDERS_CACHE;
    })
    .catch(err => {
      console.error('Error al cargar proveedores:', err);
      PROVIDERS_CACHE = [];
      return PROVIDERS_CACHE;
    });
}

function loadProvidersFromGoogleSheets() {
  return preloadProviders();
}

// --- JSONBin helpers usando APIs internas (llave oculta) ---
function saveReceptionToJSONBin(binId, payload) {
  if (!binId) {
    return Promise.reject(new Error('BIN no configurado para esta hoja.'));
  }
  return fetch('/api/jsonbin-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId, payload })
  }).then(r => {
    if (!r.ok) throw new Error('Error al guardar datos (' + r.status + ')');
    return r.json();
  });
}

function loadReceptionFromJSONBin(binId) {
  if (!binId) return Promise.resolve({});
  return fetch('/api/jsonbin-load?binId=' + encodeURIComponent(binId))
    .then(r => {
      if (!r.ok) throw new Error('Error al cargar datos (' + r.status + ')');
      return r.json();
    })
    .then(d => d.record || d || {})
    .catch(err => {
      console.error('Error al leer JSONBin:', err);
      return {};
    });
}
