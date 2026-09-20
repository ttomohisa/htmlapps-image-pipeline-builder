import test from 'node:test';
import assert from 'node:assert/strict';
import Core from '../src/core/node-editor-core.mjs';
import ImagePipeline from '../src/image-pipeline/image-pipeline.mjs';

const {
  createImageRegistry,
  createInitialImageGraph,
  calculateResizeDimensions,
  calculateCropRect,
  calculateRotatedBounds,
  calculateCanvasPlacement,
  normalizeCropSettings,
  normalizeRotateSettings,
  normalizeFlipSettings,
  normalizeCanvasSettings,
  normalizeOutputSettings,
  outputExtension,
  makeOutputFilename,
  normalizeOutputFolder,
  resolveUniqueOutputPath,
  createCachedEvaluator,
  buildStoredZip,
  runBatchSequential,
  pipelineGraphSignature,
  previewTargetNodeId,
  previewSubgraphSignature,
  createLruCache
} = ImagePipeline;

test('image consumer registry uses generic image ports without changing Core', () => {
  const registry = createImageRegistry(Core);
  const images = registry.create('images');
  const resize = registry.create('resize');
  const output = registry.create('output');
  assert.deepEqual(registry.resolvePorts(images), [
    { id: 'out', direction: 'output', dataType: 'image', required: true, maxConnections: null, data: {} }
  ]);
  assert.deepEqual(registry.resolvePorts(resize), [
    { id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1, data: {} },
    { id: 'out', direction: 'output', dataType: 'image', required: true, maxConnections: null, data: {} }
  ]);
  assert.deepEqual(registry.resolvePorts(output), [
    { id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1, data: {} }
  ]);
});

test('initial image graph validates and sorts Images -> Resize -> Output', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  assert.deepEqual(Core.validateGraph(graph, { registry }), []);
  assert.deepEqual(Core.topologicalSort(graph).order, ['node-images', 'node-resize', 'node-output']);
  assert.equal(graph.coreSchemaVersion, 1);
});

test('resize preserves aspect ratio from width when height is auto', () => {
  assert.deepEqual(
    calculateResizeDimensions({ width: 4000, height: 3000 }, { width: 1600, height: null, keepAspect: true, allowUpscale: false }),
    { width: 1600, height: 1200 }
  );
});

test('resize does not upscale when allowUpscale is false', () => {
  assert.deepEqual(
    calculateResizeDimensions({ width: 800, height: 600 }, { width: 1600, height: null, keepAspect: true, allowUpscale: false }),
    { width: 800, height: 600 }
  );
});

test('resize exact dimensions are used when keepAspect is false', () => {
  assert.deepEqual(
    calculateResizeDimensions({ width: 1200, height: 800 }, { width: 640, height: 640, keepAspect: false, allowUpscale: true }),
    { width: 640, height: 640 }
  );
});



test('geometry registry exposes crop rotate flip and canvas with generic image ports', () => {
  const registry = createImageRegistry(Core);
  for (const type of ['crop', 'rotate', 'flip', 'canvas']) {
    const node = registry.create(type);
    assert.deepEqual(registry.resolvePorts(node), [
      { id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1, data: {} },
      { id: 'out', direction: 'output', dataType: 'image', required: true, maxConnections: null, data: {} }
    ], `${type} ports`);
  }
});

test('resize fit mode keeps aspect inside a width and height box', () => {
  assert.deepEqual(
    calculateResizeDimensions({ width: 4000, height: 3000 }, { width: 1000, height: 1000, fit: 'contain', allowUpscale: true }),
    { width: 1000, height: 750 }
  );
  assert.deepEqual(
    calculateResizeDimensions({ width: 4000, height: 3000 }, { width: 1000, height: 1000, fit: 'exact', allowUpscale: true }),
    { width: 1000, height: 1000 }
  );
});

test('explicit resize fit mode overrides legacy keepAspect data', () => {
  assert.deepEqual(
    calculateResizeDimensions({ width: 4000, height: 3000 }, { width: 1000, height: 1000, fit: 'contain', keepAspect: false, allowUpscale: true }),
    { width: 1000, height: 750 }
  );
});

