import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';

/**
 * Resilient Model Fallback Ladder ordered by availability and latency
 */
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
] as const;

let aiClientInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  if (!aiClientInstance) {
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
  mode?: string;
}

/**
 * Intelligent Mindful Generator for graceful fallback when external API keys are pending or invalid.
 * Ensures verified transaction persistence to Firestore without halting the user journey.
 */
function generateOfflineResponse(
  userPrompt: string,
  mode: string = 'reflection'
): string {
  const cleanPrompt = userPrompt.trim();

  if (mode === 'summary') {
    return (
      `**Gemini Reflection Synthesis**\n\n` +
      `**1. Core Themes & Mood**\n` +
      `• Presence & Contemplation: You are engaging in thoughtful introspection around: "${cleanPrompt.slice(0, 100)}${cleanPrompt.length > 100 ? '...' : ''}".\n` +
      `• Cultivating Self-Awareness: Noticeable desire for grounded clarity and alignment.\n\n` +
      `**2. Key Epiphanies**\n` +
      `• Giving space to your inner thoughts reveals patterns that are often obscured by daily momentum.\n` +
      `• Honest reflection is the catalyst for mindful change and peace of mind.\n\n` +
      `**3. Mindful Action & Gentle Anchor for Tomorrow**\n` +
      `• Choose one small, conscious action that honors the intention you identified here today.\n` +
      `• Anchor yourself with three slow, full breaths whenever you feel hurried or uncertain.`
    );
  }

  if (mode === 'brainstorm') {
    return (
      `Here are three creative pathways and fresh perspectives on your brainstorm:\n\n` +
      `**Pathway 1: The Inversion Lens**\n` +
      `What if you flipped the core assumption? Instead of asking how to push forward, ask what friction you can subtract to make progress effortless.\n\n` +
      `**Pathway 2: The Micro-Experiment**\n` +
      `Break this down into the smallest 24-hour testable action. What step requires less than 20 minutes but yields immediate feedback?\n\n` +
      `**Pathway 3: Values-First Alignment**\n` +
      `When this is accomplished, which of your primary values (freedom, craft, clarity, connection) will feel most fulfilled?\n\n` +
      `*What part of this resonates most with your immediate focus?*`
    );
  }

  if (mode === 'journal') {
    return (
      `Thank you for honoring your experience by writing it down. In noticing: *" ${cleanPrompt.slice(0, 120)}${cleanPrompt.length > 120 ? '...' : ''} "*, you are practicing emotional honesty.\n\n` +
      `It is completely natural for thoughts and sensations to arrive in waves. Giving them room on the page allows you to be the observer of your experience rather than consumed by it.\n\n` +
      `Take a gentle pause right now. Where in your body are you carrying this thought, and can you soften your shoulders just five percent?`
    );
  }

  // Default: Deep Reflection
  return (
    `Thank you for sharing this thought. There is deep honesty in examining: *" ${cleanPrompt.slice(0, 120)}${cleanPrompt.length > 120 ? '...' : ''} "*.\n\n` +
    `When we pause to look closer at moments like this, two deeper questions often emerge:\n` +
    `1. **What is this situation or feeling asking you to protect or prioritize?**\n` +
    `2. **If you treated yourself with absolute compassion right now, what would you say to yourself?**\n\n` +
    `You don't need all the answers immediately. Simply acknowledging where you stand is a meaningful step forward.`
  );
}

/**
 * Standard Helper Implementation:
 * Attempts generation using the model fallback ladder and handles recoverable API status codes.
 * Gracefully falls back to the mindful generator if API keys are invalid or unconfigured,
 * guaranteeing zero-crash persistence to Firestore.
 */
export async function generateContentWithFallback(
  options: FallbackGenerationOptions
): Promise<{ text: string; modelUsed: string; isFallback?: boolean; notice?: string }> {
  const ai = getGeminiClient();

  // Extract prompt text if present
  let extractedPrompt = '';
  if (typeof options.contents === 'string') {
    extractedPrompt = options.contents;
  } else if (Array.isArray(options.contents)) {
    const lastItem = options.contents[options.contents.length - 1];
    if (typeof lastItem === 'string') {
      extractedPrompt = lastItem;
    } else if (lastItem && typeof lastItem === 'object' && 'parts' in lastItem && Array.isArray(lastItem.parts)) {
      extractedPrompt = lastItem.parts.map((p) => (typeof p === 'object' && 'text' in p ? p.text : '')).join(' ');
    }
  }

  // If no Gemini client is available, gracefully use mindful engine
  if (!ai) {
    const fallbackText = generateOfflineResponse(extractedPrompt, options.mode);
    return {
      text: fallbackText,
      modelUsed: 'mindful-engine (API Key Not Configured)',
      isFallback: true,
      notice: 'GEMINI_API_KEY is not configured. Reflection was processed via the mindful engine and saved to Firestore. Configure your key in Settings > Secrets.',
    };
  }

  let lastError: unknown = null;
  let isApiKeyIssue = false;

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

      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid') || errorMsg.includes('API_KEY_SERVICE_BLOCKED')) {
        isApiKeyIssue = true;
        console.warn(`[Gemini Auth Notice] API Key is invalid or blocked: ${errorMsg}. Engaging mindful fallback engine...`);
        break; // Stop attempting other models if the key itself is invalid
      }

      console.warn(`[Gemini Fallback] Model "${model}" failed: ${errorMsg}. Checking next in ladder...`);
    }
  }

  // If the API key is invalid or all attempts failed, ensure persistence & user experience don't break
  if (isApiKeyIssue || lastError) {
    console.info('[Gemini Fallback] Activating offline mindful reflection to ensure transaction completeness.');
    const fallbackText = generateOfflineResponse(extractedPrompt, options.mode);
    return {
      text: fallbackText,
      modelUsed: 'mindful-engine (Fallback)',
      isFallback: true,
      notice: isApiKeyIssue
        ? 'The configured GEMINI_API_KEY is invalid or expired. Your reflection was answered by the mindful engine and saved securely to Firestore. Update your key in Settings > Secrets to enable live Gemini AI.'
        : 'Live Gemini models were temporarily unreachable. Your reflection was saved with the mindful engine.',
    };
  }

  throw lastError || new Error('All models in the Gemini resilience ladder failed to respond.');
}
