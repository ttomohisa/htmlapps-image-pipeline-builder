import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Core from '../src/core/node-editor-core.mjs';
import Pipeline from '../src/image-pipeline/image-pipeline.mjs';

const html=fs.readFileSync(process.env.IMAGE_PIPELINE_HTML||'src/index.template.html','utf8');
function source(name){const match=new RegExp(`^      (?:async )?function ${name}\\(`,'m').exec(html);if(!match)return '';const next=/\n {6}(?:function |async function |const |let |if\(|\$|window\.|document\.)/.exec(html.slice(match.index+match[0].length));return html.slice(match.index,next?match.index+match[0].length+next.index:undefined).trim();}
class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.attributes={};this.open=false;this.disabled=false;this.dataset={};}
  append(...children){this.children.push(...children);}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return this.text;}
  addEventListener(name,fn){this['on'+name]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
  showModal(){this.open=true;}
  close(){this.open=false;this.onclose?.();}
  focus(){this.focused=true;}
  select(){this.selected=true;}
  getBoundingClientRect(){return {left:50,top:50,right:600,bottom:600};}
}
const registry=Pipeline.createImageRegistry(Core);
function documentFor(width,name='Synthetic Recipe'){const graph=Pipeline.createInitialImageGraph(Core,registry);const doc=Pipeline.createWorkflowDocument(Core,graph,{appVersion:'1.0.0',name});doc.graph.nodes.find(n=>n.type==='resize').data.width=width;doc.graph.nodes[0].position={x:123,y:456};return doc;}
function width(ctx){return ctx.graph.nodes.find(n=>n.type==='resize').data.width;}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject};}
function harness(){
  const controls=new Map(),downloads=[],notices=[],applied=[],recovery=[];
  const ctx={Core,Pipeline,registry,Blob,TextEncoder,graph:Pipeline.parseWorkflowDocument(Core,documentFor(111),{registry}).graph,
    APP_CONFIG:{version:'1.0.0'},RECIPE_LIMIT:30,savedWorkflows:[Pipeline.createSavedWorkflowRecord({id:'A',name:'保存 Recipe',document:documentFor(222,'保存 Recipe'),updatedAt:'2026-10-01T00:00:00Z'})],
    quickRecipeFiles:new Map([['A',[{name:'staged.png',type:'image/png'}]]]),recipeExportSnapshot:null,pipelineImportGeneration:0,
    batchRunning:false,batchAbortController:null,previewGeneration:0,previewFrame:{close(){}},sourceSequence:0,
    sourceItems:[{id:'source',file:{name:'synthetic.png',type:'image/png'}}],previewItemId:'source',batchResult:{sentinel:'completed'},
    currentWorkflowName:'old',activeSavedWorkflowId:null,lastPipelineSignature:'',supportedTypes:new Set(['image/png']),
    runtimeStatusStore:{clearAll(){}},previewCache:{clear(){}},
    nodeCanvas:{setGraph(g,options){ctx.graph=g;applied.push({width:width(ctx),options});},getGraph(){return ctx.graph;},selectNode(){},openInspector(){},fitView(){},setInteractive(){}},
    clearBatchResults(){ctx.batchResult=null;},invalidateBatchResults(){ctx.batchResult=null;},resetPreviewDisplay(){},
    renderSourceList(){},refreshSourceNodeSummary(){},renderGraphStatus(){},renderInspector(){},schedulePreview(){},scheduleWorkflowRecoverySave(){},renderBatchStateSummary(){},
    selectPreviewItem(id){ctx.previewItemId=id;},saveCurrentWorkflowRecovery(){recovery.push(width(ctx));},requestAnimationFrame:fn=>fn(),
    clearTimeout(){},recoverySaveTimer:0,activeBatchJob:null,setBatchRunning(value){ctx.batchRunning=value;},
    $:id=>{if(!controls.has(id))controls.set(id,new Element());return controls.get(id);},
    document:{createElement:tag=>new Element(tag),querySelectorAll:()=>[]},
    window:{confirm:()=>true},AppToast:{show:m=>notices.push(m)},t:k=>k,workflowDateLabel:()=>'',downloadBlob:(blob,name)=>downloads.push({blob,name})
  };
  vm.createContext(ctx);
  for(const name of ['invalidatePipelineImport','onWorkflowGraphChange','applyWorkflowGraph','clearSourcesForRecipe','loadPipelineJson','loadSourceFiles','removeSourceItem','clearSourceItems','pipelineExportName','openRecipeExport','saveRecipePipelineJson','closeRecipeExport','bindDialogBackdrop','renderRecipeList']){const code=source(name);if(code)vm.runInContext(code,ctx);}
  return {ctx,controls,downloads,notices,applied,recovery};
}
function stableState(h){return {graph:h.ctx.graph,sources:h.ctx.sourceItems,result:h.ctx.batchResult,recipes:h.ctx.savedWorkflows,staged:h.ctx.quickRecipeFiles.get('A'),name:h.ctx.currentWorkflowName,selected:h.ctx.previewItemId,bytes:JSON.stringify([h.ctx.graph,h.ctx.sourceItems,h.ctx.batchResult,h.ctx.savedWorkflows,[...h.ctx.quickRecipeFiles]])};}
function assertUnchanged(h,before){assert.deepEqual(stableState(h),before);assert.equal(h.applied.length,0);assert.equal(h.recovery.length,0);}

