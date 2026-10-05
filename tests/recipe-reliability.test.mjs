import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Core from '../src/core/node-editor-core.mjs';
import Pipeline from '../src/image-pipeline/image-pipeline.mjs';

const html = fs.readFileSync(process.env.IMAGE_PIPELINE_HTML || 'src/index.template.html', 'utf8');
function source(name) {
  const match = new RegExp(`^      (?:async )?function ${name}\\(`, 'm').exec(html);
  if (!match) return '';
  const next = /\n {6}(?:function |async function |const |let |if\(|\$|window\.|document\.)/.exec(html.slice(match.index + match[0].length));
  const end = next ? match.index + match[0].length + next.index : undefined;
  return html.slice(match.index, end).trim();
}
class Element {
  constructor(tag = 'div') { this.tagName=tag; this.children=[]; this.dataset={}; this.disabled=false; this.value=''; this.hidden=false; this.textContent=''; this.className=''; this.attributes={}; this.classList={add(){},remove(){},toggle(){}}; }
  set textContent(value) { this.text=String(value); this.children=[]; }
  get textContent() { return this.text; }
  set innerHTML(value) { this.markup=String(value); this.children=[]; }
  get innerHTML() { return this.markup; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children=nodes; }
  setAttribute(name,value) { this.attributes[name]=value; }
  addEventListener(name,fn) { this['on'+name]=fn; }
  focus() { this.focused=true; }
}
function descendants(root) { return root.children.flatMap(child=>[child,...descendants(child)]); }
function harness() {
  const registry=Pipeline.createImageRegistry(Core),graph=Pipeline.createInitialImageGraph(Core,registry);
  const controls=new Map(), notices=[], writes=[], held=[], downloads=[], confirms=[];
  const $=id=>{ if(!controls.has(id))controls.set(id,new Element()); return controls.get(id); };
  const byClass=name=>[...controls.values()].flatMap(descendants).filter(e=>e.className.split(' ').includes(name));
  const document={createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag),querySelectorAll(selector){
    const found=[];
    for(const part of selector.split(',')) {
      if(part.includes('quick-recipe-actions'))found.push(...byClass('quick-recipe-actions').flatMap(e=>e.children));
      if(part.includes('quick-recipe-picker'))found.push(...byClass('quick-recipe-picker').flatMap(e=>e.children.filter(x=>x.tagName==='input')));
      if(part.includes('recipe-card-actions'))found.push(...byClass('recipe-card-actions').flatMap(e=>e.children));
    }
    return [...new Set(found)];
  }};
  const ctx={Core,Pipeline,registry,graph,AbortController,Set,Map,Date,Blob,console,document,$,
    APP_CONFIG:{version:'1.0.0'}, RECIPE_LIMIT:30,SAVED_WORKFLOWS_STORAGE_KEY:'recipes',
    savedWorkflows:[],quickRecipeFiles:new Map(),batchAbortController:null,activeBatchJob:null,batchResult:null,batchRunning:false,recipeMutationPending:false,
    sourceItems:[{id:'source',file:{name:'source.png',type:'image/png',size:10}}],
    supportedTypes:new Set(['image/png']),language:'en',
    t:(key,params={})=>key+JSON.stringify(params),AppToast:{show:message=>notices.push(message)},
    AppConfirm:{ask:async options=>{confirms.push(options);return ctx.confirmed;}},confirmed:true,
    window:{confirm:()=>ctx.confirmed},
    localStorage:{setItem(key,value){if(ctx.storageError)throw new Error('QuotaExceededError');writes.push({key,value});},getItem(){return writes.at(-1)?.value||null;}},
    nodeCanvas:{setInteractive:value=>ctx.interactive=value},runtimeStatusStore:{set(){},clearAll(){}},
    renderBatchStateSummary(){},renderGraphStatus:()=>({valid:true}),renderSourceList(){},focusGraphIssue(){},
    updateBatchProgress(){},renderBatchResults:result=>ctx.rendered=result,
    clearBatchResults(){ctx.batchResult=null;},isMobileLayout:()=>false,
    workflowDateLabel:()=>'',
    async encodeSourceOutputs(item,{signal}){held.push({item,signal});await new Promise(resolve=>held.at(-1).resolve=resolve);if(signal.aborted){const error=new Error('Cancelled');error.name='AbortError';throw error;}return {outputs:[{path:item.file.name,outputName:item.file.name,blob:new Blob(['synthetic'])}]};},
    async downloadCompletedBatchResult(result){downloads.push(result);return result.entries.some(e=>e.status==='success');},
  };
  vm.createContext(ctx);
  for(const name of ['recipeGraph','recipeFiles','renderRecipeList','renderQuickRecipes','persistSavedWorkflows','persistRecipes','saveRecipe','updateRecipe','deleteRecipe','setBatchRunning','releaseBatchResult','isCurrentBatchJob','runOwnedBatch','runBatch','runQuickRecipe']) {
    const code=source(name);if(code)vm.runInContext(code,ctx);
  }
  const record=(id,name=id)=>Pipeline.createSavedWorkflowRecord({id,name,document:Pipeline.createWorkflowDocument(Core,graph,{appVersion:'1.0.0',name}),updatedAt:'2026-10-01T00:00:00Z'});
  ctx.savedWorkflows=[record('A'),record('B')];
  for(const id of ['A','B'])ctx.quickRecipeFiles.set(id,[{name:id+'.png',type:'image/png',size:10}]);
  return {ctx,$,controls,notices,writes,held,downloads,confirms,record,byClass};
}
async function finish(h,promise,index=0) { h.held[index].resolve();await promise; }

