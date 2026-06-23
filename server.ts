import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not defined!");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}

// Manually load environment variables from .env and .env.local files
function loadEnvFiles() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    try {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        content.split(/\r?\n/).forEach((line) => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const index = trimmed.indexOf("=");
            if (index > -1) {
              const key = trimmed.substring(0, index).trim();
              let val = trimmed.substring(index + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.substring(1, val.length - 1);
              }
              // Set the value (override or keep existing depending on preference, system defaults should be kept)
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        });
      }
    } catch (err) {
      console.error(`Error loading env file ${file}:`, err);
    }
  }
}
loadEnvFiles();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON with increased limit for audio
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoint: Generate tasks with AI from voice recordings or transcripts
  app.post("/api/tasks/generate", async (req, res) => {
    const { audio, mimeType, text } = req.body;

    if (!audio && !text) {
      return res.status(400).json({ 
        error: "MISSING_INPUT", 
        message: "No audio recording or fallback text notes were provided to process." 
      });
    }

    try {
      const ai = getAiClient();
      const parts: any[] = [];

      if (audio) {
        parts.push({
          inlineData: {
            mimeType: mimeType || "audio/webm",
            data: audio
          }
        });
      }

      if (text) {
        parts.push({
          text: `Contractor's raw text notes or raw voice transcript: "${text}"`
        });
      }

      // Add project-management guidance prompt
      parts.push({
        text: "You are an expert construction project engineer and task organiser. Analyze this raw recorded speech or text where a contractor is walking around a jobsite talking about work that needs to be done. Extract logical, realistic, clear, actionable physical tasks to perform. For each task, assign an appropriate priority level ('high', 'medium', or 'low') and a relevant construction trade category (e.g. Plumbing, Electrical, Cleanup, Safety, Framing, HVAC, Painting, Inspection, Carpentry). Filter out background chat, greetings, or conversational filler."
      });

      console.log("Calling Gemini API task extractor (gemini-3.5-flash) with options...");
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
                    title: { type: Type.STRING, description: "Actionable, clear name of the specific jobsite task. E.g., 'Fix loose wiring', 'Clean up debris near entry', 'Inspect HVAC ductwork'" },
                    priority: { type: Type.STRING, description: "Priority rating of the task", enum: ["high", "medium", "low"] },
                    category: { type: Type.STRING, description: "The specific trade or work classification", enum: ["Plumbing", "Electrical", "Cleanup", "Safety", "Framing", "HVAC", "Painting", "Inspection", "Carpentry", "General"] }
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
      if (!extractedText) {
        throw new Error("No response text received from the Gemini model.");
      }

      // Remove markdown backticks if present
      extractedText = extractedText.trim();
      if (extractedText.startsWith("```json")) {
        extractedText = extractedText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (extractedText.startsWith("```")) {
        extractedText = extractedText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      let result;
      try {
        result = JSON.parse(extractedText.trim());
      } catch (parseErr) {
        console.error("JSON parse error. Raw text was:", extractedText);
        throw new Error("Failed to parse AI response as JSON.");
      }

      return res.json({ success: true, tasks: result.tasks || [] });

    } catch (error: any) {
      console.error("Gemini task extraction endpoint error:", error);
      return res.status(500).json({ 
        error: "AI_GENERATION_FAILED", 
        message: error.message || "An error occurred while calling the Gemini API." 
      });
    }
  });

  // API endpoint: Summarize chat messages
  app.post("/api/chat/summarize", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages to summarize" });
    }

    try {
      const ai = getAiClient();
      const chatLogs = messages
        .map((m: any) => `[${m.senderName || "Unknown"}]: ${m.messageText}`)
        .join("\n");

      const prompt = `You are ProContractor's construction project coordinator. Analyze this team dispatch & support chat log and provide a concise, high-level, bulleted summary of key decisions, active worksite issues, or dispatch updates. Keep it professional, clear, and very brief. Do not invent any facts:\n\n${chatLogs}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      return res.json({ success: true, summary: response.text });
    } catch (error: any) {
      console.error("Gemini chat summary error:", error);
      return res.status(500).json({ 
        error: "SUMMARIZATION_FAILED", 
        message: error.message || "An error occurred during summarization." 
      });
    }
  });

  // API endpoint: Generate auto-reply drafts based on recent chat context
  app.post("/api/chat/reply", async (req, res) => {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "No messages to draft a reply for" });
    }

    try {
      const ai = getAiClient();
      const lastMessages = messages.slice(-8); // take the last 8 messages for context
      const chatLogs = lastMessages
        .map((m: any) => `[${m.senderName || "Unknown"}]: ${m.messageText}`)
        .join("\n");

      const prompt = `You are a helpful construction project coordinator and dispatch support assistant. Based on this active team chat dialogue, draft a single, extremely professional, concise (maximum 1-2 sentences), helpful, and direct auto-reply on behalf of the user. Focus on resolving the concern, confirming the status, or scheduling. Keep it humble, human-like, and highly context-aware. Return ONLY the reply text, with no wrapping quotes:\n\n${chatLogs}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      return res.json({ success: true, reply: response.text?.trim() });
    } catch (error: any) {
      console.error("Gemini chat auto-reply error:", error);
      return res.status(500).json({ 
        error: "AUTO_REPLY_FAILED", 
        message: error.message || "An error occurred while calling the Gemini API." 
      });
    }
  });

  // API proxy endpoint: Get database state
  app.post("/api/data", async (req, res) => {
    const url = process.env.GOOGLE_APPS_SCRIPT_URL;
    if (!url) {
      return res.status(500).json({ error: "MISSING_ENV", message: "Google Apps Script URL not configured" });
    }

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      return res.json(data);
    } catch (error: any) {
      console.error("Error fetching data:", error);
      return res.status(500).json({ error: "FETCH_FAILED" });
    }
  });

  // API proxy endpoint: Sync local state with database
  app.post("/api/sync", async (req, res) => {
    const { payload } = req.body;
    const url = process.env.GOOGLE_APPS_SCRIPT_URL;
    
    if (!url) {
      return res.status(500).json({ error: "MISSING_ENV", message: "Google Apps Script URL not configured" });
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Status ${response.status}`);
      const result = await response.json();
      return res.json(result);
    } catch (error: any) {
      console.error("Error syncing data:", error);
      return res.status(500).json({ error: "SYNC_FAILED" });
    }
  });

  // Integration of Vite Dev Server/Static File Serving
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // Express v5 uses '*all' instead of '*'
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
