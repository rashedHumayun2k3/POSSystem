import Dexie, { type Table } from 'dexie';
import type { PosSession } from '@/types/pos';
import type { OfflineSale } from '@/types/offlineSale';

class PosDatabase extends Dexie {
  sessions!: Table<PosSession>;
  offlineSales!: Table<OfflineSale>;

  constructor() {
    super('reseller_pos');
    this.version(1).stores({
      sessions: 'id, status, createdAt',
    });
    // v2 adds the offline sales queue — a sale that couldn't reach the server gets written here
    // instead of failing, then replayed (createOrder → confirmOrder → addOrderPayment) once
    // connectivity returns. See lib/posSync.ts.
    this.version(2).stores({
      sessions: 'id, status, createdAt',
      offlineSales: 'id, status, createdAt',
    });
  }
}

export const posDb = new PosDatabase();