test('quick Recipe starts share one owner, ignoring repeated and mixed regular launches',async()=>{
  const h=harness(),{ctx}=h;
  const first=ctx.runQuickRecipe('A');const owner=ctx.batchAbortController;
  void ctx.runQuickRecipe('B');void ctx.runQuickRecipe('A');void ctx.runBatch();
  assert.equal(h.held.length,1);assert.equal(ctx.batchAbortController,owner);assert.equal(ctx.batchRunning,true);
  await finish(h,first);assert.equal(h.downloads.length,1);assert.equal(ctx.batchRunning,false);assert.equal(ctx.batchAbortController,null);
});

test('regular launch blocks quick Recipe without replacing Cancel ownership',async()=>{
  const h=harness(),first=h.ctx.runBatch(),owner=h.ctx.batchAbortController;
  void h.ctx.runQuickRecipe('A');assert.equal(h.held.length,1);assert.equal(h.ctx.batchAbortController,owner);
  owner.abort();await finish(h,first);assert.equal(h.ctx.batchResult.status,'cancelled');assert.equal(h.ctx.batchRunning,false);
});

test('Cancel keeps ownership until completion, retains partial outputs and allows retry',async()=>{
  const h=harness(),{ctx}=h;ctx.quickRecipeFiles.get('A').push({name:'A2.png',type:'image/png',size:10});
  const first=ctx.runQuickRecipe('A');h.held[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.held.length,2);ctx.batchAbortController.abort();void ctx.runQuickRecipe('B');assert.equal(h.held.length,2);
  await finish(h,first,1);assert.equal(ctx.batchResult.status,'cancelled');assert.equal(ctx.batchResult.succeeded,1);
  assert.ok(!h.notices.some(x=>x.startsWith('quickRecipePreviewReady')));
  const retry=ctx.runQuickRecipe('B');assert.equal(h.held.length,3);await finish(h,retry,2);assert.equal(ctx.batchResult.status,'completed');
});

test('stale completion and finally cannot publish, download, or unlock a newer owner',async()=>{
  const h=harness(),{ctx}=h,first=ctx.runQuickRecipe('A');const old=ctx.batchAbortController;
  old.abort();const newer={controller:new AbortController(),recipeId:'B'};
  ctx.activeBatchJob=newer;ctx.batchAbortController=newer.controller;ctx.batchResult={marker:'newer'};
  await finish(h,first);
  assert.equal(ctx.batchResult.marker,'newer');assert.equal(ctx.batchRunning,true);assert.equal(ctx.batchAbortController,newer.controller);assert.equal(h.downloads.length,0);
});

test('quick controls and recreated localized cards stay disabled during a run; staging is ignored',async()=>{
  const h=harness(),{ctx}=h;ctx.renderQuickRecipes();const first=ctx.runQuickRecipe('A');
  ctx.language='ja';ctx.renderQuickRecipes();ctx.renderRecipeList();
  const actions=h.byClass('quick-recipe-actions').flatMap(x=>x.children),pickers=h.byClass('quick-recipe-picker');
  assert.ok(actions.length===4&&actions.every(x=>x.disabled));assert.ok(pickers.every(x=>x.children[0].disabled));
  assert.equal(h.$('#openRecipeLibraryButton').disabled,true);
  const before=ctx.recipeFiles('B');pickers[1].ondrop({preventDefault(){},dataTransfer:{files:[{name:'replacement.png',type:'image/png'}]}});
  assert.equal(ctx.recipeFiles('B'),before);assert.equal(before[0].name,'B.png');
  await finish(h,first);assert.ok(actions.every(x=>!x.disabled));
});

