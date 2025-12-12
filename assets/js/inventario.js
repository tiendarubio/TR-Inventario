// assets/js/inventario.js
document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

  const fechaEl = $('fechaInventario');
  if (fechaEl) {
    fechaEl.textContent = 'Fecha de inventario: ' + new Date().toLocaleString('es-SV', { timeZone: 'America/El_Salvador' });
  }

  const body           = $('recepcionBody');
  const proveedorInput = $('proveedorInput');
  const ubicacionInput = $('ubicacionInput');
  const btnSave        = $('saveReception');
  const btnPDF         = $('exportPDF');
  const btnPrint       = $('printPDF');
  const btnExcel       = $('exportExcel');
  const btnClear       = $('clearReception');

  const mCodigo       = $('mCodigo');
  const mNombre       = $('mNombre');
  const mCodInv       = $('mCodInv');
  const mBodega       = $('mBodega');
  const mVencimiento  = $('mVencimiento');
  const mCantidad     = $('mCantidad');
  const manualModalEl = document.getElementById('manualModal');
  const manualModal   = new bootstrap.Modal(manualModalEl);

  const modalInputs = [mCodigo, mNombre, mCodInv, mBodega, mVencimiento, mCantidad];
  modalInputs.forEach((inp, idx) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (idx < modalInputs.length - 1) {
          modalInputs[idx + 1].focus();
        } else {
          $('btnAddManual').click();
        }
      }
    });
  });

  const INVENTARIO_BINS = {
    inventario1: '692091aa43b1c97be9bc18dd',
    inventario2: '692091efd0ea881f40f71767',
    inventario3: '69209205ae596e708f67d3f6',
    inventario4: '6920921ed0ea881f40f717a1',
    inventario5: '69209234ae596e708f67d43d',
    inventario6: '6920924f43b1c97be9bc19f8',
    inventario7: '6920927143b1c97be9bc1a36',
    inventario8: '692092d9ae596e708f67d551',
    inventario9: '6920930243b1c97be9bc1b38',
    inventario10:'69209315ae596e708f67d5da'
  };

  let CURRENT_INVENTARIO = localStorage.getItem('TR_AVM_CURRENT_INVENTARIO') || 'inventario1';
  const inventarioSelect = $('inventarioSelect');

  function getCurrentBinId() {
    return INVENTARIO_BINS[CURRENT_INVENTARIO];
  }

  function sanitizeName(s) {
    return (s || '').toString().trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-.]/g, '_');
  }

  if (inventarioSelect) {
    inventarioSelect.value = CURRENT_INVENTARIO;
  }

  const searchInput = $('searchInput');
  const btnScan     = $('btnScan');
  const scanWrap    = $('scanWrap');
  const scanVideo   = $('scanVideo');
  const btnScanStop = $('btnScanStop');
  const fileScan    = $('fileScan');

  let mediaStream = null;
  let scanInterval = null;
  let detector = null;

  function centerOnElement(el) {
    if (!el) return;
    setTimeout(() => {
      const rect        = el.getBoundingClientRect();
      const absoluteTop = rect.top + window.pageYOffset;
      const middle      = absoluteTop - (window.innerHeight / 2) + rect.height / 2;
      window.scrollTo({ top: middle, behavior: 'smooth' });
    }, 0);
  }

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t === searchInput || t.classList.contains('qty')) {
      centerOnElement(t);
    }
  });

  const provSuggestions = $('provSuggestions');
  await preloadProviders().catch(() => {});

  let provFocus = -1;
  proveedorInput.addEventListener('input', () => {
    const q = (proveedorInput.value || '').trim().toLowerCase();
    provSuggestions.innerHTML = '';
    provFocus = -1;
    if (!q) return;

    loadProvidersFromGoogleSheets().then(list => {
      (list || [])
        .filter(p => p.toLowerCase().includes(q))
        .slice(0, 50)
        .forEach(name => {
          const li       = document.createElement('li');
          li.className   = 'list-group-item';
          li.textContent = name;
          li.addEventListener('click', () => {
            proveedorInput.value   = name;
            provSuggestions.innerHTML = '';
          });
          provSuggestions.appendChild(li);
        });

      if (!provSuggestions.children.length) {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-light no-results';
        li.textContent = 'Sin resultados. Escriba el nombre completo del proveedor.';
        provSuggestions.appendChild(li);
      }
    }).catch(() => {});
  });

  proveedorInput.addEventListener('keydown', (e) => {
    const items = provSuggestions.getElementsByTagName('li');
    if (e.key === 'ArrowDown') { provFocus++; addActiveProv(items); }
    else if (e.key === 'ArrowUp') { provFocus--; addActiveProv(items); }
    else if (e.key === 'Enter') {
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
    if (target === proveedorInput || provSuggestions.contains(target)) return;
    provSuggestions.innerHTML = '';
    provFocus = -1;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      provSuggestions.innerHTML = '';
      provFocus = -1;
    }
  });

  function openManualModalFromSearch(rawQuery) {
    const q = (rawQuery || '').trim();
    mCodigo.value   = '';
    mNombre.value   = '';
    mCodInv.value   = 'N/A';
    mBodega.value   = '';
    mCantidad.value = '';
    if (q) {
      if (/^\d+$/.test(q)) mCodigo.value = q;
      else mNombre.value = q;
    }
    manualModal.show();
    setTimeout(() => mCodigo.focus(), 200);
  }

  const btnOpenManual = document.getElementById('btnOpenManual');
  btnOpenManual.addEventListener('click', () => {
    const raw = (searchInput.value || '').replace(/\r|\n/g, '').trim();
    openManualModalFromSearch(raw);
  });

  $('btnAddManual').addEventListener('click', () => {
    const codigo   = (mCodigo.value || '').trim();
    const nombre   = (mNombre.value || '').trim();
    const codInv   = (mCodInv.value || 'N/A').trim() || 'N/A';
    const bodega   = (mBodega.value || '').trim();
    const fechaVenc= (mVencimiento.value || '').trim();
    const qty      = parseNum(mCantidad.value);

    if (!codigo || !nombre) {
      Swal.fire('Campos faltantes', 'Ingrese código de barras y nombre.', 'info');
      return;
    }
    if (!(qty > 0)) {
      Swal.fire('Cantidad inválida', 'La cantidad debe ser mayor que 0.', 'warning');
      return;
    }

    addRow({ barcode: codigo, nombre, codInvent: codInv, bodega, fechaVenc, cantidad: qty });
    manualModal.hide();
    searchInput.focus();
  });

  const suggestions = $('suggestions');
  let currentFocus  = -1;

  await preloadCatalog().catch(() => {});

  searchInput.addEventListener('input', () => {
    const raw = (searchInput.value || '').replace(/\r|\n/g, '').trim();
    const q   = raw.toLowerCase();
    suggestions.innerHTML = '';
    currentFocus = -1;
    if (!q) return;

    loadProductsFromGoogleSheets().then(rows => {
      const filtered = (rows || []).filter(r => {
        const nombre    = (r[0] || '').toLowerCase();
        const codInvent = (r[1] || '').toLowerCase();
        const barcode   = (r[3] || '').toLowerCase();
        return nombre.includes(q) || barcode.includes(q) || codInvent.includes(q);
      });

      if (!filtered.length) {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-light no-results';
        li.innerHTML = '<strong>Sin resultados</strong>. Usa el botón + para agregar producto manual.';
        suggestions.appendChild(li);
        return;
      }

      filtered.slice(0, 50).forEach(prod => {
        const li        = document.createElement('li');
        li.className    = 'list-group-item';
        const nombre    = prod[0] || '';
        const codInvent = prod[1] || 'N/A';
        const bodega    = prod[2] || '';
        const barcode   = prod[3] || 'sin código';
        li.textContent  = nombre + ' (' + barcode + ') [' + codInvent + '] — ' + bodega;
        li.addEventListener('click', () => addRowAndFocus({ barcode, nombre, codInvent, bodega }));
        suggestions.appendChild(li);
      });
    }).catch(() => {});
  });

  searchInput.addEventListener('keydown', (e) => {
    const items = suggestions.getElementsByTagName('li');
    if (e.key === 'ArrowDown') { currentFocus++; addActive(items); }
    else if (e.key === 'ArrowUp') { currentFocus--; addActive(items); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (currentFocus > -1 && items[currentFocus]) {
        items[currentFocus].click();
        return;
      }

      const raw = (searchInput.value || '').replace(/\r|\n/g, '').trim();
      if (!raw) return;

      const rows = (window.CATALOGO_CACHE || []);
      let match  = null;
      for (const r of rows) {
        const barcode   = r[3] ? String(r[3]).trim() : '';
        const codInvent = r[1] ? String(r[1]).trim() : '';
        if (barcode === raw || codInvent === raw) {
          match = r;
          break;
        }
      }
      if (match) {
        const nombre    = match[0] || '';
        const codInvent = match[1] || 'N/A';
        const bodega    = match[2] || '';
        const barcode   = match[3] || raw;
        addRowAndFocus({ barcode, nombre, codInvent, bodega });
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
    }
  });

  async function startScanner() {
    if (!btnScan || !scanWrap) return;

    if (!('BarcodeDetector' in window)) {
      Swal.fire(
        'Escáner limitado',
        'Este navegador no soporta escaneo en vivo. Usa la opción de archivo o la pistola de códigos.',
        'info'
      );
      if (fileScan) {
        fileScan.click();
      }
      return;
    }

    try {
      detector = new window.BarcodeDetector({
        formats: ['ean_13','code_128','code_39','ean_8','upc_a','upc_e']
      });
    } catch (e) {
      detector = null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      Swal.fire('No compatible', 'Tu navegador no permite usar la cámara.', 'info');
      return;
    }

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      });
      if (!scanVideo) return;
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
              if (raw) {
                await onBarcodeFound(raw);
              }
            }
          } catch (_e) {
          }
        }, 250);
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Cámara no disponible', 'No se pudo acceder a la cámara.', 'error');
    }
  }

  async function stopScanner() {
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    if (scanWrap) {
      scanWrap.classList.remove('active');
    }
  }

  async function onBarcodeFound(code) {
    await stopScanner();
    if (!searchInput) return;
    searchInput.value = code;
    const e = new KeyboardEvent('keydown', { key: 'Enter' });
    searchInput.dispatchEvent(e);
  }

  if (fileScan) {
    fileScan.addEventListener('change', async () => {
      const f = fileScan.files && fileScan.files[0];
      if (!f) return;
      const m = (f.name || '').match(/\d{8,}/);
      if (m) {
        if (searchInput) {
          searchInput.value = m[0];
          const e = new KeyboardEvent('keydown', { key: 'Enter' });
          searchInput.dispatchEvent(e);
        }
      } else {
        Swal.fire(
          'Atención',
          'No se pudo leer el código desde la imagen. Prueba con la cámara o la pistola.',
          'info'
        );
      }
    });
  }

  if (btnScan) {
    btnScan.addEventListener('click', startScanner);
  }
  if (btnScanStop) {
    btnScanStop.addEventListener('click', stopScanner);
  }

  function addRowAndFocus({ barcode, nombre, codInvent, bodega, fechaVenc }) {
    addRow({ barcode, nombre, codInvent, bodega, fechaVenc });
    const firstRow = body.firstElementChild;
    if (firstRow) {
      const venc = firstRow.querySelector('.vencimiento');
      const qty  = firstRow.querySelector('.qty');
      if (qty) qty.focus();
      else if (venc) venc.focus();
    }
  }

  // Busca si el producto ya existe en la tabla (por código de inventario y/o código de barras)
  function findExistingRow(barcode, codInvent) {
    const barcodeTrim = (barcode || '').toString().trim();
    const codInvTrim  = (codInvent || '').toString().trim();
    const rows = [...body.getElementsByTagName('tr')];
    for (const tr of rows) {
      const rowBarcode = tr.cells[1]?.innerText.trim() || '';
      const rowCodInv  = tr.cells[3]?.innerText.trim() || '';
      const sameBarcode = barcodeTrim && rowBarcode && rowBarcode === barcodeTrim;
      const sameCodInv  = codInvTrim && rowCodInv && rowCodInv === codInvTrim;
      if ((sameBarcode && sameCodInv) || sameBarcode || sameCodInv) {
        return tr;
      }
    }
    return null;
  }

  function addRow({ barcode, nombre, codInvent, bodega = '', fechaVenc = '', cantidad = '', skipDuplicateCheck = false }) {
    // Control de duplicados: pregunta si desea sumar cantidades o cancelar
    if (!skipDuplicateCheck) {
      const existing = findExistingRow(barcode, codInvent);
      if (existing) {
        Swal.fire({
          title: 'Producto ya agregado',
          text: 'Este producto ya existe en la tabla. ¿Desea sumar la cantidad a la existente o cancelar?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonText: 'Sumar cantidades',
          cancelButtonText: 'Cancelar'
        }).then(res => {
          if (res.isConfirmed) {
            const qtyInput = existing.querySelector('.qty');
            const currentQty = parseNum(qtyInput && qtyInput.value);
            const addQty = parseNum(cantidad);
            if (addQty > 0 && qtyInput) {
              qtyInput.value = currentQty + addQty;
              recalcTotals();
            }
            // En cualquier caso, enfocar y resaltar la fila existente
            if (qtyInput) qtyInput.focus();
            existing.classList.add('table-warning');
            setTimeout(() => existing.classList.remove('table-warning'), 800);
          }
        });
        return;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = '' +
      '<td></td>' +
      '<td>' + (barcode || '') + '</td>' +
      '<td>' + (nombre || '') + '</td>' +
      '<td>' + (codInvent || 'N/A') + '</td>' +
      '<td>' + (bodega || '') + '</td>' +
      '<td><input type="number" class="form-control form-control-sm qty" min="0" step="1" value="' + (cantidad || '') + '"></td>' +
      '<td><input type="date" class="form-control form-control-sm vencimiento" value="' + (fechaVenc || '') + '"></td>' +
      '<td><button class="btn btn-outline-danger btn-sm" title="Eliminar fila"><i class="fas fa-trash"></i></button></td>';
    body.insertBefore(tr, body.firstChild);
    renumber();
    suggestions.innerHTML = '';
    if (searchInput) searchInput.value = '';

    const venc   = tr.querySelector('.vencimiento');
    const qty    = tr.querySelector('.qty');
    const delBtn = tr.querySelector('button');

    if (venc) {
      venc.addEventListener('focus', () => {
        try {
          if (venc.showPicker) venc.showPicker();
        } catch (e) {}
      });
      venc.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (searchInput) searchInput.focus();
        }
      });
    }

    if (qty) {
      qty.addEventListener('input', recalcTotals);
      qty.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (venc) venc.focus();
        }
      });
    }

    delBtn.addEventListener('click', () => {
      Swal.fire({
        title: '¿Eliminar ítem?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar'
      }).then(res => {
        if (res.isConfirmed) {
          tr.remove();
          renumber();
          recalcTotals();
          updateButtons();
        }
      });
    });

    recalcTotals();
    updateButtons();
  }

  function renumber() {
    [...body.getElementsByTagName('tr')].forEach((row, idx) => {
      row.cells[0].textContent = (body.rows.length - idx);
    });
  }

  function parseNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function recalcTotals() {
    let lineas    = 0;
    let tCantidad = 0;

    [...body.getElementsByTagName('tr')].forEach(tr => {
      const qty = parseNum(tr.querySelector('.qty') && tr.querySelector('.qty').value);
      if (qty > 0) {
        lineas++;
        tCantidad += qty;
      }
    });

    $('tLineas').textContent   = lineas;
    $('tCantidad').textContent = tCantidad;

    updateButtons();
  }

  function updateButtons() {
    const hasRows = body.rows.length > 0;
    btnPDF.disabled   = !hasRows;
    btnPrint.disabled = !hasRows;
    btnExcel.disabled = !hasRows;
    btnClear.disabled = !hasRows && !(proveedorInput.value.trim() || (ubicacionInput && ubicacionInput.value.trim()));
  }

  btnSave.addEventListener('click', () => {
    if (!ubicacionInput || !ubicacionInput.value.trim()) {
      Swal.fire('Ubicación requerida', 'Ingrese la ubicación del producto.', 'info');
      return;
    }
    if (body.rows.length === 0) {
      Swal.fire('Sin ítems', 'Agregue al menos un producto.', 'error');
      return;
    }

    const items = [...body.getElementsByTagName('tr')].map(tr => {
      const qty       = parseNum(tr.querySelector('.qty').value);
      const fechaVenc = (tr.querySelector('.vencimiento')?.value || '').trim();
      return {
        codigo_barras:     tr.cells[1].innerText.trim(),
        nombre:            tr.cells[2].innerText.trim(),
        codigo_inventario: tr.cells[3].innerText.trim(),
        bodega:            tr.cells[4].innerText.trim(),
        fecha_vencimiento: fechaVenc,
        cantidad:          qty
      };
    });

    const payload = {
      meta: {
        tienda: 'AVENIDA MORAZÁN',
        proveedor: proveedorInput.value.trim(),
        ubicacion: ubicacionInput.value.trim(),
        hoja_inventario: CURRENT_INVENTARIO,
        fechaInventario: new Date().toISOString()
      },
      items,
      totales: {
        lineas:         Number($('tLineas').textContent),
        cantidad_total: Number($('tCantidad').textContent)
      }
    };

    saveReceptionToJSONBin(getCurrentBinId(), payload)
      .then(() => {
        const msgEl = $('successMessage');
        if (msgEl) {
          msgEl.textContent = 'Inventario guardado correctamente.';
          msgEl.style.display = 'block';
          setTimeout(() => msgEl.style.display = 'none', 4000);
        }
        Swal.fire('Guardado', 'El inventario ha sido guardado.', 'success');
      })
      .catch(e => Swal.fire('Error', String(e), 'error'));
  });

  await (async function loadAndRenderFromCurrentBin() {
    try {
      const record = await loadReceptionFromJSONBin(getCurrentBinId());
      if (record && record.items && Array.isArray(record.items)) {
        if (record.meta && record.meta.proveedor) {
          proveedorInput.value = record.meta.proveedor;
        }
        if (record.meta && (record.meta.ubicacion || record.meta.numero_credito_fiscal)) {
          if (ubicacionInput) {
            ubicacionInput.value = record.meta.ubicacion || record.meta.numero_credito_fiscal;
          }
        }
        record.items.forEach(it => {
          addRow({
            barcode:   it.codigo_barras || '',
            nombre:    it.nombre || '',
            codInvent: it.codigo_inventario || 'N/A',
            bodega:    it.bodega || '',
            fechaVenc: it.fecha_vencimiento || '',
            cantidad:  (it.cantidad !== undefined && it.cantidad !== null) ? Number(it.cantidad) : '',
            skipDuplicateCheck: true
          });
        });
        recalcTotals();
      }
    } catch (e) {
      console.error('Error al cargar estado previo:', e);
    }
  })();

  inventarioSelect.addEventListener('change', async () => {
    CURRENT_INVENTARIO = inventarioSelect.value;
    localStorage.setItem('TR_AVM_CURRENT_INVENTARIO', CURRENT_INVENTARIO);

    body.innerHTML = '';
    proveedorInput.value = '';
    if (ubicacionInput) ubicacionInput.value = '';
    recalcTotals();
    updateButtons();

    try {
      const record = await loadReceptionFromJSONBin(getCurrentBinId());
      if (record && record.items && Array.isArray(record.items)) {
        if (record.meta && record.meta.proveedor) {
          proveedorInput.value = record.meta.proveedor;
        }
        if (record.meta && (record.meta.ubicacion || record.meta.numero_credito_fiscal)) {
          if (ubicacionInput) {
            ubicacionInput.value = record.meta.ubicacion || record.meta.numero_credito_fiscal;
          }
        }
        record.items.forEach(it => {
          addRow({
            barcode:   it.codigo_barras || '',
            nombre:    it.nombre || '',
            codInvent: it.codigo_inventario || 'N/A',
            bodega:    it.bodega || '',
            fechaVenc: it.fecha_vencimiento || '',
            cantidad:  (it.cantidad !== undefined && it.cantidad !== null) ? Number(it.cantidad) : '',
            skipDuplicateCheck: true
          });
        });
        recalcTotals();
      }
    } catch (e) {
      console.error('Error al cargar estado de la hoja de inventario:', e);
    }
  });

  btnPDF.addEventListener('click', () => exportPDF(false));
  btnPrint.addEventListener('click', () => exportPDF(true));

  function exportPDF(openWindow) {
    if (body.rows.length === 0) return;
    const jsPDF = window.jspdf.jsPDF;
    const doc   = new jsPDF();
    const fecha = new Date().toISOString().split('T')[0];

    doc.setFontSize(12);
    doc.text('Tienda: AVENIDA MORAZÁN', 10, 10);
    doc.text('Ubicación: ' + (ubicacionInput ? (ubicacionInput.value || '-') : '-'), 10, 18);
    if (proveedorInput.value.trim()) {
      doc.text('Proveedor: ' + proveedorInput.value, 10, 26);
    }
    if (inventarioSelect) {
      doc.text('Hoja de inventario: ' + inventarioSelect.value, 10, 34);
    } else {
      doc.text('Fecha: ' + fecha, 10, 34);
    }

    const rows = [...body.getElementsByTagName('tr')].map((tr, i) => {
      const bodega = tr.cells[4].innerText;
      const qty    = tr.querySelector('.qty').value;
      const fechaV = (tr.querySelector('.vencimiento')?.value || '');
      return [
        i + 1,
        tr.cells[1].innerText,
        tr.cells[2].innerText,
        tr.cells[3].innerText,
        bodega,
        qty,
        fechaV
      ];
    });

    doc.autoTable({
      startY: 40,
      head: [['#','Código barras','Producto','Cod. Inv.','Bodega','Cant.','F. vencimiento']],
      body: rows,
      styles: { fontSize: 9, cellPadding: 2 }
    });

    const y = doc.lastAutoTable.finalY + 6;
    doc.text(
      'Líneas: ' + $('tLineas').textContent + '  |  Cantidad total: ' + $('tCantidad').textContent,
      10,
      y
    );

    const name = 'INVENTARIO_AVM_' + sanitizeName(ubicacionInput ? (ubicacionInput.value || '') : '') + '_' + (inventarioSelect ? inventarioSelect.value : '') + '_' + fecha + '.pdf';
    if (openWindow) {
      doc.output('dataurlnewwindow');
    } else {
      doc.save(name);
    }
  }

  // Nuevo exportador Excel con formato requerido
  btnExcel.addEventListener('click', () => {
    if (body.rows.length === 0) return;

    // Fecha física del inventario en formato 2025-12-10
    const fechaFis = new Date().toISOString().split('T')[0];
    const ubicacionValor = ubicacionInput ? (ubicacionInput.value || '') : '';

    // Encabezados en el orden solicitado
    const data = [[
      'fechafis',
      'idgrupo',
      'idsubgrupo',
      'idarticulo',
      'descrip',
      'codigobarra',
      'cod_unidad',
      'ubicacion',
      'Bodega_5'
    ]];

    const catalogo = (window.CATALOGO_CACHE || []);

    [...body.getElementsByTagName('tr')].forEach(tr => {
      const nombreUI       = tr.cells[2].innerText.trim(); // descrip en UI
      const codInventUI    = tr.cells[3].innerText.trim(); // idarticulo (B)
      const codigoBarrasUI = tr.cells[1].innerText.trim(); // codigobarra (D)
      const qty            = parseNum(tr.querySelector('.qty').value);

      // Buscar fila en catálogo para idgrupo (E) e idsubgrupo (F)
      let match = null;
      if (catalogo && catalogo.length) {
        match = catalogo.find(r => {
          const idartCatalogo = (r[1] || '').toString().trim(); // B
          const codBarCatalog = (r[3] || '').toString().trim(); // D
          const sameCodInv    = codInventUI && idartCatalogo && idartCatalogo === codInventUI;
          const sameBar       = codigoBarrasUI && codBarCatalog && codBarCatalog === codigoBarrasUI;
          if (sameCodInv && sameBar) return true;
          if (sameBar) return true;
          if (sameCodInv) return true;
          return false;
        }) || null;
      }

      const descrip   = match ? ((match[0] || '').toString().trim() || nombreUI)          : nombreUI;       // A
      const idart     = match ? ((match[1] || '').toString().trim() || codInventUI)      : codInventUI;    // B
      const codBar    = match ? ((match[3] || '').toString().trim() || codigoBarrasUI)   : codigoBarrasUI; // D
      const idgrupo   = match ? ((match[4] || '').toString().trim())                     : '';             // E
      const idsubgr   = match ? ((match[5] || '').toString().trim())                     : '';             // F
      const codUnidad = 6; // fijo

      data.push([
        fechaFis,        // fechafis
        idgrupo,         // idgrupo
        idsubgr,         // idsubgrupo
        idart,           // idarticulo
        descrip,         // descrip
        codBar,          // codigobarra
        codUnidad,       // cod_unidad
        ubicacionValor,  // ubicacion
        qty              // Bodega_5
      ]);
    });

    const wb    = XLSX.utils.book_new();
    const ws    = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    const fechaArchivo = new Date().toISOString().split('T')[0];
    const nombreArchivo =
      'INVENTARIO_AVM_' +
      sanitizeName(ubicacionValor) + '_' +
      (inventarioSelect ? inventarioSelect.value : '') + '_' +
      fechaArchivo + '.xlsx';

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob  = new Blob([wbout], { type: 'application/octet-stream' });
    const a     = document.createElement('a');
    a.href      = URL.createObjectURL(blob);
    a.download  = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  btnClear.addEventListener('click', () => {
    if (body.rows.length === 0 && !(proveedorInput.value.trim() || (ubicacionInput && ubicacionInput.value.trim()))) return;
    Swal.fire({
      title: '¿Vaciar y comenzar nuevo inventario?',
      text: 'Esto guardará el estado vacío en esta hoja.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar y guardar'
    }).then(res => {
      if (res.isConfirmed) {
        body.innerHTML = '';
        proveedorInput.value = '';
        if (ubicacionInput) ubicacionInput.value = '';
        recalcTotals();
        updateButtons();

        const payload = {
          meta: {
            tienda: 'AVENIDA MORAZÁN',
            proveedor: '',
            ubicacion: '',
            hoja_inventario: CURRENT_INVENTARIO,
            fechaInventario: new Date().toISOString()
          },
          items: [],
          totales: {
            lineas: 0,
            cantidad_total: 0
          }
        };

        saveReceptionToJSONBin(getCurrentBinId(), payload)
          .then(() => {
            const msgEl = $('successMessage');
            if (msgEl) {
              msgEl.textContent = 'Inventario limpiado y guardado. Lista para empezar una nueva hoja.';
              msgEl.style.display = 'block';
              setTimeout(() => msgEl.style.display = 'none', 4000);
            }
            Swal.fire('Listo', 'Se limpió y guardó el estado vacío.', 'success');
          })
          .catch(e => Swal.fire('Error', String(e), 'error'));
      }
    });
  });

  if (searchInput) searchInput.focus();
});
