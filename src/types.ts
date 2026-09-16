export type Theme = 'light' | 'dark' | 'sunset';

export type Card = {
  id: string;
  prompt: string;
  answer: string;
  seconds: number;
  repetitions?: number;
  secondsManual?: boolean;
};

export type Topic = {
  id: string;
  name: string;
  cards: Card[];
};

export type Knight = {
  id: string;
  name: string;
  topic: string;
  description: string;
  topics?: Topic[];
  cards: Card[];
  sessions: number;
  bestScore: number;
  createdAt: string;
};

export type DraftTopic = {
  id: string;
  name: string;
  cards: Card[];
};