test('failed new Recipe save preserves collection, entered name and successful retry',()=>{
  const h=harness(),{ctx}=h,prior=ctx.savedWorkflows;ctx.storageError=true;h.$('#recipeNameInput').value='  New Recipe  ';
  ctx.saveRecipe();assert.equal(ctx.savedWorkflows,prior);assert.equal(h.$('#recipeNameInput').value,'  New Recipe  ');assert.equal(h.writes.length,0);
  assert.ok(h.notices.some(x=>x.startsWith('recipeStorageFailed')));assert.ok(!h.notices.some(x=>x.startsWith('recipeSaved')));
  ctx.storageError=false;ctx.saveRecipe();assert.equal(ctx.savedWorkflows.length,3);assert.equal(h.$('#recipeNameInput').value,'');assert.equal(JSON.parse(h.writes[0].value).length,3);
});

test('duplicate registration is case/whitespace-insensitive and never overwrites; changing name adds a Recipe',()=>{
  const h=harness(),prior=h.ctx.savedWorkflows;h.$('#recipeNameInput').value=' a ';h.ctx.saveRecipe();
  assert.equal(h.ctx.savedWorkflows,prior);assert.equal(h.writes.length,0);assert.equal(h.$('#recipeNameInput').value,' a ');
  assert.ok(h.notices.some(x=>x.startsWith('recipeNameExists')));
  h.$('#recipeNameInput').value='Different';h.ctx.saveRecipe();assert.equal(h.ctx.savedWorkflows.length,3);assert.deepEqual(h.ctx.savedWorkflows.find(x=>x.id==='A'),prior[0]);
});

for(const action of ['updateRecipe','deleteRecipe']) {
  test(`${action} asks explicitly, cancellation preserves collection and staged images`,async()=>{
    const h=harness(),prior=h.ctx.savedWorkflows,files=h.ctx.recipeFiles('A');h.ctx.confirmed=false;
    await h.ctx[action]('A');assert.equal(h.confirms.length,1);assert.equal(h.confirms[0].tone,'danger');assert.equal(h.ctx.savedWorkflows,prior);assert.equal(h.ctx.recipeFiles('A'),files);assert.equal(h.writes.length,0);
  });
  test(`${action} storage error preserves prior Recipe and staged images, then retry commits`,async()=>{
    const h=harness(),prior=h.ctx.savedWorkflows,files=h.ctx.recipeFiles('A');h.ctx.storageError=true;
    await h.ctx[action]('A');assert.equal(h.ctx.savedWorkflows,prior);assert.equal(h.ctx.recipeFiles('A'),files);assert.equal(h.writes.length,0);
    assert.ok(h.notices.some(x=>x.startsWith('recipeStorageFailed')));assert.ok(!h.notices.some(x=>/^(recipeUpdatedToast|recipeDeleted)/.test(x)));
    h.ctx.storageError=false;await h.ctx[action]('A');assert.equal(h.writes.length,1);assert.equal(h.ctx.quickRecipeFiles.get('A')?.length||0,0);
    assert.equal(h.ctx.savedWorkflows.length,action==='deleteRecipe'?1:2);
  });
}

test('30-Recipe limit stays stable after duplicate and failed persistence attempts',()=>{
  const h=harness();h.ctx.savedWorkflows=Array.from({length:30},(_,i)=>h.record('recipe'+i));const prior=h.ctx.savedWorkflows;
  h.$('#recipeNameInput').value='New';h.ctx.saveRecipe();assert.equal(h.ctx.savedWorkflows,prior);assert.equal(h.writes.length,0);
  h.$('#recipeNameInput').value=' RECIPE0 ';h.ctx.saveRecipe();assert.equal(h.ctx.savedWorkflows,prior);assert.equal(h.writes.length,0);
});

test('cancel before the first output never announces a downloaded Recipe',async()=>{
  const h=harness(),pending=h.ctx.runQuickRecipe('A');h.ctx.batchAbortController.abort();await finish(h,pending);
  assert.equal(h.ctx.batchResult.succeeded,0);assert.equal(h.ctx.batchResult.failed,0);
  assert.ok(h.notices.some(x=>x.startsWith('batchCancelledSummary')));assert.ok(!h.notices.some(x=>x.startsWith('quickRecipePreviewReady')));
});

test('all failed images keep error results without a false downloaded notice',async()=>{
  const h=harness();h.ctx.encodeSourceOutputs=async()=>{throw new Error('Invalid synthetic image')};await h.ctx.runQuickRecipe('A');
  assert.equal(h.ctx.batchResult.failed,1);assert.equal(h.ctx.batchResult.succeeded,0);assert.equal(h.ctx.batchRunning,false);
  assert.ok(!h.notices.some(x=>x.startsWith('quickRecipePreviewReady')));
});

test('stale progress and fatal rejection cannot change or unlock another run',async()=>{
  const h=harness();let progress,reject;h.ctx.Pipeline={...Pipeline,runBatchSequential:(_items,_encode,options)=>{progress=options.onProgress;return new Promise((_resolve,fail)=>reject=fail)}};
  const pending=h.ctx.runQuickRecipe('A'),newer={controller:new AbortController()};h.ctx.activeBatchJob=newer;h.ctx.batchAbortController=newer.controller;h.ctx.batchResult={marker:'new'};h.ctx.rendered={marker:'new'};
  progress({phase:'complete',result:{status:'success',value:{outputs:[]}}});reject(new Error('late failure'));await pending;
  assert.equal(h.ctx.rendered.marker,'new');assert.equal(h.ctx.batchResult.marker,'new');assert.equal(h.ctx.batchRunning,true);assert.equal(h.ctx.batchAbortController,newer.controller);
});

