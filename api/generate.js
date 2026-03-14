const Replicate = require("replicate");

// Pipeline:
// Step 1 — Replicate FLUX 1.1 Pro generates a high-quality spy scene
// Step 2 — Segmind FaceSwap v4 inserts the user's real face into that scene
// Segmind preserves gender, hair, body type — only swaps the face.

const STYLES = {
  james_bond: {
    male:   "A man in an elegant black tuxedo with bow tie, arms confidently crossed, standing against a dramatic night cityscape with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression. Ultra realistic, 8K, full body portrait.",
    female: "A woman in a sharp tailored black pantsuit with white blouse, arms confidently crossed, standing against a dramatic night cityscape with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, pistol, knife, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
  mission_impossible: {
    male:   "A man in a black tactical jacket and trousers with a small earpiece, standing on a glass skyscraper rooftop at night, city lights below, arms crossed. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K, full body portrait.",
    female: "A woman in a black tactical jacket and straight-cut trousers with a small earpiece, standing on a glass skyscraper rooftop at night, city lights below, arms crossed. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, knife, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
  ai_cyber: {
    male:   "A man in a futuristic structured holographic jacket with electric teal glowing circuits, standing in a server room with floating data panels, hands on hips. Face clearly visible, front-facing, neutral expression. Navy and teal neon. Ultra realistic, 8K, half body portrait.",
    female: "A woman in a futuristic structured holographic jacket and wide-leg trousers with electric teal glowing circuits, standing in a server room with floating data panels, hands on hips. Face clearly visible, front-facing, neutral expression. Navy and teal neon. Ultra realistic, 8K, half body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, bodysuit, catsuit, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
  sailpoint_spy: {
    male:   "A man in a sharp tailored navy business suit with earpiece, arms crossed, standing in front of glowing identity vault panels and a dark city skyline. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K, full body portrait.",
    female: "A woman in a sharp tailored navy business suit with earpiece, arms crossed, standing in front of glowing identity vault panels and a dark city skyline. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runWithRetry(replicate, model, input, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await replicate.run(model, { input });
    } catch (err) {
      const is429 = err.message?.includes("429") || err.message?.includes("throttled") || err.message?.includes("Too Many Requests");
      const retryAfter = err.message?.match(/retry_after["\s:]+(\d+)/)?.[1];
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 8000;
      if (is429 && attempt < maxRetries) {
        console.log(`429 attempt ${attempt + 1}, retrying in ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
}

// Convert a URL to base64 (needed to pass FLUX output to Segmind)
async function urlToBase64(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, style = "james_bond", gender = "male" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });
  if (!process.env.SEGMIND_API_KEY) return res.status(500).json({ error: "SEGMIND_API_KEY not set" });

  const s = STYLES[style] || STYLES.james_bond;
  const genderKey = gender === "female" ? "female" : "male";
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    // ── STEP 1: FLUX generates the spy scene ─────────────────────────
    console.log(`Step 1: FLUX scene — ${style} / ${genderKey}`);
    const fluxOutput = await runWithRetry(replicate, "black-forest-labs/flux-1.1-pro", {
      prompt: s[genderKey],
      negative_prompt: s.negative,
      aspect_ratio: "2:3",
      output_format: "jpg",
      output_quality: 95,
      safety_tolerance: 2,
      prompt_upsampling: true,
    });
    const sceneUrl = String(Array.isArray(fluxOutput) ? fluxOutput[0] : fluxOutput);
    console.log("Step 1 done:", sceneUrl);

    // Wait to avoid burst rate limit
    await sleep(12000);

    // ── STEP 2: Segmind FaceSwap v4 inserts user's real face ─────────
    // source_image = user's photo (the face to insert)
    // target_image = the spy scene generated by FLUX
    // swap_type "face" = only swaps the face, preserves body/hair/gender
    console.log("Step 2: Segmind FaceSwap v4...");

    // Convert scene URL to base64 for Segmind
    const sceneBase64 = await urlToBase64(sceneUrl);

    const segmindRes = await fetch("https://api.segmind.com/v1/faceswap-v4", {
      method: "POST",
      headers: {
        "x-api-key": process.env.SEGMIND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_image: imageBase64,      // user's face
        target_image: sceneBase64,      // spy scene
        model_type: "quality",          // "quality" > "speed" for events
        swap_type: "face",              // only face, not head — preserves hair
        style_type: "normal",
        image_format: "jpg",
        image_quality: 95,
        base64: true,                   // return base64 directly
      }),
    });

    if (!segmindRes.ok) {
      const errText = await segmindRes.text();
      throw new Error(`Segmind error ${segmindRes.status}: ${errText}`);
    }

    const segmindData = await segmindRes.json();

    // Segmind returns base64 image — convert to data URL
    const finalBase64 = segmindData.image || segmindData.output || segmindData.result;
    if (!finalBase64) throw new Error("Segmind did not return an image");

    const imageUrl = `data:image/jpeg;base64,${finalBase64}`;
    console.log("Step 2 done.");

    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Pipeline error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
