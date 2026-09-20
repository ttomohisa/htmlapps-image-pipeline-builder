import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('src/index.template.html', 'utf8');
const config = JSON.parse(fs.readFileSync('app.config.json', 'utf8'));

test('app config identifies Image Pipeline Builder v1.0.0', () => {
  assert.equal(config.name, 'Image Pipeline Builder');
  assert.equal(config.nameJa, '画像処理パイプライン');
  assert.equal(config.slug, 'image-pipeline-builder');
  assert.equal(config.version, '1.0.0');
  assert.equal(config.build.blockRuntimeNetwork, true);
});

test('consumer shell exposes palette canvas preview inspector and local file actions', () => {
  for (const token of [
    'id="nodePalette"', 'id="nodeCanvas"', 'id="previewCanvas"', 'id="inspectorBody"',
    'id="imageFileInput"', 'id="dropZone"', 'id="resizeWidth"', 'id="resizeHeight"',
    'id="outputFormat"', 'id="outputQuality"', 'id="outputFilename"', 'id="saveOutputButton"',
    'const Pipeline = globalThis.ImagePipeline;'
  ]) assert.ok(html.includes(token), `missing UI token: ${token}`);
});

test('consumer shell contains the three initial node labels and no Core harness demo copy', () => {
  for (const token of ['node.images', 'node.resize', 'node.output']) assert.ok(html.includes(token));
  for (const forbidden of ['Benchmark', 'FFmpeg migration ready', 'node-editor-core-graph', 'Transform Nodeを追加']) {
    assert.equal(html.includes(forbidden), false, `Core harness copy remains: ${forbidden}`);
  }
});

test('v0.4 shell states supported formats and fully local processing', () => {
  assert.match(html, /JPEG\s*\/\s*PNG\s*\/\s*WebP/);
  assert.ok(html.includes('完全ローカル処理'));
  assert.ok(html.includes("connect-src 'none'"));
});


test('workspace mirrors the FFmpeg builder three-panel collapse pattern', () => {
  for (const token of [
    'id="workspaceEditor"',
    'id="closePaletteButton"',
    'id="closeInspectorButton"',
    'id="togglePaletteButton"',
    'id="toggleInspectorButton"',
    'palette-collapsed',
    'inspector-collapsed',
    'setWorkspaceSidebar',
    'toggleWorkspaceSidebar'
  ]) assert.ok(html.includes(token), `missing workspace parity token: ${token}`);
});

test('floating workspace expands the whole editor rather than only the canvas panel', () => {
  assert.match(html, /\.workspace\.workspace-expanded\s*\{/);
  assert.ok(html.includes('setWorkspaceFloating'));
  assert.equal(html.includes('.canvas-floating .canvas-panel'), false);
});

test('consumer overrides the Core canvas host so it fills the full canvas region', () => {
  assert.match(html, /\.canvas-wrap\s*>\s*\.node-canvas\.nec-canvas\s*\{[^}]*position\s*:\s*absolute[^}]*inset\s*:\s*0[^}]*height\s*:\s*100%[^}]*min-height\s*:\s*0/s);
});


test('v0.4 shell exposes multi-image management, preview navigation, and batch controls', () => {
  for (const token of [
    'id="sourceFileList"', 'id="addImagesButton"', 'id="clearImagesButton"',
    'id="previousPreviewButton"', 'id="nextPreviewButton"', 'id="previewCounter"',
    'id="runBatchButton"', 'id="cancelBatchButton"', 'id="batchProgress"',
    'id="batchResultList"', 'id="saveZipButton"',
    'loadSourceFiles', 'selectPreviewItem', 'runBatchSequential', 'runBatch'
  ]) assert.ok(html.includes(token), `missing v0.2 batch token: ${token}`);
  assert.match(html, /id="imageFileInput"[^>]*\bmultiple\b/);
});

test('v0.4 copy describes multiple images and no longer claims one-image scope', () => {
  assert.equal(html.includes('v0.1.1では1枚ずつ扱います'), false);
  assert.equal(html.includes('v0.1.1 handles one image at a time'), false);
  assert.ok(html.includes('複数画像'));
  assert.ok(html.includes('multiple images'));
});

