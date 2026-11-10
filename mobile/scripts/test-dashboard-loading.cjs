const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/components/DashboardReportCard.tsx'),'utf8');
const screen=fs.readFileSync(path.join(__dirname,'../src/screens/ReportDashboardScreen.tsx'),'utf8');
let current;const pending=[];
const react={createElement:(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props,children}),Fragment:'Fragment',useRef:value=>({current:value}),
 useState:initial=>{const instance=current,i=instance.index++;if(!(i in instance.state))instance.state[i]=initial;return[instance.state[i],v=>instance.state[i]=typeof v==='function'?v(instance.state[i]):v];},
 useEffect:(effect,deps)=>{const instance=current,i=instance.index++,old=instance.effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){old?.cleanup?.();instance.queued.push(()=>instance.effects[i]={deps,cleanup:effect()});}}};
const native={useWindowDimensions:()=>({width:1024,height:768}),View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',StyleSheet:{create:s=>s}};
const context={exports:{},React:react,require:name=>name==='./DashboardBreakdown'?breakdown.exports:name==='./DashboardCardChrome'?chrome.exports:name==='@expo/vector-icons'?{Ionicons:'Icon'}:name==='react'?react:name==='react-native'?native:name==='expo-router'?{router:{push:()=>{}}}:name==='../theme'?{colors:{card:'#FFFFFF'}}:name.includes('AuthContext')?{useAuth:()=>({api:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))})}:{useLanguage:()=>({lang:'en'})}};
const chrome={exports:{},React:react,require:context.require};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/components/DashboardCardChrome.tsx'),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,chrome);
const breakdown={exports:{},React:react,require:context.require};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/components/DashboardBreakdown.tsx'),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,breakdown);
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,context);
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...(tree.children||[]).flat(Infinity).flatMap(nodes)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function card(id){const instance={state:[],effects:[],queued:[],index:0};instance.render=()=>{current=instance;instance.index=0;const tree=context.exports.default({config:{id,title:[id,id],summary:[id,id],periods:['TODAY','MONTH'],initial:'TODAY',link:'/orders',linkText:['View','View']},canSeeCosts:true});instance.queued.splice(0).forEach(fn=>fn());return tree;};instance.render();return instance;}
(async()=>{
 const expense=card('expense'),collection=card('collection');assert.equal(pending.length,2);
 const data={total:10,rows:[{name:'Transport',value:10}],metrics:[],recent:[]};
 pending[0].resolve(data);await flush();assert.ok(JSON.stringify(expense.render()).includes('৳10'));assert.ok(JSON.stringify(collection.render()).includes('Spinner'));
 pending[1].reject(new Error('failed'));await flush();assert.ok(JSON.stringify(collection.render()).includes('Could not load'));assert.ok(JSON.stringify(expense.render()).includes('৳10'));
 let tree=expense.render();const header=nodes(tree).find(n=>n.props?.accessibilityState?.expanded===false);assert.ok(header);header.props.onPress();tree=expense.render();assert.ok(nodes(tree).some(n=>n.props?.accessibilityState?.expanded===true));
 const month=nodes(tree).find(n=>n.type==='Pressable'&&nodes(n).some(x=>x.children?.includes('This month')));month.props.onPress();tree=expense.render();assert.ok(pending.at(-1).url.endsWith('period=MONTH'));
 expense.effects.forEach(e=>e?.cleanup?.());pending.at(-1).resolve({...data,total:999});await flush();assert.ok(!JSON.stringify(expense.render()).includes('৳999'),'unmounted scope response ignored');
 const money=card('money');assert.equal(pending.at(-1).url,'/reports/dashboard/money-section');pending.at(-1).resolve({...data,asOf:'2026-11-09T08:00:00Z'});await flush();
 let moneyTree=money.render();assert.ok(JSON.stringify(moneyTree).includes('Other sources'));assert.ok(!JSON.stringify(moneyTree).includes('Updated'));nodes(moneyTree).find(n=>n.props?.accessibilityState?.expanded===false).props.onPress();money.render();pending.at(-1).resolve({...data,asOf:'2026-11-09T08:00:00Z'});await flush();moneyTree=money.render();assert.ok(JSON.stringify(moneyTree).includes('Updated'));const refresh=nodes(moneyTree).find(n=>n.type==='Pressable'&&nodes(n).some(x=>x.children?.some(c=>typeof c==='string'&&c.includes('Refresh balance'))));assert.ok(refresh);refresh.props.onPress();money.render();assert.equal(pending.at(-1).url,'/reports/dashboard/money-section');
 for(const id of ['expense','money','profit','orders','products','capital','dues','top'])assert.ok(screen.includes(`id:"${id}"`));
 assert.ok(screen.includes('canSeeCosts?['));assert.ok(screen.includes('canSeeCapital?['));
 console.log('Dashboard card independent loading, failure isolation, collapsed headers, filters, stale scope protection and section configuration passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
