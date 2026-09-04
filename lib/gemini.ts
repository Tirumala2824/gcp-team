import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

/**
 * Resilient Model Fallback Ladder ordered by availability and latency
 */
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

let aiClientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiClientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured.');
    }
    aiClientInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClientInstance;
}

export interface FallbackGenerationOptions {
  contents: GenerateContentParameters['contents'];
  config?: GenerateContentParameters['config'];
}

/**
 * Standard Helper Implementation:
 * Attempts generation using the model fallback ladder and handles recoverable API status codes.
 */
export async function generateContentWithFallback(
  options: FallbackGenerationOptions
): Promise<{ text: string; modelUsed: string }> {
  const ai = getGeminiClient();
  let lastError: unknown = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const text = response.text;
      if (text !== undefined && text !== null) {
        return { text, modelUsed: model };
      }
    } catch (err: unknown) {
      lastError = err;
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini Fallback] Model "${model}" failed: ${errorMsg}. Checking fallback ladder...`);
    }
  }

  throw lastError || new Error('All models in the Gemini resilience ladder failed to respond.');
}
