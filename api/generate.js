const Replicate = require("replicate");

// KEY PRINCIPLE: Do NOT describe body shape, hair, or physical attributes.
// Let the face-swap model (Ideogram) take those from the real photo.
// Only describe clothing, setting, pose and lighting.
const STYLES = {
  james_bond: {
    male: "A person wearing an elegant black tuxedo with bow tie, arms confidently crossed, standing against a dramatic night cityscape with blurred neon lights. Cinematic movie poster lighting, chiaroscuro, deep blue and gold tones. Face front-facing, neutral expression, sharp focus. Ultra realistic, 8K, full body portrait.",
    female: "A person wearing a sharp tailored black pantsuit with a white blouse, arms confidently crossed, standing against a dramatic night cityscape with blurred neon lights. Cinematic movie poster lighting, chiaroscuro, deep blue and gold tones. Face front-facing, neutral expression, sharp focus. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask, gun, weapon, pistol, knife, bad anatomy, revealing clothes, tight clothes, low cut, cleavage, short skirt, dress, gown, lingerie, sexy, provocative, unrealistic body, distorted body, elongated body, thin, skinny, oversized breasts, different hair, hair change",
  },
  mission_impossible: {
    male: "A person wearing a black tactical jacket and trousers with a small earpiece, standing on a glass skyscraper rooftop at night, city lights below, arms crossed. Face front-facing, neutral expression, sharp focus. Orange and teal cinematic color grading. Ultra realistic, 8K, full body portrait.",
    female: "A person wearing a black tactical jacket and straight-cut trousers with a small earpiece, standing on a glass skyscraper rooftop at night, city lights below, arms crossed. Face front-facing, neutral expression, sharp focus. Orange and teal cinematic color grading. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses, gun, weapon, knife, bad anatomy, revealing clothes, tight clothes, low cut, cleavage, lingerie, sexy, provocative, unrealistic body, distorted body, elongated body, thin, skinny, oversized breasts, different hair, hair change",
  },
  ai_cyber: {
    male: "A person wearing a futuristic structured holographic jacket with electric teal glowing circuits, standing in a server room with floating holographic data panels. Face front-facing, neutral expression, sharp focus. Deep navy and teal neon glow. Ultra realistic, 8K, half body portrait.",
    female: "A person wearing a futuristic structured holographic jacket and wide-leg trousers with electric teal glowing circuits, standing in a server room with floating holographic data panels. Face front-facing, neutral expression, sharp focus. Deep navy and teal neon glow. Ultra realistic, 8K, half body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor, gun, weapon, bad anatomy, bodysuit, catsuit, revealing clothes, tight clothes, low cut, cleavage, lingerie, sexy, provocative, unrealistic body, distorted body, elongated body, thin, skinny, oversized breasts, different hair, hair change",
  },
  sailpoint_spy: {
    male: "A person wearing a sharp tailored navy business suit with a subtle earpiece, arms crossed, standing in front of glowing identity vault panels and a dark city skyline. Face front-facing, neutral expression, sharp focus. Teal and navy color palette, professional cinematic lighting. Ultra realistic, 8K, full body portrait.",
    female: "A person wearing a sharp tailored navy business suit with a subtle earpiece, arms crossed, standing in front of glowing identity vault panels and a dark city skyline. Face front-facing, neutral expression, sharp focus. Teal and navy color palette, professional cinematic lighting. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes, gun, weapon, bad anatomy, revealing clothes, tight clothes, low cut, cleavage, lingerie, sexy, provocative, unrealistic body, distorted body, elongated body, thin, skinny, oversized breasts, different hair, hair change",
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

    await sleep(12000);

    console.log("Step 2: face-swap-with-ideogram");
    const swapOutput = await runWithRetry(replicate, "fofr/face-swap-with-ideogram", {
      character_image: `data:image/jpeg;base64,${imageBase64}`,
      target_image: sceneUrl,
    });
    const finalUrl = String(Array.isArray(swapOutput) ? swapOutput[0] : swapOutput);
    console.log("Step 2 done:", finalUrl);

    return res.status(200).json({ imageUrl: finalUrl });
  } catch (err) {
    console.error("Pipeline error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
