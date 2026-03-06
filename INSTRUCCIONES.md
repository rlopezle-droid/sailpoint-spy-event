# 🕵️ SailPoint Adaptive Identity v5 — Guía de despliegue

---

## PASO 1 — Crear el Google Sheet y el webhook

1. Ve a **Google Drive** → Nuevo → Google Sheets
2. Llámalo: `SailPoint Spy Event — Leads`
3. En la fila 1 escribe estas cabeceras (una en cada celda):
   ```
   A1: Timestamp
   B1: Nombre
   C1: Apellido
   D1: Email
   E1: AgentID
   F1: Estilo
   G1: Consentimiento
   ```
4. En el menú superior: **Extensiones → Apps Script**
5. Borra todo el código que aparece y pega esto:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    sheet.appendRow([
      data.timestamp,
      data.firstName,
      data.lastName,
      data.email,
      data.agentId,
      data.style,
      data.consent
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

6. Clic en **Guardar** (icono de disco)
7. Clic en **Implementar → Nueva implementación**
8. Tipo: **Aplicación web**
9. Configuración:
   - Descripción: `Spy Event Webhook`
   - Ejecutar como: **Yo (tu email)**
   - Quién tiene acceso: **Cualquier persona**
10. Clic **Implementar** → Autoriza los permisos que pide
11. **Copia la URL** que aparece — es algo como:
    `https://script.google.com/macros/s/XXXXXXXX/exec`
12. Guárdala, la necesitas en el Paso 3.

---

## PASO 2 — Subir el código a GitHub

Si ya tienes el repositorio de versiones anteriores, **reemplaza** estos ficheros:
- `index.html` ← nuevo
- `api/generate.js` ← nuevo (InstantID)
- `vercel.json` ← actualizado
- `package.json` ← sin cambios

Y **añade** el fichero nuevo:
- `api/collect.js` ← nuevo

Si no tienes repositorio: crea uno nuevo en github.com, sube los 5 ficheros.

---

## PASO 3 — Variables de entorno en Vercel

En tu proyecto de Vercel → **Settings → Environment Variables**, añade:

| Name | Value |
|---|---|
| `REPLICATE_API_TOKEN` | Tu token de Replicate (r8_...) |
| `GOOGLE_SHEET_WEBHOOK` | La URL de Apps Script del Paso 1 |

Vercel redesplegará automáticamente.

---

## PASO 4 — Crear el QR

1. Ve a qr-code-generator.com
2. Pega tu URL de Vercel
3. Colores: fondo `#0A1628`, código `#00C4B4`
4. Descarga en PNG alta resolución para impresión

---

## Costes estimados

| Concepto | Coste |
|---|---|
| Vercel hosting | GRATIS |
| GitHub | GRATIS |
| Google Sheets | GRATIS |
| Replicate InstantID | ~$0.10–0.15 por imagen |
| 100 asistentes | ~$12–15 USD |
| 200 asistentes | ~$25–30 USD |

---

## Nota sobre InstantID

El modelo `zsxkib/instant-id` inserta la cara real de la persona en la escena generada.
- Tarda 30–60 segundos por imagen
- Requiere una foto clara con la cara visible y bien iluminada
- Funciona mejor con fotos frontales

---

*SailPoint Adaptive Identity // Operation AI Control*
