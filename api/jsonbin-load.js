// api/jsonbin-load.js — Cargar datos de JSONBin usando la API key del servidor
export default async function handler(req, res) {
  try {
    const { binId } = req.query;
    if (!binId) {
      return res.status(400).json({ error: 'Falta parámetro binId' });
    }

    const apiKey = process.env.JSONBIN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta JSONBIN_API_KEY en variables de entorno.' });
    }

    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}/latest`;
    const response = await fetch(url, {
      headers: { 'X-Access-Key': apiKey }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Error al consultar JSONBin', details: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno en /api/jsonbin-load' });
  }
}
