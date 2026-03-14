const Replicate = require("replicate");

// Single-call pipeline using FLUX 1.1 Pro Ultra with image reference.
// The user's photo is passed as the input image, and the style prompt
// guides the restyling. No face-swap model = no NSFW false positives.
const STYLES = {
  james_bond: {
    male:   "The same person wearing an elegant black tuxedo with bow tie, arms confidently crossed, standing against a dramatic night cityscape with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold tones. Face clearly visible, front-facing, sharp focus. Ultra realistic, 8K, full body portrait.",
    female: "The same person wearing a sharp tailored black pantsuit with a white blouse, arms confidently crossed, standing against a dramatic night cityscape with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold tones. Face clearly visible, front-facing, sharp focus. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, pistol, knife, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
  mission_impossible: {
    male:   "The same person wearing a black tactical jacket and trousers with a small earpiece, standing on a glass skyscraper rooftop at night, city lights below, arms crossed. Face clearly visible, front-facing, sharp focus. Orange and teal cinematic color grading. Ultra realistic, 8K, full body portrait.",
    female: "The same person wearing a black tactical jacket and straight-cut trousers with a small earpiece, standing on a glass skyscraper rooftop at night, city lights below, arms crossed. Face clearly visible, front-facing, sharp focus. Orange and teal cinematic color grading. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, knife, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
  ai_cyber: {
    male:   "The same person wearing a futuristic structured holographic jacket with electric teal glowing circuits, standing in a server room with floating holographic data panels, hands on hips. Face clearly visible, front-facing, sharp focus. Deep navy and teal neon glow. Ultra realistic, 8K, half body portrait.",
    female: "The same person wearing a futuristic structured holographic jacket and wide-leg trousers with electric teal glowing circuits, standing in a server room with floating holographic data panels, hands on hips. Face clearly visible, front-facing, sharp focus. Deep navy and teal neon glow. Ultra realistic, 8K, half body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, gun, weapon, bodysuit, catsuit, revealing clothes, cleavage, lingerie, sexy, provocative",
  },
  sailpoint_spy: {
    male:   "The same person wearing a sharp tailored navy business suit with a subtle earpiece, arms crossed, standing in front of glowing identity vault panels and a dark city skyline. Face clearly visible, front-facing, sharp focus. Teal and navy color palette, professional cinematic lighting. Ultra realistic, 8K, full body portrait.",
    female: "The same person wearing a sharp tailored navy business suit with a subtle earpiece, arms crossed, standing in front of glowing identity vault panels and a dark city skyline. Face clearly visible, front-facing, sharp focus. Teal and navy color palette, professional cinematic lighting. Ultra realistic, 8K, full body portrait.",
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, style = "james_bond", gender = "male" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });

  const s = STYLES[style] || STYLES.james_bond;
  const genderKey = gender === "female" ? "female" : "male";
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    // Single call: FLUX 1.1 Pro Ultra with the user's photo as image reference.
    // "The same person wearing..." instructs the model to preserve identity.
    // No second face-swap step = no NSFW false positives.
    console.log(`Generating with FLUX Ultra — ${style} / ${genderKey}`);
    const output = await runWithRetry(replicate, "black-forest-labs/flux-1.1-pro-ultra", {
      prompt: s[genderKey],
      image: `data:image/jpeg;base64,${imageBase64}`,
      image_prompt_strength: 0.45,   // 0=ignore photo, 1=copy photo. 0.45 = style change but keep identity
      aspect_ratio: "2:3",
      output_format: "jpg",
      output_quality: 95,
      safety_tolerance: 6,           // maximum: avoids NSFW false positives on normal photos
      raw: false,
    });

    const imageUrl = String(Array.isArray(output) ? output[0] : output);
    console.log("Done:", imageUrl);
    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("FLUX Ultra error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
