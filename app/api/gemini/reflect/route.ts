import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload. Please provide a well-formed JSON object.' },
        { status: 400 }
      );
    }

    // Defensive Payload Ingestion (Null-Safe Destructuring)
    const data = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};

    const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : '';
    const mode = typeof data.mode === 'string' ? data.mode.trim() : 'mirror';
    const region = typeof data.region === 'string' ? data.region.trim() : (process.env.GEMINI_REGION || 'us-central1');
    const contextMessages = Array.isArray(data.contextMessages) ? data.contextMessages : [];
    const pastEntries = Array.isArray(data.pastEntries) ? data.pastEntries : [];

    if (!prompt) {
      return NextResponse.json(
        { error: 'Missing required field: "prompt" must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (prompt.length > 10000) {
      return NextResponse.json(
        { error: 'Prompt exceeds maximum allowed length of 10,000 characters.' },
        { status: 400 }
      );
    }

    // System instruction tailored to exploration mode
    let systemInstruction =
      'You are a compassionate, thoughtful reflection coach and journal companion. Provide insightful reflections, gentle inquiry, and constructive perspectives on the user’s journaling.';

    if (mode === 'mirror') {
      systemInstruction =
        'You are an introspective AI cognitive mirror specializing in temporal longitudinal reflection. Your role is not to give generic life advice, but to analyze the user\'s current journal entry against their historical journal entries to expose behavioral patterns, cognitive shifts, blind spots, and personal growth.\n\n' +
        'Tone & Style Guidelines:\n' +
        '- Grounded, candid, and psychologically acute.\n' +
        '- Never use generic cheerleading or hollow motivational phrases (e.g., "You\'ve got this!", "Be proud of yourself").\n' +
        '- Base every insight strictly on the user\'s own documented words and past patterns.\n' +
        '- When comparing past and present, quote or cite specific themes, excerpts, or timeframes from their journal history.\n\n' +
        'Analyze the relationship between the past entries and the current entry, then structure your response into the following exact sections with clear markdown headings:\n\n' +
        '### 1. The Temporal Echo (Recurring Patterns)\n' +
        'Identify any cyclical thoughts, fears, or ambitions present in the current entry that have appeared before. Point out exact themes or dilemmas the user has revisited across time.\n\n' +
        '### 2. Blind Spots & Cognitive Traps\n' +
        'Highlight assumptions, premature conclusions, or repetitive anxieties the user is falling into right now that their past outcomes have already disproven or clarified.\n\n' +
        '### 3. The Growth Ledger (Then vs. Now)\n' +
        'Compare how the user handles adversity or decision-making today versus how they handled it in earlier entries. Quote or reference specific shifts in their emotional resilience, clarity, or maturity.\n\n' +
        '### 4. The Forward Catalyst\n' +
        'Provide one sharp, piercing question that forces the user to break any identified cyclical rut and move forward with clarity.';
    } else if (mode === 'brainstorm') {
      systemInstruction =
        'You are an energetic, creative brainstorming partner. Offer innovative perspectives, inventive ideas, creative angles, and actionable next steps.';
    } else if (mode === 'summary') {
      systemInstruction =
        'You are an expert synthesis assistant. Summarize the user’s thoughts into clear takeaways, core emotional themes, key realizations, and mindful suggestions.';
    } else if (mode === 'journal') {
      systemInstruction =
        'You are a mindful journaling guide. Validate the user’s experiences with empathy, clarity, and gentle prompts that deepen their self-awareness.';
    }

    // Format contents with conversation history
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    for (const msg of contextMessages) {
      if (
        msg &&
        typeof msg === 'object' &&
        typeof (msg as { content?: unknown }).content === 'string'
      ) {
        const role = (msg as { role?: unknown }).role === 'user' ? 'user' : 'model';
        const contentStr = ((msg as { content: string }).content || '').trim();
        if (contentStr) {
          contents.push({
            role,
            parts: [{ text: contentStr }],
          });
        }
      }
    }

    // Format user turn with longitudinal context when in mirror mode
    let userPromptText = prompt;
    if (mode === 'mirror') {
      let archiveSection = '';
      if (pastEntries.length > 0) {
        archiveSection = pastEntries
          .map((entry, index) => {
            const e = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
            const dateStr = typeof e.date === 'string' ? e.date : `Past Entry #${index + 1}`;
            const titleStr = typeof e.title === 'string' && e.title ? ` - ${e.title}` : '';
            const bodyStr = typeof e.content === 'string' ? e.content.trim() : '';
            return `[${dateStr}${titleStr}]:\n"${bodyStr.slice(0, 1500)}"`;
          })
          .join('\n\n');
      } else {
        archiveSection =
          'No prior historical entries recorded in the user\'s archive yet. This is their baseline reflection entry #1. Establish their initial baseline cognitive patterns, identified dilemmas, and provide the forward catalyst.';
      }

      userPromptText =
        `Context Provided:\n` +
        `1. Past Entries: A chronological archive of the user's past reflections with timestamps:\n` +
        `${archiveSection}\n\n` +
        `2. Current Entry: The user's newest reflection written today:\n` +
        `"${prompt}"\n\n` +
        `Analyze the relationship between the past entries and the current entry, then structure your response into the 4 required sections: 1. The Temporal Echo (Recurring Patterns), 2. Blind Spots & Cognitive Traps, 3. The Growth Ledger (Then vs. Now), and 4. The Forward Catalyst.`;
    }

    // Append latest user turn
    contents.push({
      role: 'user',
      parts: [{ text: userPromptText }],
    });

    const result = await generateContentWithFallback({
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
      mode,
      region,
    });

    return NextResponse.json({
      reply: result.text,
      modelUsed: result.modelUsed,
      isFallback: result.isFallback ?? false,
      notice: result.notice,
      region: result.region || region,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[API /api/gemini/reflect] Error generating reflection:', message);
    return NextResponse.json(
      { error: `Gemini processing failure: ${message}` },
      { status: 500 }
    );
  }
}
