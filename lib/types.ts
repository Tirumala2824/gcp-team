export type ReflectionMode = 'mirror' | 'reflection' | 'journal' | 'summary' | 'brainstorm';

export interface RegionOption {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
}

export interface PastEntryItem {
  id: string;
  date: string;
  title: string;
  content: string;
  mode?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
}

export interface Interaction {
  id: string;
  userId: string;
  title: string;
  mode: ReflectionMode;
  messages: ChatMessage[];
  summary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmotionalDataPoint {
  id: string;
  rawDate: string;
  displayDate: string;
  title: string;
  toneScore: number; // -10 (high anxiety/tension) to +10 (deep peace/empowerment)
  resilienceScore: number; // 0 to 100
  toneLabel: string;
  themes: string[];
  excerpt: string;
  mode: ReflectionMode;
}

export interface ThemeFrequency {
  theme: string;
  count: number;
  avgTone: number;
  color: string;
}

