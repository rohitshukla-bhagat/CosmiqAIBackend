import { Request, Response } from "express";
import { GoogleGenAI } from '@google/genai';
import generateWithFallback from "./geminiAPICallback";

export const handleChat = async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const systemPrompt = `You are CosmiqAI-V4, an AI assistant dedicated solely to the topics of astronomy, astrophysics, space exploration, and the universe. 
Your primary rule: NEVER answer questions or provide information outside of these topics. If a user asks about anything else, politely decline and steer the conversation back to space.
Format your responses using HTML tags (like <p>, <strong>, <ul>, <li>) as your output will be directly injected into a web page. Do not include markdown code block syntax like \`\`\`html. Just return the raw HTML string. Keep the response concise but informative.`;

    const fullPrompt = `${systemPrompt}\n\nUser Query: ${message}`;

    const response = await generateWithFallback({
      model: "gemini-2.5-flash",
      contents: fullPrompt,
    });

    let text = response.text || "I am currently unable to access the cosmic archives. Please try again later.";
    text = text.replace(/^```(html)?\n?/, '').replace(/\n?```$/, '').trim();

    return res.status(200).json({ response: text });
  } catch (error: any) {
    console.error("Chat Error:", error);
    return res.status(500).json({ message: error.message || "Failed to process chat query" });
  }
};
