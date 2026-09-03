import { GoogleGenAI } from "@google/genai";

const MODELS = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"] as const;

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    _ai = new GoogleGenAI({ apiKey });
  }
  return _ai;
}

export async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: unknown = null;

  for (const model of MODELS) {
    try {
      const response = await getAI().models.generateContent({
        model,
        contents: prompt,
      });
      const text = response.text;
      if (typeof text === "string" && text.trim().length > 0) {
        return text;
      }
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status: number }).status
          : undefined;
      if (status === 429 || status === 503 || status === 500) {
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `All Gemini models failed. Last error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
