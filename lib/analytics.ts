import { EmotionalDataPoint, ReflectionMode, ThemeFrequency } from './types';

export const THEME_PALETTE: Record<string, string> = {
  'Perfectionism & Hesitation': '#78716c', // stone-500
  'Burnout & Energy': '#b45309', // amber-700
  'Career & Ambition': '#0f766e', // teal-700
  'Relationships & Boundaries': '#475569', // slate-600
  'Inner Criticism & Doubt': '#991b1b', // red-800
  'Decision Paralysis': '#854d0e', // yellow-800
  'Agency & Growth Momentum': '#15803d', // green-700
  'Self-Compassion & Peace': '#0284c7', // sky-600
};

export const THEME_KEYWORDS: Record<string, string[]> = {
  'Perfectionism & Hesitation': ['perfect', 'hesitat', 'mistake', 'flaw', 'fail', 'procrastinat', 'delay', 'standard', 'not ready'],
  'Burnout & Energy': ['exhaust', 'tired', 'drain', 'burnout', 'overwhelm', 'heavy', 'pace', 'rest', 'sleep', 'fatigue'],
  'Career & Ambition': ['work', 'career', 'job', 'project', 'client', 'promot', 'build', 'goal', 'achiev', 'deliver'],
  'Relationships & Boundaries': ['boundar', 'conflict', 'partner', 'friend', 'colleague', 'people', 'say no', 'guilt', 'expect'],
  'Inner Criticism & Doubt': ['doubt', 'imposter', 'worth', 'judge', 'blame', 'harsh', 'should', 'stupid', 'fraud'],
  'Decision Paralysis': ['decid', 'choice', 'option', 'stuck', 'dilemma', 'crossroad', 'freeze', 'uncertain'],
  'Agency & Growth Momentum': ['commit', 'action', 'forward', 'step', 'shift', 'progress', 'clarity', 'breakthrough', 'courage'],
  'Self-Compassion & Peace': ['compassion', 'gentle', 'accept', 'peace', 'breathe', 'grace', 'soft', 'calm', 'patience'],
};

const POSITIVE_INDICATORS = [
  'clarity', 'grounded', 'peace', 'accept', 'progress', 'breakthrough', 'grateful', 'gratitude',
  'calm', 'energy', 'confidence', 'courage', 'resolve', 'release', 'forward', 'hope', 'alignment'
];

const NEGATIVE_INDICATORS = [
  'anxious', 'anxiety', 'fear', 'dread', 'overwhelmed', 'stuck', 'exhausted', 'frustrat',
  'hopeless', 'heavy', 'guilt', 'paralyzed', 'hesitating', 'imposter', 'isolated', 'panick'
];

export function extractThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.push(theme);
    }
  }

  if (matched.length === 0) {
    matched.push('Self-Compassion & Peace');
  }

  return matched;
}

export function calculateEmotionalTone(text: string): { toneScore: number; resilienceScore: number; toneLabel: string } {
  const lower = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of POSITIVE_INDICATORS) {
    const matches = lower.split(word).length - 1;
    positiveScore += matches * 1.8;
  }

  for (const word of NEGATIVE_INDICATORS) {
    const matches = lower.split(word).length - 1;
    negativeScore += matches * 2.2;
  }

  // Base raw valence between -10 and +10
  let rawTone = Math.round((positiveScore - negativeScore) * 1.5);
  rawTone = Math.max(-9, Math.min(9, rawTone));

  // If text is neutral or minimal emotional spikes
  if (rawTone === 0 && text.length > 50) {
    rawTone = 2; // Default gently reflective positive baseline
  }

  // Calculate cognitive resilience score (0 to 100)
  // Higher if cognitive reflection, mindfulness, or forward momentum is present
  const cognitiveMarkers = ['notice', 'realize', 'learned', 'next time', 'letting go', 'choosing', 'commit'];
  let markerBonus = 0;
  cognitiveMarkers.forEach((m) => {
    if (lower.includes(m)) markerBonus += 8;
  });

  const resilienceScore = Math.min(98, Math.max(20, Math.round(50 + rawTone * 3.5 + markerBonus)));

  let toneLabel = 'Reflective Equilibrium';
  if (rawTone <= -6) toneLabel = 'High Tension & Overwhelm';
  else if (rawTone < -1) toneLabel = 'Hesitation & Friction';
  else if (rawTone >= -1 && rawTone <= 3) toneLabel = 'Reflective Equilibrium';
  else if (rawTone > 3 && rawTone <= 6) toneLabel = 'Grounded Clarity';
  else toneLabel = 'Empowered Breakthrough';

  return { toneScore: rawTone, resilienceScore, toneLabel };
}