test('late ZIP preparation checks its owner again before download',async()=>{
  const h=harness();vm.runInContext(source('successfulOutputs'),h.ctx);vm.runInContext(source('downloadCompletedBatchResult'),h.ctx);
  let resolve,current=true;h.ctx.createBatchZip=()=>new Promise(done=>resolve=done);h.ctx.downloadBlob=()=>h.downloads.push('download');
  const result={entries:[{status:'success',value:{outputs:[{blob:new Blob(['a'])},{blob:new Blob(['b'])}]}}]};
  const pending=h.ctx.downloadCompletedBatchResult(result,{isCurrent:()=>current});current=false;resolve(new Blob(['zip']));
  assert.equal(await pending,false);assert.equal(h.downloads.length,0);
});

test('clear and next run release completed output references without clearing saved Recipes',async()=>{
  const h=harness();vm.runInContext(source('clearBatchResults'),h.ctx);const first=h.ctx.runQuickRecipe('A');await finish(h,first);
  const old=h.ctx.batchResult,recipes=JSON.stringify(h.ctx.savedWorkflows);h.ctx.clearBatchResults();
  assert.equal(h.ctx.batchResult,null);assert.equal(old.entries[0].value.outputs.length,0);assert.equal(JSON.stringify(h.ctx.savedWorkflows),recipes);
  const second=h.ctx.runQuickRecipe('B');await finish(h,second,1);assert.equal(h.ctx.batchResult.succeeded,1);
});

test('deleting the last Recipe commits an empty collection and hides quick access',async()=>{
  const h=harness();h.ctx.savedWorkflows=[h.record('A')];await h.ctx.deleteRecipe('A');
  assert.equal(h.ctx.savedWorkflows.length,0);assert.equal(h.writes[0].value,'[]');assert.equal(h.$('#quickRecipesSection').hidden,true);
});

test('pending Update cancellation and stale confirmation preserve the latest Recipe',async()=>{
  const h=harness();let decide;h.ctx.AppConfirm.ask=()=>new Promise(resolve=>decide=resolve);
  const pending=h.ctx.updateRecipe('A'),replacement=h.record('A','Changed elsewhere');h.ctx.savedWorkflows=[replacement];decide(true);await pending;
  assert.equal(h.ctx.savedWorkflows[0],replacement);assert.equal(h.writes.length,0);
});

test('Pipeline import that finishes during a run cannot clear that run or its input',async()=>{
  const h=harness();vm.runInContext(source('loadPipelineJson'),h.ctx);let resolve;let replaced=false,cleared=false;
  h.ctx.applyWorkflowGraph=()=>replaced=true;h.ctx.clearSourcesForRecipe=()=>cleared=true;
  const pending=h.ctx.loadPipelineJson({text:()=>new Promise(done=>resolve=done)});h.ctx.batchRunning=true;
  resolve(JSON.stringify(h.record('A').document));await pending;assert.equal(replaced,false);assert.equal(cleared,false);assert.equal(h.notices.length,0);
});


test('pagehide during partial output clears stale result controls before BFCache return',async()=>{
  const h=harness();for(const name of ['formatBytes','successfulOutputs','renderBatchResults','clearBatchResults'])vm.runInContext(source(name),h.ctx);
  Object.assign(h.ctx,{previewFrame:null,previewCache:{clear(){}},clearTimeout,recoverySaveTimer:0,saveCurrentWorkflowRecovery(){}});
  const pagehide=html.match(/window.addEventListener\('pagehide',(\(\)=>\{[^\n]*\})\);/)?.[1];assert.ok(pagehide);vm.runInContext('onPageHide='+pagehide,h.ctx);
  h.ctx.quickRecipeFiles.get('A').push({name:'A2.png',type:'image/png',size:10});const pending=h.ctx.runQuickRecipe('A');h.held[0].resolve();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.$('#saveZipButton').hidden,false);assert.ok(h.$('#batchResultList').children.length>0);
  h.ctx.onPageHide();assert.equal(h.$('#saveZipButton').hidden,true);assert.equal(h.$('#batchResultList').children.length,0);assert.equal(h.ctx.batchResult,null);
  await finish(h,pending,1);assert.equal(h.ctx.batchRunning,false);assert.equal(h.ctx.batchAbortController,null);assert.equal(h.downloads.length,0);assert.equal(h.$('#saveZipButton').hidden,true);
});
