
import { GoogleGenAI, Type, Content } from "@google/genai";
import { AISettings } from "../types";

// Helper to get settings from local storage
const getSettings = (): AISettings => {
  const saved = localStorage.getItem('clawreader_ai_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Ensure we have valid structure even if partially saved
      return {
        provider: parsed.provider || 'google',
        apiKey: parsed.apiKey || '',
        baseUrl: parsed.baseUrl || 'https://generativelanguage.googleapis.com',
        model: parsed.model || 'gemini-3-flash-preview'
      };
    } catch (e) {
      console.error("Error parsing AI settings", e);
    }
  }
  return { 
    provider: 'google', 
    apiKey: '', 
    baseUrl: 'https://generativelanguage.googleapis.com', 
    model: 'gemini-3-flash-preview' 
  };
};

// Generic OpenAI-compatible fetcher
const openaiFetch = async (settings: AISettings, messages: any[], jsonMode: boolean = false) => {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) throw new Error("API Key is missing for custom provider.");

  // 1. Clean URL: Handle potential query parameters
  let endpoint = settings.baseUrl.trim();
  if (!endpoint.includes('?')) {
     endpoint = endpoint.replace(/\/+$/, '');
  }
  if (!endpoint.includes('/chat/completions')) {
      if (endpoint.includes('?')) {
          const [base, query] = endpoint.split('?');
          endpoint = `${base.replace(/\/+$/, '')}/chat/completions?${query}`;
      } else {
          endpoint = `${endpoint}/chat/completions`;
      }
  }

  const payload: any = {
    model: settings.model.trim(),
    messages: messages,
    stream: false,
  };

  const knownJsonProviders = ['openai.com', 'deepseek.com', 'openrouter.ai', 'moonshot.cn', 'siliconflow.cn', 'localhost', '127.0.0.1', 'kuaecloud'];
  const isKnownProvider = knownJsonProviders.some(domain => settings.baseUrl.includes(domain));

  if (jsonMode && isKnownProvider) {
    payload.response_format = { type: "json_object" };
  }

  // Minimal headers to avoid CORS preflight issues where possible
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 
    'Authorization': `Bearer ${apiKey}`,
  };

  if (settings.baseUrl.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = window.location.origin;
    headers['X-Title'] = 'ClawReader';
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // Increased timeout for long content

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      credentials: 'omit',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => "No error details");
      let errorMsg = `AI API Error (${response.status}): ${errText.slice(0, 300)}`;
      
      if (response.status === 404) errorMsg += " (Endpoint not found - Check Base URL)";
      if (response.status === 401) errorMsg += " (Invalid API Key)";
      if (response.status === 403) errorMsg += " (Forbidden - Check CORS/Permissions)";
      if (response.status === 405) errorMsg += " (Method Not Allowed - Check if URL is correct)";
      if (response.status === 413) errorMsg += " (Payload Too Large - The book content might be too long for this model)";
      
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";

  } catch (error: any) {
    if ((error instanceof TypeError && error.message.includes('Failed to fetch')) || error.name === 'AbortError') {
      console.error("CORS or Network Error details:", error);
      
      const isHttps = window.location.protocol === 'https:';
      const isHttpTarget = endpoint.startsWith('http:');

      let friendlyMsg = "Connection Failed (CORS/Network).";
      
      if (isHttps && isHttpTarget) {
         friendlyMsg = "Mixed Content Error: Cannot access insecure HTTP API from an HTTPS site.";
      } else if (settings.baseUrl.includes('localhost') || settings.baseUrl.includes('127.0.0.1')) {
         friendlyMsg = "Connection to Localhost failed. Ensure your local server allows CORS (e.g., OLLAMA_ORIGINS='*').";
      } else {
         friendlyMsg = `Failed to connect to ${endpoint}. Likely a CORS issue or server is offline.`;
      }
      
      throw new Error(friendlyMsg);
    }
    throw error;
  }
};

/**
 * Gets insights for a book.
 * @param title Book Title
 * @param author Book Author
 * @param query (Optional) specific question
 * @param contextText (Optional) The actual content of the book
 */
