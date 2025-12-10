document.addEventListener('DOMContentLoaded', async () => {
  const $ = (id) => document.getElementById(id);

  const body             = $('inventarioBody');
  const inventarioSelect = $('inventarioSelect');
  const fechaInvEl       = $('fechaInventario');
  const ubicacionInput   = $('ubicacionInput');

  const btnSave   = $('saveInventario');
  const btnExcel  = $('exportExcel');
  const btnClear  = $('clearInventario');

  // Modal manual
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

  // Selector actual de inventario
  let CURRENT_INV = localStorage.getItem('TR_AVM_CURRENT_INVENTARIO') || 'INV1';

  const INVENTARIO_BINS = {
    INV1:  '692091aa43b1c97be9bc18dd',
    INV2:  '692091efd0ea881f40f71767',
    INV3:  '69209205ae596e708f67d3f6',
    INV4:  '6920921ed0ea881f40f717a1',
    INV5:  '69209234ae596e708f67d43d',
    INV6:  '6920924f43b1c97be9bc19f8',
    INV7:  '6920927143b1c97be9bc1a36',
    INV8:  '692092d9ae596e708f67d551',
    INV9:  '6920930243b1c97be9bc1b38',
    INV10: '69209315ae596e708f67d5da'
  };

  function getCurrentBinId() {
    return INVENTARIO_BINS[CURRENT_INV];
  }

  function updateFechaInvLabel() {
    const now = new Date();
    const fmt = now.toLocaleString('es-SV', { timeZone: 'America/El_Salvador' });
    if (fechaInvEl) {
      fechaInvEl.textContent = 'Fecha de inventario: ' + fmt;
    }
  }

  updateFechaInvLabel();

  if (inventarioSelect) {
    inventarioSelect.value = CURRENT_INV;
  }

  const searchInput   = $('searchInput');
  const suggestionsEl = $('suggestions');
  const btnOpenManual = $('btnOpenManual');

  // Utilidades numéricas
  function parseNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function renumber() {
    [...body.getElementsByTagName('tr')].forEach((row, idx) => {
      row.cells[0].textContent = (idx + 1);
    });
  }

  function recalcTotals() {
    let lineas = 0;
    let total  = 0;

    [...body.getElementsByTagName('tr')].forEach(tr => {
      const qty = parseNum(tr.querySelector('.qty')?.value);
      if (qty > 0) {
        lineas++;
        total += qty;
      }
    });

    $('tLineas').textContent   = lineas;
    $('tCantidad').textContent = total;

    updateButtons();
  }

  function updateButtons() {
    const hasRows = body.rows.length > 0;
    btnExcel.disabled = !hasRows;
    btnClear.disabled = !hasRows && !(ubicacionInput.value.trim());
  }

  // --- Abrir modal manual desde buscador ---
  function openManualModalFromSearch(rawQuery) {
    const q = (rawQuery || '').trim();
    mCodigo.value      = '';
    mNombre.value      = '';
    mCodInv.value      = '';
    mBodega.value      = '';
    mVencimiento.value = '';
    mCantidad.value    = '';

    if (q) {
      if (/^\d+$/.test(q)) mCodigo.value = q;
      else mNombre.value = q;
    }
    manualModal.show();
    setTimeout(() => mCodigo.focus(), 200);
  }

  btnOpenManual.addEventListener('click', () => {
    const raw = (searchInput.value || '').replace(/\r|\n/g, '').trim();
    openManualModalFromSearch(raw);
  });

  // Alta manual
  $('btnAddManual').addEventListener('click', () => {
    const codigo    = (mCodigo.value || '').trim();
    const nombre    = (mNombre.value || '').trim();
    const codInv    = (mCodInv.value || '').trim();
    const bodega    = (mBodega.value || '').trim();
    const fechaVenc = (mVencimiento.value || '').trim();
    const qty       = parseNum(mCantidad.value);

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

  // --- Autocomplete productos (catálogo) ---
  await preloadCatalog().catch(() => {});

  let currentFocus = -1;

  searchInput.addEventListener('input', () => {
    const raw = (searchInput.value || '').replace(/\r|\n/g, '').trim();
    const q   = raw.toLowerCase();
    suggestionsEl.innerHTML = '';
    currentFocus = -1;
    if (!q) return;

    loadProductsFromGoogleSheets().then(rows => {
      const filtered = (rows || []).filter(r => {
        const nombre    = (r[0] || '').toString().toLowerCase(); // A
        const codInvent = (r[1] || '').toString().toLowerCase(); // B
        const barcode   = (r[3] || '').toString().toLowerCase(); // D
        return nombre.includes(q) || codInvent.includes(q) || barcode.includes(q);
      });

      if (!filtered.length) {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-light no-results';
        li.innerHTML = '<strong>Sin resultados</strong>. Usa el botón + para agregar producto manual.';
        suggestionsEl.appendChild(li);
        return;
      }

      filtered.slice(0, 50).forEach(prod => {
        const nombre    = prod[0] || '';
        const codInvent = prod[1] || 'N/A';
        const bodega    = prod[2] || '';
        const barcode   = prod[3] || 'sin código';
        const li        = document.createElement('li');
        li.className    = 'list-group-item';
        li.textContent  = `${nombre} (${barcode}) [${codInvent}] — ${bodega}`;
        li.addEventListener('click', () => addRowAndFocus({ barcode, nombre, codInvent, bodega }));
        suggestionsEl.appendChild(li);
      });
    }).catch(() => {});
  });

  function addActive(items) {
    if (!items || !items.length) return;
    [...items].forEach(x => x.classList.remove('active'));
    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;
    items[currentFocus].classList.add('active');
    items[currentFocus].scrollIntoView({ block: 'nearest' });
  }

  searchInput.addEventListener('keydown', (e) => {
    const items = suggestionsEl.getElementsByTagName('li');
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
        return;
      }

      const raw = (searchInput.value || '').replace(/\r|\n/g, '').trim();
      if (!raw) return;

      const rows = (window.CATALOGO_CACHE || []);
      let match  = null;
      for (const r of rows) {
        const codInv  = r[1] ? String(r[1]).trim() : '';
        const barcode = r[3] ? String(r[3]).trim() : '';
        if (codInv === raw || barcode === raw) {
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

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target === searchInput || suggestionsEl.contains(target)) return;
    suggestionsEl.innerHTML = '';
    currentFocus = -1;
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestionsEl.innerHTML = '';
      currentFocus = -1;
    }
  });

  function addRowAndFocus({ barcode, nombre, codInvent, bodega, fechaVenc }) {
    addRow({ barcode, nombre, codInvent, bodega, fechaVenc });
    const firstRow = body.firstElementChild;
    if (firstRow) {
      const venc = firstRow.querySelector('.vencimiento');
      const qty  = firstRow.querySelector('.qty');
      if (venc) venc.focus();
      else if (qty) qty.focus();
    }
  }

  function addRow({ barcode, nombre, codInvent, bodega = '', fechaVenc = '', cantidad = '' }) {
    const tr = document.createElement('tr');
    tr.innerHTML = '' +
      '<td></td>' +
      '<td>' + (barcode || '') + '</td>' +
      '<td>' + (nombre || '') + '</td>' +
      '<td>' + (codInvent || 'N/A') + '</td>' +
      '<td>' + (bodega || '') + '</td>' +
      '<td><input type="date" class="form-control form-control-sm vencimiento" value="' + (fechaVenc || '') + '"></td>' +
      '<td><input type="number" class="form-control form-control-sm qty" min="0" step="1" value="' + (cantidad || '') + '"></td>' +
      '<td><button class="btn btn-outline-danger btn-sm" title="Eliminar fila"><i class="fas fa-trash"></i></button></td>';

    body.insertBefore(tr, body.firstChild);
    renumber();
    suggestionsEl.innerHTML = '';
    searchInput.value = '';

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
          if (qty) qty.focus();
        }
      });
    }

    qty.addEventListener('input', recalcTotals);
    qty.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        searchInput.focus();
      }
    });

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

  // --- Guardar inventario en JSONBin ---
  btnSave.addEventListener('click', () => {
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
        ubicacion: (ubicacionInput.value || '').trim(),
        fechaInventario: new Date().toISOString()
      },
      items,
      totales: {
        lineas:         Number(document.getElementById('tLineas').textContent),
        cantidad_total: Number(document.getElementById('tCantidad').textContent)
      }
    };

    saveInventarioToJSONBin(getCurrentBinId(), payload)
      .then(() => {
        const msgEl = document.getElementById('successMessage');
        if (msgEl) {
          msgEl.textContent = 'Inventario guardado correctamente.';
          msgEl.style.display = 'block';
          setTimeout(() => msgEl.style.display = 'none', 4000);
        }
        Swal.fire('Guardado', 'El inventario ha sido guardado.', 'success');
      })
      .catch(e => Swal.fire('Error', String(e), 'error'));
  });

  // --- Cargar estado previo del BIN actual ---
  async function loadAndRenderFromCurrentBin() {
    body.innerHTML = '';
    ubicacionInput.value = '';
    document.getElementById('tLineas').textContent = '0';
    document.getElementById('tCantidad').textContent = '0';
    updateButtons();

    try {
      const record = await loadInventarioFromJSONBin(getCurrentBinId());
      if (record && record.items && Array.isArray(record.items)) {
        if (record.meta && record.meta.ubicacion) {
          ubicacionInput.value = record.meta.ubicacion;
        }
        record.items.forEach(it => {
          addRow({
            barcode:   it.codigo_barras || '',
            nombre:    it.nombre || '',
            codInvent: it.codigo_inventario || 'N/A',
            bodega:    it.bodega || '',
            fechaVenc: it.fecha_vencimiento || '',
            cantidad:  (it.cantidad !== undefined && it.cantidad !== null) ? Number(it.cantidad) : ''
          });
        });
        recalcTotals();
      }
    } catch (e) {
      console.error('Error al cargar estado previo:', e);
    }
  }

  await loadAndRenderFromCurrentBin();

  // --- Cambio de inventario ---
  inventarioSelect.addEventListener('change', async () => {
    CURRENT_INV = inventarioSelect.value;
    localStorage.setItem('TR_AVM_CURRENT_INVENTARIO', CURRENT_INV);
    await loadAndRenderFromCurrentBin();
  });

  // --- Exportar a Excel con formato solicitado ---
  btnExcel.addEventListener('click', () => {
    if (body.rows.length === 0) return;

    // fechafis = fecha física del inventario (hoy) en formato YYYY-MM-DD
    const fechaFis = new Date().toISOString().split('T')[0];

    // Estructura solicitada
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

    [...body.getElementsByTagName('tr')].forEach((tr) => {
      const codigoBarras = tr.cells[1].innerText.trim(); // D
      const descrip      = tr.cells[2].innerText.trim(); // A
      const idarticulo   = tr.cells[3].innerText.trim(); // B

      let idgrupo    = '';
      let idsubgrupo = '';

      // Buscar fila en el catálogo por código inventario o código de barras
      if (Array.isArray(catalogo) && catalogo.length) {
        const match = catalogo.find((r) => {
          const rIdArt    = (r[1] ?? '').toString().trim(); // B
          const rCodBarra = (r[3] ?? '').toString().trim(); // D
          return (idarticulo && rIdArt === idarticulo) ||
                 (!idarticulo && codigoBarras && rCodBarra === codigoBarras);
        });

        if (match) {
          idgrupo    = (match[4] ?? '').toString().trim(); // E
          idsubgrupo = (match[5] ?? '').toString().trim(); // F
        }
      }

      const cod_unidad = 6;      // fijo
      const ubicacion  = '';     // por defecto sin valor
      const cantidad   = parseNum(tr.querySelector('.qty').value); // Bodega_5

      data.push([
        fechaFis,     // fechafis
        idgrupo,      // idgrupo
        idsubgrupo,   // idsubgrupo
        idarticulo,   // idarticulo (columna B bd)
        descrip,      // descrip (columna A bd)
        codigoBarras, // codigobarra (columna D bd)
        cod_unidad,   // cod_unidad
        ubicacion,    // ubicacion
        cantidad      // Bodega_5
      ]);
    });

    const wb   = XLSX.utils.book_new();
    const ws   = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob  = new Blob([wbout], { type: 'application/octet-stream' });
    const a     = document.createElement('a');

    a.href     = URL.createObjectURL(blob);
    a.download = `INVENTARIO_AVM_${fechaFis}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // --- Limpiar inventario y guardar vacío ---
  btnClear.addEventListener('click', () => {
    if (body.rows.length === 0 && !(ubicacionInput.value.trim())) return;
    Swal.fire({
      title: '¿Vaciar y comenzar nuevo inventario?',
      text: 'Esto guardará el estado vacío en esta hoja de inventario.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar y guardar'
    }).then(res => {
      if (res.isConfirmed) {
        body.innerHTML = '';
        ubicacionInput.value = '';
        recalcTotals();
        updateButtons();

        const payload = {
          meta: {
            tienda: 'AVENIDA MORAZÁN',
            ubicacion: '',
            fechaInventario: new Date().toISOString()
          },
          items: [],
          totales: {
            lineas: 0,
            cantidad_total: 0
          }
        };

        saveInventarioToJSONBin(getCurrentBinId(), payload)
          .then(() => {
            const msgEl = document.getElementById('successMessage');
            if (msgEl) {
              msgEl.textContent = 'Inventario limpiado y guardado. Lista la hoja para un nuevo conteo.';
              msgEl.style.display = 'block';
              setTimeout(() => msgEl.style.display = 'none', 4000);
            }
            Swal.fire('Listo', 'Se limpió y guardó el estado vacío.', 'success');
          })
          .catch(e => Swal.fire('Error', String(e), 'error'));
      }
    });
  });

  // Enfocar buscador al inicio
  searchInput && searchInput.focus();
});
