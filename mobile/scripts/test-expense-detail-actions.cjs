const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
const util={exports:{}};vm.runInNewContext(transpile(fs.readFileSync(path.join(__dirname,'../src/utils/expenseCashPayments.ts'),'utf8')),util);
let state=[],index=0,requests=[],saved=null,deleted=false;
const react={createElement:(type,props,...children)=>({type,props,children}),useRef:v=>({current:v}),useState:v=>{const i=index++;if(!(i in state))state[i]=v;return[state[i],n=>state[i]=typeof n==='function'?n(state[i]):n]}};
const context={exports:{},React:react,require:n=>n==='react'?react:n==='react-native'?{View:'View',Text:'Text',TextInput:'Input',Pressable:'Button',ScrollView:'Scroll',StyleSheet:{create:v=>v}}:n==='@expo/vector-icons'?{Ionicons:'Icon'}:n.includes('AuthContext')?{useAuth:()=>({session:{user:{id:'creator'}},api:async(url,options)=>{requests.push({url,...options});return {...expense,amount:125};}})}:n.includes('LanguageContext')?{useLanguage:()=>({lang:'en'})}:n.includes('theme')?{colors:{}}:n.includes('expenseCashPayments')?util.exports:{default:n}};
vm.runInNewContext(transpile(fs.readFileSync(path.join(__dirname,'../src/components/ExpenseDetailActions.tsx'),'utf8')),context);
let expense={id:'expense-1',categoryId:'category-1',createdBy:'creator',status:'APPROVED',amount:100,expenseDate:'2026-11-09',subType:'Travel',note:'Original',staffId:'staff-1',isRecurring:true,recurringDay:9,photoUrl:'receipt',allocateToTripId:null,pettyCashBoxId:null};
const nodes=t=>!t||typeof t!=='object'?[]:[t,...(t.children??[]).flat(Infinity).flatMap(nodes)];
const render=()=>{index=0;return context.exports.default({expense,onSaved:e=>saved=e,onDeleted:()=>deleted=true});};
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&nodes(n).some(c=>c.type==='Text'&&c.children.includes(label)));
(async()=>{
let tree=render();button(tree,'Edit').props.onPress();tree=render();nodes(tree).find(n=>n.type==='Input'&&n.props.accessibilityLabel==='Amount').props.onChangeText('125');tree=render();button(tree,'Save changes').props.onPress();await new Promise(r=>setImmediate(r));
assert.equal(requests[0].method,'PUT');const payload=JSON.parse(requests[0].body);assert.equal(payload.amount,125);assert.equal(payload.photoUrl,'receipt');assert.equal(payload.staffId,'staff-1');assert.equal(payload.recurringDay,9);assert.equal(saved.amount,125);
tree=render();button(tree,'Delete').props.onPress();assert.equal(requests.length,1,'opening confirmation must not delete');tree=render();const deletes=nodes(tree).filter(n=>n.type==='Button'&&nodes(n).some(c=>c.type==='Text'&&c.children.includes('Delete')));deletes.at(-1).props.onPress();await new Promise(r=>setImmediate(r));assert.equal(requests[1].method,'DELETE');assert.equal(deleted,true);
for(const extra of [{fundingSource:'CASH'},{fundingSource:'BUSINESS'},{fundingSource:'PERSONAL'},{createdBy:'other'},{isAccountingPeriodClosed:true},{source:'PURCHASE_PAYMENT'}]){expense={...expense,...extra};tree=render();assert.equal(button(tree,'Edit').props.disabled,true);assert.equal(button(tree,'Delete').props.disabled,true);delete expense.fundingSource;delete expense.isAccountingPeriodClosed;delete expense.source;expense.createdBy='creator';}
console.log('Expense detail actions: edit payload preservation, delete confirmation, and funding/ownership/period restrictions passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
