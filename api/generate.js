const fs = require("fs");
const path = require("path");

// Static scenes are committed to the repo in /scenes/
// No FLUX call needed — scenes are pre-generated and fixed.
// Only Segmind FaceSwap v4 is called per request (~$0.02/image).

const SCENE_MAP = {
  james_bond:         { male: "james_bond_male.jpg",         female: "james_bond_female.jpg"         },
  mission_impossible: { male: "mission_impossible_male.jpg", female: "mission_impossible_female.jpg" },
  ai_cyber:           { male: "ai_cyber_male.jpg",           female: "ai_cyber_female.jpg"           },
  sailpoint_spy:      { male: "sailpoint_spy_male.jpg",      female: "sailpoint_spy_female.jpg"      },
};

function loadScene(style, gender) {
  const map = SCENE_MAP[style] || SCENE_MAP.james_bond;
  const file = gender === "female" ? map.female : map.male;
  const filePath = path.join(process.cwd(), "scenes", file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Scene not found: scenes/${file}. Run generate-scenes.js first.`);
  }
  return fs.readFileSync(filePath).toString("base64");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64, style = "james_bond", gender = "male" } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });
  if (!process.env.SEGMIND_API_KEY) return res.status(500).json({ error: "SEGMIND_API_KEY not set in Vercel" });

  try {
    // Load the pre-generated scene from disk (no API call needed)
    const sceneBase64 = loadScene(style, gender);
    console.log(`Scene loaded: ${style} / ${gender}`);

    // Segmind FaceSwap v4 — swaps the user's face into the scene
    console.log("Calling Segmind FaceSwap v4...");
    const segmindRes = await fetch("https://api.segmind.com/v1/faceswap-v4", {
      method: "POST",
      headers: {
        "x-api-key": process.env.SEGMIND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_image: imageBase64,   // user's photo (face to insert)
        target_image: sceneBase64,   // spy background scene
        model_type: "quality",       // best quality
        swap_type: "head",           // preserves hair from user photo
        style_type: "normal",
        seed: 42,
        image_format: "jpg",
        image_quality: 95,
      }),
    });

    const contentType = segmindRes.headers.get("content-type") || "";
    console.log(`Segmind: ${segmindRes.status} / ${contentType}`);

    if (!segmindRes.ok) {
      const errText = await segmindRes.text();
      if (segmindRes.status === 401 || segmindRes.status === 403) {
        throw new Error("Segmind API key inválida. Verifica SEGMIND_API_KEY en Vercel.");
      }
      if (segmindRes.status === 402) {
        throw new Error("Sin créditos en Segmind. Recarga en segmind.com/dashboard.");
      }
      throw new Error(`Segmind error ${segmindRes.status}: ${errText.slice(0, 300)}`);
    }

    // Segmind returns raw binary JPEG
    const imageBuffer = await segmindRes.arrayBuffer();
    const resultBase64 = Buffer.from(imageBuffer).toString("base64");
    const imageUrl = `data:image/jpeg;base64,${resultBase64}`;

    console.log(`Done. Image: ${Math.round(imageBuffer.byteLength / 1024)}KB`);
    return res.status(200).json({ imageUrl });

  } catch (err) {
    console.error("Error:", err.message);
    return res.status(500).json({ error: err.message || "Error generating image" });
  }
}
