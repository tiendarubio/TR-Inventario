// api/jsonbin-save.js — Guardar datos en JSONBin usando la API key del servidor
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' });
  }

  try {
    const { binId, payload } = req.body || {};
    if (!binId) {
      return res.status(400).json({ error: 'Falta binId en el body.' });
    }

    const apiKey = process.env.JSONBIN_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Falta JSONBIN_API_KEY en variables de entorno.' });
    }

    const url = `https://api.jsonbin.io/v3/b/${encodeURIComponent(binId)}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Key': apiKey
      },
      body: JSON.stringify(payload || {})
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: 'Error al guardar en JSONBin', details: text });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno en /api/jsonbin-save' });
  }
}
