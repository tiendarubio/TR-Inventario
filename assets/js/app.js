// app.js — Config & helpers para TRInventario (Vercel)

// Cache de catálogo, proveedores, estantes/ubicaciones y dependientes
let CATALOGO_CACHE = null;
let PROVIDERS_CACHE = null;
let ESTANTES_CACHE = null;      // { estantes: {avenida_morazan:[], sexta_calle:[], centro_comercial:[]}, ubicaciones:[] }
let DEPENDIENTES_CACHE = null;  // [ 'Nombre', ... ]

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

// --- Estantes y Ubicaciones (Google Sheets -> /api/estantes) ---
// Hoja: estantes
// A:A = estantes AVM, B:B = estantes Sexta, C:C = estantes Centro, D:D = ubicaciones (salas + almacenes)
function preloadEstantes() {
  if (ESTANTES_CACHE) return Promise.resolve(ESTANTES_CACHE);

  return fetch('/api/estantes')
    .then(r => {
      if (!r.ok) throw new Error('Error estantes: ' + r.statusText);
      return r.json();
    })
    .then(data => {
      ESTANTES_CACHE = data && typeof data === 'object' ? data : { estantes: {}, ubicaciones: [] };
      return ESTANTES_CACHE;
    })
    .catch(err => {
      console.error('Error al cargar estantes/ubicaciones:', err);
      ESTANTES_CACHE = { estantes: { avenida_morazan: [], sexta_calle: [], centro_comercial: [] }, ubicaciones: [] };
      return ESTANTES_CACHE;
    });
}

function loadEstantesFromGoogleSheets() {
  return preloadEstantes();
}

// --- Dependientes (Google Sheets -> /api/dependientes) ---
// Hoja: dependientax A:A
function preloadDependientes() {
  if (DEPENDIENTES_CACHE) return Promise.resolve(DEPENDIENTES_CACHE);

  return fetch('/api/dependientes')
    .then(r => {
      if (!r.ok) throw new Error('Error dependientes: ' + r.statusText);
      return r.json();
    })
    .then(data => {
      const list = Array.isArray(data.dependientes) ? data.dependientes : [];
      DEPENDIENTES_CACHE = list;
      return DEPENDIENTES_CACHE;
    })
    .catch(err => {
      console.error('Error al cargar dependientes:', err);
      DEPENDIENTES_CACHE = [];
      return DEPENDIENTES_CACHE;
    });
}

function loadDependientesFromGoogleSheets() {
  return preloadDependientes();
}

// === Firestore helpers (histórico por día) ===
// Estructura:
//   tr_inventario/{docId}/historial/{YYYY-MM-DD}
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function getDocIdInv(storeKey, inventarioKey) {
  const s = String(storeKey || '').trim() || 'store';
  const inv = String(inventarioKey || '').trim() || 'inventario';
  return `inv_${s}_${inv}`;
}

function saveInventarioToFirestore(docId, payload, dateStr) {
  if (!docId) {
    return Promise.reject(new Error('Documento no configurado.'));
  }
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    return Promise.reject(new Error('Firebase/Firestore no está disponible.'));
  }

  const db  = firebase.firestore();
  const day = (typeof dateStr === 'string' && dateStr) ? dateStr : getTodayString();

  return db
    .collection('tr_inventario')
    .doc(String(docId))
    .collection('historial')
    .doc(day)
    .set(payload || {}, { merge: true })
    .then(() => ({ ok: true, day }))
    .catch(err => {
      console.error('Error al guardar en Firestore:', err);
      throw err;
    });
}

function loadInventarioFromFirestore(docId, dateStr) {
  if (!docId) return Promise.resolve({});
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    return Promise.reject(new Error('Firebase/Firestore no está disponible.'));
  }

  const db  = firebase.firestore();
  const day = (typeof dateStr === 'string' && dateStr) ? dateStr : getTodayString();

  return db
    .collection('tr_inventario')
    .doc(String(docId))
    .collection('historial')
    .doc(day)
    .get()
    .then(doc => (doc.exists ? (doc.data() || {}) : {}))
    .catch(err => {
      console.error('Error al leer Firestore:', err);
      return {};
    });
}

function getHistoryDatesInv(docId) {
  if (!docId) return Promise.resolve([]);
  if (typeof firebase === 'undefined' || !firebase.firestore) {
    return Promise.reject(new Error('Firebase/Firestore no está disponible.'));
  }

  const db = firebase.firestore();
  return db
    .collection('tr_inventario')
    .doc(String(docId))
    .collection('historial')
    .get()
    .then(snap => snap.docs.map(d => d.id))
    .catch(err => {
      console.error('Error al listar historial en Firestore:', err);
      return [];
    });
}

// Formatear fecha/hora a formato ES-SV
function formatSV(iso) {
  if (!iso) return 'Aún no guardado.';
  try {
    const dt = new Date(iso);
    return dt.toLocaleString('es-SV', {
      timeZone: 'America/El_Salvador',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (e) {
    return 'Aún no guardado.';
  }
}
