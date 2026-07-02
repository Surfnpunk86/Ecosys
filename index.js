require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const fetch      = require('node-fetch');
const path       = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════
// SEGURIDAD — CABECERAS HTTP
// ══════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "fonts.gstatic.com"],
      fontSrc:     ["'self'", "fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:"],
      connectSrc:  ["'self'"],   // el frontend SOLO habla con este servidor
    }
  }
}));

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true }));

// ══════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutos
  max: 10,                    // 10 intentos máximo
  message: { error: 'Demasiados intentos. Espera 15 minutos.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minuto
  max: 20,                    // 20 llamadas IA por minuto
  message: { error: 'Límite de IA alcanzado. Espera un momento.' }
});

// ══════════════════════════════════════════
// USUARIOS (en memoria — simple y seguro para 1-5 coaches)
// Para escala: reemplazar con Supabase o PostgreSQL
// ══════════════════════════════════════════
const USERS = [
  {
    id: 1,
    name: process.env.ADMIN_NAME || 'Renzo Gallo',
    email: process.env.ADMIN_EMAIL || 'renzo@ecosys.app',
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    role: 'admin',
    plan: 'Ecosys Pro'
  }
];

// Agregar usuarios adicionales desde env si existen
if (process.env.USER2_EMAIL && process.env.USER2_PASSWORD_HASH) {
  USERS.push({
    id: 2,
    name: process.env.USER2_NAME || 'Coach 2',
    email: process.env.USER2_EMAIL,
    passwordHash: process.env.USER2_PASSWORD_HASH,
    role: 'coach',
    plan: 'Ecosys Starter'
  });
}

// ══════════════════════════════════════════
// MIDDLEWARE — VERIFICAR JWT
// ══════════════════════════════════════════
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// ══════════════════════════════════════════
// RUTAS PÚBLICAS
// ══════════════════════════════════════════

// Health check para Render
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── LOGIN ──
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, plan: user.plan }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── VERIFICAR TOKEN (para reload de página) ──
app.get('/api/auth/verify', requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ══════════════════════════════════════════
// RUTAS PROTEGIDAS — IA
// ══════════════════════════════════════════

// ── PROXY SEGURO A ANTHROPIC ──
app.post('/api/ai/chat', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { messages, system } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Formato de mensajes inválido' });
    }

    // Limitar contexto a los últimos 20 mensajes para control de costo
    const trimmedMessages = messages.slice(-20);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        system:     system || 'Eres un asistente experto para coaches profesionales. Responde en español, directo y práctico.',
        messages:   trimmedMessages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', response.status, errText);
      return res.status(502).json({ error: 'Error al comunicarse con la IA' });
    }

    const data = await response.json();
    res.json({ content: data.content?.[0]?.text || '' });

  } catch (err) {
    console.error('AI proxy error:', err);
    res.status(500).json({ error: 'Error interno del servidor de IA' });
  }
});

// ── GENERADOR DE CONTENIDO ──
app.post('/api/ai/content', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { type, topic } = req.body;
    if (!type || !topic) return res.status(400).json({ error: 'Tipo y tema requeridos' });

    const prompt = `Crea un ${type} sobre el tema: "${topic}". Para un coach auténtico que no vende promesas vacías. Estilo directo, poderoso, sin florituras motivacionales baratas.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    res.json({ content: data.content?.[0]?.text || '' });

  } catch (err) {
    console.error('Content gen error:', err);
    res.status(500).json({ error: 'Error generando contenido' });
  }
});

// ── PROCESADOR DE NOTAS DE SESIÓN ──
app.post('/api/ai/session-notes', requireAuth, aiLimiter, async (req, res) => {
  try {
    const { notes } = req.body;
    if (!notes) return res.status(400).json({ error: 'Notas requeridas' });

    const prompt = `Procesa estas notas de sesión de coaching y entrega:
1) Resumen ejecutivo (3-4 líneas)
2) Compromisos del cliente (lista)
3) Próximos pasos (lista con fechas si las hay)
4) Preguntas para la próxima sesión (3-4 preguntas poderosas)

Notas: ${notes}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1024,
        messages:   [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    res.json({ content: data.content?.[0]?.text || '' });

  } catch (err) {
    console.error('Session notes error:', err);
    res.status(500).json({ error: 'Error procesando notas' });
  }
});

// ── INSIGHT DEL DÍA ──
app.get('/api/ai/daily-insight', requireAuth, async (req, res) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 200,
        messages:   [{ role: 'user', content: 'Dame UN insight poderoso para un coach hoy. Máximo 3 frases. Profundo, sin clichés.' }]
      })
    });

    const data = await response.json();
    res.json({ content: data.content?.[0]?.text || '' });

  } catch (err) {
    res.status(500).json({ error: 'Error generando insight' });
  }
});

// ══════════════════════════════════════════
// SERVIR EL FRONTEND ESTÁTICO
// ══════════════════════════════════════════
app.use(express.static(path.join(__dirname, '..', 'public')));

// Cualquier ruta no-API devuelve el index.html (SPA)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  }
});

// ══════════════════════════════════════════
// ARRANCAR
// ══════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✅ ECOSYS corriendo en puerto ${PORT}`);
  console.log(`   Modo: ${process.env.NODE_ENV || 'development'}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY no configurada — IA desactivada');
  }
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET no configurada — LOGIN NO FUNCIONARÁ');
  }
});