test('Recipe library offers a localized Export Pipeline JSON action without applying it',()=>{const h=harness();h.ctx.renderRecipeList();const buttons=h.ctx.$('#recipeList').children[0].children[1].children;const button=buttons.find(b=>b.textContent==='recipeExport');assert.ok(button);button.onclick();assert.equal(h.ctx.$('#recipeExportDialog').open,true);assert.equal(h.applied.length,0);});

test('saved Recipe snapshot round-trips layout, connections, settings and name independently of Canvas',async()=>{
 const h=harness(),before=stableState(h),saved=structuredClone(h.ctx.savedWorkflows[0].document);
 h.ctx.openRecipeExport('A');assert.equal(h.ctx.$('#recipeExportFilename').value,'保存 Recipe.image-pipeline.json');
 h.ctx.$('#recipeExportFilename').value='my revised backup.json';h.ctx.saveRecipePipelineJson();
 assert.equal(h.downloads.length,1);assert.equal(h.downloads[0].name,'my revised backup.image-pipeline.json');
 const exported=JSON.parse(await h.downloads[0].blob.text());assert.deepEqual(exported,saved);assert.equal(exported.formatVersion,1);
 assert.equal(Pipeline.parseWorkflowDocument(Core,exported,{registry}).graph.nodes.find(n=>n.type==='resize').data.width,222);
 assertUnchanged(h,before);assert.equal(h.ctx.$('#recipeExportDialog').open,false);assert.equal(h.ctx.recipeExportSnapshot,null);
});

test('open export captures an immutable validated snapshot and cancellation/reopen uses a fresh snapshot',async()=>{
 const h=harness();h.ctx.openRecipeExport('A');h.ctx.savedWorkflows[0].document.graph.nodes.find(n=>n.type==='resize').data.width=333;
 h.ctx.saveRecipePipelineJson();assert.equal(JSON.parse(await h.downloads[0].blob.text()).graph.nodes.find(n=>n.type==='resize').data.width,222);
 h.ctx.openRecipeExport('A');h.ctx.$('#recipeExportFilename').value='cancel me';h.ctx.closeRecipeExport();assert.equal(h.downloads.length,1);assert.equal(h.ctx.recipeExportSnapshot,null);
 h.ctx.openRecipeExport('A');assert.equal(h.ctx.$('#recipeExportFilename').value,'保存 Recipe.image-pipeline.json');h.ctx.saveRecipePipelineJson();
 assert.equal(JSON.parse(await h.downloads[1].blob.text()).graph.nodes.find(n=>n.type==='resize').data.width,333);
});

for(const [input,expected] of [['','image-pipeline.image-pipeline.json'],[' . ','image-pipeline.image-pipeline.json'],['../bad\\name\u0000:*?"<>|.JSON','badname.image-pipeline.json'],['写真 🌿.image-pipeline.json','写真 🌿.image-pipeline.json'],['name.image-pipeline.json.image-pipeline.json','name.image-pipeline.json'],['CON','_CON.image-pipeline.json']]){
 test(`safe predictable filename: ${JSON.stringify(input)}`,()=>assert.equal(harness().ctx.pipelineExportName(input),expected));
}
test('long multibyte filename is bounded without splitting Unicode characters',()=>{const name=harness().ctx.pipelineExportName('写真🌿'.repeat(100));assert.ok(new TextEncoder().encode(name).length<=240);assert.ok(!name.includes('\ufffd'));assert.ok(name.endsWith('.image-pipeline.json'));});