test('crop ratio uses the largest centered rectangle and honors anchors', () => {
  assert.deepEqual(
    calculateCropRect({ width: 1600, height: 900 }, { mode: 'ratio', ratio: '1:1', anchor: 'center' }),
    { x: 350, y: 0, width: 900, height: 900 }
  );
  assert.deepEqual(
    calculateCropRect({ width: 1600, height: 900 }, { mode: 'ratio', ratio: '1:1', anchor: 'right' }),
    { x: 700, y: 0, width: 900, height: 900 }
  );
});

test('crop size clamps to the source and positions from the selected anchor', () => {
  assert.deepEqual(
    calculateCropRect({ width: 1200, height: 800 }, { mode: 'size', width: 600, height: 400, anchor: 'bottom-right' }),
    { x: 600, y: 400, width: 600, height: 400 }
  );
  assert.deepEqual(
    calculateCropRect({ width: 1200, height: 800 }, { mode: 'size', width: 4000, height: 4000, anchor: 'center' }),
    { x: 0, y: 0, width: 1200, height: 800 }
  );
});

test('geometry settings normalize crop rotate flip and canvas values', () => {
  assert.deepEqual(normalizeCropSettings({ mode: 'ratio', ratio: '16:9', anchor: 'top-left' }), {
    mode: 'ratio', ratio: '16:9', width: null, height: null, customRatioWidth: 1, customRatioHeight: 1, anchor: 'top-left'
  });
  assert.deepEqual(normalizeRotateSettings({ angle: -90 }), { angle: 270 });
  assert.deepEqual(normalizeFlipSettings({ direction: 'vertical' }), { direction: 'vertical' });
  assert.deepEqual(normalizeCanvasSettings({ width: 1400, height: 1000, anchor: 'bottom-right', background: 'color', backgroundColor: '#ABCDEF' }), {
    width: 1400, height: 1000, anchor: 'bottom-right', background: 'color', backgroundColor: '#abcdef'
  });
});

test('rotation bounds swap right angles and expand arbitrary angles', () => {
  assert.deepEqual(calculateRotatedBounds({ width: 800, height: 600 }, 90), { width: 600, height: 800 });
  assert.deepEqual(calculateRotatedBounds({ width: 800, height: 600 }, 180), { width: 800, height: 600 });
  const diagonal = calculateRotatedBounds({ width: 100, height: 50 }, 45);
  assert.deepEqual(diagonal, { width: 107, height: 107 });
});

test('canvas placement changes the outer size without scaling the image', () => {
  assert.deepEqual(
    calculateCanvasPlacement({ width: 800, height: 600 }, { width: 1200, height: 1000, anchor: 'center' }),
    { width: 1200, height: 1000, x: 200, y: 200 }
  );
  assert.deepEqual(
    calculateCanvasPlacement({ width: 800, height: 600 }, { width: 1200, height: 1000, anchor: 'bottom-right' }),
    { width: 1200, height: 1000, x: 400, y: 400 }
  );
});

test('output settings normalize format and quality', () => {
  assert.deepEqual(normalizeOutputSettings({ format: 'jpeg', quality: 95, filename: 'photo', folder: 'large/', label: 'Large' }), {
    format: 'jpeg', quality: 0.95, filename: 'photo', folder: 'large', label: 'Large'
  });
  assert.deepEqual(normalizeOutputSettings({ format: 'png', quality: 12, filename: '', folder: '', label: '' }), {
    format: 'png', quality: 1, filename: '{name}', folder: '', label: 'Output'
  });
});

test('output extensions and filenames follow the chosen format', () => {
  assert.equal(outputExtension('jpeg'), '.jpg');
  assert.equal(outputExtension('png'), '.png');
  assert.equal(outputExtension('webp'), '.webp');
  assert.equal(makeOutputFilename('Summer.Photo.JPG', 'webp'), 'Summer.Photo.webp');
  assert.equal(makeOutputFilename('scan', 'jpeg'), 'scan.jpg');
  assert.equal(makeOutputFilename('photo.png', 'webp', '{name}-{width}x{height}-{index:3}', { index: 7, width: 400, height: 300 }), 'photo-400x300-007.webp');
});

test('output folders are normalized and path traversal is rejected', () => {
  assert.equal(normalizeOutputFolder(' thumbnails\\small/ '), 'thumbnails/small');
  assert.equal(normalizeOutputFolder(''), '');
  assert.throws(() => normalizeOutputFolder('../secret'), /parent directory/i);
  assert.throws(() => normalizeOutputFolder('/absolute'), /relative/i);
});

