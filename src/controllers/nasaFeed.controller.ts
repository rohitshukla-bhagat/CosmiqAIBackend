import { Request, Response } from "express";
import { GoogleGenAI } from '@google/genai';
import generateWithFallback from "./geminiAPICallback";

interface ApodItem {
  date: string;
  title: string;
  url: string;
  credit: string;
  explanation: string;
  nasaDescription: string;
  tags: string[];
}

let cachedApodData: ApodItem[] = [];
let lastFetchDate: string = "";
let isFetching: boolean = false;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const getNasaFeed = async (req: Request, res: Response): Promise<any> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Serve from cache if available and not stale
    if (lastFetchDate === today && cachedApodData.length > 0) {
      return res.status(200).json(cachedApodData);
    }

    // Basic lock to prevent multiple concurrent fetches over-hitting APIs
    while (isFetching) {
      await delay(100);
      if (lastFetchDate === today && cachedApodData.length > 0) {
        return res.status(200).json(cachedApodData);
      }
    }

    isFetching = true;

    const nasaApiKey = process.env.NASA_API_KEY;
    if (!nasaApiKey) {
      throw new Error("NASA_API_KEY is not configured on the server");
    }

    // Calculate start and end date for the past 15 days
    const endDateObj = new Date();
    const startDateObj = new Date();
    startDateObj.setDate(endDateObj.getDate() - 15);

    const endDateStr = endDateObj.toISOString().split('T')[0];
    const startDateStr = startDateObj.toISOString().split('T')[0];

    // Fetch from NASA APOD
    const nasaResponse = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${nasaApiKey}&start_date=${startDateStr}&end_date=${endDateStr}`);
    
    if (!nasaResponse.ok) {
      throw new Error(`NASA API responded with status ${nasaResponse.status}`);
    }

    const nasaData: any[] = await nasaResponse.json();

    // Filter images, sort descending by date, and take the latest 11
    const imagesOnly = nasaData.filter(item => item.media_type === 'image');
    imagesOnly.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const top11 = imagesOnly.slice(0, 11);

    // Only prepare the first image (latest) for Gemini explanation
    const latestItem = top11[0];
    console.log("Fetching gemini api.....");

    const prompt = `I will provide an astronomical image title and NASA description.
Generate a short, engaging 10-11 sentence AI explanation (in the perspective of an AI astronomer) and exactly 3 short tags.
Return the result strictly as a valid JSON object, and NO markdown formatting or backticks.
Schema for the object:
{
  "explanation": "Engaging AI explanation",
  "tags": ["Tag1", "Tag2", "Tag3"]
}

Title: ${latestItem.title}
NASA Description: ${latestItem.explanation}
`;

    const response = await generateWithFallback({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }]
    }
  ],
  config: {
    responseMimeType: "application/json"
  }
});
    console.log("Gemini api fetch completed.");

    let text = response.text || "{}";
    text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    console.log("Gemini api fetch completed.");
    
    const geminiData = JSON.parse(text);

    // Merge data
    const finalData: ApodItem[] = top11.map((item, idx) => {
      // Provide explanation only for the first item, others will be empty until clicked
      const explanation = idx === 0 ? geminiData.explanation : "";
      const tags = idx === 0 ? geminiData.tags : [];
      
      return {
        date: item.date,
        title: item.title,
        url: item.hdurl || item.url, // Prefer hdurl if available
        credit: item.copyright ? `NASA, ESA, CSA; Credit: ${item.copyright.trim()}` : "NASA APOD",
        explanation: explanation,
        nasaDescription: item.explanation,
        tags: tags
      };
    });

    cachedApodData = finalData;
    lastFetchDate = today;
    isFetching = false;

    return res.status(200).json(cachedApodData);

  } catch (error: any) {
    isFetching = false;
    console.error("Nasa Feed Error:", error);
    
    if (cachedApodData.length > 0) {
      console.log("Serving stale cache due to fetch error");
      return res.status(200).json(cachedApodData);
    }
    
    return res.status(500).json({ message: error.message || "Failed to fetch NASA feed" });
  }
};

export const explainNasaImage = async (req: Request, res: Response): Promise<any> => {
  try {
    const { date, title, nasaDescription } = req.body;
    
    if (!date || !title || !nasaDescription) {
      return res.status(400).json({ message: "Missing required fields: date, title, nasaDescription" });
    }

    // If it's already in the cache with an explanation, return it directly
    const cachedItem = cachedApodData.find(item => item.date === date);
    if (cachedItem && cachedItem.explanation) {
      return res.status(200).json({
        explanation: cachedItem.explanation,
        tags: cachedItem.tags
      });
    }

    const prompt = `I will provide an astronomical image title and NASA description.
Generate a short, engaging 1-2 sentence AI explanation (in the perspective of an AI astronomer) and exactly 3 short tags.
Return the result strictly as a valid JSON object, and NO markdown formatting or backticks.
Schema for the object:
{
  "explanation": "Engaging AI explanation",
  "tags": ["Tag1", "Tag2", "Tag3"]
}

Title: ${title}
NASA Description: ${nasaDescription}
`;

   const response = await generateWithFallback({
  model: "gemini-2.5-flash",
  contents: [
    {
      role: "user",
      parts: [{ text: prompt }]
    }
  ],
  config: {
    responseMimeType: "application/json"
  }
});

    let text = response.text || "{}";
    text = text.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    
    const geminiData = JSON.parse(text);

    // Update the cached item if it exists
    if (cachedItem) {
      cachedItem.explanation = geminiData.explanation;
      cachedItem.tags = geminiData.tags;
    }

    return res.status(200).json({
      explanation: geminiData.explanation,
      tags: geminiData.tags
    });

  } catch (error: any) {
    console.error("Explain Nasa Image Error:", error);
    return res.status(500).json({ message: error.message || "Failed to generate AI explanation" });
  }
};