test('invalid or missing saved Recipe cannot download or mutate user work',()=>{const h=harness();h.ctx.savedWorkflows[0].document.formatVersion=99;const before=stableState(h);h.ctx.openRecipeExport('A');h.ctx.saveRecipePipelineJson();h.ctx.openRecipeExport('missing');assert.equal(h.downloads.length,0);assertUnchanged(h,before);assert.ok(h.notices.includes('recipeExportFailed'));});
test('read-only export remains disabled and guarded during an owned Batch',()=>{const h=harness();h.ctx.batchRunning=true;h.ctx.renderRecipeList();assert.ok(h.ctx.$('#recipeList').children[0].children[1].children.every(b=>b.disabled));h.ctx.openRecipeExport('A');assert.equal(h.ctx.$('#recipeExportDialog').open,false);h.ctx.batchRunning=false;h.ctx.openRecipeExport('A');h.ctx.batchRunning=true;h.ctx.saveRecipePipelineJson();assert.equal(h.downloads.length,0);});
test('failed download retains export snapshot/name for retry without false success',()=>{const h=harness();h.ctx.openRecipeExport('A');h.ctx.$('#recipeExportFilename').value='retry';h.ctx.downloadBlob=()=>{throw Error('synthetic download failure')};h.ctx.saveRecipePipelineJson();assert.equal(h.ctx.$('#recipeExportDialog').open,true);assert.equal(h.ctx.$('#recipeExportFilename').value,'retry');assert.ok(h.ctx.recipeExportSnapshot);assert.deepEqual(h.notices,['recipeExportFailed']);});

