export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, imageUrl, agentId } = req.body;
  if (!email || !imageUrl) return res.status(400).json({ error: "Missing email or imageUrl" });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY not configured in Vercel" });

  // ── RESEND PLAN LOGIC ──────────────────────────────────────────────
  // Free plan: solo puedes enviar al email de tu cuenta Resend.
  // Pon RESEND_TEST_EMAIL en Vercel con tu email de cuenta Resend.
  // Cuando verifiques un dominio, pon VERIFIED_DOMAIN=tudominio.com
  // y borra RESEND_TEST_EMAIL — entonces se enviará al email del usuario.
  // ──────────────────────────────────────────────────────────────────
  const hasVerifiedDomain = !!process.env.VERIFIED_DOMAIN;
  const recipient = hasVerifiedDomain ? email : (process.env.RESEND_TEST_EMAIL || email);
  const fromAddress = hasVerifiedDomain
    ? `SailPoint Event <event@${process.env.VERIFIED_DOMAIN}>`
    : "SailPoint Event <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipient],
        subject: `Tu credencial de Agente Espia - ${agentId}`,
        html: `
          <div style="background:#0A1628;color:#ffffff;font-family:Arial,sans-serif;padding:32px;max-width:520px;margin:0 auto;">
            <div style="text-align:center;margin-bottom:24px;">
              <p style="color:#00C4B4;letter-spacing:4px;font-size:11px;margin:0 0 8px">TOP SECRET // CLEARANCE LEVEL 5</p>
              <h1 style="color:#ffffff;font-size:26px;margin:0;letter-spacing:2px">SAILPOINT</h1>
              <p style="color:#00C4B4;font-size:18px;margin:4px 0 0;letter-spacing:3px">ADAPTIVE IDENTITY</p>
            </div>
            <div style="border:1px solid rgba(0,196,180,0.3);padding:20px;text-align:center;margin-bottom:24px;">
              <p style="color:#8FA3B1;font-size:12px;letter-spacing:2px;margin:0 0 16px">// CREDENCIAL DE AGENTE CONFIRMADA</p>
              <img src="${imageUrl}" alt="Spy Agent" style="width:100%;max-width:400px;border:2px solid #00C4B4;display:block;margin:0 auto 16px;">
              <p style="color:#00C4B4;font-size:13px;letter-spacing:2px;margin:0">AGENT ID: ${agentId}</p>
            </div>
            <p style="color:#8FA3B1;font-size:12px;text-align:center;line-height:1.6;">
              Tu mision: <strong style="color:#ffffff">gobernar y supervisar los Agentes de IA</strong> para evitar acciones no autorizadas.<br>
              <span style="color:#00C4B4">#AdaptiveIdentity #SailPoint</span>
            </p>
            <p style="color:rgba(143,163,177,0.35);font-size:10px;text-align:center;margin-top:24px;letter-spacing:1px;">
              SAILPOINT ADAPTIVE IDENTITY // OPERATION AI CONTROL // CLASSIFIED
            </p>
          </div>
        `,
      }),
    });

    // Safely parse — Resend sometimes returns empty body on error
    const text = await response.text();
    let resBody = {};
    if (text) {
      try { resBody = JSON.parse(text); } catch { resBody = { raw: text }; }
    }

    if (!response.ok) {
      const msg = resBody.message || resBody.name || resBody.raw || `HTTP ${response.status}`;
      throw new Error(msg);
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("Resend error:", err.message);
    return res.status(500).json({ error: err.message || "Error sending email" });
  }
}
