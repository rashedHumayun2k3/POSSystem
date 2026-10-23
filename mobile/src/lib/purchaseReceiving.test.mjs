import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lotUsableQuantity, receiptQuantities } from './purchaseReceiving.ts';

test('LOT-2: five assigned pieces with one damaged and one missing means three usable, not seven entered', () => {
  assert.deepEqual(receiptQuantities({ usable: '5', damaged: '1', missing: '1' }, 5, 5), { qtyUsable: 3, qtyDamaged: 1, qtyMissing: 1 });
});
test('all missing is valid and gives zero usable', () => {
  assert.equal(lotUsableQuantity(5, '0', '5'), 0);
});
test('damage or missing cannot exceed the lot', () => {
  assert.throws(() => lotUsableQuantity(5, '4', '2'), /cannot exceed/);
});
test('invalid lot allocation is not silently reduced to remaining PO quantity', () => {
  assert.throws(() => receiptQuantities({ usable: '7', damaged: '0', missing: '0' }, 7, 5), /only 5 remain/);
});
test('legacy receipts still allow explicitly entered partial usable quantities', () => {
  assert.deepEqual(receiptQuantities({ usable: '2', damaged: '1', missing: '0' }, undefined, 5), { qtyUsable: 2, qtyDamaged: 1, qtyMissing: 0 });
  assert.throws(() => receiptQuantities({ usable: '5', damaged: '1', missing: '1' }, undefined, 5), /only 5 remain/);
});
test('fractional quantities round accurately and invalid inputs are rejected', () => {
  assert.equal(lotUsableQuantity(0.3, '0.1', '0.2'), 0);
  for (const invalid of ['-1', 'abc', 'Infinity', '0.0001']) assert.throws(() => lotUsableQuantity(5, invalid, '0'));
});
