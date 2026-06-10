import { Request, Response } from "express";
import { GoogleGenAI } from '@google/genai';
import generateWithFallback from './geminiAPICallback';

export const analyzeSky = async (req: Request, res: Response) => {
  try {
    const { base64Image, mimeType } = req.body;

    if (!base64Image || !mimeType) {
      return res.status(400).json({ message: "Image data is required" });
    }

    const prompt = `Analyze this astronomical image and identify the primary celestial body or phenomenon shown. Return the result strictly as a valid JSON object with the following schema, and no markdown formatting or backticks:
{
  "title": "Short name of the object (e.g. The Moon, Orion Nebula, Saturn)",
  "subtitle": "A brief, all-caps subtitle (e.g. LUNA • EARTH'S SATELLITE)",
  "matchPercentage": "Estimated confidence or match percentage (e.g. 98%)",
  "infoGrid": [
    {
      "icon": "material symbol name (e.g. distance, schedule, visibility, landscape, hub, flare)",
      "label": "Short label (e.g. Distance, Age, Visibility)",
      "value": "Short value (e.g. 384,400 km, 4.5B years)"
    }
  ],
  "description": "A detailed 2-3 sentence description of the image, the identified objects, and prominent features.",
  "insights": [
    "Fascinating fact 1",
    "Fascinating fact 2",
    "Fascinating fact 3"
  ]
}
Ensure exactly 4 items in infoGrid, and exactly 3 items in insights. Return ONLY raw JSON string.`;

    const response = await generateWithFallback ({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [
        { text: prompt },
        {
          inlineData: {
            data: base64Image,
            mimeType,
          },
        },
      ],
    },
  ],
  config: {
    responseMimeType: "application/json",
  },
});

    let text = response.text || "{}";
    text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();

    const result = JSON.parse(text);
    return res.status(200).json(result);

  } catch (error: any) {
    console.error("Analysis Error:", error);
    return res.status(500).json({ message: error.message || "Failed to analyze image" });
  }
};