test('output path collision handling appends a stable numeric suffix', () => {
  const used = new Set();
  assert.equal(resolveUniqueOutputPath('thumb/photo.webp', used), 'thumb/photo.webp');
  assert.equal(resolveUniqueOutputPath('thumb/photo.webp', used), 'thumb/photo-2.webp');
  assert.equal(resolveUniqueOutputPath('thumb/photo.webp', used), 'thumb/photo-3.webp');
});

test('cached evaluator reuses shared upstream results across output branches', async () => {
  const calls = [];
  const parents = { outputA: 'resize', outputB: 'resize', resize: 'images' };
  const evaluate = createCachedEvaluator(async (nodeId, recurse) => {
    calls.push(nodeId);
    const parent = parents[nodeId];
    const input = parent ? await recurse(parent) : 'frame';
    return `${input}>${nodeId}`;
  });
  const [a, b] = await Promise.all([evaluate('outputA'), evaluate('outputB')]);
  assert.equal(a, 'frame>images>resize>outputA');
  assert.equal(b, 'frame>images>resize>outputB');
  assert.equal(calls.filter(id => id === 'resize').length, 1);
  assert.equal(calls.filter(id => id === 'images').length, 1);
});

test('stored ZIP writer emits local entries and central directory for UTF-8 paths', () => {
  const bytes = buildStoredZip([
    { path: 'large/photo.webp', bytes: new TextEncoder().encode('A') },
    { path: 'サムネイル/photo.webp', bytes: new TextEncoder().encode('BC') }
  ]);
  assert.ok(bytes instanceof Uint8Array);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const decoded = new TextDecoder().decode(bytes);
  assert.ok(decoded.includes('large/photo.webp'));
  assert.ok(decoded.includes('サムネイル/photo.webp'));
  assert.ok(decoded.includes('PK\u0005\u0006'));
});


test('batch runner processes items sequentially and keeps partial failures', async () => {
  const order = [];
  const progress = [];
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const result = await runBatchSequential(items, async item => {
    order.push(item.id);
    if (item.id === 'b') throw new Error('broken image');
    return `${item.id}-output`;
  }, { onProgress: state => progress.push({ ...state, item: state.item?.id, result: undefined }) });

  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.equal(result.status, 'completed');
  assert.equal(result.total, 3);
  assert.equal(result.processed, 3);
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.entries.map(entry => [entry.item.id, entry.status]), [
    ['a', 'success'], ['b', 'error'], ['c', 'success']
  ]);
  assert.match(result.entries[1].error.message, /broken image/);
  assert.deepEqual(progress.filter(state => state.phase === 'complete').map(state => state.processed), [1, 2, 3]);
});

test('batch runner stops before the next item after abort', async () => {
  const controller = new AbortController();
  const processed = [];
  const result = await runBatchSequential(['a', 'b', 'c'], async item => {
    processed.push(item);
    if (item === 'a') controller.abort();
    return item.toUpperCase();
  }, { signal: controller.signal });

  assert.deepEqual(processed, ['a']);
  assert.equal(result.status, 'cancelled');
  assert.equal(result.processed, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);
});


test('pipeline signature ignores viewport and node positions but tracks processing changes', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  const baseline = pipelineGraphSignature(graph);

  const moved = structuredClone(graph);
  moved.viewport = { x: 320, y: -80, zoom: 1.4 };
  moved.nodes[1].position = { x: 999, y: 777 };
  assert.equal(pipelineGraphSignature(moved), baseline);

  const changedData = structuredClone(graph);
  changedData.nodes[1].data.width = 800;
  assert.notEqual(pipelineGraphSignature(changedData), baseline);

  const changedEdge = structuredClone(graph);
  changedEdge.edges[1].target.portId = 'different';
  assert.notEqual(pipelineGraphSignature(changedEdge), baseline);
});

test('output setting validation rejects unsafe ZIP folders before execution', () => {
  assert.deepEqual(ImagePipeline.validateOutputSettings({ folder: 'thumb/small', filename: '{name}', format: 'webp' }), []);
  const issues = ImagePipeline.validateOutputSettings({ folder: '../secret', filename: '{name}', format: 'webp' });
  assert.equal(issues.length, 1);
  assert.equal(issues[0].code, 'invalid-output-folder');
});


