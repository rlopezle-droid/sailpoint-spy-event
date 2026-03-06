const Replicate = require("replicate");

const STYLES = {
  james_bond: {
    scene: "A secret agent in an elegant black tuxedo with bow tie, holding a Walther PPK pistol, standing confidently. Dramatic night cityscape background with blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression. Ultra realistic, 8K, full body portrait.",
    prompt: "Secret agent, black tuxedo, bow tie, pistol, night city, cinematic, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask, extra limbs",
  },
  mission_impossible: {
    scene: "A tactical secret agent in a black tactical suit with earpiece, on a skyscraper rooftop at night, city lights below. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K, full body portrait.",
    prompt: "Tactical spy, black suit, earpiece, rooftop, night city, cinematic, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses",
  },
  ai_cyber: {
    scene: "A futuristic AI agent in a holographic bodysuit with teal glowing circuits, in a server room with floating data panels. Face clearly visible, front-facing, neutral expression. Navy and teal neon. Ultra realistic, 8K, full body portrait.",
    prompt: "Cyberpunk AI agent, holographic suit, teal circuits, server room, neon, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor",
  },
  sailpoint_spy: {
    scene: "An elite corporate agent in a sharp navy business suit with earpiece. Glowing identity vault panels and city skyline background. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K, full body portrait.",
    prompt: "Corporate spy, navy suit, earpiece, identity vault background, teal navy, cinematic, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes",
  },
};

// Sleep helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Run with automatic retry on 429
async function runWithRetry(replicate, model, input, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await replicate.run(model, { input });
    } catch (err) {
      const is429 = err.message?.includes("429") || err.message?.includes("Too Many Requests") || err.message?.includes("throttled");
      const retryAfter = err.message?.match(/retry_after["\s:]+(\d+)/)?.[1];
      const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (2 ** attempt) * 8000; // exponential backoff: 8s, 16s, 32s...

      if (is429 && attempt < maxRetries) {
        console.log(`429 on attempt ${attempt + 1}, waiting ${waitMs / 1000}s before retry...`);
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
    // ── STEP 1: Generate spy scene with FLUX ─────────────────────────
    console.log("Step 1: Generating spy scene with FLUX...");
    const fluxOutput = await runWithRetry(replicate, "black-forest-labs/flux-1.1-pro", {
      prompt: s.scene,
      aspect_ratio: "2:3",
      output_format: "jpg",
      output_quality: 95,
      safety_tolerance: 2,
      prompt_upsampling: true,
    });

    const sceneUrl = String(Array.isArray(fluxOutput) ? fluxOutput[0] : fluxOutput);
    console.log("Step 1 done:", sceneUrl);

    // ── Wait 12s between calls to avoid burst rate limit ─────────────
    console.log("Waiting 12s between API calls...");
    await sleep(12000);

    // ── STEP 2: Face swap with InstantID ─────────────────────────────
    console.log("Step 2: Face swap with InstantID...");
    const instantOutput = await runWithRetry(replicate,
      "zsxkib/instant-id-ipadapter-plus-face:32402fb5c493d883aa6cf098ce3e4cc80f1fe6871f6ae7f632a8dbde01a3d161",
      {
        image: `data:image/jpeg;base64,${imageBase64}`,
        prompt: s.prompt,
        negative_prompt: s.negative,
        width: 1024,
        height: 1024,
        num_inference_steps: 40,
        guidance_scale: 6,
        instantid_weight: 0.9,
        ipadapter_weight: 0.9,
        ip_image: sceneUrl,
      }
    );

    const finalUrl = String(Array.isArray(instantOutput) ? instantOutput[0] : instantOutput);
    console.log("Step 2 done:", finalUrl);

    return res.status(200).json({ imageUrl: finalUrl });

  } catch (err) {
    console.error("Pipeline error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
