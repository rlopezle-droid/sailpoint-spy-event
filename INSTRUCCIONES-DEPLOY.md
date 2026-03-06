# 🕵️ SailPoint Adaptive Identity — Spy Event App
## Guía de despliegue (sin experiencia técnica)

---

## ¿Qué necesitas?
- Cuenta gratuita en [GitHub](https://github.com) (para guardar el código)
- Cuenta gratuita en [Vercel](https://vercel.com) (para publicar la web)
- Cuenta gratuita en [Replicate](https://replicate.com) (para generar las imágenes con IA)

---

## PASO 1 — Obtener tu API Key de Replicate (GRATIS)

1. Ve a [replicate.com](https://replicate.com) → Sign Up (puedes entrar con GitHub)
2. Una vez dentro, ve a **Account Settings → API Tokens**
3. Clic en **"Create token"** → copia el token (empieza por `r8_...`)
4. **Guárdalo**, lo necesitarás en el Paso 3.

> 💡 Replicate da créditos gratuitos al registrarte. Cada imagen cuesta ~$0.05.

---

## PASO 2 — Subir el código a GitHub

1. Ve a [github.com](https://github.com) → **New repository**
2. Nombre: `sailpoint-spy-event` → **Public** → Create repository
3. Haz clic en **"uploading an existing file"**
4. Sube **toda la carpeta** del proyecto (arrastra los archivos):
   - `vercel.json`
   - `package.json`
   - `api/generate.js`
   - `public/index.html`
5. Clic en **"Commit changes"**

---

## PASO 3 — Desplegar en Vercel

1. Ve a [vercel.com](https://vercel.com) → **Sign Up with GitHub**
2. Clic en **"New Project"**
3. Selecciona el repositorio `sailpoint-spy-event` → **Import**
4. Antes de hacer Deploy, ve a **"Environment Variables"** y añade:
   - **Name:** `REPLICATE_API_TOKEN`
   - **Value:** (pega aquí tu token de Replicate del Paso 1)
5. Clic en **"Deploy"** ✅

¡En 2 minutos tendrás una URL pública como:
`https://sailpoint-spy-event.vercel.app`

---

## PASO 4 — Crear el QR para el evento

1. Ve a [qr-code-generator.com](https://www.qr-code-generator.com)
2. Pega tu URL de Vercel
3. Personaliza colores: fondo `#0A1628`, código `#00C4B4`
4. Descarga en PNG o SVG (alta resolución para impresión)

---

## PASO 5 — Poner límite de gasto (recomendado)

En [replicate.com](https://replicate.com) → **Billing → Spending Limits**
- Pon un límite de $20-50 para el evento (depende de asistentes esperados)
- Recibirás un email si te acercas al límite

---

## ¿Cuánto cuesta?

| Concepto | Coste |
|---|---|
| Vercel (hosting) | **GRATIS** |
| GitHub | **GRATIS** |
| Replicate (imágenes) | ~$0.05 por imagen |
| 100 asistentes | ~$5 USD |
| 500 asistentes | ~$25 USD |

---

## Soporte

Si algo falla, revisa:
1. Que el token de Replicate esté bien puesto en Vercel (sin espacios)
2. Que el repositorio en GitHub tenga los 4 archivos correctamente
3. En Vercel → tu proyecto → **"Deployments"** → logs de error

---

*SailPoint Adaptive Identity Event // Operation AI Control*
