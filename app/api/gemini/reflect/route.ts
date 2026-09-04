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
    const mode = typeof data.mode === 'string' ? data.mode.trim() : 'reflection';
    const contextMessages = Array.isArray(data.contextMessages) ? data.contextMessages : [];

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

    if (mode === 'brainstorm') {
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

    // Append latest user turn
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    const result = await generateContentWithFallback({
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return NextResponse.json({
      reply: result.text,
      modelUsed: result.modelUsed,
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
