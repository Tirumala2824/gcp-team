export type ReflectionMode = 'reflection' | 'brainstorm' | 'summary' | 'journal';

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
