export default async function handler(req: any, res: any) {
  // Allow only POST requests matching our app protocol
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Only POST requests are allowed" });
  }

  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!url) {
    return res.status(500).json({ 
      error: "MISSING_ENV", 
      message: "GOOGLE_APPS_SCRIPT_URL environment variable is not configured. Please define it in your Vercel Dashboard settings." 
    });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Google Sheets proxy request failed with status ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("Vercel Serverless Error - Fetching data failed:", error);
    return res.status(500).json({ error: "FETCH_FAILED", message: error.message || "Unknown error" });
  }
}
