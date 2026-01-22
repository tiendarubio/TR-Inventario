document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

  // UI
  const storeSelect = $('storeSelect');
  const tipoSelect = $('tipoInventarioSelect');
  const inventarioSelect = $('inventarioSelect');
  const fechaInventario = $('fechaInventario');

  const proveedorInput = $('proveedorInput');
  const provSuggestions = $('provSuggestions');

  const ubicacionInput = $('ubicacionInput'); // ahora es <select>
  const wrapEstante = $('wrapEstante');
  const estanteSelect = $('estanteSelect');
  const wrapDependiente = $('wrapDependiente');
  const dependienteSelect = $('dependienteSelect');
  const wrapProveedor = $('wrapProveedor');

  const storeNavText = $('storeNavText');
  const lastSaved = $('lastSaved');

  const searchInput = $('searchInput');
  const suggestions = $('suggestions');

  const body = $('recepcionBody');
  const tLineas = $('tLineas');
  const tCantidad = $('tCantidad');

  const btnSave = $('saveReception');
  const btnExcel = $('exportExcel');
  const btnPDF = $('exportPDF');
  const btnClear = $('clearReception');
  const successMessage = $('successMessage');

  // Histórico
  const histDateInput = $('histDateInput');
  const btnHistToday = $('btnHistToday');
  const histViewModeText = $('histViewModeText');

  // Scanner
  const btnScan = $('btnScan');
  const scanWrap = $('scanWrap');
  const scanVideo = $('scanVideo');
  const btnScanStop = $('btnScanStop');
  const fileScan = $('fileScan');

  // Manual modal
  const btnOpenManual = $('btnOpenManual');
  const manualModalEl = $('manualModal');
  const btnAddManual = $('btnAddManual');
  const mCodigo = $('mCodigo');
  const mNombre = $('mNombre');
  const mCodInv = $('mCodInv');
  const mBodega = $('mBodega');
  const mVencimiento = $('mVencimiento');
  const mCantidad = $('mCantidad');

  // State
  let lastUpdateISO = null;

  // Histórico (flatpickr)
  let histPicker = null;
  let currentViewDate = null; // null = hoy (editable)
  let histDatesWithData = new Set();

  // Scanner state
  let mediaStream = null;
  let scanInterval = null;
  let detector = null;

  // ===== Helpers =====
  function getToday() {
    return (typeof getTodayString === 'function') ? getTodayString() : new Date().toISOString().split('T')[0];
  }

  function getDocId() {
    const storeKey = storeSelect?.value || 'store';
    const invKey = inventarioSelect?.value || 'inventario';
    return (typeof getDocIdInv === 'function') ? getDocIdInv(storeKey, invKey) : (`inv_${storeKey}_${invKey}`);
  }

  function setLastSaved(iso) {
    lastUpdateISO = iso || null;
    if (!lastSaved) return;
    lastSaved.innerHTML = '<i class="fa-solid fa-clock-rotate-left me-1"></i>' + (lastUpdateISO ? ('Última actualización: ' + formatSV(lastUpdateISO)) : 'Aún no guardado.');
  }

  function setSuccess(msg) {
    if (!successMessage) return;
    if (msg) {
      successMessage.textContent = msg;
      successMessage.classList.remove('d-none');
    } else {
      successMessage.classList.add('d-none');
    }
  }

  function updateStoreText() {
    const storeName = storeSelect?.options?.[storeSelect.selectedIndex]?.text || 'Sucursal';
    if (storeNavText) storeNavText.textContent = `${storeName} — Control de inventario`;
  }

  function clearTable() {
    if (!body) return;
    body.innerHTML = '';
    updateTotals();
  }

  function updateTotals() {
    if (!body) return;
    const lines = body.rows.length;
    let totalQty = 0;

    [...body.getElementsByTagName('tr')].forEach(tr => {
      const qtyInput = tr.querySelector('.qty');
      const raw = (qtyInput?.value || '').trim();
      const n = (raw.match(/\d+/g)) ? parseInt(raw.match(/\d+/g).join('')) : 0;
      totalQty += isNaN(n) ? 0 : n;
    });

    if (tLineas) tLineas.textContent = String(lines);
    if (tCantidad) tCantidad.textContent = String(totalQty);
  }

  function htmlAttrEscape(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/"/g, '&quot;');
  }

  function setHistoricalViewMode(isHistorical) {
    const labelDate = currentViewDate || '';
    if (histViewModeText) {
      if (isHistorical) {
        histViewModeText.textContent = labelDate
          ? ('Modo histórico (' + labelDate + '): solo lectura.')
          : 'Modo histórico: solo lectura.';
        histViewModeText.classList.remove('text-muted');
        histViewModeText.classList.add('text-primary');
      } else {
        histViewModeText.textContent = 'Modo: inventario del día actual (editable).';
        histViewModeText.classList.add('text-muted');
        histViewModeText.classList.remove('text-primary');
      }
    }

    const disable = !!isHistorical;

    // Inputs
    if (storeSelect) storeSelect.disabled = disable;
    if (tipoSelect) tipoSelect.disabled = disable;
    if (ubicacionInput) ubicacionInput.disabled = disable;
    if (estanteSelect) estanteSelect.disabled = disable;
    if (dependienteSelect) dependienteSelect.disabled = disable;
    if (proveedorInput) proveedorInput.disabled = disable;

    if (searchInput) searchInput.disabled = disable;
    if (btnScan) btnScan.disabled = disable;
    if (fileScan) fileScan.disabled = disable;
    if (btnOpenManual) btnOpenManual.disabled = disable;

    // Buttons
    if (btnSave) btnSave.disabled = disable;
    if (btnClear) btnClear.disabled = disable;

    // Row qty inputs
    if (body) {
      [...body.getElementsByTagName('tr')].forEach(tr => {
        const qty = tr.querySelector('.qty');
        const delBtn = tr.querySelector('.btn-delete-row');
        if (qty) qty.disabled = disable;
        if (delBtn) delBtn.disabled = disable;
      });
    }
  }

  // ===== Load dropdown data (Sheets) =====
  function fillSelect(selectEl, options, placeholder) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = '';

    const opt0 = document.createElement('option');
    opt0.value = '';
    opt0.textContent = placeholder || 'Seleccione...';
    selectEl.appendChild(opt0);

    (options || []).forEach(v => {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = String(v);
      selectEl.appendChild(o);
    });

    // Intentar mantener selección previa si existe
    if (prev && [...selectEl.options].some(o => o.value === prev)) {
      selectEl.value = prev;
    } else {
      selectEl.value = '';
    }
  }

  async function refreshUbicacionesEstantesDependientes() {
    // Estantes + ubicaciones
    const est = await loadEstantesFromGoogleSheets();
    const ubicaciones = Array.isArray(est?.ubicaciones) ? est.ubicaciones : [];
    fillSelect(ubicacionInput, ubicaciones, 'Seleccione ubicación...');

    const storeKey = storeSelect?.value || 'avenida_morazan';
    const estantes = Array.isArray(est?.estantes?.[storeKey]) ? est.estantes[storeKey] : [];
    fillSelect(estanteSelect, estantes, 'Seleccione estante...');

    // Dependientes
    const deps = await loadDependientesFromGoogleSheets();
    fillSelect(dependienteSelect, Array.isArray(deps) ? deps : [], 'Seleccione dependiente...');
  }

  function applyTipoUI() {
    const tipo = (tipoSelect?.value || 'Sala de venta').trim();

    const showEst = (tipo === 'Sala de venta' || tipo === 'Almacen');
    const showDep = (tipo === 'Sala de venta' || tipo === 'Almacen');
    const showProv = (tipo === 'Almacen' || tipo === 'Averías');

    if (wrapEstante) wrapEstante.style.display = showEst ? '' : 'none';
    if (wrapDependiente) wrapDependiente.style.display = showDep ? '' : 'none';
    if (wrapProveedor) wrapProveedor.style.display = showProv ? '' : 'none';

    // Si se oculta, limpiamos valores (para evitar guardar "basura")
    if (!showEst && estanteSelect) estanteSelect.value = '';
    if (!showDep && dependienteSelect) dependienteSelect.value = '';
    if (!showProv && proveedorInput) {
      proveedorInput.value = '';
      if (provSuggestions) provSuggestions.innerHTML = '';
    }
  }

  // ===== Rows =====
  function addRowFromData(item) {
    if (!body) return;

    const tr = document.createElement('tr');
    const qtyValue = htmlAttrEscape(item.cantidad ?? '');
    const vencValue = htmlAttrEscape(item.vencimiento ?? '');

    tr.innerHTML = `
      <td class="text-center">${body.rows.length + 1}</td>
      <td>${item.codigo || ''}</td>
      <td>${item.descripcion || ''}</td>
      <td>${item.codigo_inventario || 'N/A'}</td>
      <td>${item.bodega || ''}</td>
      <td>${item.vencimiento || ''}</td>
      <td class="text-center">
        <input type="text" class="form-control form-control-sm qty" value="${qtyValue}" placeholder="0">
      </td>
      <td class="text-center">
        <button class="btn btn-sm btn-outline-secondary btn-delete-row" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;

    body.appendChild(tr);

    const qtyInput = tr.querySelector('.qty');
    if (qtyInput) qtyInput.addEventListener('input', updateTotals);

    const delBtn = tr.querySelector('.btn-delete-row');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        Swal.fire({
          title: '¿Eliminar ítem?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Eliminar'
        }).then(res => {
          if (res.isConfirmed) {
            tr.remove();
            renumberRows();
            updateTotals();
          }
        });
      });
    }

    renumberRows();
    updateTotals();
  }

  function renumberRows() {
    if (!body) return;
    [...body.getElementsByTagName('tr')].forEach((row, idx) => {
      row.cells[0].textContent = String(idx + 1);
    });
  }

  function collectItems() {
    if (!body) return [];
    return [...body.getElementsByTagName('tr')].map(tr => ({
      codigo: tr.cells[1].innerText.trim(),
      descripcion: tr.cells[2].innerText.trim(),
      codigo_inventario: tr.cells[3].innerText.trim(),
      bodega: tr.cells[4].innerText.trim(),
      vencimiento: tr.cells[5].innerText.trim(),
      cantidad: (tr.querySelector('.qty')?.value || '').trim()
    }));
  }

  function collectPayload() {
    const storeKey = storeSelect?.value || '';
    const storeName = storeSelect?.options?.[storeSelect.selectedIndex]?.text || '';
    const tipo = (tipoSelect?.value || '').trim();

    return {
      meta: {
        store_key: storeKey,
        store: storeName,
        hoja_inventario: inventarioSelect?.value || '',
        tipo_inventario: tipo,
        ubicacion: ubicacionInput?.value || '',
        estante: estanteSelect?.value || '',
        dependiente: dependienteSelect?.value || '',
        proveedor: (proveedorInput?.value || '').trim(),
        updatedAt: new Date().toISOString()
      },
      items: collectItems()
    };
  }

  function applyMetaToUI(meta) {
    if (!meta) return;

    if (meta.tipo_inventario && tipoSelect) {
      tipoSelect.value = meta.tipo_inventario;
    }
    applyTipoUI();

    if (meta.ubicacion && ubicacionInput) ubicacionInput.value = meta.ubicacion;
    if (meta.estante && estanteSelect) estanteSelect.value = meta.estante;
    if (meta.dependiente && dependienteSelect) dependienteSelect.value = meta.dependiente;
    if (meta.proveedor !== undefined && proveedorInput) proveedorInput.value = meta.proveedor || '';

    if (meta.updatedAt) setLastSaved(meta.updatedAt);
  }

  function validateMetaOrThrow() {
    const tipo = (tipoSelect?.value || '').trim();
    const prov = (proveedorInput?.value || '').trim();
    const ubic = (ubicacionInput?.value || '').trim();
    const est = (estanteSelect?.value || '').trim();
    const dep = (dependienteSelect?.value || '').trim();

    if (tipo === 'Sala de venta') {
      if (!ubic) throw new Error('Selecciona la ubicación (sala de venta).');
      if (!est) throw new Error('Selecciona el estante.');
      if (!dep) throw new Error('Selecciona el dependiente.');
    } else if (tipo === 'Almacen') {
      if (!ubic) throw new Error('Selecciona el almacén (ubicación).');
      if (!est) throw new Error('Selecciona el estante.');
      if (!dep) throw new Error('Selecciona el dependiente.');
      if (!prov) throw new Error('Selecciona o escribe el proveedor.');
    } else if (tipo === 'Averías') {
      if (!prov) throw new Error('Selecciona o escribe el proveedor.');
    }
  }

  // ===== Catálogo autocomplete =====
  let currentFocus = -1;

  searchInput?.addEventListener('input', () => {
    const q = (searchInput.value || '').replace(/\r|\n/g, '').trim().toLowerCase();
    suggestions.innerHTML = '';
    currentFocus = -1;
    if (!q) return;

    loadProductsFromGoogleSheets().then(rows => {
      rows
        .filter(r => {
          const n = (r[0] || '').toLowerCase(); // nombre
          const cod = (r[1] || '').toLowerCase(); // cod inventario
          const bod = (r[2] || '').toLowerCase(); // bodega
          const bar = (r[3] || '').toLowerCase(); // barcode
          return n.includes(q) || cod.includes(q) || bod.includes(q) || bar.includes(q);
        })
        .slice(0, 50)
        .forEach(r => {
          const li = document.createElement('li');
          li.className = 'list-group-item';
          const nombre = r[0] || '';
          const codInv = r[1] || 'N/A';
          const bodega = r[2] || '';
          const barcode = r[3] || 'sin código';
          li.textContent = `${nombre} (${barcode}) [${codInv}] — ${bodega}`;
          li.addEventListener('click', () => {
            addRowFromData({
              codigo: r[3] || '',
              descripcion: r[0] || '',
              codigo_inventario: r[1] || 'N/A',
              bodega: r[2] || '',
              vencimiento: '',
              cantidad: ''
            });
            suggestions.innerHTML = '';
            searchInput.value = '';
            searchInput.focus();
          });
          suggestions.appendChild(li);
        });
    });
  });

  searchInput?.addEventListener('keydown', (e) => {
    const items = suggestions.getElementsByTagName('li');
    if (e.key === 'ArrowDown') {
      currentFocus++;
      addActive(items);
    } else if (e.key === 'ArrowUp') {
      currentFocus--;
      addActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFocus > -1 && items[currentFocus]) {
        items[currentFocus].click();
      } else {
        // Enter directo por barcode o cod_inv
        const q = (searchInput.value || '').replace(/\r|\n/g, '').trim();
        if (!q) return;
        const rows = (window.CATALOGO_CACHE || []);
        let match = null;
        for (const r of rows) {
          const bar = r[3] ? String(r[3]).trim() : '';
          const cod = r[1] ? String(r[1]).trim() : '';
          if (bar === q || cod === q) { match = r; break; }
        }
        if (match) {
          addRowFromData({
            codigo: match[3] || q,
            descripcion: match[0] || '',
            codigo_inventario: match[1] || 'N/A',
            bodega: match[2] || '',
            vencimiento: '',
            cantidad: ''
          });
          suggestions.innerHTML = '';
          searchInput.value = '';
          searchInput.focus();
        }
      }
    }
  });

  function addActive(items) {
    if (!items || !items.length) return;
    [...items].forEach(x => x.classList.remove('active'));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active');
    items[currentFocus].scrollIntoView({ block: 'nearest' });
  }

  // Cerrar sugerencias click afuera / Escape
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target === searchInput || suggestions.contains(target)) return;
    suggestions.innerHTML = '';
    currentFocus = -1;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestions.innerHTML = '';
      currentFocus = -1;
      if (provSuggestions) provSuggestions.innerHTML = '';
    }
  });

  // ===== Proveedores autocomplete =====
  let provFocus = -1;

  function renderProvSuggestions(list) {
    if (!provSuggestions) return;
    provSuggestions.innerHTML = '';
    provFocus = -1;
    (list || []).slice(0, 30).forEach(p => {
      const li = document.createElement('li');
      li.className = 'list-group-item';
      li.textContent = p;
      li.addEventListener('click', () => {
        proveedorInput.value = p;
        provSuggestions.innerHTML = '';
        proveedorInput.focus();
      });
      provSuggestions.appendChild(li);
    });
  }

  proveedorInput?.addEventListener('input', async () => {
    const q = (proveedorInput.value || '').replace(/\r|\n/g, '').trim().toLowerCase();
    if (!q) { if (provSuggestions) provSuggestions.innerHTML = ''; return; }
    const list = await loadProvidersFromGoogleSheets();
    const matches = (list || []).filter(x => String(x).toLowerCase().includes(q));
    renderProvSuggestions(matches);
  });

  proveedorInput?.addEventListener('keydown', async (e) => {
    if (!provSuggestions) return;
    const items = provSuggestions.getElementsByTagName('li');
    if (e.key === 'ArrowDown') {
      provFocus++;
      addActiveProv(items);
    } else if (e.key === 'ArrowUp') {
      provFocus--;
      addActiveProv(items);
    } else if (e.key === 'Enter') {
      if (provFocus > -1 && items[provFocus]) {
        e.preventDefault();
        items[provFocus].click();
      }
    }
  });

  function addActiveProv(items) {
    if (!items || !items.length) return;
    [...items].forEach(x => x.classList.remove('active'));
    if (provFocus >= items.length) provFocus = 0;
    if (provFocus < 0) provFocus = items.length - 1;
    items[provFocus].classList.add('active');
    items[provFocus].scrollIntoView({ block: 'nearest' });
  }

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target === proveedorInput || (provSuggestions && provSuggestions.contains(target))) return;
    if (provSuggestions) provSuggestions.innerHTML = '';
    provFocus = -1;
  });

  // ===== Manual add =====
  let manualModal = null;
  if (manualModalEl && window.bootstrap?.Modal) {
    manualModal = new window.bootstrap.Modal(manualModalEl);
  }

  btnOpenManual?.addEventListener('click', () => {
    if (manualModal) {
      // limpiar
      if (mCodigo) mCodigo.value = '';
      if (mNombre) mNombre.value = '';
      if (mCodInv) mCodInv.value = '';
      if (mBodega) mBodega.value = '';
      if (mVencimiento) mVencimiento.value = '';
      if (mCantidad) mCantidad.value = '';
      manualModal.show();
      setTimeout(() => mNombre?.focus(), 150);
    }
  });

  btnAddManual?.addEventListener('click', () => {
    const desc = (mNombre?.value || '').trim();
    if (!desc) {
      Swal.fire('Falta descripción', 'Escribe el nombre/descripcion del producto.', 'warning');
      return;
    }
    addRowFromData({
      codigo: (mCodigo?.value || '').trim(),
      descripcion: desc,
      codigo_inventario: (mCodInv?.value || '').trim() || 'N/A',
      bodega: (mBodega?.value || '').trim(),
      vencimiento: (mVencimiento?.value || '').trim(),
      cantidad: (mCantidad?.value || '').trim()
    });
    manualModal?.hide();
    searchInput?.focus();
  });

  // ===== Scanner =====
  async function startScanner() {
    if ('BarcodeDetector' in window) {
      try {
        detector = new window.BarcodeDetector({ formats: ['ean_13', 'code_128', 'code_39', 'ean_8', 'upc_a', 'upc_e'] });
      } catch (e) { detector = null; }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Swal.fire('No compatible', 'Tu navegador no permite usar la cámara.', 'info');
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      scanVideo.srcObject = mediaStream;
      await scanVideo.play();
      scanWrap.classList.add('active');

      if (detector) {
        if (scanInterval) clearInterval(scanInterval);
        scanInterval = setInterval(async () => {
          try {
            const barcodes = await detector.detect(scanVideo);
            if (barcodes && barcodes.length) {
              const raw = String(barcodes[0].rawValue || '').trim();
              if (raw) await onBarcodeFound(raw);
            }
          } catch (_e) { }
        }, 250);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Cámara no disponible', 'No se pudo acceder a la cámara.', 'error');
    }
  }

  async function stopScanner() {
    if (scanInterval) { clearInterval(scanInterval); scanInterval = null; }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    scanWrap.classList.remove('active');
  }

  async function onBarcodeFound(code) {
    await stopScanner();
    searchInput.value = code;
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    searchInput.dispatchEvent(e);
  }

  fileScan?.addEventListener('change', async () => {
    const f = fileScan.files?.[0];
    if (!f) return;
    const m = (f.name || '').match(/\d{8,}/);
    if (m) {
      searchInput.value = m[0];
      const e = new KeyboardEvent('keydown', { key: 'Enter' });
      searchInput.dispatchEvent(e);
    } else {
      Swal.fire('Atención', 'No se pudo leer el código desde la imagen. Prueba con la cámara.', 'info');
    }
  });

  btnScan?.addEventListener('click', startScanner);
  btnScanStop?.addEventListener('click', stopScanner);

  // ===== PDF/Excel exports =====
  function buildHeaderLines() {
    const storeName = storeSelect?.options?.[storeSelect.selectedIndex]?.text || 'Sucursal';
    const tipo = (tipoSelect?.value || '').trim();
    const ubic = (ubicacionInput?.value || '').trim();
    const est = (estanteSelect?.value || '').trim();
    const dep = (dependienteSelect?.value || '').trim();
    const prov = (proveedorInput?.value || '').trim();
    const inv = inventarioSelect?.value || '';

    const lines = [];
    lines.push(`Tienda: ${storeName}`);
    if (tipo) lines.push(`Tipo: ${tipo}`);
    if (ubic) lines.push(`Ubicación: ${ubic}`);
    if (est) lines.push(`Estante: ${est}`);
    if (dep) lines.push(`Dependiente: ${dep}`);
    if (prov) lines.push(`Proveedor: ${prov}`);
    if (inv) lines.push(`Hoja de inventario: ${inv}`);
    if (currentViewDate) lines.push(`Vista: ${currentViewDate}`);
    lines.push(`Última actualización (guardado): ${formatSV(lastUpdateISO)}`);
    return lines;
  }

  function exportPDF(openWindow) {
    if (!body || body.rows.length === 0) return;

    const jsPDF = window.jspdf.jsPDF;
    const doc = new jsPDF();

    doc.setFontSize(12);

    const header = buildHeaderLines();
    let y = 10;
    header.forEach(line => {
      doc.text(line, 10, y);
      y += 8;
    });

    const rows = [...body.getElementsByTagName('tr')].map((tr, i) => {
      const codigo = tr.cells[1].innerText.trim();
      const desc = tr.cells[2].innerText.trim();
      const codInv = tr.cells[3].innerText.trim();
      const bodega = tr.cells[4].innerText.trim();
      const venc = tr.cells[5].innerText.trim();
      const qty = tr.querySelector('.qty')?.value.trim() || '';
      return [i + 1, codigo, desc, codInv, bodega, venc, qty];
    });

    doc.autoTable({
      startY: y + 2,
      head: [['#', 'Código', 'Descripción', 'Cód. inv', 'Bodega', 'Venc.', 'Cant.']],
      body: rows,
      pageBreak: 'auto'
    });

    if (openWindow) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      const fecha = new Date().toISOString().split('T')[0];
      const storeName = storeSelect?.options?.[storeSelect.selectedIndex]?.text || 'Tienda';
      doc.save(`${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_${fecha}_Inventario.pdf`);
    }
  }

  btnPDF?.addEventListener('click', () => {
    if (!body || body.rows.length === 0) {
      Swal.fire('Sin datos', 'No hay productos para generar PDF.', 'info');
      return;
    }
    Swal.fire({
      title: 'PDF',
      text: '¿Deseas abrir en una pestaña nueva o descargar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Abrir',
      cancelButtonText: 'Descargar'
    }).then(res => {
      if (res.isConfirmed) exportPDF(true);
      else exportPDF(false);
    });
  });

  async function exportExcel() {
    if (!body || body.rows.length === 0) return;

    const header = buildHeaderLines();

    const rows = [...body.getElementsByTagName('tr')].map((tr) => {
      const codigo = tr.cells[1].innerText.trim();
      const desc = tr.cells[2].innerText.trim();
      const codInv = tr.cells[3].innerText.trim();
      const bodega = tr.cells[4].innerText.trim();
      const venc = tr.cells[5].innerText.trim();
      const qtyInput = tr.querySelector('.qty')?.value.trim() || '0';
      const qty = (qtyInput.match(/\d+/g)) ? parseInt(qtyInput.match(/\d+/g).join('')) : 0;
      return [codigo, desc, codInv, bodega, venc, qty];
    });

    const data = [
      ['Inventario (TR)'],
      ...header.map(l => [l]),
      [],
      ['Código', 'Descripción', 'Cód. inv', 'Bodega', 'Vencimiento', 'Cantidad'],
      ...rows
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });

    const fecha = new Date().toISOString().split('T')[0];
    const storeName = storeSelect?.options?.[storeSelect.selectedIndex]?.text || 'Tienda';
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${storeName.replace(/[^a-zA-Z0-9]/g, '_')}_${fecha}_Inventario.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  btnExcel?.addEventListener('click', async () => {
    if (!body || body.rows.length === 0) {
      Swal.fire('Sin datos', 'No hay productos para generar Excel.', 'info');
      return;
    }
    await exportExcel();
    Swal.fire('Éxito', 'Se generó el Excel.', 'success');
  });

  // ===== Firestore: load/save + historial =====
  async function loadStateForDate(dateStrOrNull) {
    clearTable();
    setSuccess('');

    const docId = getDocId();
    const record = await loadInventarioFromFirestore(docId, dateStrOrNull || undefined);
    const meta = record?.meta || null;

    // Aplicar meta primero para que se activen/oculten controles
    if (meta) applyMetaToUI(meta);
    else {
      // si no hay meta, mantenemos selección actual
      setLastSaved(null);
    }

    // Render items
    if (record && Array.isArray(record.items)) {
      record.items.forEach(addRowFromData);
      renumberRows();
      updateTotals();
    }

    // Badge last saved (si no venía en meta)
    if (!meta?.updatedAt) setLastSaved(meta?.updatedAt || null);

    // Fecha en UI
    if (fechaInventario) {
      const d = dateStrOrNull || getToday();
      fechaInventario.textContent = d;
    }
  }

  async function refreshHistoryPicker() {
    if (!histDateInput || typeof flatpickr === 'undefined' || typeof getHistoryDatesInv !== 'function') return;
    try {
      const docId = getDocId();
      const fechas = await getHistoryDatesInv(docId);
      const fechasUnicas = Array.from(new Set((fechas || []).filter(Boolean)));
      histDatesWithData = new Set(fechasUnicas);

      if (histPicker) {
        try { histPicker.destroy(); } catch (e) {}
        histPicker = null;
      }

      histPicker = flatpickr(histDateInput, {
        dateFormat: 'Y-m-d',
        allowInput: false,
        onDayCreate: function(dObj, dStr, fp, dayElem) {
          try {
            const date = dayElem.dateObj;
            if (!date) return;
            const iso = date.toISOString().slice(0, 10);
            if (histDatesWithData && histDatesWithData.has(iso)) {
              dayElem.classList.add('has-history');
            }
          } catch (_) {}
        },
        onChange: function(selectedDates, dateStr) {
          if (!dateStr) return;
          loadHistoryForDate(dateStr);
        }
      });
    } catch (e) {
      console.error('Error al configurar calendario histórico:', e);
    }
  }

  async function loadHistoryForDate(dateStr) {
    if (!dateStr) return;
    try {
      const today = getToday();
      currentViewDate = dateStr;

      await loadStateForDate(dateStr);

      const isHistorical = (today ? (dateStr !== today) : true);
      setHistoricalViewMode(isHistorical);

      if (isHistorical) {
        Swal.fire('Vista histórica', 'Mostrando inventario guardado para ' + dateStr + ' (solo lectura).', 'info');
      }
    } catch (e) {
      console.error('Error al cargar histórico:', e);
      Swal.fire('Error', 'No se pudo cargar el histórico para esa fecha.', 'error');
    }
  }

  btnHistToday?.addEventListener('click', async () => {
    if (histPicker) {
      histPicker.clear();
    } else if (histDateInput) {
      histDateInput.value = '';
    }
    currentViewDate = null;
    await loadStateForDate(null);
    setHistoricalViewMode(false);
    searchInput?.focus();
  });

  // Guardar (solo hoy)
  btnSave?.addEventListener('click', async () => {
    const today = getToday();
    if (currentViewDate && currentViewDate !== today) {
      Swal.fire('Vista histórica', 'Estás viendo el inventario del ' + currentViewDate + '. Para guardar, vuelve a hoy.', 'info');
      return;
    }

    try {
      validateMetaOrThrow();

      const docId = getDocId();
      const payload = collectPayload();

      await saveInventarioToFirestore(docId, payload, today);

      setLastSaved(payload.meta.updatedAt);
      setSuccess('Inventario guardado correctamente.');
      await refreshHistoryPicker();

      Swal.fire('Guardado', 'Inventario guardado correctamente.', 'success');
    } catch (e) {
      console.error(e);
      Swal.fire('Error', String(e?.message || e), 'error');
    }
  });

  // Limpiar (solo hoy) -> guarda vacío
  btnClear?.addEventListener('click', async () => {
    const today = getToday();
    if (currentViewDate && currentViewDate !== today) {
      Swal.fire('Vista histórica', 'Para limpiar, vuelve al día actual.', 'info');
      return;
    }
    if (!body || body.rows.length === 0) return;

    Swal.fire({
      title: '¿Limpiar inventario?',
      text: 'Se eliminarán todos los items en pantalla (se guardará vacío).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Limpiar'
    }).then(async res => {
      if (!res.isConfirmed) return;
      clearTable();
      try {
        // Validamos meta igual, para no guardar "sin tipo" (pero en Averías solo proveedor)
        validateMetaOrThrow();

        const docId = getDocId();
        const payload = collectPayload(); // vacío

        await saveInventarioToFirestore(docId, payload, today);

        setLastSaved(payload.meta.updatedAt);
        setSuccess('Inventario vacío guardado.');
        await refreshHistoryPicker();

        Swal.fire('Listo', 'Inventario vacío guardado.', 'success');
      } catch (e) {
        console.error(e);
        Swal.fire('Error', String(e?.message || e), 'error');
      }
    });
  });

  // ===== Change handlers =====
  storeSelect?.addEventListener('change', async () => {
    updateStoreText();
    await refreshUbicacionesEstantesDependientes();
    applyTipoUI();

    // cambiar sucursal => volvemos a hoy
    currentViewDate = null;
    if (histPicker) { try { histPicker.clear(); } catch (_) {} }
    if (histDateInput) histDateInput.value = '';

    await loadStateForDate(null);
    setHistoricalViewMode(false);
    await refreshHistoryPicker();
  });

  inventarioSelect?.addEventListener('change', async () => {
    // cambiar hoja => volvemos a hoy
    currentViewDate = null;
    if (histPicker) { try { histPicker.clear(); } catch (_) {} }
    if (histDateInput) histDateInput.value = '';

    await loadStateForDate(null);
    setHistoricalViewMode(false);
    await refreshHistoryPicker();
  });

  tipoSelect?.addEventListener('change', () => {
    applyTipoUI();
  });

  // ===== Init =====
  updateStoreText();

  // Cargar caches Sheets
  await preloadCatalog();
  await preloadProviders();
  await preloadEstantes();
  await preloadDependientes();

  await refreshUbicacionesEstantesDependientes();
  applyTipoUI();

  // Carga inicial (hoy)
  await loadStateForDate(null);
  currentViewDate = null;
  setHistoricalViewMode(false);
  await refreshHistoryPicker();

  // Foco
  searchInput?.focus();
});
