// api/estantes.js — Proxy a Google Sheets para estantes y ubicaciones
export default async function handler(req, res) {
  try {
    const apiKey  = process.env.GOOGLE_SHEETS_API_KEY;
    const sheetId = process.env.GOOGLE_SHEETS_SHEET_ID || '1b5B9vp0GKc4T_mORssdj-J2vgc-xEO5YAFkcrVX-nHI';
    const range   = process.env.GOOGLE_SHEETS_ESTANTES_RANGE || 'estantes!A2:D2000';

    if (!apiKey) {
      return res.status(500).json({ error: 'Falta GOOGLE_SHEETS_API_KEY en variables de entorno.' });
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Error al consultar Google Sheets (estantes)', details: text });
    }

    const data = await response.json();
    const values = Array.isArray(data.values) ? data.values : [];

    const avm = [];
    const sexta = [];
    const centro = [];
    const ubic = [];

    for (const row of values) {
      const a = row && row[0] ? String(row[0]).trim() : '';
      const b = row && row[1] ? String(row[1]).trim() : '';
      const c = row && row[2] ? String(row[2]).trim() : '';
      const d = row && row[3] ? String(row[3]).trim() : '';

      if (a) avm.push(a);
      if (b) sexta.push(b);
      if (c) centro.push(c);
      if (d) ubic.push(d);
    }

    // únicos
    const uniq = (arr) => Array.from(new Set((arr || []).filter(Boolean)));

    return res.status(200).json({
      estantes: {
        avenida_morazan: uniq(avm),
        sexta_calle: uniq(sexta),
        centro_comercial: uniq(centro)
      },
      ubicaciones: uniq(ubic)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno en /api/estantes' });
  }
}
