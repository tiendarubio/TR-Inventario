// api/dependientes.js — Proxy a Google Sheets para lista de dependientes (dependientax!A:A)
export default async function handler(req, res) {
  try {
    const apiKey  = process.env.GOOGLE_SHEETS_API_KEY;
    const sheetId = process.env.GOOGLE_SHEETS_SHEET_ID || '1b5B9vp0GKc4T_mORssdj-J2vgc-xEO5YAFkcrVX-nHI';
    const range   = process.env.GOOGLE_SHEETS_DEP_RANGE || 'dependientax!A2:A2000';

    if (!apiKey) {
      return res.status(500).json({ error: 'Falta GOOGLE_SHEETS_API_KEY en variables de entorno.' });
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Error al consultar Google Sheets (dependientes)', details: text });
    }

    const data = await response.json();
    const dependientes = Array.isArray(data.values)
      ? data.values.flat().filter(Boolean)
      : [];

    // únicos
    const uniq = Array.from(new Set(dependientes.map(x => String(x).trim()).filter(Boolean)));

    return res.status(200).json({ dependientes: uniq });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno en /api/dependientes' });
  }
}
