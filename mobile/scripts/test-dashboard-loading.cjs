const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/screens/ReportDashboardScreen.tsx'), 'utf8');
const part = source.slice(source.indexOf('function DashboardPart<T>'), source.indexOf('function Kpi('));
let current;
const pending = new Map();
const api = endpoint => new Promise((resolve, reject) => pending.set(endpoint, { resolve, reject }));
const context = {
  exports: {}, React: { createElement: (type, props, ...children) => ({ type, props, children }), Fragment: 'Fragment' },
  useAuth: () => ({ api }), useLanguage: () => ({ lang: 'en' }),
  useRef: value => ({ current: value }),
  useState: initial => {
    const instance = current, index = instance.index++;
    if (!(index in instance.state)) instance.state[index] = initial;
    return [instance.state[index], value => { instance.state[index] = typeof value === 'function' ? value(instance.state[index]) : value; }];
  },
  useEffect: effect => { if (!current.started) { current.started = true; current.cleanup = effect(); } },
  View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'Spinner', colors: { primary: 'orange' }, s: {},
};
vm.runInNewContext(ts.transpileModule(part + '\nexports.Part = DashboardPart;', {
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS },
}).outputText, context);
function loader(endpoint) {
  const instance = { state: [], index: 0, started: false };
  instance.render = () => { current = instance; instance.index = 0; return context.exports.Part({ endpoint, label: endpoint, children: value => ({ loaded: value }) }); };
  instance.render(); return instance;
}
(async () => {
  const sales = loader('sales-overview'), due = loader('collections-summary');
  pending.get('/reports/dashboard/sales-overview').resolve(123);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sales.render().children[0].loaded, 123);
  assert.equal(due.state[0], null, 'slow Due must not block Sales');
  pending.get('/reports/dashboard/collections-summary').reject(new Error('Due unavailable'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(due.state[1], 'Due unavailable');
  assert.equal(sales.render().children[0].loaded, 123, 'one failure must not clear another card');
  const oldBranch = loader('today-returns'); oldBranch.cleanup();
  pending.get('/reports/dashboard/today-returns').resolve({ cash: 999 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(oldBranch.state[0], null, 'late response after unmount must be ignored');
  assert.ok(source.includes('value>0?<Kpi'), 'returns card is conditional');
  assert.ok(!source.includes('label="Customers"') && !source.includes('label="Products Sold"'));
  for (const endpoint of ['sales-overview','today-returns','stock','collections-summary','trend']) assert.ok(source.includes('endpoint="'+endpoint+'"'));
  assert.ok(!source.includes('endpoint="due"') && !source.includes('endpoint="today-sales"'));
  console.log('Dashboard independent loading, failure isolation, stale responses, and card visibility passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
