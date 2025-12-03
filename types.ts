
export interface WordPair {
  id: string;
  english: string;
  chinese: string;
  category?: string;
  // SRS Fields
  lastReviewed?: number; // timestamp
  reviewInterval?: number; // in days (0, 1, 3, 7...)
  proficiency?: number; // 0-5
}

export interface WordLibrary {
  [category: string]: WordPair[];
}

export interface TranslationOption {
  text: string;
  context: string; // e.g. "Fruit", "Company", "Action"
}

export enum AppMode {
  SETUP = 'SETUP',
  QUIZ = 'QUIZ',
  RESULT = 'RESULT',
  SPEAKING = 'SPEAKING',
  DIALOGUE = 'DIALOGUE', // New Mode
}

export enum LanguageMode {
  ENGLISH = 'ENGLISH', // Speak/Write English
  CHINESE = 'CHINESE', // Speak/Write Chinese
}

export interface QuizConfig {
  promptLanguage: LanguageMode; // What the app speaks
  answerLanguage: LanguageMode; // What the user writes
  randomize: boolean;
}

export interface QuizResult {
  wordId: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  timestamp: number;
}

export interface TestRecord {
  id: string;
  date: number;
  score: number;
  total: number;
  wrongWords: { english: string; chinese: string }[];
}

// For the Speaking Practice Mode
export interface SpeakingEvaluation {
  score: number; // 0-100
  feedback: string;
}

export interface GeneratedPassage {
  title: string;
  content: string;
  vocabulary: WordPair[];
}

// For Dialogue Mode
export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  audioBase64?: string; // Cache audio for replay
}