test('preview target resolves selected node for After and its input for Before', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  assert.equal(previewTargetNodeId(graph, 'node-resize', 'after'), 'node-resize');
  assert.equal(previewTargetNodeId(graph, 'node-resize', 'before'), 'node-images');
  assert.equal(previewTargetNodeId(graph, 'node-images', 'before'), 'node-images');
  assert.equal(previewTargetNodeId(graph, 'node-output', 'before'), 'node-resize');
});

test('preview subgraph signature ignores downstream and layout-only changes', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  const baselineAfter = previewSubgraphSignature(graph, 'node-resize', 'after');
  const baselineBefore = previewSubgraphSignature(graph, 'node-resize', 'before');

  const downstream = structuredClone(graph);
  downstream.nodes.find(node => node.id === 'node-output').data.quality = 31;
  downstream.nodes.find(node => node.id === 'node-output').position = { x: 999, y: 444 };
  assert.equal(previewSubgraphSignature(downstream, 'node-resize', 'after'), baselineAfter);

  const changedResize = structuredClone(graph);
  changedResize.nodes.find(node => node.id === 'node-resize').data.width = 800;
  assert.notEqual(previewSubgraphSignature(changedResize, 'node-resize', 'after'), baselineAfter);
  assert.equal(previewSubgraphSignature(changedResize, 'node-resize', 'before'), baselineBefore);
});

test('output After preview signature includes output encoding settings', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  const before = previewSubgraphSignature(graph, 'node-output', 'before');
  const after = previewSubgraphSignature(graph, 'node-output', 'after');
  const changed = structuredClone(graph);
  changed.nodes.find(node => node.id === 'node-output').data.format = 'jpeg';
  changed.nodes.find(node => node.id === 'node-output').data.quality = 55;
  assert.equal(previewSubgraphSignature(changed, 'node-output', 'before'), before);
  assert.notEqual(previewSubgraphSignature(changed, 'node-output', 'after'), after);
});

test('preview LRU cache refreshes access order and evicts the oldest item', () => {
  const cache = createLruCache(2);
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3);
  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.size, 2);
  cache.clear();
  assert.equal(cache.size, 0);
});

test('appearance and composition registry nodes use generic image ports', () => {
  const registry = createImageRegistry(Core);
  for (const type of ['adjust', 'grayscale', 'blur', 'sharpen', 'border', 'rounded-corners', 'text-watermark']) {
    const node = registry.create(type);
    assert.deepEqual(registry.resolvePorts(node), [
      { id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1, data: {} },
      { id: 'out', direction: 'output', dataType: 'image', required: true, maxConnections: null, data: {} }
    ], `${type} ports`);
  }
});

test('appearance settings normalize into bounded values', () => {
  assert.deepEqual(ImagePipeline.normalizeAdjustSettings({ brightness: 120, contrast: -140, saturation: 25 }), {
    brightness: 100, contrast: -100, saturation: 25
  });
  assert.deepEqual(ImagePipeline.normalizeGrayscaleSettings({ strength: 150 }), { strength: 100 });
  assert.deepEqual(ImagePipeline.normalizeBlurSettings({ radius: -4 }), { radius: 0 });
  assert.deepEqual(ImagePipeline.normalizeSharpenSettings({ amount: 3 }), { amount: 2 });
});

test('border settings and geometry support inside and outside placement', () => {
  assert.deepEqual(ImagePipeline.normalizeBorderSettings({ width: 12.4, color: '#ABC', placement: 'outside' }), {
    width: 12, color: '#aabbcc', placement: 'outside'
  });
  assert.deepEqual(ImagePipeline.calculateBorderGeometry({ width: 800, height: 600 }, { width: 10, placement: 'inside' }), {
    width: 800, height: 600, imageX: 0, imageY: 0, borderWidth: 10, placement: 'inside'
  });
  assert.deepEqual(ImagePipeline.calculateBorderGeometry({ width: 800, height: 600 }, { width: 10, placement: 'outside' }), {
    width: 820, height: 620, imageX: 10, imageY: 10, borderWidth: 10, placement: 'outside'
  });
});