test('v0.4 release copy and batch errors are version-consistent and generic', () => {
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  assert.ok(html.includes('id="dropBody"'));
  assert.ok(html.includes("batchItemFailed:'画像を処理できませんでした。'"));
  assert.ok(html.includes("batchItemFailed:'Could not process the image.'"));
  assert.ok(html.includes("strong.textContent=t('batchItemFailed')"));
});

test('hidden UI states stay hidden even when component CSS declares display', () => {
  assert.match(html, /\.preview-empty\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/);
});

test('language switching preserves selected filename and completed batch summary', () => {
  assert.ok(html.includes('function renderPreviewFileName()'));
  assert.ok(html.includes('function renderBatchStateSummary()'));
  assert.match(html, /setTextTranslations\(\);[^\n]*renderPreviewFileName\(\);[^\n]*renderBatchStateSummary\(\)/);  assert.ok(html.includes('Pipeline.pipelineGraphSignature'));
  assert.ok(html.includes('processingChanged'));
});


test('v0.4 allows reusable geometry/output nodes while keeping Images singleton', () => {
  assert.ok(html.includes("if(type==='images'&&graph.nodes.some(n=>n.type==='images'))"));
  assert.equal(html.includes("graph.nodes.some(n=>n.type===type)"), false);
});

test('v0.4 output inspector exposes label folder and filename template settings', () => {
  for (const token of [
    'id=\"outputLabel\"', 'id=\"outputFolder\"', 'id=\"outputFilename\"',
    'outputFolderHint', 'filenameTemplateHint'
  ]) assert.ok(html.includes(token), `missing output setting: ${token}`);
});

test('v0.4 batch output is grouped by source and can be saved as one ZIP', () => {
  for (const token of [
    'id=\"saveZipButton\"', 'createBatchZip', 'encodeSourceOutputs',
    'resolveUniqueOutputPath', 'buildStoredZip', 'batchZipReady'
  ]) assert.ok(html.includes(token), `missing v0.3 branch/zip token: ${token}`);
  assert.equal(html.includes('id=\"saveAllResultsButton\"'), false);
});

test('v0.4 copy no longer says branches or ZIP are future work', () => {
  assert.equal(html.includes('分岐、複数Output、ZIP出力は今後追加します。'), false);
  assert.equal(html.includes('Branches, multiple outputs, and ZIP export come later.'), false);
  assert.ok(html.includes('複数Output'));
  assert.ok(html.includes('multiple outputs'));
});

test('v0.4 blocks execution for unsafe output folders and focuses that Output node', () => {
  assert.ok(html.includes('Pipeline.validateOutputSettings'));
  assert.ok(html.includes("invalid-output-folder"));
  assert.ok(html.includes('focusConsumerIssue'));
});

test('v0.4 places newly added nodes beside the selection and avoids occupied positions across node types', () => {
  assert.ok(html.includes('function nextNodePosition'));
  assert.ok(html.includes('nodeCanvas.getPrimarySelection()'));
  assert.ok(html.includes('selected?.position'));
  assert.ok(html.includes('Math.abs(node.position.x-candidate.x)<200'));
  assert.ok(html.includes('candidate={x:candidate.x,y:candidate.y+120}'));
  assert.ok(html.includes('flowPosition||nextNodePosition()'));
});


test('v0.4 palette and inspector expose all geometry nodes', () => {
  for (const token of [
    'data-node-type="crop"', 'data-node-type="rotate"', 'data-node-type="flip"', 'data-node-type="canvas"',
    'id="cropInspector"', 'id="rotateInspector"', 'id="flipInspector"', 'id="canvasInspector"',
    'id="resizeFit"', 'id="cropMode"', 'id="cropRatio"', 'id="cropAnchor"',
    'id="rotateAnglePreset"', 'id="rotateCustomAngle"', 'id="flipDirection"',
    'id="canvasWidth"', 'id="canvasHeight"', 'id="canvasAnchor"', 'id="canvasBackground"', 'id="canvasBackgroundColor"'
  ]) assert.ok(html.includes(token), `missing v0.4 geometry UI token: ${token}`);
});

