// api/catalogo.js — Proxy a Google Sheets para el catálogo de productos
export default async function handler(req, res) {
  try {
    const apiKey  = process.env.GOOGLE_SHEETS_API_KEY;
    const sheetId = process.env.GOOGLE_SHEETS_SHEET_ID || '1b5B9vp0GKc4T_mORssdj-J2vgc-xEO5YAFkcrVX-nHI';
    const range   = process.env.GOOGLE_SHEETS_RANGE || 'bd!A2:F5000';

    if (!apiKey) {
      return res.status(500).json({ error: 'Falta GOOGLE_SHEETS_API_KEY en variables de entorno.' });
    }

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Error al consultar Google Sheets', details: text });
    }

    const data = await response.json();
    return res.status(200).json({ values: data.values || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno en /api/catalogo' });
  }
}
