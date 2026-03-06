const Replicate = require("replicate");

const STYLES = {
  james_bond: {
    prompt: "man img as a James Bond secret agent, elegant black tuxedo with bow tie, holding a Walther PPK pistol, dramatic night cityscape background with blurred neon lights, cinematic movie poster composition, chiaroscuro lighting, deep blue and gold color palette, ultra realistic, 8K photography",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask, bad anatomy, low quality",
  },
  mission_impossible: {
    prompt: "man img as a Mission Impossible secret agent, black tactical suit with earpiece, standing on a glass skyscraper rooftop at night, city lights below, dramatic clouds, orange and teal cinematic color grading, thriller atmosphere, ultra realistic, 8K photography",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses, bad anatomy",
  },
  ai_cyber: {
    prompt: "man img as a futuristic cyberpunk AI agent, sleek holographic bodysuit with electric teal glowing circuit patterns, massive server room background with floating holographic data panels, deep navy and electric teal neon glow, ultra realistic, 8K photography",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor, bad anatomy",
  },
  sailpoint_spy: {
    prompt: "man img as an elite corporate intelligence agent, sharp tailored navy business suit with subtle earpiece, glowing identity vault access panels and dark city skyline background, teal and navy color scheme, professional cinematic photography, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes, bad anatomy",
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
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (2 ** attempt) * 8000;
      if (is429 && attempt < maxRetries) {
        console.log(`429 on attempt ${attempt + 1}, waiting ${waitMs / 1000}s...`);
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

  const { imageBase64, style = "james_bond" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });

  const s = STYLES[style] || STYLES.james_bond;
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    // Single call — FLUX PuLID generates the full spy image preserving the person's face
    // ~15 seconds, ~$0.02 per image, 2.5M runs on Replicate
    console.log("Generating with FLUX PuLID...");
    const output = await runWithRetry(replicate, "bytedance/flux-pulid", {
      main_face_image: `data:image/jpeg;base64,${imageBase64}`,
      prompt: s.prompt,
      negative_prompt: s.negative,
      num_steps: 20,
      start_step: 4,        // 4 = best for realistic images (per official docs)
      guidance: 4,
      true_cfg: 1,
      width: 768,
      height: 1024,
      output_format: "jpg",
      output_quality: 95,
    });

    const imageUrl = String(Array.isArray(output) ? output[0] : output);
    console.log("Done:", imageUrl);
    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("PuLID error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