test('export dialog has labeled input, native keyboard submit/cancel, narrow-safe layout and both locales',()=>{
 assert.match(html,/<dialog id="recipeExportDialog"[^>]*aria-labelledby="recipeExportTitle"/);
 assert.match(html,/id="recipeExportFilename"[^>]*aria-describedby="recipeExportHint"/);
 assert.match(html,/id="recipeExportSaveButton"[^>]*type="submit"/);
 for(const key of ['recipeExport','recipeExportTitle','recipeExportHint','recipeExportFailed'])assert.equal((html.match(new RegExp(key+":'",'g'))||[]).length,2,key);
 assert.match(html,/recipeExportForm'\)\.addEventListener\('submit',event=>\{event.preventDefault\(\);saveRecipePipelineJson\(\)\}/);
 assert.match(html,/recipeExportDialog'\)\.addEventListener\('close',\(\)=>\{if\(!\$\('#recipeExportDialog'\)\.open\)recipeExportSnapshot=null\}/);
 assert.match(html,/bindDialogBackdrop\(\$\('#recipeExportDialog'\)\)/);
 assert.match(html,/\.recipe-export-actions\{[^}]*flex-wrap:wrap/);
});

test('current valid import commits once with history reset and owned input cleanup',async()=>{const h=harness();h.ctx.$('#pipelineFileInput').value='A';await h.ctx.loadPipelineJson({text:async()=>JSON.stringify(documentFor(222))});assert.equal(width(h.ctx),222);assert.equal(h.applied.length,1);assert.equal(h.ctx.sourceItems.length,0);assert.equal(h.ctx.batchResult,null);assert.equal(h.applied[0].options.resetHistory,true);assert.deepEqual(h.notices,['pipelineLoaded']);assert.equal(h.ctx.$('#pipelineFileInput').value,'');});
for(const outcome of ['valid','malformed','rejected'])test(`older ${outcome} read cannot overwrite or announce after a newer import`,async()=>{
 const h=harness(),a=deferred(),b=deferred();const old=h.ctx.loadPipelineJson({text:()=>a.promise});const recent=h.ctx.loadPipelineJson({text:()=>b.promise});
 b.resolve(JSON.stringify(documentFor(333)));await recent;h.ctx.$('#pipelineFileInput').value='newer picker';
 if(outcome==='rejected')a.reject(Error('late synthetic failure'));else a.resolve(outcome==='valid'?JSON.stringify(documentFor(222)):'{');await old;
 assert.equal(width(h.ctx),333);assert.deepEqual(h.recovery,[333]);assert.deepEqual(h.notices,['pipelineLoaded']);assert.equal(h.ctx.$('#pipelineFileInput').value,'newer picker');
});
test('earlier import finishing first cannot clear a newer pending file selection',async()=>{const h=harness(),a=deferred(),b=deferred();const old=h.ctx.loadPipelineJson({text:()=>a.promise});const recent=h.ctx.loadPipelineJson({text:()=>b.promise});h.ctx.$('#pipelineFileInput').value='B';a.resolve(JSON.stringify(documentFor(222)));await old;assert.equal(width(h.ctx),111);assert.equal(h.ctx.$('#pipelineFileInput').value,'B');b.resolve(JSON.stringify(documentFor(333)));await recent;assert.equal(width(h.ctx),333);});
for(const outcome of ['valid','malformed','rejected'])test(`newer Canvas replacement invalidates older ${outcome} read and cleanup`,async()=>{
 const h=harness(),d=deferred(),old=h.ctx.loadPipelineJson({text:()=>d.promise});h.ctx.applyWorkflowGraph(Pipeline.parseWorkflowDocument(Core,documentFor(444),{registry}).graph);h.ctx.sourceItems=[{id:'new',file:{name:'new.png'}}];h.ctx.$('#pipelineFileInput').value='new selection';const before=stableState(h);
 if(outcome==='rejected')d.reject(Error('late read'));else d.resolve(outcome==='valid'?JSON.stringify(documentFor(222)):'{');await old;
 assert.deepEqual(stableState(h),before);assert.equal(width(h.ctx),444);assert.deepEqual(h.recovery,[444]);assert.deepEqual(h.notices,[]);assert.equal(h.ctx.$('#pipelineFileInput').value,'new selection');
});
for(const mutation of ['add','remove','clear','edit','undo'])test(`newer ${mutation} revision invalidates pending JSON`,async()=>{
 const h=harness(),d=deferred(),old=h.ctx.loadPipelineJson({text:()=>d.promise});
 if(mutation==='add')await h.ctx.loadSourceFiles([{name:'new.png',type:'image/png'}]);
 if(mutation==='remove')h.ctx.removeSourceItem('source');
 if(mutation==='clear')h.ctx.clearSourceItems();
 if(mutation==='edit'||mutation==='undo')h.ctx.onWorkflowGraphChange(Pipeline.parseWorkflowDocument(Core,documentFor(555),{registry}).graph);
 const before=stableState(h),notices=[...h.notices];h.ctx.$('#pipelineFileInput').value='new picker';d.resolve(JSON.stringify(documentFor(222)));await old;
 assert.deepEqual(stableState(h),before);assert.deepEqual(h.notices,notices);assert.equal(h.applied.length,0);assert.equal(h.ctx.$('#pipelineFileInput').value,'new picker');
});
test('pagehide invalidates pending import before later BFCache restoration',async()=>{const h=harness(),d=deferred(),old=h.ctx.loadPipelineJson({text:()=>d.promise});const callback=html.match(/window.addEventListener\('pagehide',(\(\)=>\{[^\n]*\})\);/)?.[1];assert.ok(callback);vm.runInContext('onPageHide='+callback,h.ctx);h.ctx.onPageHide();d.resolve(JSON.stringify(documentFor(222)));await old;assert.equal(width(h.ctx),111);assert.equal(h.applied.length,0);assert.deepEqual(h.notices,[]);});
test('starting and finishing Batch invalidates an earlier import permanently',async()=>{const h=harness(),d=deferred(),old=h.ctx.loadPipelineJson({text:()=>d.promise});vm.runInContext(source('setBatchRunning'),h.ctx);h.ctx.setBatchRunning(true);h.ctx.setBatchRunning(false);d.resolve(JSON.stringify(documentFor(222)));await old;assert.equal(width(h.ctx),111);assert.equal(h.applied.length,0);assert.deepEqual(h.notices,[]);});
test('invalid current JSON retains graph, sources, output and history, then valid retry works',async()=>{const h=harness(),before=stableState(h);await h.ctx.loadPipelineJson({text:async()=>'{'});assertUnchanged(h,before);assert.deepEqual(h.notices,['pipelineLoadFailed']);await h.ctx.loadPipelineJson({text:async()=>JSON.stringify(documentFor(222))});assert.equal(width(h.ctx),222);});
test('graph callback routes edit/undo/redo through Consumer ownership invalidation',()=>assert.match(html,/onChange:onWorkflowGraphChange,/));

function bindExportDialog(ctx){const start=html.indexOf("      $('#recipeExportForm').addEventListener");const end=html.indexOf('      const PRESET_NAME_KEYS=',start);assert.ok(start>=0&&end>start);vm.runInContext(html.slice(start,end),ctx);}
test('keyboard click from nested Recipe action cannot dismiss its parent dialog',()=>{const h=harness(),dialog=h.ctx.$('#recipeDialog');dialog.open=true;h.ctx.bindDialogBackdrop(dialog);dialog.onclick({target:new Element('button'),clientX:0,clientY:0});assert.equal(dialog.open,true);dialog.onclick({target:dialog,clientX:20,clientY:20});assert.equal(dialog.open,false);});
test('queued old native close event cannot discard a reopened export snapshot',()=>{const h=harness();bindExportDialog(h.ctx);const dialog=h.ctx.$('#recipeExportDialog');dialog.close=()=>{dialog.open=false};h.ctx.openRecipeExport('A');h.ctx.closeRecipeExport();h.ctx.openRecipeExport('A');const snapshot=h.ctx.recipeExportSnapshot;dialog.onclose();assert.equal(h.ctx.recipeExportSnapshot,snapshot);h.ctx.saveRecipePipelineJson();assert.equal(h.downloads.length,1);});
test('native cancellation blocks any queued submit before its close event arrives',()=>{const h=harness();bindExportDialog(h.ctx);h.ctx.openRecipeExport('A');h.ctx.$('#recipeExportDialog').open=false;let prevented=false;h.ctx.$('#recipeExportForm').onsubmit({preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(h.downloads.length,0);h.ctx.$('#recipeExportDialog').onclose();assert.equal(h.ctx.recipeExportSnapshot,null);});