test('rounded corner radius supports pixels and percentage and never exceeds half the short side', () => {
  assert.deepEqual(ImagePipeline.normalizeRoundedCornersSettings({ mode: 'percent', radius: 80 }), { mode: 'percent', radius: 50 });
  assert.equal(ImagePipeline.calculateRoundedCornerRadius({ width: 800, height: 600 }, { mode: 'pixels', radius: 500 }), 300);
  assert.equal(ImagePipeline.calculateRoundedCornerRadius({ width: 800, height: 600 }, { mode: 'percent', radius: 10 }), 60);
});

test('text watermark settings normalize position opacity size margin and rotation', () => {
  assert.deepEqual(ImagePipeline.normalizeTextWatermarkSettings({
    text: '  Sample  ', fontFamily: 'serif', fontSize: 48.6, color: '#ABC', opacity: 1.2,
    position: 'bottom-right', margin: -5, rotation: 370
  }), {
    text: 'Sample', fontFamily: 'serif', fontSize: 49, color: '#aabbcc', opacity: 1,
    position: 'bottom-right', margin: 0, rotation: 10
  });
  assert.deepEqual(ImagePipeline.calculateWatermarkPosition(
    { width: 800, height: 600 }, { width: 200, height: 50 }, { position: 'bottom-right', margin: 20 }
  ), { x: 580, y: 530 });
});

test('sharpen rgba keeps alpha and increases local contrast', () => {
  const pixels = new Uint8ClampedArray([
    100,100,100,255, 100,100,100,255, 100,100,100,255,
    100,100,100,255, 150,150,150,128, 100,100,100,255,
    100,100,100,255, 100,100,100,255, 100,100,100,255
  ]);
  const out = ImagePipeline.sharpenRgba(pixels, 3, 3, 0.5);
  const center = 4 * 4;
  assert.ok(out[center] > 150);
  assert.equal(out[center + 3], 128);
  assert.equal(out[3], 255);
});

test('workflow envelope round-trips a graph through Core deserialization', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  graph.nodes.find(node => node.id === 'node-resize').data.width = 1234;
  const document = ImagePipeline.createWorkflowDocument(Core, graph, { appVersion: '0.7.0', name: 'Web images' });
  assert.equal(document.format, 'image-pipeline-builder-workflow');
  assert.equal(document.formatVersion, 1);
  assert.equal(document.appVersion, '0.7.0');
  assert.equal(document.name, 'Web images');
  assert.equal(document.graph.format, 'node-editor-core');
  const restored = ImagePipeline.parseWorkflowDocument(Core, JSON.stringify(document), { registry });
  assert.equal(restored.document.formatVersion, 1);
  assert.equal(restored.graph.nodes.find(node => node.id === 'node-resize').data.width, 1234);
  assert.deepEqual(Core.validateGraph(restored.graph, { registry }), []);
});

test('workflow parser rejects unsupported envelopes and newer format versions', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  const valid = ImagePipeline.createWorkflowDocument(Core, graph, { appVersion: '0.7.0' });
  assert.throws(() => ImagePipeline.parseWorkflowDocument(Core, { ...valid, format: 'other-workflow' }, { registry }), /format/i);
  assert.throws(() => ImagePipeline.parseWorkflowDocument(Core, { ...valid, formatVersion: 99 }, { registry }), /newer|version/i);
});

test('built-in workflow presets produce valid reusable graphs', () => {
  const registry = createImageRegistry(Core);
  const expected = {
    'web-images': 1,
    'main-thumbnail': 2,
    'social-square': 1,
    'watermark': 1,
    'blank': 1
  };
  assert.deepEqual(ImagePipeline.BUILT_IN_WORKFLOW_IDS, Object.keys(expected));
  for (const [id, outputCount] of Object.entries(expected)) {
    const graph = ImagePipeline.createBuiltInWorkflow(id, Core, registry);
    assert.deepEqual(Core.validateGraph(graph, { registry }), [], id);
    assert.equal(graph.nodes.filter(node => node.type === 'images').length, 1, `${id} images`);
    assert.equal(graph.nodes.filter(node => node.type === 'output').length, outputCount, `${id} outputs`);
  }
});

