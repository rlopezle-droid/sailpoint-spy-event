const Replicate = require("replicate");

// Step 1: Generate a spy background scene with a generic agent (no specific face)
const STYLE_SCENES = {
  james_bond: {
    scene: "A secret agent in an elegant black tuxedo with bow tie, holding a Walther PPK pistol, standing confidently. Dramatic night cityscape background with blurred neon lights and reflections. Cinematic movie poster composition, chiaroscuro lighting, deep blue and gold color palette. The agent's face is clearly visible, front-facing, sharp focus. Ultra realistic, 8K photography, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, mask, hat covering face",
  },
  mission_impossible: {
    scene: "A secret agent in a black tactical suit with earpiece, standing on a glass skyscraper rooftop at night, city lights below, dramatic clouds. Agent's face is clearly visible, front-facing, sharp focus. Orange and teal cinematic color grading, thriller atmosphere. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, mask, helmet",
  },
  ai_cyber: {
    scene: "A futuristic agent in a sleek holographic bodysuit with electric teal glowing circuit patterns, standing in a massive server room with floating holographic data panels. Agent's face clearly visible, front-facing, sharp focus. Deep navy and electric teal neon glow. Hyper detailed, ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask",
  },
  sailpoint_spy: {
    scene: "An elite corporate intelligence agent in a sharp tailored navy business suit with subtle earpiece. Background: glowing identity vault access panels and dark city skyline. Agent's face clearly visible, front-facing, sharp focus. Teal and navy color scheme, professional cinematic photography. Ultra realistic, 8K, full body portrait.",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses",
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, style = "james_bond" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });

  const s = STYLE_SCENES[style] || STYLE_SCENES.james_bond;
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    // ── STEP 1: Generate spy background scene with FLUX ──────────────
    console.log("Step 1: Generating spy scene with FLUX...");
    const fluxOutput = await replicate.run("black-forest-labs/flux-1.1-pro", {
      input: {
        prompt: s.scene,
        negative_prompt: s.negative,
        aspect_ratio: "2:3",
        output_format: "jpg",
        output_quality: 90,
        safety_tolerance: 2,
      },
    });

    const sceneUrl = Array.isArray(fluxOutput) ? String(fluxOutput[0]) : String(fluxOutput);
    console.log("Step 1 done. Scene URL:", sceneUrl);

    // ── STEP 2: Swap user's face into the scene ──────────────────────
    console.log("Step 2: Swapping face with easel/advanced-face-swap...");
    const swapOutput = await replicate.run("easel/advanced-face-swap", {
      input: {
        swap_image: `data:image/jpeg;base64,${imageBase64}`, // user's face
        target_image: sceneUrl,                               // spy scene
        hair_source: "target",                               // keep scene hair/style
      },
    });

    const finalUrl = Array.isArray(swapOutput) ? String(swapOutput[0]) : String(swapOutput);
    console.log("Step 2 done. Final URL:", finalUrl);

    return res.status(200).json({ imageUrl: finalUrl });

  } catch (err) {
    console.error("Pipeline error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