test('v0.4 runtime evaluates crop rotate flip and canvas nodes', () => {
  for (const token of [
    "node.type==='crop'", "node.type==='rotate'", "node.type==='flip'", "node.type==='canvas'",
    'Pipeline.calculateCropRect', 'Pipeline.calculateRotatedBounds', 'Pipeline.calculateCanvasPlacement'
  ]) assert.ok(html.includes(token), `missing geometry runtime token: ${token}`);
});

test('v0.4 release copy and help describe geometry processing', () => {
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  for (const token of ['Crop', 'Rotate', 'Flip', 'Canvas', 'v1.0.0']) assert.ok(html.includes(token), `missing v0.4 copy: ${token}`);
});


test('v0.5 preview exposes Before After mode and cache status controls', () => {
  for (const token of [
    'id="previewBeforeButton"', 'id="previewAfterButton"', 'id="previewStatus"',
    'previewSubgraphSignature', 'previewTargetNodeId', 'createLruCache',
    'previewMode', 'previewCache', 'renderPreviewMode'
  ]) assert.ok(html.includes(token), `missing v0.5 preview token: ${token}`);
});

test('v0.5 preview cache keys are scoped to representative image and upstream graph', () => {
  assert.ok(html.includes('selectedSourceItem().id'));
  assert.ok(html.includes('Pipeline.previewSubgraphSignature'));
  assert.ok(html.includes('Pipeline.previewTargetNodeId'));
  assert.ok(html.includes("previewMode==='before'"));
});

test('v0.5 preview has explicit loading cached ready and error states', () => {
  for (const key of ['previewLoading', 'previewCached', 'previewReady', 'previewFailed']) {
    assert.ok(html.includes(key), `missing preview state copy: ${key}`);
  }
});

test('v0.5 release copy identifies intermediate preview scope', () => {
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  assert.ok(html.includes('Before'));
  assert.ok(html.includes('After'));
  assert.ok(html.includes('v1.0.0'));
});

test('v0.6 palette and inspector expose appearance and composition nodes', () => {
  for (const token of [
    'data-node-type="adjust"', 'data-node-type="grayscale"', 'data-node-type="blur"', 'data-node-type="sharpen"',
    'data-node-type="border"', 'data-node-type="rounded-corners"', 'data-node-type="text-watermark"',
    'id="adjustInspector"', 'id="grayscaleInspector"', 'id="blurInspector"', 'id="sharpenInspector"',
    'id="borderInspector"', 'id="roundedCornersInspector"', 'id="textWatermarkInspector"'
  ]) assert.ok(html.includes(token), `missing v0.6 appearance/composition UI token: ${token}`);
});

test('v0.6 runtime evaluates all appearance and composition nodes', () => {
  for (const token of [
    "node.type==='adjust'", "node.type==='grayscale'", "node.type==='blur'", "node.type==='sharpen'",
    "node.type==='border'", "node.type==='rounded-corners'", "node.type==='text-watermark'",
    'Pipeline.sharpenRgba', 'Pipeline.calculateBorderGeometry', 'Pipeline.calculateRoundedCornerRadius', 'Pipeline.calculateWatermarkPosition'
  ]) assert.ok(html.includes(token), `missing v0.6 runtime token: ${token}`);
});

test('v0.6 release metadata and copy describe appearance and composition scope', () => {
  assert.equal(config.version, '1.0.0');
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  for (const token of ['Adjust', 'Grayscale', 'Blur', 'Sharpen', 'Border', 'Rounded Corners', 'Text Watermark']) {
    assert.ok(html.includes(token), `missing v0.6 copy: ${token}`);
  }
});

test('v0.6 canvas node labels resolve registry titleKey instead of deriving i18n keys from dashed types', () => {
  assert.ok(html.includes("registry.get(node.type)?.titleKey"));
  assert.equal(html.includes("function nodeLabel(node){return t(`node.${node.type}`)}"), false);
});

test('v0.7 reusable flow infrastructure remains available through Recipe, presets, Pipeline JSON, and auto recovery', () => {
  for (const token of [
    'id="recipeButton"', 'id="presetButton"', 'id="recipeDialog"', 'id="presetDialog"',
    'id="recipeNameInput"', 'id="saveRecipeButton"', 'id="recipeList"',
    'id="savePipelineButton"', 'id="loadPipelineButton"', 'id="pipelineFileInput"',
    'data-preset-id="web-images"', 'data-preset-id="main-thumbnail"', 'data-preset-id="social-square"',
    'data-preset-id="watermark"', 'data-preset-id="blank"',
    'saveCurrentWorkflowRecovery', 'restoreCurrentWorkflowRecovery', 'renderRecipeList', 'applyBuiltInWorkflow'
  ]) assert.ok(html.includes(token), `missing reusable flow UI token: ${token}`);
});

