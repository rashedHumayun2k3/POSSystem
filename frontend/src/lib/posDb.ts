import Dexie, { type Table } from 'dexie';
import type { PosSession } from '@/types/pos';

class PosDatabase extends Dexie {
  sessions!: Table<PosSession>;

  constructor() {
    super('reseller_pos');
    this.version(1).stores({
      sessions: 'id, status, createdAt',
    });
  }
}

export const posDb = new PosDatabase();
