import Dexie, { type Table } from 'dexie';
import type { AudioEntry, ImportBatch, Session, AnswerLogEntry } from './schema';

export class HiyodoriDB extends Dexie {
  audioEntries!: Table<AudioEntry, string>;
  importBatches!: Table<ImportBatch, string>;
  sessions!: Table<Session, string>;
  answerLog!: Table<AnswerLogEntry, number>;

  constructor() {
    super('hiyodori');

    this.version(1).stores({
      audioEntries: 'id, reading, batchId, disabled',
      importBatches: 'id',
      sessions: 'id',
      answerLog: '++id, sessionId, entryId',
    });

    // v2: compound index for efficient keyset pagination in the Library
    this.version(2).stores({
      audioEntries: 'id, reading, batchId, disabled, [reading+id]',
    });
  }
}

export const db = new HiyodoriDB();
