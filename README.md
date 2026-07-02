# ECOSYS Platform

Sitio + backend seguro (Node/Express) que sirve `public/index.html` y expone
`/api/chat` como proxy hacia la API de Anthropic. La API key vive **solo**
en el servidor (variable de entorno), nunca en el navegador.

## Estructura

```
ecosys/
├── public/
│   └── index.html      ← tu plataforma (frontend)
├── server.js            ← backend Express
├── package.json
├── render.yaml           ← configuración para desplegar en Render
├── .env.example
└── .gitignore
```

## 1. Subir a GitHub

```bash
cd ecosys
git init
git add .
git commit -m "Primer commit: ECOSYS Platform"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

⚠️ Asegúrate de que `.env` **no** se suba (ya está en `.gitignore`).
Nunca pongas la API key directamente en el código.

## 2. Desplegar en Render

### Opción A — Blueprint (usa render.yaml, más rápido)
1. Entra a https://dashboard.render.com
2. New → Blueprint
3. Conecta tu repo de GitHub
4. Render detecta `render.yaml` automáticamente
5. Te pedirá el valor de `ANTHROPIC_API_KEY` → pégala ahí
6. Deploy

### Opción B — Manual
1. New → Web Service
2. Conecta tu repositorio de GitHub
3. Configura:
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. En "Environment Variables" agrega:
   - `ANTHROPIC_API_KEY` = tu key (obtenla en https://console.anthropic.com)
5. Create Web Service

Render te dará una URL tipo `https://ecosys-platform.onrender.com`.

## 3. Probar localmente (opcional)

```bash
cp .env.example .env
# edita .env y pon tu API key real
npm install
npm start
# abre http://localhost:3000
```

## Importante sobre seguridad

- La API key **original** que estaba escrita en el HTML quedó expuesta.
  Revócala en https://console.anthropic.com y genera una nueva antes de
  desplegar, luego úsala solo como variable de entorno.