test('v0.7 workflow storage never persists image File objects and uses workflow envelopes', () => {
  assert.ok(html.includes('Pipeline.createWorkflowDocument'));
  assert.ok(html.includes('Pipeline.parseWorkflowDocument'));
  assert.ok(html.includes('image-pipeline-builder.current-workflow'));
  assert.ok(html.includes('image-pipeline-builder.saved-workflows'));
  assert.equal(html.includes('JSON.stringify(sourceItems)'), false);
});

test('v0.7 release metadata and help describe reusable workflows', () => {
  assert.equal(config.version, '1.0.0');
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  for (const token of ['Recipe', 'テンプレート', 'JSON', 'v1.0.0']) assert.ok(html.includes(token), `missing v0.7 copy: ${token}`);
});

test('v0.8 release metadata identifies the mobile UX and accessibility phase', () => {
  assert.equal(config.version, '1.0.0');
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  assert.ok(html.includes('v1.0.0'));
});

test('v0.8 mobile bottom navigation exposes Flow Images Node and Run pages', () => {
  for (const token of [
    'id="mobileBottomNav"',
    'data-mobile-page="flow"',
    'data-mobile-page="images"',
    'data-mobile-page="node"',
    'data-mobile-page="run"',
    'mobileNavFlow', 'mobileNavImages', 'mobileNavNode', 'mobileNavRun',
    'setMobilePage', 'mobile-page-flow', 'mobile-page-images', 'mobile-page-node', 'mobile-page-run'
  ]) assert.ok(html.includes(token), `missing v0.8 mobile navigation token: ${token}`);
});

