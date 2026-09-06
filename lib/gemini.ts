import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { RegionOption } from './types';

/**
 * Supported Google Cloud and Gemini regions
 */
export const SUPPORTED_REGIONS: RegionOption[] = [
  {
    id: 'us-central1',
    name: 'US Central (Iowa)',
    description: 'Primary Google Cloud region for Gemini with highest quota and model availability',
    recommended: true,
  },
  {
    id: 'us-east4',
    name: 'US East (N. Virginia)',
    description: 'Alternative US regional cluster with high throughput',
  },
  {
    id: 'europe-west1',
    name: 'Europe West (Belgium)',
    description: 'European multi-cluster deployment with EU compliance',
  },
  {
    id: 'asia-southeast1',
    name: 'Asia Southeast (Singapore)',
    description: 'Asia-Pacific regional edge deployment',
  },
];

/**
 * Resilient Model Fallback Ladder ordered by availability and latency
 */
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

let aiClientInstance: GoogleGenAI | null = null;
let currentClientRegion: string | null = null;

export function getGeminiClient(region?: string): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  const targetRegion = region || process.env.GEMINI_REGION || 'us-central1';

  // If using Vertex AI mode with GCP project credentials
  if (process.env.GEMINI_USE_VERTEX === 'true' && (process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT)) {
    if (!aiClientInstance || currentClientRegion !== targetRegion) {
      currentClientRegion = targetRegion;
      aiClientInstance = new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT,
        location: targetRegion,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClientInstance;
  }

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  if (!aiClientInstance || currentClientRegion !== targetRegion) {
    currentClientRegion = targetRegion;
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
  region?: string;
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

  if (mode === 'mirror') {
    return (
      `### 1. The Temporal Echo (Recurring Patterns)\n` +
      `Your current reflection re-engages a recurring theme: balancing the urge for immediate resolution against the discomfort of ambiguity. You are revisiting an internal demand for absolute certainty before committing to action—a pattern documented across previous turning points.\n\n` +
      `### 2. Blind Spots & Cognitive Traps\n` +
      `You are conflating temporary emotional discomfort with a lack of strategic competence. The underlying assumption here is that hesitation signals that something is fundamentally wrong with your path, rather than recognizing that hesitation is an unavoidable friction inherent in genuine growth.\n\n` +
      `### 3. The Growth Ledger (Then vs. Now)\n` +
      `Compared to earlier entries where distress often triggered paralysis or impulsive course-correction, today you are actively articulating the tension in writing. You have moved from reactivity to structured witness. The impulse to catastrophize has shifted toward an analytical assessment of what you can control.\n\n` +
      `### 4. The Forward Catalyst\n` +
      `What decision are you attempting to solve with more thinking that can only actually be resolved through committed action?`
    );
  }

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
): Promise<{ text: string; modelUsed: string; isFallback?: boolean; notice?: string; region?: string }> {
  const targetRegion = options.region || process.env.GEMINI_REGION || 'us-central1';
  const ai = getGeminiClient(targetRegion);

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
      region: targetRegion,
      notice: `GEMINI_API_KEY is not configured for region [${targetRegion}]. Reflection was processed via the mindful engine and saved to Firestore. Configure your key in Settings > Secrets.`,
    };
  }

  let lastError: unknown = null;
  let isApiKeyIssue = false;
  let isQuotaOrCreditsIssue = false;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const text = response.text;
      if (text !== undefined && text !== null) {
        return { text, modelUsed: model, region: targetRegion };
      }
    } catch (err: unknown) {
      lastError = err;
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid') || errorMsg.includes('API_KEY_SERVICE_BLOCKED')) {
        isApiKeyIssue = true;
        console.warn(`[Gemini Auth Notice] API Key is invalid or blocked: ${errorMsg}. Engaging mindful fallback engine...`);
        break;
      }

      if (
        errorMsg.includes('429') ||
        errorMsg.includes('RESOURCE_EXHAUSTED') ||
        errorMsg.includes('prepayment credits are depleted') ||
        errorMsg.includes('quota')
      ) {
        isQuotaOrCreditsIssue = true;
        console.warn(`[Gemini Quota Notice] Region [${targetRegion}] returned 429 quota/credits depleted: ${errorMsg}.`);
      }

      console.warn(`[Gemini Fallback] Model "${model}" in region "${targetRegion}" failed: ${errorMsg}. Checking next in ladder...`);
    }
  }

  // If the API key is invalid, quota is depleted, or all attempts failed, ensure persistence & user experience don't break
  if (isApiKeyIssue || isQuotaOrCreditsIssue || lastError) {
    console.info(`[Gemini Fallback] Activating offline mindful reflection for region [${targetRegion}] to ensure transaction completeness.`);
    const fallbackText = generateOfflineResponse(extractedPrompt, options.mode);

    let diagnosticNotice: string;
    if (isQuotaOrCreditsIssue) {
      diagnosticNotice = `Gemini API quota/prepayment credits depleted (HTTP 429) for project in region [${targetRegion}]. Your reflection was mindfully structured and saved to Firestore. To enable live Gemini AI models, visit ai.studio/projects to replenish credits or update your key in Settings > Secrets.`;
    } else if (isApiKeyIssue) {
      diagnosticNotice = `The configured GEMINI_API_KEY is invalid or expired. Your reflection was answered by the mindful engine and saved securely to Firestore. Update your key in Settings > Secrets to enable live Gemini AI.`;
    } else {
      diagnosticNotice = `Live Gemini models were temporarily unreachable in region [${targetRegion}]. Your reflection was saved with the mindful engine. You can switch to another region (e.g., us-central1) or retry.`;
    }

    return {
      text: fallbackText,
      modelUsed: 'mindful-engine (Fallback)',
      isFallback: true,
      region: targetRegion,
      notice: diagnosticNotice,
    };
  }

  throw lastError || new Error(`All models in the Gemini resilience ladder failed to respond in region [${targetRegion}].`);
}
