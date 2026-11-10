const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const load=file=>{const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:m.exports,module:m});return m.exports;};
const c=load('../src/utils/cashBook.ts');

// Date presets follow the Dhaka report day passed in as "today".
assert.deepEqual({...c.periodRange('TODAY','2026-11-10')},{from:'2026-11-10',to:'2026-11-10'});
assert.deepEqual({...c.periodRange('7D','2026-11-03')},{from:'2026-10-28',to:'2026-11-03'},'7 days crosses month end');
assert.deepEqual({...c.periodRange('MONTH','2026-11-10')},{from:'2026-11-01',to:'2026-11-10'});
assert.equal(c.validRange('2026-11-01','2026-11-10','2026-11-10'),'');
assert.ok(c.validRange('2026-11-11','2026-11-10','2026-11-10'),'start after end');
assert.ok(c.validRange('2026-11-01','2026-11-11','2026-11-10'),'future end');
assert.ok(c.validRange('2025-01-01','2026-11-10','2026-11-10'),'more than a year');
assert.equal(c.validRange('2025-11-10','2026-11-10','2026-11-10'),'','exactly 366 days allowed');

// Rows stay newest-first and each day carries its closing balance; a day split across pages joins the open group.
const row=(id,date,amount)=>({id,date,amount});
const groups=c.groupByDay([row('a','2026-11-10',500),row('b','2026-11-10',-200),row('c','2026-11-09',100)],[{date:'2026-11-10',closing:900},{date:'2026-11-09',closing:600}]);
assert.equal(groups.length,2);assert.equal(groups[0].closing,900);assert.deepEqual([...groups[0].rows.map(r=>r.id)],['a','b']);assert.equal(groups[1].closing,600);
assert.equal(c.groupByDay([row('x','2026-11-08',1)],[])[0].closing,undefined,'missing day balance stays unknown');

// Money input never turns bad text into a different amount.
assert.equal(c.amountInput('১২৫০.৫','') ,'1250.5','Bangla digits');
assert.equal(c.amountInput('12.345','12.34'),'12.34','three decimals rejected');
assert.equal(c.amountInput('abc','50'),'50');
assert.equal(c.amountInput('.5',''),'0.5');

assert.equal(c.balanceOf({cash:10,bkash:20,nagad:30},'BKASH'),20);
assert.equal(c.sourceLabel('NAGAD'),'Nagad');
for(const kind of ['PAYMENT','REFUND','EXPENSE','PURCHASE','INVESTMENT'])assert.ok(c.kindLabel[kind],kind);

// Every visible English label used by the Cash Book has a Bangla translation (English text is the lookup key).
const en=require('../src/i18n/en.json'),bn=require('../src/i18n/bn.json');
const index=new Map();(function walk(e,b){for(const[k,v]of Object.entries(e)){const t=b?.[k];if(typeof v==='string'&&typeof t==='string')index.set(v,t);else if(v&&typeof v==='object')walk(v,t);}})(en,bn);
const sources=['../src/screens/CashBookScreen.tsx'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n');
const labels=['Cash Book','Money In','Money Out','Partner Investment','Incl. purchases & refunds',...Object.values(c.kindLabel)];
for(const label of labels){assert.ok(index.has(label),`missing Bangla for "${label}"`);}
assert.ok(sources.includes('/reports/cash-activity?'),'screens call the cash endpoints');
console.log('Cash book date ranges, day grouping, amount input and translations passed.');
