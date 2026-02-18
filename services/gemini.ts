import { GoogleGenAI, Type, Content } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getBookInsights = async (title: string, author: string, query?: string) => {
  const model = ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: query 
      ? `Based on the book "${title}" by ${author}, please answer: ${query}` 
      : `Provide a detailed summary and 3 key insights for the book "${title}" by ${author}.`,
    config: {
      responseMimeType: query ? "text/plain" : "application/json",
      responseSchema: query ? undefined : {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyInsights: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          suggestedQuestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["summary", "keyInsights", "suggestedQuestions"]
      }
    }
  });

  const response = await model;
  return response.text;
};

export const chatWithBook = async (title: string, history: {role: 'user' | 'model', text: string}[]) => {
  // We need to separate the history (context) from the new message (trigger)
  const previousMessages = history.slice(0, -1);
  const currentMessage = history[history.length - 1];

  // Map application history format to Gemini API format
  const formattedHistory: Content[] = previousMessages.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.text }]
  }));

  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: `You are Claw, an AI Reading Assistant. You have expert knowledge of the book "${title}". Help the user understand deep themes, character motivations, and plot points. Keep answers concise and insightful.`
    },
    history: formattedHistory
  });

  const result = await chat.sendMessage({ message: currentMessage.text });
  return result.text;
};