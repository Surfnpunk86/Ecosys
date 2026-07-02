const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Proxy seguro: el frontend llama aquí, este servidor llama a Anthropic
// usando la API key guardada como variable de entorno (nunca expuesta al navegador).
app.post('/api/chat', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada en el servidor.' });
    }

    const { prompt, system } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Falta el campo "prompt".' });
    }

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: system || 'Eres un asistente experto para coaches profesionales. Responde en español, de forma directa, práctica y aplicable. Sé conciso pero poderoso.',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', response.status, errText);
      return res.status(502).json({ error: 'Error al consultar el modelo.' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'No se pudo obtener respuesta.';
    res.json({ reply });
  } catch (err) {
    console.error('Error en /api/chat:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// Cualquier otra ruta devuelve el index.html (SPA simple)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ECOSYS Platform corriendo en el puerto ${PORT}`);
});