export interface RawInteractionRecord {
  id: string;
  userId?: string;
  title: string;
  mode: ReflectionMode;
  messages: Array<{ role: string; content: string; timestamp?: string }>;
  summary?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export function parseInteractionTimestamp(record: RawInteractionRecord): Date {
  if (record.createdAt) {
    if (typeof record.createdAt === 'string') {
      const parsed = new Date(record.createdAt);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    // Firestore Timestamp format { seconds, nanoseconds }
    if (typeof record.createdAt === 'object' && record.createdAt !== null && 'seconds' in record.createdAt) {
      return new Date((record.createdAt as { seconds: number }).seconds * 1000);
    }
  }

  if (record.messages && record.messages.length > 0 && record.messages[0].timestamp) {
    const parsed = new Date(record.messages[0].timestamp);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
}

/**
 * Transforms real user interactions into longitudinal data points for the selected window.
 */
export function processInteractionsToDataPoints(
  interactions: RawInteractionRecord[],
  daysWindow: number = 30
): EmotionalDataPoint[] {
  const now = new Date();
  const windowThreshold = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  const points: EmotionalDataPoint[] = [];

  for (const item of interactions) {
    const date = parseInteractionTimestamp(item);
    if (date < windowThreshold) continue;

    // Combine user's reflections
    const userTexts = (item.messages || [])
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');

    const combinedText = `${item.title} ${userTexts} ${item.summary || ''}`;
    const { toneScore, resilienceScore, toneLabel } = calculateEmotionalTone(combinedText);
    const themes = extractThemes(combinedText);

    const excerpt = userTexts.slice(0, 140) + (userTexts.length > 140 ? '...' : '');

    points.push({
      id: item.id,
      rawDate: date.toISOString(),
      displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      title: item.title,
      toneScore,
      resilienceScore,
      toneLabel,
      themes,
      excerpt: excerpt || 'Reflective journaling entry',
      mode: item.mode,
    });
  }

  // Sort chronologically ascending for the chart timeline
  points.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime());
  return points;
}

/**
 * High-fidelity 30-day realistic baseline demonstrating a full longitudinal arc
 * (anxiety/hesitation -> reflection -> boundary reset -> breakthrough).
 */
export function generateSampleLongitudinalArc(daysWindow: number = 30): EmotionalDataPoint[] {
  const now = new Date();
  const sampleEvents = [
    { daysAgo: 28, title: 'Sprint planning anxiety & imposter doubt', text: 'Stuck in decision paralysis. Feeling anxious about presenting to leadership. Afraid of failing or being exposed as not knowing enough.', mode: 'mirror' as ReflectionMode, offsetTone: -7, themes: ['Inner Criticism & Doubt', 'Perfectionism & Hesitation'] },
    { daysAgo: 25, title: 'Hesitating to launch new proposal', text: 'Procrastinating on releasing the document. Spending 3 hours tweaking word choices. Classic perfectionism loop.', mode: 'mirror' as ReflectionMode, offsetTone: -5, themes: ['Perfectionism & Hesitation'] },
    { daysAgo: 21, title: 'Exhausted by back-to-back demands', text: 'Hit a wall today. So tired and overwhelmed by everyone asking for things. I have trouble saying no.', mode: 'journal' as ReflectionMode, offsetTone: -4, themes: ['Burnout & Energy', 'Relationships & Boundaries'] },
    { daysAgo: 18, title: 'Setting communication boundaries', text: 'I decided to block my mornings for deep work and silence notifications. Felt guilty at first, but breathing through it.', mode: 'reflection' as ReflectionMode, offsetTone: 1, themes: ['Relationships & Boundaries', 'Agency & Growth Momentum'] },
    { daysAgo: 15, title: 'Reflection on past cycles of panic', text: 'Looking at my mirror log from last month, I notice whenever a milestone approaches, my mind predicts catastrophe. It never actually happens.', mode: 'mirror' as ReflectionMode, offsetTone: 3, themes: ['Agency & Growth Momentum', 'Inner Criticism & Doubt'] },
    { daysAgo: 12, title: 'Quiet afternoon of creative clarity', text: 'Work felt light today. Flow state achieved. Focused on the mission rather than my self-conscious defense mechanisms.', mode: 'brainstorm' as ReflectionMode, offsetTone: 6, themes: ['Career & Ambition', 'Self-Compassion & Peace'] },
    { daysAgo: 9, title: 'Handling constructive feedback without defensive spiraling', text: 'Received critical feedback on the spec. Normally I would withdraw and stew in shame. Today I asked clarifying questions and felt calm.', mode: 'mirror' as ReflectionMode, offsetTone: 7, themes: ['Agency & Growth Momentum', 'Inner Criticism & Doubt'] },
    { daysAgo: 6, title: 'Mid-week energy dip and gentle pause', text: 'Felt a familiar wave of fatigue. Instead of pushing through, I took a 20-minute walk and permitted myself to go slow.', mode: 'journal' as ReflectionMode, offsetTone: 4, themes: ['Burnout & Energy', 'Self-Compassion & Peace'] },
    { daysAgo: 3, title: 'Breakthrough on strategic decision', text: 'Committed to the harder path with total peace. No second-guessing. The past fear has lost its grip.', mode: 'reflection' as ReflectionMode, offsetTone: 8, themes: ['Decision Paralysis', 'Agency & Growth Momentum'] },
    { daysAgo: 0, title: 'Longitudinal alignment check', text: 'Reviewing 30 days of reflections. I am significantly more patient with my own humanity than 4 weeks ago.', mode: 'summary' as ReflectionMode, offsetTone: 9, themes: ['Self-Compassion & Peace', 'Agency & Growth Momentum'] },
  ];

  return sampleEvents
    .filter((e) => e.daysAgo <= daysWindow)
    .map((e, idx) => {
      const d = new Date(now.getTime() - e.daysAgo * 24 * 60 * 60 * 1000);
      const resilience = Math.min(96, Math.max(25, 45 + e.offsetTone * 5 + idx * 2));
      let toneLabel = 'Reflective Equilibrium';
      if (e.offsetTone <= -6) toneLabel = 'High Tension & Overwhelm';
      else if (e.offsetTone < -1) toneLabel = 'Hesitation & Friction';
      else if (e.offsetTone >= -1 && e.offsetTone <= 3) toneLabel = 'Reflective Equilibrium';
      else if (e.offsetTone > 3 && e.offsetTone <= 6) toneLabel = 'Grounded Clarity';
      else toneLabel = 'Empowered Breakthrough';

      return {
        id: `sample-pt-${idx}`,
        rawDate: d.toISOString(),
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        title: e.title,
        toneScore: e.offsetTone,
        resilienceScore: resilience,
        toneLabel,
        themes: e.themes,
        excerpt: e.text,
        mode: e.mode,
      };
    });
}

/**
 * Aggregates frequency and average tone across recurring themes.
 */
export function aggregateThemeFrequencies(dataPoints: EmotionalDataPoint[]): ThemeFrequency[] {
  const themeMap: Record<string, { count: number; totalTone: number }> = {};

  for (const pt of dataPoints) {
    for (const theme of pt.themes) {
      if (!themeMap[theme]) {
        themeMap[theme] = { count: 0, totalTone: 0 };
      }
      themeMap[theme].count += 1;
      themeMap[theme].totalTone += pt.toneScore;
    }
  }

  const result: ThemeFrequency[] = Object.entries(themeMap).map(([theme, stats]) => ({
    theme,
    count: stats.count,
    avgTone: Number((stats.totalTone / stats.count).toFixed(1)),
    color: THEME_PALETTE[theme] || '#78716c',
  }));

  // Sort descending by frequency
  result.sort((a, b) => b.count - a.count);
  return result;
}