test('named workflow records normalize names and replace records by id', () => {
  const registry = createImageRegistry(Core);
  const graph = createInitialImageGraph(Core, registry);
  const document = ImagePipeline.createWorkflowDocument(Core, graph, { appVersion: '0.7.0' });
  const first = ImagePipeline.createSavedWorkflowRecord({ id: 'wf-1', name: '  Blog images  ', document, updatedAt: '2026-09-18T00:00:00.000Z' });
  assert.equal(first.name, 'Blog images');
  const second = ImagePipeline.createSavedWorkflowRecord({ id: 'wf-1', name: 'Blog thumbnails', document, updatedAt: '2026-09-18T01:00:00.000Z' });
  const third = ImagePipeline.createSavedWorkflowRecord({ id: 'wf-2', name: 'SNS', document, updatedAt: '2026-09-18T00:30:00.000Z' });
  const records = ImagePipeline.upsertSavedWorkflow(ImagePipeline.upsertSavedWorkflow([first], third), second);
  assert.deepEqual(records.map(record => record.id), ['wf-1', 'wf-2']);
  assert.equal(records[0].name, 'Blog thumbnails');
  assert.deepEqual(ImagePipeline.removeSavedWorkflow(records, 'wf-1').map(record => record.id), ['wf-2']);
  assert.throws(() => ImagePipeline.createSavedWorkflowRecord({ id: 'x', name: '   ', document }), /name/i);
});

test('preview LRU cache disposes evicted and cleared entries', () => {
  const disposed = [];
  const cache = createLruCache(2, { onEvict: value => disposed.push(value) });
  cache.set('a', { id: 'a' });
  cache.set('b', { id: 'b' });
  cache.set('c', { id: 'c' });
  assert.deepEqual(disposed.map(item => item.id), ['a']);
  cache.delete('b');
  assert.deepEqual(disposed.map(item => item.id), ['a', 'b']);
  cache.clear();
  assert.deepEqual(disposed.map(item => item.id), ['a', 'b', 'c']);
});

test('batch runner remains strictly sequential across a 100-item stress batch', async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 100 }, (_, index) => index);
  const result = await runBatchSequential(items, async item => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    return item * 2;
  });
  assert.equal(maxActive, 1);
  assert.equal(result.status, 'completed');
  assert.equal(result.processed, 100);
  assert.equal(result.succeeded, 100);
  assert.equal(result.failed, 0);
});

test('batch runner treats an abort raised by the current item as cancellation, not failure', async () => {
  const controller = new AbortController();
  const result = await runBatchSequential(['a', 'b', 'c'], async (item, context) => {
    if (item === 'b') {
      controller.abort();
      const error = new Error('cancelled');
      error.name = 'AbortError';
      throw error;
    }
    return item.toUpperCase();
  }, { signal: controller.signal });
  assert.equal(result.status, 'cancelled');
  assert.equal(result.processed, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(result.entries.map(entry => entry.item), ['a']);
});

test('stored ZIP writer handles a large multi-output result set', () => {
  const entries = Array.from({ length: 300 }, (_, index) => ({
    path: `branch-${index % 3}/image-${String(index + 1).padStart(3, '0')}.webp`,
    bytes: new Uint8Array([index & 255, (index >> 8) & 255])
  }));
  const bytes = buildStoredZip(entries);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);
  const decoded = new TextDecoder().decode(bytes);
  assert.ok(decoded.includes('branch-0/image-001.webp'));
  assert.ok(decoded.includes('branch-2/image-300.webp'));
  assert.ok(decoded.includes('PK\u0005\u0006'));
});

test('three output branches still evaluate their shared upstream once', async () => {
  const calls = [];
  const parents = { outputA: 'resize', outputB: 'resize', outputC: 'resize', resize: 'images' };
  const evaluate = createCachedEvaluator(async (nodeId, recurse) => {
    calls.push(nodeId);
    const parent = parents[nodeId];
    const input = parent ? await recurse(parent) : 'frame';
    return `${input}>${nodeId}`;
  });
  const values = await Promise.all(['outputA', 'outputB', 'outputC'].map(id => evaluate(id)));
  assert.equal(values.length, 3);
  assert.equal(calls.filter(id => id === 'resize').length, 1);
  assert.equal(calls.filter(id => id === 'images').length, 1);
});
