# ECOSYS — Guía de Deploy para Howard
## De cero a producción en Render · ~20 minutos

---

## PASO 1 — Generar el hash de la contraseña (en tu computador)

Necesitas Node.js instalado. Abre una terminal en la carpeta del proyecto:

```bash
npm install
node setup-password.js
```

Escribe la contraseña que Renzo quiere usar para entrar a ECOSYS.
El script imprime un hash así: `$2b$12$XXXXXXXX...`
**Cópialo — lo necesitas en el Paso 3.**

---

## PASO 2 — Subir el código a GitHub

1. Crea un repositorio **privado** en https://github.com → "New repository" → nombre: `ecosys-platform`
2. En la carpeta del proyecto ejecuta:

```bash
git init
git add .
git commit -m "ECOSYS v1.0 — initial deploy"
git remote add origin https://github.com/TU_USUARIO/ecosys-platform.git
git push -u origin main
```

---

## PASO 3 — Crear el servicio en Render

1. Ve a https://render.com → Sign in con GitHub
2. Click **"New +"** → **"Web Service"**
3. Conecta el repositorio `ecosys-platform`
4. Render detecta el `render.yaml` automáticamente — revisa:
   - **Name:** ecosys-platform
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (suficiente para empezar)

5. En la sección **"Environment Variables"** agrega estas variables:

| Variable | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-api03-L7mMFQq...` (la clave de Renzo) |
| `JWT_SECRET` | Genera uno en https://generate-secret.vercel.app/64 |
| `ADMIN_NAME` | `Renzo Gallo` |
| `ADMIN_EMAIL` | El email con el que Renzo quiere iniciar sesión |
| `ADMIN_PASSWORD_HASH` | El hash generado en el Paso 1 |
| `NODE_ENV` | `production` |

6. Click **"Create Web Service"**
7. Render instala dependencias y arranca. El log debe mostrar:
   ```
   ✅ ECOSYS corriendo en puerto 3000
   ```

---

## PASO 4 — Conectar el dominio

En Render → tu servicio → **"Settings"** → **"Custom Domains"**:
1. Click "Add Custom Domain"
2. Escribe el dominio: `ecosys.tudominio.com` (o el dominio principal)
3. Render te da un valor CNAME, por ejemplo: `ecosys-platform.onrender.com`
4. En el panel DNS del dominio (GoDaddy, Cloudflare, etc.) agrega:
   - **Tipo:** CNAME
   - **Nombre:** ecosys (o @ para dominio raíz)
   - **Valor:** ecosys-platform.onrender.com
5. Espera 5-10 minutos para propagación DNS
6. Render emite el certificado SSL automáticamente (HTTPS gratis)

---

## PASO 5 — Verificar que todo funciona

Abre el dominio y prueba en orden:

- [ ] La landing carga con el logo ECOSYS
- [ ] Login con el email y contraseña configurados → entra al dashboard
- [ ] Módulo IA Asistente → envía un mensaje → responde la IA
- [ ] Módulo Marketing → genera contenido con IA
- [ ] Módulo Sesiones → procesa notas con IA
- [ ] Cerrar pestaña y volver → la sesión se mantiene

Si algo falla: Render → tu servicio → **"Logs"** → ver el error exacto.

---

## NOTAS IMPORTANTES

- **La API Key nunca aparece en el código fuente** — solo vive en las variables de entorno de Render
- **El plan Free de Render** hace spin-down después de 15 min de inactividad (primer request tarda ~30 seg). Para evitarlo: upgrade a Plan Starter ($7/mes)
- **Para agregar más coaches** como usuarios: agrega `USER2_EMAIL`, `USER2_NAME`, `USER2_PASSWORD_HASH` en las variables de entorno de Render y reinicia el servicio
- **Backup:** El código en GitHub ES el backup. Todo vive ahí.

---

## ESTRUCTURA DEL PROYECTO

```
ecosys/
├── server/
│   └── index.js          ← Backend Express (API Key aquí, segura)
├── public/
│   └── index.html        ← Frontend completo (sin secretos)
├── package.json
├── render.yaml           ← Configuración de Render
├── setup-password.js     ← Generador de contraseñas
└── .env.example          ← Plantilla de variables (NO subir .env real)
```
