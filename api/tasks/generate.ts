import { GoogleGenAI, Type } from "@google/genai";

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

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { audio, mimeType, text } = req.body;

  if (!audio && !text) {
    return res.status(400).json({ error: "MISSING_INPUT", message: "No audio or text provided." });
  }

  try {
    const ai = getAiClient();
    const parts: any[] = [];

    if (audio) parts.push({ inlineData: { mimeType: mimeType || "audio/webm", data: audio } });
    if (text) parts.push({ text: `Contractor's raw text notes or raw voice transcript: "${text}"` });

    parts.push({
      text: "You are an expert construction project engineer and task organiser. Analyze this raw recorded speech or text where a contractor is walking around a jobsite talking about work that needs to be done. Extract logical, realistic, clear, actionable physical tasks to perform. For each task, assign an appropriate priority level ('high', 'medium', or 'low') and a relevant construction trade category (e.g. Plumbing, Electrical, Cleanup, Safety, Framing, HVAC, Painting, Inspection, Carpentry). Filter out background chat, greetings, or conversational filler."
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: parts,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low"] },
                  category: { type: Type.STRING }
                },
                required: ["title", "priority", "category"]
              }
            }
          },
          required: ["tasks"]
        }
      }
    });

    let extractedText = response.text || "";
    extractedText = extractedText.trim();
    if (extractedText.startsWith("```json")) extractedText = extractedText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    else if (extractedText.startsWith("```")) extractedText = extractedText.replace(/^```\n?/, "").replace(/\n?```$/, "");

    const result = JSON.parse(extractedText.trim());
    return res.json({ success: true, tasks: result.tasks || [] });

  } catch (error: any) {
    console.error("Task generation error:", error);
    return res.status(500).json({ error: "AI_GENERATION_FAILED", message: error.message });
  }
}
