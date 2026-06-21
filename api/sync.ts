export default async function handler(req: any, res: any) {
  // Allow only POST requests matching our app protocol
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Only POST requests are allowed" });
  }

  const { payload } = req.body || {};
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  
  if (!url) {
    return res.status(500).json({ 
      error: "MISSING_ENV", 
      message: "GOOGLE_APPS_SCRIPT_URL environment variable is not configured. Please define it in your Vercel Dashboard settings." 
    });
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Google Sheets proxy request failed with status ${response.status}`);
    }

    const result = await response.json();
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Vercel Serverless Error - Syncing data failed:", error);
    return res.status(500).json({ error: "SYNC_FAILED", message: error.message || "Unknown error" });
  }
}
