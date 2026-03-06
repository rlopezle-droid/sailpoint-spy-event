const Replicate = require("replicate");

const STYLES = {
  james_bond: {
    scene: "A secret agent in an elegant black tuxedo with bow tie, holding a Walther PPK pistol, standing confidently. Dramatic night cityscape background with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask",
  },
  mission_impossible: {
    scene: "A secret agent in a black tactical suit with earpiece, standing on a glass skyscraper rooftop at night, city lights below, dramatic clouds. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses",
  },
  ai_cyber: {
    scene: "A futuristic AI agent in a holographic bodysuit with electric teal glowing circuit patterns, in a server room with floating holographic data panels. Face clearly visible, front-facing, neutral expression. Navy and teal neon glow. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor",
  },
  sailpoint_spy: {
    scene: "An elite corporate agent in a sharp navy business suit with earpiece. Glowing identity vault access panels and dark city skyline background. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes",
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

  const { imageBase64, style = "james_bond", gender = "male" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });

  const s = STYLES[style] || STYLES.james_bond;
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  // Adapt to gender
  const genderWord = gender === "female" ? "female" : "male";
  const scene = s.scene.replace(/\bA secret agent\b/g, `A ${genderWord} secret agent`)
                       .replace(/\bA futuristic\b/g, `A ${genderWord} futuristic`)
                       .replace(/\bAn elite\b/g, `A ${genderWord} elite`);

  try {
    // ── STEP 1: FLUX generates the spy scene ─────────────────────────
    console.log("Step 1: Generating spy scene with FLUX...");
    const fluxOutput = await runWithRetry(replicate, "black-forest-labs/flux-1.1-pro", {
      prompt: scene,
      negative_prompt: s.negative,
      aspect_ratio: "2:3",
      output_format: "jpg",
      output_quality: 95,
      safety_tolerance: 2,
      prompt_upsampling: true,
    });
    const sceneUrl = String(Array.isArray(fluxOutput) ? fluxOutput[0] : fluxOutput);
    console.log("Step 1 done:", sceneUrl);

    // Wait between calls
    await sleep(12000);

    // ── STEP 2: fofr/face-swap-with-ideogram inserts user face ───────
    // This model auto-generates the prompt using Claude internally,
    // creates a face mask, and uses Ideogram Character for inpainting.
    console.log("Step 2: Face swap with fofr/face-swap-with-ideogram...");
    const swapOutput = await runWithRetry(replicate, "fofr/face-swap-with-ideogram", {
      face_image: `data:image/jpeg;base64,${imageBase64}`,
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
