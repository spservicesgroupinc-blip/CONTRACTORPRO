import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    aiClient = new GoogleGenAI({
      apiKey: key || "",
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });
  }
  return aiClient;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "No messages to draft a reply for" });
  }

  try {
    const ai = getAiClient();
    const lastMessages = messages.slice(-8);
    const chatLogs = lastMessages.map((m: any) => `[${m.senderName || "Unknown"}]: ${m.messageText}`).join("\n");
    const prompt = `You are a helpful construction project coordinator and dispatch support assistant. Based on this active team chat dialogue, draft a single, extremely professional, concise (maximum 1-2 sentences), helpful, and direct auto-reply on behalf of the user. Focus on resolving the concern, confirming the status, or scheduling. Keep it humble, human-like, and highly context-aware. Return ONLY the reply text, with no wrapping quotes:\n\n${chatLogs}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    return res.json({ success: true, reply: response.text?.trim() });
  } catch (error: any) {
    console.error("Chat auto-reply error:", error);
    return res.status(500).json({ error: "AUTO_REPLY_FAILED", message: error.message });
  }
}
