const Replicate = require("replicate");

// Cinematic spy scenes — generic agent placeholder, face will be swapped in step 2
const STYLES = {
  james_bond: {
    scene: "Full body portrait of a secret agent in an elegant black tuxedo with bow tie, holding a Walther PPK pistol. Dramatic night cityscape background, blurred neon lights. Cinematic movie poster, chiaroscuro lighting, deep blue and gold. Face clearly visible, front-facing, sharp focus. Ultra realistic, 8K.",
    prompt: "Secret agent, black tuxedo, bow tie, pistol, night city background, cinematic, ultra realistic",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, hat, mask, extra limbs, bad anatomy",
  },
  mission_impossible: {
    scene: "Full body portrait of a tactical secret agent in a black tactical suit with earpiece, standing on a glass skyscraper rooftop at night. City lights below. Face clearly visible, front-facing, sharp focus. Orange and teal cinematic color grading. Ultra realistic, 8K.",
    prompt: "Tactical spy agent, black suit, earpiece, rooftop, night city, cinematic thriller, ultra realistic",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, sunglasses",
  },
  ai_cyber: {
    scene: "Full body portrait of a futuristic AI agent in a sleek holographic bodysuit with electric teal glowing circuits. Server room background with floating holographic data panels. Face clearly visible, front-facing, sharp focus. Navy and teal neon. Ultra realistic, 8K.",
    prompt: "Cyberpunk AI agent, holographic suit, teal circuits, server room, neon glow, ultra realistic",
    negative: "cartoon, anime, deformed, blurry, watermark, helmet, mask, visor",
  },
  sailpoint_spy: {
    scene: "Full body portrait of an elite corporate agent in a sharp navy business suit with subtle earpiece. Background: glowing identity vault panels and dark city skyline. Face clearly visible, front-facing, sharp focus. Teal and navy palette, cinematic. Ultra realistic, 8K.",
    prompt: "Corporate spy agent, navy suit, earpiece, identity vault background, teal navy palette, cinematic, ultra realistic",
    negative: "cartoon, anime, deformed, blurry, watermark, sunglasses, casual clothes",
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

  const s = STYLES[style] || STYLES.james_bond;
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

  try {
    // ── STEP 1: Generate high-quality spy scene with FLUX 1.1 Pro ────
    console.log("Step 1: Generating spy scene...");
    const fluxOutput = await replicate.run("black-forest-labs/flux-1.1-pro", {
      input: {
        prompt: s.scene,
        aspect_ratio: "2:3",
        output_format: "jpg",
        output_quality: 95,
        safety_tolerance: 2,
        prompt_upsampling: true,
      },
    });
    const sceneUrl = String(Array.isArray(fluxOutput) ? fluxOutput[0] : fluxOutput);
    console.log("Step 1 done:", sceneUrl);

    // ── STEP 2: Swap user face into the scene with InstantID ─────────
    // InstantID uses the face photo as identity reference and
    // generates a new image matching the spy scene prompt
    // but with the user's facial features preserved.
    console.log("Step 2: Applying face identity with InstantID...");
    const instantOutput = await replicate.run(
      "zsxkib/instant-id-ipadapter-plus-face:32402fb5c493d883aa6cf098ce3e4cc80f1fe6871f6ae7f632a8dbde01a3d161",
      {
        input: {
          image: `data:image/jpeg;base64,${imageBase64}`, // user's face reference
          prompt: s.prompt,
          negative_prompt: s.negative,
          // High quality settings
          width: 1024,
          height: 1024,
          num_inference_steps: 40,
          guidance_scale: 6,
          // Face identity strength — higher = more faithful to original face
          instantid_weight: 0.9,
          ipadapter_weight: 0.9,
          // Reference image for composition/style
          ip_image: sceneUrl,
        },
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
