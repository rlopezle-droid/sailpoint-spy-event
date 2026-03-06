const Replicate = require("replicate");

const STYLES = {
  james_bond: {
    prompt: "James Bond 007 spy, elegant black tuxedo with bow tie, holding a Walther PPK pistol, dramatic night cityscape background with blurred lights and reflections, cinematic movie poster composition, chiaroscuro lighting, deep blue and gold color palette, ultra realistic, 8K photography",
    negative: "cartoon, anime, painting, deformed, blurry, bad anatomy, extra limbs, watermark",
  },
  mission_impossible: {
    prompt: "Mission Impossible secret agent, black tactical suit, earpiece, rooftop of glass skyscraper at night with city lights below, dramatic orange and teal cinematic color grading, motion thriller atmosphere, ultra realistic, 8K",
    negative: "cartoon, anime, painting, deformed, blurry, bad anatomy, watermark",
  },
  ai_cyber: {
    prompt: "Futuristic cyberpunk AI governance agent, sleek holographic bodysuit with electric teal glowing circuit patterns, massive server room background with floating holographic data panels and streams, deep navy and electric teal neon glow, hyper detailed, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, bad anatomy, watermark, low quality",
  },
  sailpoint_spy: {
    prompt: "Elite corporate intelligence agent, sharp tailored navy business suit, subtle earpiece, background split between glowing identity vault access panels and dark city skyline, teal and navy color scheme, professional cinematic photography, ultra realistic, 8K",
    negative: "cartoon, anime, deformed, blurry, bad anatomy, watermark",
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, style = "james_bond", firstName = "", lastName = "" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.REPLICATE_API_TOKEN) return res.status(500).json({ error: "REPLICATE_API_TOKEN not set" });

  const s = STYLES[style] || STYLES.james_bond;
  const nameTag = [firstName, lastName].filter(Boolean).join(" ");
  const finalPrompt = nameTag
    ? `${s.prompt}. Agent name badge reads "${nameTag}"`
    : s.prompt;

  try {
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

    // zsxkib/instant-id-ipadapter-plus-face — correct version as of 2025
    const output = await replicate.run(
      "zsxkib/instant-id-ipadapter-plus-face:32402fb5c493d883aa6cf098ce3e4cc80f1fe6871f6ae7f632a8dbde01a3d161",
      {
        input: {
          image: `data:image/jpeg;base64,${imageBase64}`,
          prompt: finalPrompt,
          negative_prompt: s.negative,
          instantid_weight: 0.8,
          ipadapter_weight: 0.8,
          num_inference_steps: 30,
          guidance_scale: 5,
          width: 640,
          height: 960,
        },
      }
    );

    const imageUrl = Array.isArray(output) ? output[0] : output;
    return res.status(200).json({ imageUrl: String(imageUrl) });

  } catch (err) {
    console.error("Replicate error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
