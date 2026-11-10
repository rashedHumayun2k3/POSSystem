const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/components/DashboardSalesCard.tsx'),'utf8');
const pending=[],state=[],effects=[];let index=0,queued=[];
const react={createElement:(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props,children}),Fragment:'Fragment',
 useRef:value=>({current:value}),
 useState:initial=>{const i=index++;if(!(i in state))state[i]=initial;return[state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},
 useEffect:(effect,deps)=>{const i=index++,old=effects[i];if(!old||deps.some((d,j)=>d!==old.deps[j])){old?.cleanup?.();queued.push(()=>effects[i]={deps,cleanup:effect()});}}};
const native={useWindowDimensions:()=>({width:1024,height:768}),View:'View',Text:'Text',Pressable:'Pressable',ActivityIndicator:'Spinner',StyleSheet:{create:s=>s}};
const context={exports:{},React:react,require:name=>name==='./DashboardBreakdown'?breakdown.exports:name==='./DashboardCardChrome'?chrome.exports:name==='@expo/vector-icons'?{Ionicons:'Icon'}:name==='react'?react:name==='react-native'?native:name==='../theme'?{colors:{card:'#FFFFFF',primary:'#F97316'}}:name==='expo-router'?{router:{push:()=>{}}}:name.includes('AuthContext')?{useAuth:()=>({api:url=>new Promise((resolve,reject)=>pending.push({url,resolve,reject}))})}:{useLanguage:()=>({lang:'en'})}};
const chrome={exports:{},React:react,require:context.require};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/components/DashboardCardChrome.tsx'),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,chrome);
const breakdown={exports:{},React:react,require:context.require};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../src/components/DashboardBreakdown.tsx'),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,breakdown);
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,context);
const render=(costs=true)=>{index=0;const tree=context.exports.default({canSeeCosts:costs});queued.splice(0).forEach(fn=>fn());return tree;};
const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...(tree.children||[]).flat(Infinity).flatMap(nodes)];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 let tree=render();assert.equal(tree.props.style[0].width,'100%');assert.equal(pending.length,1);
 const header=nodes(tree).find(n=>n.type==='Pressable'&&n.props?.accessibilityState?.expanded===false);assert.ok(header,'sales starts collapsed');header.props.onPress();tree=render();
 const yesterday=nodes(tree).find(n=>n.type==='Pressable'&&nodes(n).some(x=>x.children?.includes('Yesterday')));
 yesterday.props.onPress();render();assert.equal(pending.length,2);assert.ok(pending[1].url.endsWith('YESTERDAY'));
 const payload={sales:300,profit:170,orders:2,itemsSold:3,averageBill:150,margin:56.7,changePercent:100,chart:[{label:'00:00',value:300}],channels:[{channel:'ONLINE',orders:2,sales:300,share:100}]};
 pending[1].resolve(payload);await flush();render();assert.equal(state[2].period,'YESTERDAY');
 pending[0].resolve({...payload,sales:999});await flush();tree=render();assert.equal(state[2].data.sales,300,'old tab response must not replace current period');
 assert.ok(nodes(tree).some(n=>n.props?.style?.height===72),'sales chart is visible with sales');
 state[2]={period:'YESTERDAY',data:{...payload,sales:0,orders:0,chart:[{label:'00:00',value:0}],channels:[]}};
 tree=render();assert.ok(!nodes(tree).some(n=>n.props?.style?.height===72),'empty sales chart is hidden');
 assert.equal(tree.props.style[0].backgroundColor,'#FFFFFF','card follows theme background');
 tree=render(false);assert.ok(!JSON.stringify(tree).includes('Margin'),'profit metrics must be hidden without permission');
 console.log('Sales card full width, single request per period, stale response protection and permission rendering passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
