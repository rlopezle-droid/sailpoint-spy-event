const Replicate = require("replicate");

// PIPELINE (identical to the working version):
// Step 1 — Replicate FLUX 1.1 Pro generates the spy scene
// Step 2 — Segmind FaceSwap v4 swaps the face (replaces fofr/face-swap-with-ideogram)
//
// Why Segmind instead of Ideogram:
// - No NSFW false positives on normal photos
// - swap_type "head" preserves hair colour and style from source photo
// - No gender change — only the face/head is swapped, body stays from scene

const STYLES = {
  james_bond: {
    male:   "A well-dressed man in an elegant black tuxedo with bow tie, arms confidently crossed. Dramatic night cityscape background with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression. Ultra realistic, 8K, full body portrait.",
    female: "A professional woman in an elegant tailored black pantsuit with a white blouse, arms confidently crossed. Dramatic night cityscape background with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask, gun, weapon, pistol, knife, bad anatomy, revealing clothes, tight clothes, low cut, cleavage, short skirt, dress, gown, lingerie, sexy, provocative, thin, skinny, oversized breasts",
  },
  mission_impossible: {
    male:   "A man in a black tactical suit with earpiece, on a glass skyscraper rooftop at night, city lights below, arms crossed. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K, full body portrait.",
    female: "A woman in a practical black tactical jacket and straight-cut trousers with earpiece, on a glass skyscraper rooftop at night, city lights below, arms crossed. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses, gun, weapon, knife, bad anatomy, revealing clothes, tight clothes, low cut, cleavage, lingerie, sexy, provocative, thin, skinny, oversized breasts",
  },
  ai_cyber: {
    male:   "A man in a futuristic structured holographic jacket with electric teal glowing circuits, in a server room with floating data panels, hands on hips. Face clearly visible, front-facing, neutral expression. Navy and teal neon. Ultra realistic, 8K, half body portrait.",
    female: "A woman in a futuristic structured holographic jacket and wide-leg trousers with electric teal glowing circuits, in a server room with floating data panels, hands on hips. Face clearly visible, front-facing, neutral expression. Navy and teal neon. Ultra realistic, 8K, half body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor, gun, weapon, bad anatomy, bodysuit, catsuit, revealing clothes, tight clothes, low cut, cleavage, lingerie, sexy, provocative, thin, skinny, oversized breasts",
  },
  sailpoint_spy: {
    male:   "A man in a sharp tailored navy business suit with earpiece, arms crossed. Glowing identity vault panels and dark city skyline background. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K, full body portrait.",
    female: "A woman in a sharp tailored navy business suit with earpiece, arms crossed. Glowing identity vault panels and dark city skyline background. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes, gun, weapon, bad anatomy, revealing clothes, tight clothes, low cut, cleavage, lingerie, sexy, provocative, thin, skinny, oversized breasts",
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

// Fetch a URL and return its contents as base64
async function urlToBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch scene image: ${res.status}`);
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
    // ── STEP 1: FLUX generates the spy scene (same as before) ─────────
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

    // Wait between calls to avoid burst rate limit on Replicate
    await sleep(12000);

    // ── STEP 2: Segmind FaceSwap v4 (replaces fofr/face-swap-with-ideogram) ──
    // source_image = user's photo (the face to use)
    // target_image = FLUX spy scene (where the face goes)
    // swap_type "head" = preserves hair colour/style from the source photo
    // model_type "quality" = best results, slightly slower than "speed"
    console.log("Step 2: Segmind FaceSwap v4...");

    const sceneBase64 = await urlToBase64(sceneUrl);

    const segmindRes = await fetch("https://api.segmind.com/v1/faceswap-v4", {
      method: "POST",
      headers: {
        "x-api-key": process.env.SEGMIND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_image: imageBase64,   // user's photo — face to insert
        target_image: sceneBase64,   // spy scene — where to insert it
        model_type: "quality",       // "quality" or "speed"
        swap_type: "head",           // "head" preserves hair; "face" only swaps face
        style_type: "normal",
        image_format: "jpg",
        image_quality: 95,
        base64: true,                // return base64 directly, no extra fetch needed
      }),
    });

    if (!segmindRes.ok) {
      const errText = await segmindRes.text();
      throw new Error(`Segmind error (${segmindRes.status}): ${errText}`);
    }

    // Segmind returns the image as raw binary when base64:true is set
    const buffer = await segmindRes.arrayBuffer();
    const resultBase64 = Buffer.from(buffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${resultBase64}`;

    console.log("Step 2 done.");
    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Pipeline error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
