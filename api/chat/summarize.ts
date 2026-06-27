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
    return res.status(400).json({ error: "No messages to summarize" });
  }

  try {
    const ai = getAiClient();
    const chatLogs = messages.map((m: any) => `[${m.senderName || "Unknown"}]: ${m.messageText}`).join("\n");
    const prompt = `You are ProContractor's construction project coordinator. Analyze this team dispatch & support chat log and provide a concise, high-level, bulleted summary of key decisions, active worksite issues, or dispatch updates. Keep it professional, clear, and very brief. Do not invent any facts:\n\n${chatLogs}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt
    });

    return res.json({ success: true, summary: response.text });
  } catch (error: any) {
    console.error("Chat summarize error:", error);
    return res.status(500).json({ error: "SUMMARIZATION_FAILED", message: error.message });
  }
}