export const getBookInsights = async (title: string, author: string, query?: string, contextText?: string) => {
  const settings = getSettings();
  
  // Construct a prompt that includes the context if available
  let promptContext = "";
  if (contextText) {
    promptContext = `
    
    [BOOK CONTENT START]
    ${contextText}
    [BOOK CONTENT END]
    
    INSTRUCTION: Use the [BOOK CONTENT] provided above to answer. If the answer is not in the content, you may use your general knowledge but please mention that you are doing so.
    `;
  }

  // --- GOOGLE PROVIDER (Default) ---
  if (settings.provider === 'google') {
    try {
      const finalApiKey = settings.apiKey || process.env.API_KEY;
      if (!finalApiKey) throw new Error("No Google API Key configured.");

      const ai = new GoogleGenAI({ apiKey: finalApiKey });
      const model = ai.models.generateContent({
        model: settings.model, 
        contents: query 
          ? `Analysis Request for "${title}" by ${author}. ${promptContext} \n\n QUESTION: ${query}` 
          : `Provide a detailed summary and 3 key insights for the book "${title}" by ${author}. ${promptContext}`,
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
    } catch (error: any) {
       console.error("Google Gemini API Error:", error);
       if (error.message?.includes('fetch') || error.message?.includes('Network')) {
         throw new Error("Google API Network Error. VPN might be required.");
       }
       throw error;
    }
  } 
  
  // --- CUSTOM / OPENAI COMPATIBLE PROVIDER ---
  else {
    const systemPrompt = `You are Claw, an expert literary assistant. Analyzing "${title}" by ${author}. ${promptContext}`;
    
    let userContent = "";
    if (query) {
      userContent = `Answer this question based on the book content provided: ${query}`;
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ];
      return await openaiFetch(settings, messages, false);
    } else {
      userContent = `Provide a detailed summary and 3 key insights for the book based on the provided text. 
      RETURN ONLY RAW JSON. No markdown formatting.
      Required JSON Structure:
      {
        "summary": "string",
        "keyInsights": ["string", "string", "string"],
        "suggestedQuestions": ["string", "string", "string"]
      }`;
      
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ];
      
      return await openaiFetch(settings, messages, true);
    }
  }
};

/**
 * Chat with a book
 * @param title 
 * @param history 
 * @param contextText (Optional) The actual content
 */
export const chatWithBook = async (title: string, history: {role: 'user' | 'model', text: string}[], contextText?: string) => {
  const settings = getSettings();
  const previousMessages = history.slice(0, -1);
  const currentMessage = history[history.length - 1];

  let systemInstruction = `You are Claw, an AI Reading Assistant. You have expert knowledge of the book "${title}".`;
  
  if (contextText) {
    systemInstruction += `\n\n[BOOK CONTEXT]:\n${contextText}\n\nINSTRUCTION: Base your answers primarily on the [BOOK CONTEXT] provided above. Keep answers concise and insightful.`;
  } else {
    systemInstruction += ` Help the user understand deep themes, character motivations, and plot points.`;
  }

  // --- GOOGLE PROVIDER ---
  if (settings.provider === 'google') {
    try {
      const finalApiKey = settings.apiKey || process.env.API_KEY;
      if (!finalApiKey) throw new Error("No Google API Key configured.");

      const ai = new GoogleGenAI({ apiKey: finalApiKey });
      const formattedHistory: Content[] = previousMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const chat = ai.chats.create({
        model: settings.model,
        config: {
          systemInstruction: systemInstruction
        },
        history: formattedHistory
      });

      const result = await chat.sendMessage({ message: currentMessage.text });
      return result.text;
    } catch (error: any) {
       console.error("Google Chat API Error:", error);
       if (error.message?.includes('fetch') || error.message?.includes('Network')) {
         throw new Error("Google API Connection Failed. Check network/VPN.");
       }
       throw error;
    }
  }
  
  // --- CUSTOM / OPENAI COMPATIBLE PROVIDER ---
  else {
    const apiMessages = [
      { role: "system", content: systemInstruction },
      ...history.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text
      }))
    ];

    return await openaiFetch(settings, apiMessages, false);
  }
};
