const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/expenseCashPayments.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { parseCashPayments: parse, cashPaymentInputs } = context.exports;
assert.equal(parse({ cash: '2000', bkash: '700', nagad: '300' }, 3000, false).error, '');
assert.equal(parse({ bkash: '0.1', nagad: '0.2' }, 0.3, false).error, '');
assert.equal(parse({ nagad: '100' }, 100, false).payments.cash, 0);
for (const input of [{}, { cash: '' }, { cash: '0' }, { cash: '-1' }, { cash: '100.001' }, { cash: '99' }, { cash: '101' }, { cash: 'NaN' }, { cash: '1e2' }]) {
  assert.ok(parse(input, 100, false).error, JSON.stringify(input));
}
assert.deepEqual(JSON.parse(JSON.stringify(cashPaymentInputs({ cash: 0, bkash: 700, nagad: 300 }))), { bkash: '700', nagad: '300' });
assert.ok(parse({}, 100, true).error.includes('নির্বাচন'));
console.log('Expense cash payment validation passed.');

const input = context.exports.expenseAmountInput;
for (const invalid of ['abc','12a','1e3','-10','1.2.3','10.123','1,000']) assert.equal(input(invalid,'12'),'12');
assert.equal(input('১২.৫০',''),'12.50');assert.equal(input('.5',''),'0.5');assert.equal(input('','12'),'');
console.log('Expense amount input restrictions passed.');
