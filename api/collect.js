export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { firstName, lastName, email, agentId, style, consent } = req.body;
  if (!email || !consent) return res.status(400).json({ error: "Missing required fields" });
  if (!process.env.GOOGLE_SHEET_WEBHOOK) return res.status(500).json({ error: "GOOGLE_SHEET_WEBHOOK not set" });

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      firstName: firstName || "",
      lastName: lastName || "",
      email,
      agentId: agentId || "",
      style: style || "",
      consent: consent ? "YES" : "NO",
    };

    const response = await fetch(process.env.GOOGLE_SHEET_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sheets webhook error: ${response.status} ${text}`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Collect error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
