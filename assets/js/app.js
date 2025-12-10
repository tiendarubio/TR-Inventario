// app.js — Helpers compartidos (catálogo + JSONBin)

// Cache de catálogo
let CATALOGO_CACHE = null;

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

// --- JSONBin helpers usando APIs internas (llave oculta) ---
function saveInventarioToJSONBin(binId, payload) {
  if (!binId) {
    return Promise.reject(new Error('BIN no configurado para este inventario.'));
  }
  return fetch('/api/jsonbin-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ binId, payload })
  }).then(r => {
    if (!r.ok) throw new Error('Error al guardar inventario (' + r.status + ')');
    return r.json();
  });
}

function loadInventarioFromJSONBin(binId) {
  if (!binId) return Promise.resolve({});
  return fetch('/api/jsonbin-load?binId=' + encodeURIComponent(binId))
    .then(r => {
      if (!r.ok) throw new Error('Error al cargar inventario (' + r.status + ')');
      return r.json();
    })
    .then(d => d.record || d || {})
    .catch(err => {
      console.error('Error al leer inventario JSONBin:', err);
      return {};
    });
}
