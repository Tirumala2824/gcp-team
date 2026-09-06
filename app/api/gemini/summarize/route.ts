import { NextRequest, NextResponse } from 'next/server';
import { generateContentWithFallback } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload.' },
        { status: 400 }
      );
    }

    const data = rawBody && typeof rawBody === 'object' ? (rawBody as Record<string, unknown>) : {};
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const textSnippet = typeof data.text === 'string' ? data.text : '';
    const region = typeof data.region === 'string' ? data.region.trim() : (process.env.GEMINI_REGION || 'us-central1');

    let contentToSummarize = textSnippet.trim();

    if (!contentToSummarize && messages.length > 0) {
      contentToSummarize = messages
        .map((m: Record<string, unknown>) => {
          const sender = m.role === 'user' ? 'User' : 'Gemini';
          return `${sender}: ${m.content || ''}`;
        })
        .join('\n\n');
    }

    if (!contentToSummarize) {
      return NextResponse.json(
        { error: 'Provide either a text string or a non-empty messages array to summarize.' },
        { status: 400 }
      );
    }

    const systemInstruction =
      'You are an expert mindfulness and personal insight synthesizer. Condense the journal conversation or reflection into: 1) Core Themes & Mood, 2) Key Epiphanies, and 3) Mindful Action / Gentle Anchor for Tomorrow. Keep it concise, poetic, and encouraging.';

    const result = await generateContentWithFallback({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Please synthesize and summarize this reflection session:\n\n${contentToSummarize.slice(0, 12000)}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction,
        temperature: 0.5,
      },
      mode: 'summary',
      region,
    });

    return NextResponse.json({
      summary: result.text,
      modelUsed: result.modelUsed,
      isFallback: result.isFallback ?? false,
      notice: result.notice,
      region: result.region || region,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    console.error('[API /api/gemini/summarize] Error summarizing reflection:', message);
    return NextResponse.json(
      { error: `Gemini synthesis failure: ${message}` },
      { status: 500 }
    );
  }
}
