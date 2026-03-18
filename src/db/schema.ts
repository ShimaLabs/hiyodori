export interface AudioEntry {
  id: string;
  reading: string;
  audioUrl: string;
  written?: string;
  pitch?: number;
  batchId: string;
  disabled?: boolean;
  disabledNote?: string;
}

export interface ImportBatch {
  id: string;
  importedAt: number;
  choonpuIsDistinct: boolean;
  distinguishesNasalG: boolean;
  particleSpelling: 'phonetic' | 'orthographic';
}

export interface Session {
  id: string;
  startedAt: number;
  completedAt?: number;
  questionCount: number;
  strictChoonpu: boolean;
  strictNasalG: boolean;
  strictParticleKana: boolean;
  typoCheckEnabled: boolean;
  kanaFilter: string[] | null;
}

export interface AnswerLogEntry {
  id?: number;
  sessionId: string;
  startTime: number;
  timestamp: number;
  entryId: string;
  targetReading: string;
  submittedReading: string;
  certainty: number;
  replayCount: number;
  correct: boolean;
  resubmitted: boolean;
}
