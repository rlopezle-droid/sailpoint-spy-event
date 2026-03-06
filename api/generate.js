const Replicate = require("replicate");

const STYLE_PROMPTS = {
  james_bond: `Cinematic James Bond spy movie poster. A secret agent in a perfectly tailored black tuxedo with bow tie, 
    holding a sleek pistol with confidence. Dramatic aerial night cityscape background with neon reflections. 
    Deep blue-black shadows, gold and silver highlights. Text overlay at bottom: "ADAPTIVE IDENTITY". 
    Ultra-realistic, 8K, professional movie poster photography, chiaroscuro lighting.`,

  mission_impossible: `Mission Impossible tactical spy scene. Secret agent in dark tactical outfit with earpiece and gadgets. 
    Glass skyscraper rooftop at night, city lights below, dramatic clouds. 
    Moody thriller cinematography, blue and orange grading. HUD overlay: "OPERATION: ADAPTIVE IDENTITY". 
    Photorealistic, cinematic, dramatic tension.`,

  ai_cyber: `Futuristic cyberpunk AI governance agent portrait. Agent in holographic suit with glowing teal circuit patterns. 
    Massive server room background with floating holographic identity panels and data streams. 
    Deep navy and electric teal color palette (#00C4B4), white glow effects. 
    Text: "AGENT CONTROL SYSTEM — ADAPTIVE IDENTITY — SAILPOINT". Ultra-realistic cyberpunk, hyper-detailed.`,

  sailpoint_spy: `Premium corporate spy credential scene. Agent in sharp navy business suit with earpiece. 
    Split background: secure identity vault with glowing access panels on left, dark city skyline on right. 
    SailPoint navy and teal color scheme. Credential card overlay: "SAILPOINT // ADAPTIVE IDENTITY // AI GOVERNANCE DIVISION". 
    Ultra-realistic, professional, cinematic lighting.`
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, style = "james_bond" } = req.body;

  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "API token not configured" });

  try {
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    const stylePrompt = STYLE_PROMPTS[style] || STYLE_PROMPTS.james_bond;

    // Use FLUX with image-to-image (img2img) via fofr/flux-style-transfer or similar
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro",
      {
        input: {
          prompt: `Portrait photo of a person. ${stylePrompt} The person's face and likeness from the reference photo must be preserved as accurately as possible. Same person, same facial features, same hair.`,
          image: `data:image/jpeg;base64,${imageBase64}`,
          prompt_strength: 0.75,
          aspect_ratio: "9:16",
          output_format: "jpg",
          output_quality: 90,
          safety_tolerance: 2
        }
      }
    );

    // output is a URL string
    const imageUrl = Array.isArray(output) ? output[0] : output;
    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Replicate error:", err);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
