const Replicate = require("replicate");

const STYLES = {
  james_bond: {
    scene: "Full body portrait of a male secret agent in an elegant black tuxedo with bow tie, holding a Walther PPK pistol. Dramatic night cityscape background, blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, neutral expression, sharp focus. Ultra realistic, 8K.",
    prompt: "male secret agent, black tuxedo, bow tie, pistol, night city, cinematic lighting, ultra realistic, 8K, sharp focus",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask, extra limbs, woman, female",
  },
  mission_impossible: {
    scene: "Full body portrait of a male tactical agent in a black tactical suit with earpiece, on a skyscraper rooftop at night. City lights below, dramatic clouds. Face clearly visible, front-facing, neutral expression. Orange and teal cinematic grading. Ultra realistic, 8K.",
    prompt: "male tactical spy, black suit, earpiece, rooftop, night city, cinematic thriller, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses, woman, female",
  },
  ai_cyber: {
    scene: "Full body portrait of a male futuristic AI agent in a holographic bodysuit with teal glowing circuits. Server room background with floating data panels. Face clearly visible, front-facing, neutral expression. Navy and teal neon. Ultra realistic, 8K.",
    prompt: "male cyberpunk AI agent, holographic suit, teal circuits, server room, neon glow, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor, woman, female",
  },
  sailpoint_spy: {
    scene: "Full body portrait of a male corporate agent in a sharp navy business suit with earpiece. Glowing identity vault panels and city skyline background. Face clearly visible, front-facing, neutral expression. Teal and navy palette, cinematic. Ultra realistic, 8K.",
    prompt: "male corporate spy, navy suit, earpiece, identity vault background, teal navy, cinematic, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes, woman, female",
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

  // Adapt prompts to gender
  const genderWord = gender === "female" ? "female" : "male";
  const antiGender = gender === "female" ? "man, male" : "woman, female";
  const scene = s.scene.replace(/\bmale\b/g, genderWord).replace(/\bfemale\b/g, genderWord);
  const prompt = s.prompt.replace(/\bmale\b/g, genderWord);
  const negative = s.negative.replace(/woman, female|man, male/g, antiGender);

  try {
    // ── STEP 1: FLUX generates the spy scene ─────────────────────────
    console.log("Step 1: Generating spy scene with FLUX...");
    const fluxOutput = await runWithRetry(replicate, "black-forest-labs/flux-1.1-pro", {
      prompt: scene,
      aspect_ratio: "2:3",
      output_format: "jpg",
      output_quality: 95,
      safety_tolerance: 2,
      prompt_upsampling: true,
    });
    const sceneUrl = String(Array.isArray(fluxOutput) ? fluxOutput[0] : fluxOutput);
    console.log("Step 1 done:", sceneUrl);

    // Wait between calls to avoid burst rate limit
    await sleep(12000);

    // ── STEP 2: InstantID inserts the user's face ─────────────────────
    // Key improvements vs before:
    // - instantid_weight: 1.0 (max face fidelity)
    // - ipadapter_weight: 1.0 (max style reference from scene)
    // - steps: 50 (higher quality)
    // - guidance: 7.5 (stronger prompt adherence)
    console.log("Step 2: Inserting face with InstantID...");
    const instantOutput = await runWithRetry(replicate,
      "zsxkib/instant-id-ipadapter-plus-face:32402fb5c493d883aa6cf098ce3e4cc80f1fe6871f6ae7f632a8dbde01a3d161",
      {
        image: `data:image/jpeg;base64,${imageBase64}`,
        prompt: prompt,
        negative_prompt: negative,
        width: 1024,
        height: 1024,
        num_inference_steps: 50,
        guidance_scale: 7.5,
        instantid_weight: 1.0,
        ipadapter_weight: 1.0,
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