test('v0.8 mobile Flow uses the node palette as a bottom sheet instead of stacking it below the canvas', () => {
  for (const token of ['id="mobileSheetBackdrop"', 'mobile-palette-open', 'mobile-sheet-backdrop', 'addNodeMobile']) {
    assert.ok(html.includes(token), `missing v0.8 mobile palette token: ${token}`);
  }
  assert.match(html, /@media\(max-width:600px\)[\s\S]*\.palette-panel\{display:none/);
  assert.match(html, /(?:body\.)?mobile-palette-open\s+\.palette-panel\{display:block!important;position:fixed/);
});

test('v0.8 mobile pages keep fixed navigation clear of content and respect safe areas', () => {
  assert.match(html, /--mobile-nav-height\s*:\s*74px/);
  assert.match(html, /padding-bottom:calc\(var\(--mobile-nav-height\) \+ env\(safe-area-inset-bottom\)/);
  assert.match(html, /\.mobile-bottom-nav\{position:fixed/);
  assert.match(html, /padding:[^}]*env\(safe-area-inset-bottom\)/);
});

test('v0.8 palette search filters node buttons without changing graph data', () => {
  for (const token of ['id="paletteSearchInput"', 'id="clearPaletteSearchButton"', 'applyPaletteSearch', 'paletteSearchText']) {
    assert.ok(html.includes(token), `missing v0.8 palette search token: ${token}`);
  }
});

test('v0.8 accessibility adds mobile announcements and keyboard batch execution', () => {
  for (const token of [
    'id="mobileStatusAnnouncer"', 'aria-live="polite"', 'aria-atomic="true"',
    'aria-keyshortcuts="Control+Enter Meta+Enter"', 'isTypingTarget', "e.key==='Enter'", '(e.ctrlKey||e.metaKey)'
  ]) assert.ok(html.includes(token), `missing v0.8 accessibility token: ${token}`);
  assert.match(html, /\.mobile-nav-item\{[^}]*min-height:54px/s);
});

test('v0.8 mobile Images and Node tabs select the appropriate inspector context', () => {
  for (const token of ['lastEditableNodeId', 'selectImagesNodeForMobile', 'selectEditableNodeForMobile']) {
    assert.ok(html.includes(token), `missing v0.8 mobile inspector token: ${token}`);
  }
});

test('v0.8 dialogs and long filenames remain bounded on small screens', () => {
  assert.match(html, /@media\(max-width:600px\)[\s\S]*dialog\{[^}]*max-height:calc\(100dvh/);
  assert.match(html, /\.source-file-name[^}]*overflow-wrap:anywhere/);
});

test('v0.8 mobile canvas toolbar wraps controls instead of requiring horizontal scrolling', () => {
  assert.match(html, /\.canvas-tools\{flex-wrap:wrap;overflow:visible/);
});

test('v0.8 refreshes the Images node summary when the source list changes', () => {
  assert.ok(html.includes('refreshSourceNodeSummary'));
  assert.match(html, /loadSourceFiles[\s\S]*refreshSourceNodeSummary\(\)/);
  assert.match(html, /removeSourceItem[\s\S]*refreshSourceNodeSummary\(\)/);
  assert.match(html, /clearSourceItems[\s\S]*refreshSourceNodeSummary\(\)/);
});

test('v1.0.0 uses the supplied Image Pipeline Builder icon for favicon and header', () => {
  const favicon = fs.readFileSync('assets/favicon.svg', 'utf8').trim();
  assert.ok(favicon.includes('viewBox="0 0 64 64"'));
  assert.ok(favicon.includes('width="59" height="59" rx="14.75"'));
  assert.ok(favicon.includes('#11644f'));
  assert.ok(html.includes('id="appBrandIcon" src="__APP_ICON_DATA_URI__"'));
});

test('v1.0.0 header and local badge follow PDF Pipeline Builder structure', () => {
  for (const token of [
    'class="brand-mark"', 'class="brand-name"', 'class="brand-meta"',
    'class="page-intro"', 'class="local-badge"', 'data-i18n="localBadge"',
    '<path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6z"',
    '<path d="m9 12 2 2 4-5"'
  ]) assert.ok(html.includes(token), `missing PDF Builder parity token: ${token}`);
});

test('v1.0.0 Recipe UX mirrors PDF Pipeline Builder quick recipe and library flow', () => {
  for (const token of [
    'id="quickRecipesSection"', 'id="quickRecipeList"', 'id="openRecipeLibraryButton"',
    'id="recipeDialog"', 'id="recipeNameInput"', 'id="saveRecipeButton"', 'id="recipeList"',
    'renderQuickRecipes', 'runQuickRecipe', 'applyRecipe', 'saveRecipe', 'updateRecipe', 'deleteRecipe',
    'quickRecipeApplyCanvas', 'quickRecipeUse', 'manageRecipes'
  ]) assert.ok(html.includes(token), `missing Recipe parity token: ${token}`);
});

test('v1.0.0 exposes Pipeline JSON save and open separately from Recipe storage', () => {
  for (const token of [
    'id="savePipelineButton"', 'id="loadPipelineButton"', 'id="pipelineFileInput"',
    'savePipelineJson', 'loadPipelineJson', 'savePipeline', 'loadPipeline'
  ]) assert.ok(html.includes(token), `missing Pipeline JSON token: ${token}`);
  assert.ok(html.includes('Recipe'));
});

test('v1.0.0 language refresh does not depend on the removed legacy brandName element', () => {
  assert.equal(html.includes("$('#brandName').textContent"), false);
  assert.ok(html.includes('class="brand-name"'));
  assert.ok(html.includes("document.title=APP_CONFIG.name"));
});

test('v1.0.0 quick Recipe execution reveals the Run page on mobile', () => {
  assert.match(html, /runQuickRecipe\(id,button\)\{[^\n]*isMobileLayout\(\)[^\n]*setMobilePage\('run'/);
});

test('v1.0.0 palette nodes can be dragged from the left palette to a canvas drop position', () => {
  assert.match(html, /class="node-add"[^>]*draggable="true"[^>]*data-node-type="resize"/);
  for (const token of [
    "application/x-browser-kitty-node", 'dragstart', 'dragend', 'dragover', "addEventListener('drop'",
    'screenToFlowPosition', "'palette-drag'"
  ]) assert.ok(html.includes(token), `missing palette drag token: ${token}`);
});

test('v1.0.0 preview preserves the image aspect ratio inside the preview stage', () => {
  assert.ok(html.includes('fitPreviewCanvasElement'));
  assert.ok(html.includes('availableWidth/canvas.width'));
  assert.ok(html.includes('availableHeight/canvas.height'));
  assert.match(html, /canvas\.style\.width=`\$\{Math\.max\(1,Math\.floor\(canvas\.width\*scale\)\)\}px`/);
  assert.match(html, /canvas\.style\.height=`\$\{Math\.max\(1,Math\.floor\(canvas\.height\*scale\)\)\}px`/);
});

test('v1.0.0 quick Recipe execution automatically downloads its completed result', () => {
  assert.ok(html.includes('downloadCompletedBatchResult'));
  assert.match(html, /runQuickRecipe\(id,button\)\{[^\n]*await downloadCompletedBatchResult\(result/);
});

test('v1.0.0 desktop workspace fixes side panel height and scrolls panel contents like Data Pipeline Builder', () => {
  assert.match(html, /\.workspace\{[^}]*height:640px[^}]*min-height:0/s);
  assert.match(html, /\.palette-panel\{[^}]*display:flex[^}]*flex-direction:column[^}]*height:100%/s);
  assert.match(html, /\.palette\{[^}]*flex:1[^}]*min-height:0[^}]*overflow:auto/s);
  assert.match(html, /\.inspector-panel\{[^}]*height:100%[^}]*min-height:0/s);
});


test('v1.0.0 Fit All icon is visually distinct from the expand workspace icon', () => {
  const fit = html.match(/id="fitViewButton"[\s\S]*?<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '';
  const expand = html.match(/id="toggleCanvasSizeButton"[\s\S]*?<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '';
  assert.ok(fit, 'Fit All SVG should exist');
  assert.ok(expand, 'Expand workspace SVG should exist');
  assert.notEqual(fit.replace(/\s+/g, ' ').trim(), expand.replace(/\s+/g, ' ').trim());
  assert.match(fit, /<rect[^>]*x="4"[^>]*y="4"[^>]*width="16"[^>]*height="16"/);
});

test('v1.0.0 desktop canvas can shrink inside the fixed workspace so the status row is never clipped', () => {
  assert.match(html, /\.canvas-wrap\{[^}]*flex:1[^}]*min-height:0[^}]*overflow:hidden/s);
  assert.match(html, /\.canvas-status\{[^}]*flex:0 0 auto[^}]*min-height:38px/s);
});

test('v1.0.0 stable release metadata is versioned consistently', () => {
  assert.equal(config.version, '1.0.0');
  assert.ok(html.includes('<span class="version-badge" id="versionBadge">v1.0.0</span>'));
  assert.ok(html.includes('v1.0.0'));
});

test('v1.0.0 preview cache explicitly releases evicted snapshot backing stores', () => {
  assert.ok(html.includes('releasePreviewCacheEntry'));
  assert.ok(html.includes('Pipeline.createLruCache(12,{onEvict:releasePreviewCacheEntry})'));
  assert.match(html, /canvas\.width=1;canvas\.height=1/);
});

test('v1.0.0 batch cancellation checks the AbortSignal between decode, graph, and output stages', () => {
  assert.ok(html.includes('function throwIfAborted(signal)'));
  assert.ok(html.includes('createFrameEvaluator(frame=previewFrame,graphRef=graph,signal=null)'));
  assert.ok(html.includes('encodeSourceOutputs(item,{index:context.index,usedPaths,signal:context.signal})'));
  assert.ok(html.includes('graphRef:recipeGraphValue,signal:context.signal'));
});

test('v1.0.0 releases completed batch output references when results are invalidated', () => {
  assert.ok(html.includes('function releaseBatchResult(result)'));
  assert.match(html, /entry\.value\.outputs\.length=0/);
  assert.match(html, /clearBatchResults\(\)\{releaseBatchResult\(batchResult\)/);
});

test('v1.0.0 pagehide cleanup releases preview cache and batch output references', () => {
  assert.match(html, /pagehide[\s\S]*previewCache\.clear\(\)[\s\S]*releaseBatchResult\(batchResult\)/);
});
