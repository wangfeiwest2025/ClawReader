
export type BookFormat = 'epub' | 'pdf' | 'mobi' | 'fb2' | 'txt' | 'rtf' | 'azw3';

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  content: string | ArrayBuffer; // Base64 or Blob URL
  cover?: string;
  addedAt: number;
  lastRead?: number;
}

export interface AIResponse {
  summary: string;
  keyInsights: string[];
  suggestedQuestions: string[];
}

export interface ReadingSettings {
  fontSize: number;
  lineHeight: number;
  theme: 'light' | 'dark' | 'sepia';
  fontFamily: 'serif' | 'sans';
}
