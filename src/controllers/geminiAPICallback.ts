import { GoogleGenAI } from "@google/genai";

export default async function generateWithFallback(requestBody: any) {
  const apiKeys = [
    process.env.GEMINI_API_KEY1,
    process.env.GEMINI_API_KEY2,
    process.env.GEMINI_API_KEY3,
  ].filter(Boolean);

  let lastError: any;
  

  for (const apiKey of apiKeys) {
    try {

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent(requestBody);

      console.log("Gemini request successful");
      return response;

    } catch (err: any) {
      console.log("Gemini key failed:", err?.status || err?.message);

      lastError = err;

      if (
        err?.status === 429 ||
        err?.status === 503
      ) {
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}