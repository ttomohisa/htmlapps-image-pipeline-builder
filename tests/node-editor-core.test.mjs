import test from 'node:test';
import assert from 'node:assert/strict';
import Core from '../src/core/node-editor-core.mjs';

const { FORMAT, CORE_SCHEMA_VERSION, RUNTIME_STATUSES, NodeRegistry, CoreMigrationRegistry, RuntimeStatusStore, Translator, LayoutRegistry, NodeCanvas, NODE_CANVAS_CSS, normalizeTheme, applyTheme, clampZoom, screenToFlowPosition, flowToScreenPosition, calculateFitViewport, snapToGridValue, calculateAlignmentSnap, getContextualZoomLevel, createValidationResult, normalizeLayoutResult, createBenchmarkGraph, benchmarkGraphModel, createId, createGraph, createNode, createEdge, cloneGraph, graphContentSignature, createGraphFragment, pasteGraphFragment, applyChange, applyChanges, getNode, getEdge, getPort, getIncomingEdges, getOutgoingEdges, getIncidentEdges, getUpstreamNodeIds, getDownstreamNodeIds, arePortTypesCompatible, hasDirectedCycle, validateConnection, validateGraph, assertValidGraph, serializeGraph, deserializeGraph } = Core;

function demoRegistry() {
  const registry = new NodeRegistry();
  registry.register({
    type: 'source', titleKey: 'source', category: 'io', definitionVersion: 1,
    createDefaultData: () => ({ label: 'Input', outputs: 1 }),
    getPorts: node => Array.from({ length: node.data.outputs }, (_, index) => ({ id: `out-${index + 1}`, direction: 'output', dataType: 'demo' }))
  });
  registry.register({
    type: 'transform', titleKey: 'transform', category: 'process', definitionVersion: 2,
    createDefaultData: () => ({ mode: 'pass' }),
    getPorts: () => [{ id: 'in', direction: 'input', dataType: 'demo', required: true, maxConnections: 1 }, { id: 'out', direction: 'output', dataType: 'demo' }],
    validate: node => node.data.mode ? [] : [{ code: 'MODE_REQUIRED', message: 'mode is required' }]
  });
  return registry;
}

function demoGraph() {
  const nodes = [
    createNode({ id: 'a', type: 'source', position: { x: 10, y: 20 }, data: { outputs: 1 } }),
    createNode({ id: 'b', type: 'transform', definitionVersion: 2, position: { x: 120, y: 20 }, data: { mode: 'pass' } })
  ];
  const edges = [createEdge({ id: 'e1', source: { nodeId: 'a', portId: 'out-1' }, target: { nodeId: 'b', portId: 'in' } })];
  return createGraph({ appId: 'test-consumer', appSchemaVersion: 1, nodes, edges });
}

test('exports the first public graph format and schema version', () => {
  assert.equal(FORMAT, 'node-editor-core'); assert.equal(CORE_SCHEMA_VERSION, 1);
});

test('createGraph creates a persistent graph document', () => {
  const graph = createGraph({ appId: 'demo' });
  assert.equal(graph.format, FORMAT); assert.equal(graph.coreSchemaVersion, 1); assert.deepEqual(graph.app, { id: 'demo', schemaVersion: 1 }); assert.deepEqual(graph.nodes, []); assert.deepEqual(graph.edges, []); assert.deepEqual(graph.viewport, { x: 0, y: 0, zoom: 1 });
});

test('createId prefixes generated IDs and avoids supplied IDs', () => {
  const first = createId('node'); const second = createId('node', new Set([first])); assert.match(first, /^node-/); assert.match(second, /^node-/); assert.notEqual(first, second);
});

test('NodeRegistry registers definitions and merges default node data', () => {
  const registry = demoRegistry(); const node = registry.create('source', { id: 'source-1', data: { label: 'Custom' } });
  assert.equal(registry.has('source'), true); assert.equal(registry.list().length, 2); assert.equal(node.data.label, 'Custom'); assert.equal(node.data.outputs, 1); assert.throws(() => registry.register({ type: 'source' }), /already registered/);
});

test('NodeRegistry resolves dynamic ports from persistent node data', () => {
  const registry = demoRegistry(); const node = registry.create('source', { data: { outputs: 3 } }); assert.deepEqual(registry.resolvePorts(node).map(port => port.id), ['out-1', 'out-2', 'out-3']);
});

test('NodeRegistry validates consumer nodes without teaching Core domain types', () => {
  const registry = demoRegistry(); const invalid = createNode({ id: 'x', type: 'transform', definitionVersion: 2, data: { mode: '' } }); assert.equal(registry.validateNode(invalid, demoGraph())[0].code, 'MODE_REQUIRED');
});

test('applyChange adds nodes and leaves the input graph unchanged', () => {
  const graph = createGraph({ appId: 'demo' }); const next = applyChange(graph, { type: 'node.add', node: createNode({ id: 'a', type: 'source' }) }); assert.equal(graph.nodes.length, 0); assert.equal(next.nodes.length, 1); assert.notEqual(next, graph);
});

test('applyChanges updates node state and viewport immutably', () => {
  const graph = createGraph({ appId: 'demo', nodes: [createNode({ id: 'a', type: 'source' })] });
  const next = applyChanges(graph, [
    { type: 'node.position', nodeId: 'a', position: { x: 40, y: 50 } },
    { type: 'node.data', nodeId: 'a', data: { label: 'Changed' } },
    { type: 'node.disable', nodeId: 'a', disabled: true },
    { type: 'graph.viewport', viewport: { x: 8, y: -4, zoom: 1.25 } }
  ]);
  assert.deepEqual(getNode(next, 'a').position, { x: 40, y: 50 }); assert.equal(getNode(next, 'a').data.label, 'Changed'); assert.equal(getNode(next, 'a').disabled, true); assert.deepEqual(next.viewport, { x: 8, y: -4, zoom: 1.25 }); assert.deepEqual(getNode(graph, 'a').position, { x: 0, y: 0 });
});

test('removing a node also removes incident edges without bypassing it', () => {
  const next = applyChange(demoGraph(), { type: 'node.remove', nodeId: 'b' }); assert.equal(next.nodes.length, 1); assert.equal(next.edges.length, 0);
});

test('edge changes support add, data update, reconnect, and remove', () => {
  let graph = createGraph({ appId: 'demo', nodes: [createNode({ id: 'a', type: 'source' }), createNode({ id: 'b', type: 'transform' }), createNode({ id: 'c', type: 'transform' })] });
  graph = applyChange(graph, { type: 'edge.add', edge: createEdge({ id: 'e', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } }) });
  graph = applyChange(graph, { type: 'edge.data', edgeId: 'e', data: { label: 'flow' } });
  graph = applyChange(graph, { type: 'edge.reconnect', edgeId: 'e', target: { nodeId: 'c', portId: 'in' } });
  assert.equal(getEdge(graph, 'e').data.label, 'flow'); assert.equal(getEdge(graph, 'e').target.nodeId, 'c'); graph = applyChange(graph, { type: 'edge.remove', edgeId: 'e' }); assert.equal(graph.edges.length, 0);
});

test('query helpers return incoming, outgoing, incident, upstream, and downstream relationships', () => {
  const graph = demoGraph(); assert.deepEqual(getIncomingEdges(graph, 'b').map(e => e.id), ['e1']); assert.deepEqual(getOutgoingEdges(graph, 'a').map(e => e.id), ['e1']); assert.deepEqual(getIncidentEdges(graph, 'a').map(e => e.id), ['e1']); assert.deepEqual(getUpstreamNodeIds(graph, 'b'), ['a']); assert.deepEqual(getDownstreamNodeIds(graph, 'a'), ['b']);
});

test('validateGraph detects duplicate node and edge IDs', () => {
  const graph = { format: FORMAT, coreSchemaVersion: 1, app: { id: 'demo', schemaVersion: 1 }, nodes: [{ id: 'dup', type: 'source', definitionVersion: 1, position: { x: 0, y: 0 }, data: {}, disabled: false }, { id: 'dup', type: 'source', definitionVersion: 1, position: { x: 1, y: 1 }, data: {}, disabled: false }], edges: [{ id: 'dup-edge', source: { nodeId: 'dup', portId: 'a' }, target: { nodeId: 'dup', portId: 'b' }, data: {} }, { id: 'dup-edge', source: { nodeId: 'dup', portId: 'a' }, target: { nodeId: 'dup', portId: 'b' }, data: {} }], viewport: { x: 0, y: 0, zoom: 1 } };
  const codes = validateGraph(graph).map(i => i.code); assert.ok(codes.includes('DUPLICATE_NODE_ID')); assert.ok(codes.includes('DUPLICATE_EDGE_ID'));
});

test('validateGraph detects dangling edges', () => {
  const doc = JSON.parse(serializeGraph(createGraph({ appId: 'demo', nodes: [createNode({ id: 'a', type: 'source' })] }))); doc.edges.push({ id: 'e', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'missing', portId: 'in' }, data: {} }); assert.ok(validateGraph(doc).some(i => i.code === 'DANGLING_TARGET_NODE'));
});

test('validateGraph can use registry information to find missing ports', () => {
  const registry = demoRegistry(); const doc = JSON.parse(serializeGraph(demoGraph())); doc.edges[0].target.portId = 'does-not-exist'; assert.ok(validateGraph(doc, { registry }).some(i => i.code === 'MISSING_TARGET_PORT'));
});

test('serialization round-trips persistent graph state', () => {
  const graph = demoGraph(); const restored = deserializeGraph(serializeGraph(graph)); assert.deepEqual(restored, graph); assertValidGraph(restored);
});

test('cloneGraph produces an independent persistent graph clone', () => {
  const graph = demoGraph(); const clone = cloneGraph(graph); assert.deepEqual(clone, graph); assert.notEqual(clone, graph); assert.notEqual(clone.nodes, graph.nodes);
});

test('persistent values reject non-JSON data', () => {
  assert.throws(() => createNode({ type: 'bad', data: { value: Number.NaN } }), /non-finite/); assert.throws(() => createNode({ type: 'bad', data: { value: undefined } }), /cannot be persisted/); assert.throws(() => createNode({ type: 'bad', data: { value: new Date() } }), /plain objects/);
});

test('CoreMigrationRegistry performs sequential one-version migrations', () => {
  const migrations = new CoreMigrationRegistry(); migrations.register(1, doc => ({ ...doc, coreSchemaVersion: 2, migrated: true })); migrations.register(2, doc => ({ ...doc, coreSchemaVersion: 3, migratedAgain: true })); const migrated = migrations.migrate(JSON.parse(serializeGraph(demoGraph())), 3); assert.equal(migrated.coreSchemaVersion, 3); assert.equal(migrated.migrated, true); assert.equal(migrated.migratedAgain, true);
});

test('migration registry rejects gaps and backward migration', () => {
  const migrations = new CoreMigrationRegistry(); const source = JSON.parse(serializeGraph(demoGraph())); assert.throws(() => migrations.migrate(source, 2), /Missing Core migration/); assert.throws(() => migrations.migrate({ ...source, coreSchemaVersion: 2 }, 1), /backward/);
});

test('deserializeGraph rejects malformed JSON and newer unsupported schema', () => {
  assert.throws(() => deserializeGraph('{oops'), /could not be parsed/); const doc = JSON.parse(serializeGraph(demoGraph())); doc.coreSchemaVersion = 999; assert.throws(() => deserializeGraph(doc), /newer than supported/);
});


test('v0.2 exports the reusable Canvas and Viewport surface', () => {
  assert.equal(typeof NodeCanvas, 'function');
  assert.equal(typeof NODE_CANVAS_CSS, 'string');
  assert.match(NODE_CANVAS_CSS, /\.nec-canvas/);
});

test('clampZoom enforces configured viewport limits', () => {
  assert.equal(clampZoom(0.1, 0.25, 2), 0.25);
  assert.equal(clampZoom(1.5, 0.25, 2), 1.5);
  assert.equal(clampZoom(4, 0.25, 2), 2);
  assert.throws(() => clampZoom(1, 0, 2), /greater than 0/);
});

test('screen and flow coordinates round-trip with viewport translation and scale', () => {
  const viewport = { x: 120, y: -40, zoom: 1.5 };
  const origin = { x: 15, y: 25 };
  const flow = { x: 80, y: 60 };
  const screen = flowToScreenPosition(flow, viewport, origin);
  assert.deepEqual(screen, { x: 255, y: 75 });
  assert.deepEqual(screenToFlowPosition(screen, viewport, origin), flow);
});

test('calculateFitViewport centers bounds and respects zoom limits', () => {
  const viewport = calculateFitViewport({ bounds: { x: 100, y: 50, width: 400, height: 200 }, width: 1000, height: 600, padding: 50, minZoom: 0.25, maxZoom: 2 });
  assert.equal(viewport.zoom, 2);
  assert.deepEqual(viewport, { x: -100, y: 0, zoom: 2 });
  const limited = calculateFitViewport({ bounds: { x: 0, y: 0, width: 4000, height: 2000 }, width: 800, height: 500, padding: 40, minZoom: 0.3, maxZoom: 2 });
  assert.equal(limited.zoom, 0.3);
});

test('fitSelection uses the normal canvas zoom range by default', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.selectedNodeIds = new Set(['node-1']);
  canvas.selectedNodeId = 'node-1';
  canvas.maxZoom = 2.5;
  canvas.graph = { viewport: { x: 0, y: 0, zoom: 0.5 } };
  canvas._fitNodes = (ids, options) => ({ ids, options });

  const defaultFit = canvas.fitSelection({ padding: 110 });
  assert.deepEqual(defaultFit.ids, ['node-1']);
  assert.equal(defaultFit.options.padding, 110);
  assert.equal(defaultFit.options.maxZoom, undefined);

  const limitedFit = canvas.fitSelection({ padding: 110, maxZoom: 1.5 });
  assert.equal(limitedFit.options.maxZoom, 1.5);
});

test('canvas CSS separates pan and zoom layers without permanent will-change', () => {
  assert.match(NODE_CANVAS_CSS, /\.nec-stage\{[^}]*transform-origin:0 0[^}]*\}/);
  assert.match(NODE_CANVAS_CSS, /\.nec-zoom-layer\{[^}]*transform-origin:0 0[^}]*\}/);
  assert.doesNotMatch(NODE_CANVAS_CSS, /will-change:transform/);
  assert.match(NODE_CANVAS_CSS, /\.nec-edge-layer\{[^}]*pointer-events:auto/);
  assert.match(NODE_CANVAS_CSS, /\.nec-edge-hit\{[^}]*pointer-events:stroke/);
  assert.match(NODE_CANVAS_CSS, /\.nec-node-layer\{[^}]*pointer-events:none/);
  assert.match(NODE_CANVAS_CSS, /\.nec-node\{[^}]*pointer-events:auto/);
});


test('_applyViewport uses CSS zoom when supported and keeps pan separate', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.graph = { viewport: { x: 12.5, y: -8.25, zoom: 2 } };
  canvas.stage = { style: {} };
  canvas.zoomLayer = { style: {} };
  const styleValues = new Map();
  canvas.element = {
    ownerDocument: { defaultView: { CSS: { supports: (property, value) => property === 'zoom' && value === '1' } } },
    style: {
      backgroundSize: '',
      setProperty: (name, value) => styleValues.set(name, value)
    }
  };
  canvas._applyViewport();
  assert.equal(canvas.stage.style.transform, 'translate(12.5px, -8.25px)');
  assert.equal(canvas.zoomLayer.style.zoom, '2');
  assert.equal(canvas.zoomLayer.style.transform, 'none');
  assert.equal(canvas.element.style.backgroundSize, '40px 40px');
});

test('_applyViewport falls back to transform scale when CSS zoom is unavailable', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.graph = { viewport: { x: 4, y: 6, zoom: 1.75 } };
  canvas.stage = { style: {} };
  canvas.zoomLayer = { style: {} };
  canvas.element = {
    ownerDocument: { defaultView: { CSS: { supports: () => false } } },
    style: { backgroundSize: '', setProperty: () => {} }
  };
  canvas._applyViewport();
  assert.equal(canvas.stage.style.transform, 'translate(4px, 6px)');
  assert.equal(canvas.zoomLayer.style.zoom, '');
  assert.equal(canvas.zoomLayer.style.transform, 'scale(1.75)');
});


test('v0.3 exports connection primitives', () => {
  assert.equal(typeof getPort, 'function');
  assert.equal(typeof arePortTypesCompatible, 'function');
  assert.equal(typeof hasDirectedCycle, 'function');
  assert.equal(typeof validateConnection, 'function');
  assert.match(NODE_CANVAS_CSS, /\.nec-port/);
  assert.match(NODE_CANVAS_CSS, /\.nec-edge-hit/);
  assert.match(NODE_CANVAS_CSS, /\.nec-edge-endpoint/);
});

test('port compatibility accepts equal types and any', () => {
  assert.equal(arePortTypesCompatible({ dataType: 'video' }, { dataType: 'video' }), true);
  assert.equal(arePortTypesCompatible({ dataType: 'any' }, { dataType: 'video' }), true);
  assert.equal(arePortTypesCompatible({ dataType: 'video' }, { dataType: 'any' }), true);
  assert.equal(arePortTypesCompatible({ dataType: 'video' }, { dataType: 'audio' }), false);
});

function connectionRegistry() {
  const registry = new NodeRegistry();
  registry.register({ type: 'source', getPorts: () => [{ id: 'out', direction: 'output', dataType: 'video', maxConnections: 1 }] });
  registry.register({ type: 'pass', getPorts: () => [{ id: 'in', direction: 'input', dataType: 'video', maxConnections: 1 }, { id: 'out', direction: 'output', dataType: 'video', maxConnections: 1 }] });
  registry.register({ type: 'audio', getPorts: () => [{ id: 'in', direction: 'input', dataType: 'audio', maxConnections: 1 }] });
  return registry;
}

function connectionGraph() {
  const nodes = [
    createNode({ id: 'a', type: 'source' }),
    createNode({ id: 'b', type: 'pass' }),
    createNode({ id: 'c', type: 'pass' }),
    createNode({ id: 'd', type: 'audio' })
  ];
  return createGraph({ appId: 'connection-test', nodes, edges: [createEdge({ id: 'ab', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } })] });
}

test('validateConnection checks direction and type compatibility', () => {
  const registry = connectionRegistry();
  const graph = connectionGraph();
  assert.equal(validateConnection(graph, { registry, source: { nodeId: 'b', portId: 'in' }, target: { nodeId: 'c', portId: 'in' } }).code, 'INVALID_SOURCE_DIRECTION');
  assert.equal(validateConnection(graph, { registry, source: { nodeId: 'b', portId: 'out' }, target: { nodeId: 'd', portId: 'in' } }).code, 'TYPE_MISMATCH');
});

test('validateConnection enforces connection limits or plans replacement', () => {
  const registry = connectionRegistry();
  const graph = connectionGraph();
  const rejected = validateConnection(graph, { registry, source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'c', portId: 'in' } });
  assert.equal(rejected.valid, false);
  assert.equal(rejected.code, 'SOURCE_CONNECTION_LIMIT');
  const replacement = validateConnection(graph, { registry, source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'c', portId: 'in' }, replaceExisting: true });
  assert.equal(replacement.valid, true);
  assert.deepEqual(replacement.edgesToReplace, ['ab']);
});

test('validateConnection rejects duplicate and self connections', () => {
  const registry = connectionRegistry();
  const graph = connectionGraph();
  assert.equal(validateConnection(graph, { registry, source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'b', portId: 'in' }, ignoreEdgeId: null }).code, 'DUPLICATE_CONNECTION');
  assert.equal(validateConnection(graph, { registry, source: { nodeId: 'b', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } }).code, 'SELF_CONNECTION');
});

test('cycle detection rejects a candidate edge unless cycles are allowed', () => {
  const registry = connectionRegistry();
  let graph = connectionGraph();
  graph = applyChange(graph, { type: 'edge.add', edge: createEdge({ id: 'bc', source: { nodeId: 'b', portId: 'out' }, target: { nodeId: 'c', portId: 'in' } }) });
  const result = validateConnection(graph, { registry, source: { nodeId: 'c', portId: 'out' }, target: { nodeId: 'a', portId: 'out' } });
  assert.equal(result.code, 'INVALID_TARGET_DIRECTION');
  const registry2 = new NodeRegistry();
  registry2.register({ type: 'n', getPorts: () => [{ id: 'in', direction: 'input', dataType: 'x' }, { id: 'out', direction: 'output', dataType: 'x' }] });
  let cyclic = createGraph({ appId: 'cycle', nodes: [createNode({ id: 'x', type: 'n' }), createNode({ id: 'y', type: 'n' }), createNode({ id: 'z', type: 'n' })], edges: [createEdge({ id: 'xy', source: { nodeId: 'x', portId: 'out' }, target: { nodeId: 'y', portId: 'in' } }), createEdge({ id: 'yz', source: { nodeId: 'y', portId: 'out' }, target: { nodeId: 'z', portId: 'in' } })] });
  assert.equal(validateConnection(cyclic, { registry: registry2, source: { nodeId: 'z', portId: 'out' }, target: { nodeId: 'x', portId: 'in' } }).code, 'CYCLE');
  assert.equal(validateConnection(cyclic, { registry: registry2, source: { nodeId: 'z', portId: 'out' }, target: { nodeId: 'x', portId: 'in' }, allowCycles: true }).valid, true);
  cyclic = applyChange(cyclic, { type: 'edge.add', edge: createEdge({ id: 'zx', source: { nodeId: 'z', portId: 'out' }, target: { nodeId: 'x', portId: 'in' } }) });
  assert.equal(hasDirectedCycle(cyclic), true);
});

test('validateGraph reports type mismatches, connection limits, and cycles', () => {
  const registry = new NodeRegistry();
  registry.register({ type: 'n', getPorts: () => [{ id: 'in', direction: 'input', dataType: 'video', maxConnections: 1 }, { id: 'out', direction: 'output', dataType: 'video', maxConnections: 1 }] });
  registry.register({ type: 'audio', getPorts: () => [{ id: 'in', direction: 'input', dataType: 'audio', maxConnections: 1 }] });
  const nodes = [createNode({ id: 'a', type: 'n' }), createNode({ id: 'b', type: 'n' }), createNode({ id: 'c', type: 'n' }), createNode({ id: 'd', type: 'audio' })];
  const graph = createGraph({ appId: 'validate-connections', nodes, edges: [
    createEdge({ id: 'ab', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } }),
    createEdge({ id: 'ac', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'c', portId: 'in' } }),
    createEdge({ id: 'ca', source: { nodeId: 'c', portId: 'out' }, target: { nodeId: 'a', portId: 'in' } }),
    createEdge({ id: 'bd', source: { nodeId: 'b', portId: 'out' }, target: { nodeId: 'd', portId: 'in' } })
  ] });
  const codes = validateGraph(graph, { registry }).map(item => item.code);
  assert.ok(codes.includes('SOURCE_CONNECTION_LIMIT'));
  assert.ok(codes.includes('TYPE_MISMATCH'));
  assert.ok(codes.includes('CYCLE'));
});

test('NodeCanvas connection policy defaults to conservative graph edits', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.registry = connectionRegistry();
  canvas.graph = connectionGraph();
  canvas.connectionPolicy = Object.freeze({ allowSelfConnections: false, allowCycles: false, replaceExisting: false, isCompatible: null, validate: null });
  const result = canvas.validateConnection({ nodeId: 'a', portId: 'out' }, { nodeId: 'c', portId: 'in' });
  assert.equal(result.code, 'SOURCE_CONNECTION_LIMIT');
});


test('consumer connection validation can reject a structurally valid candidate', () => {
  const registry = connectionRegistry();
  const graph = connectionGraph();
  const result = validateConnection(graph, {
    registry,
    source: { nodeId: 'b', portId: 'out' },
    target: { nodeId: 'c', portId: 'in' },
    validate: ({ source, target }) => ({ valid: false, code: 'APP_POLICY', messageKey: 'app.connectionRejected', source, target })
  });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'APP_POLICY');
  assert.equal(result.messageKey, 'app.connectionRejected');
  assert.ok(Object.isFrozen(result.edgesToReplace));
});

test('reconnect validation ignores the edge being moved while enforcing other limits', () => {
  const registry = connectionRegistry();
  let graph = connectionGraph();
  const same = validateConnection(graph, {
    registry,
    source: { nodeId: 'a', portId: 'out' },
    target: { nodeId: 'b', portId: 'in' },
    ignoreEdgeId: 'ab'
  });
  assert.equal(same.valid, true);
  graph = applyChange(graph, { type: 'edge.add', edge: createEdge({ id: 'cb', source: { nodeId: 'c', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } }) });
  const blocked = validateConnection(graph, {
    registry,
    source: { nodeId: 'a', portId: 'out' },
    target: { nodeId: 'b', portId: 'in' },
    ignoreEdgeId: 'ab'
  });
  assert.equal(blocked.code, 'TARGET_CONNECTION_LIMIT');
  const replace = validateConnection(graph, {
    registry,
    source: { nodeId: 'a', portId: 'out' },
    target: { nodeId: 'b', portId: 'in' },
    ignoreEdgeId: 'ab',
    replaceExisting: true
  });
  assert.equal(replace.valid, true);
  assert.deepEqual(replace.edgesToReplace, ['cb']);
});

test('v0.4 Canvas CSS includes marquee, toolbar, disabled, and locked states', () => {
  assert.match(NODE_CANVAS_CSS, /\.nec-selection-marquee/);
  assert.match(NODE_CANVAS_CSS, /\.nec-node-toolbar/);
  assert.match(NODE_CANVAS_CSS, /data-disabled/);
  assert.match(NODE_CANVAS_CSS, /\.nec-canvas\.is-locked/);
});

function editingCanvasStub(graph = demoGraph()) {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.graph = graph;
  canvas.selectedNodeIds = new Set();
  canvas.selectedNodeId = null;
  canvas.selectedEdgeId = null;
  canvas.interactive = true;
  canvas.inspectorOpen = false;
  canvas.nodeElements = new Map();
  canvas.edgeElements = new Map();
  canvas.portElements = new Map();
  canvas.getNodeToolbarActions = null;
  canvas.onNodeToolbarAction = null;
  canvas.onSelectionChange = null;
  canvas.onEdgeSelectionChange = null;
  canvas.onInspectorChange = null;
  canvas.onInteractiveChange = null;
  canvas.element = {
    classList: { toggle: () => {} },
    setPointerCapture: () => {},
    clientWidth: 800,
    clientHeight: 500
  };
  canvas._updateSelectionStyles = () => {};
  canvas._syncNodeToolbar = () => {};
  canvas._renderEdges = () => {};
  canvas._clearConnectionHighlights = () => {};
  return canvas;
}

test('multi-selection supports additive toggle and primary selection', () => {
  const canvas = editingCanvasStub();
  assert.deepEqual(canvas.selectNode('a'), ['a']);
  assert.deepEqual(canvas.selectNode('b', { additive: true, toggle: true }), ['a', 'b']);
  assert.equal(canvas.getPrimarySelection(), 'b');
  assert.deepEqual(canvas.selectNode('a', { additive: true, toggle: true }), ['b']);
  assert.equal(canvas.getPrimarySelection(), 'b');
});

test('fitSelection sends every selected node to the viewport fitter', () => {
  const canvas = editingCanvasStub();
  canvas.selectedNodeIds = new Set(['a', 'b']);
  canvas.selectedNodeId = 'b';
  canvas._fitNodes = (ids, options) => ({ ids, options });
  const result = canvas.fitSelection({ padding: 70 });
  assert.deepEqual(result.ids, ['a', 'b']);
  assert.equal(result.options.padding, 70);
});

test('multi-node drag snapshots all selected positions', () => {
  const canvas = editingCanvasStub();
  canvas.selectedNodeIds = new Set(['a', 'b']);
  canvas.selectedNodeId = 'b';
  canvas.graph = demoGraph();
  canvas.graph = { ...canvas.graph, viewport: { x: 0, y: 0, zoom: 2 } };
  canvas._beginNodeDrag({ pointerId: 4, clientX: 100, clientY: 80 }, 'b');
  assert.equal(canvas.gesture.type, 'node-drag');
  assert.deepEqual(Object.keys(canvas.gesture.starts), ['a', 'b']);
  assert.deepEqual(canvas.gesture.starts.a, { x: 10, y: 20 });
  assert.deepEqual(canvas.gesture.starts.b, { x: 120, y: 20 });
  assert.equal(canvas.gesture.zoom, 2);
});

test('interactive lock blocks delete and disable edits while leaving graph unchanged', () => {
  const canvas = editingCanvasStub();
  canvas.selectedNodeIds = new Set(['b']);
  canvas.selectedNodeId = 'b';
  canvas.interactive = false;
  const original = canvas.graph;
  assert.equal(canvas.deleteSelection(), false);
  assert.equal(canvas.toggleSelectedDisabled(), false);
  assert.equal(canvas.graph, original);
});

test('deleteSelection delegates node.remove changes without implicit bypass edges', () => {
  const graph = createGraph({
    appId: 'delete-test',
    nodes: [createNode({ id: 'a', type: 'source' }), createNode({ id: 'b', type: 'transform' }), createNode({ id: 'c', type: 'transform' })],
    edges: [
      createEdge({ id: 'ab', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } }),
      createEdge({ id: 'bc', source: { nodeId: 'b', portId: 'out' }, target: { nodeId: 'c', portId: 'in' } })
    ]
  });
  const canvas = editingCanvasStub(graph);
  canvas.selectedNodeIds = new Set(['b']);
  canvas.selectedNodeId = 'b';
  canvas.dispatchMany = changes => { canvas.graph = applyChanges(canvas.graph, changes); return canvas.graph; };
  assert.equal(canvas.deleteSelection(), true);
  assert.equal(getNode(canvas.graph, 'b'), null);
  assert.equal(canvas.graph.edges.length, 0);
});

test('deleteSelection removes a selected Edge and leaves its Nodes in place', () => {
  const graph = demoGraph();
  const canvas = editingCanvasStub(graph);
  canvas.selectedNodeIds = new Set();
  canvas.selectedNodeId = null;
  canvas.selectedEdgeId = 'e1';
  canvas.dispatch = change => { canvas.graph = applyChange(canvas.graph, change); return canvas.graph; };
  assert.equal(canvas.deleteSelection(), true);
  assert.equal(getEdge(canvas.graph, 'e1'), null);
  assert.equal(canvas.graph.nodes.length, 2);
});

test('inspector state reports selected node without owning consumer layout', () => {
  const canvas = editingCanvasStub();
  const events = [];
  canvas.onInspectorChange = state => events.push({ open: state.open, nodeId: state.nodeId, selection: [...state.selection] });
  canvas.openInspector('b');
  assert.equal(canvas.isInspectorOpen(), true);
  assert.deepEqual(events.at(-1), { open: true, nodeId: 'b', selection: ['b'] });
  canvas.closeInspector();
  assert.deepEqual(events.at(-1), { open: false, nodeId: 'b', selection: ['b'] });
});

test('selection mode accepts partial or full only', () => {
  const source = NodeCanvas.toString();
  assert.match(source, /selectionMode !== 'partial'/);
  assert.match(source, /selectionMode !== 'full'/);
});


test('v0.5 exports history and clipboard graph helpers', () => {
  assert.equal(typeof graphContentSignature, 'function');
  assert.equal(typeof createGraphFragment, 'function');
  assert.equal(typeof pasteGraphFragment, 'function');
  assert.equal(typeof NodeCanvas.prototype.undo, 'function');
  assert.equal(typeof NodeCanvas.prototype.redo, 'function');
  assert.equal(typeof NodeCanvas.prototype.copySelection, 'function');
  assert.equal(typeof NodeCanvas.prototype.pasteClipboard, 'function');
  assert.equal(typeof NodeCanvas.prototype.duplicateSelection, 'function');
  assert.equal(typeof NodeCanvas.prototype.markSaved, 'function');
});

test('graphContentSignature ignores viewport-only changes', () => {
  const graph = demoGraph();
  const movedViewport = applyChange(graph, { type: 'graph.viewport', viewport: { x: 90, y: -30, zoom: 1.8 } });
  assert.equal(graphContentSignature(graph), graphContentSignature(movedViewport));
  const movedNode = applyChange(graph, { type: 'node.position', nodeId: 'a', position: { x: 99, y: 20 } });
  assert.notEqual(graphContentSignature(graph), graphContentSignature(movedNode));
});

test('graph fragments include selected nodes and only edges fully inside the selection', () => {
  const graph = createGraph({
    appId: 'fragment-test',
    nodes: [createNode({ id: 'a', type: 'source' }), createNode({ id: 'b', type: 'transform' }), createNode({ id: 'c', type: 'transform' })],
    edges: [
      createEdge({ id: 'ab', source: { nodeId: 'a', portId: 'out' }, target: { nodeId: 'b', portId: 'in' } }),
      createEdge({ id: 'bc', source: { nodeId: 'b', portId: 'out' }, target: { nodeId: 'c', portId: 'in' } })
    ]
  });
  const fragment = createGraphFragment(graph, ['a', 'b']);
  assert.deepEqual(fragment.nodes.map(node => node.id), ['a', 'b']);
  assert.deepEqual(fragment.edges.map(edge => edge.id), ['ab']);
});

test('pasteGraphFragment remaps node and edge IDs while preserving internal connectivity', () => {
  const graph = demoGraph();
  const fragment = createGraphFragment(graph, ['a', 'b']);
  const result = pasteGraphFragment(graph, fragment, { offset: { x: 30, y: 40 } });
  assert.equal(result.nodeIds.length, 2);
  assert.equal(result.edgeIds.length, 1);
  assert.ok(result.nodeIds.every(id => !['a', 'b'].includes(id)));
  assert.notEqual(result.edgeIds[0], 'e1');
  const copiedA = getNode(result.graph, result.nodeIdMap.a);
  const copiedB = getNode(result.graph, result.nodeIdMap.b);
  const copiedEdge = getEdge(result.graph, result.edgeIdMap.e1);
  assert.deepEqual(copiedA.position, { x: 40, y: 60 });
  assert.deepEqual(copiedB.position, { x: 150, y: 60 });
  assert.equal(copiedEdge.source.nodeId, copiedA.id);
  assert.equal(copiedEdge.target.nodeId, copiedB.id);
});

function historyCanvasStub(graph = demoGraph()) {
  const canvas = editingCanvasStub(graph);
  canvas.history = { past: [], future: [], transaction: null };
  canvas.historyLimit = 100;
  canvas.lastHistoryCoalesceKey = null;
  canvas.clipboard = null;
  canvas.clipboardPasteCount = 0;
  canvas.clipboardOffset = { x: 24, y: 24 };
  canvas.savedSignature = graphContentSignature(graph);
  canvas.lastDirtyState = false;
  canvas.onHistoryChange = null;
  canvas.onDirtyChange = null;
  canvas.onClipboardChange = null;
  canvas.onChange = null;
  canvas.onViewportChange = null;
  canvas._syncNodes = () => {};
  canvas._applyViewport = () => {};
  canvas._positionNode = () => {};
  canvas._positionAllPorts = () => {};
  canvas._syncLayerBounds = () => {};
  canvas._notifySelection = NodeCanvas.prototype._notifySelection.bind(canvas);
  return canvas;
}

test('undo and redo restore persistent edits without rewinding the current viewport', () => {
  const canvas = historyCanvasStub();
  canvas.dispatch({ type: 'node.position', nodeId: 'a', position: { x: 50, y: 60 } });
  assert.equal(canvas.canUndo(), true);
  canvas.graph = applyChange(canvas.graph, { type: 'graph.viewport', viewport: { x: 100, y: 80, zoom: 2 } });
  assert.equal(canvas.undo(), true);
  assert.deepEqual(getNode(canvas.graph, 'a').position, { x: 10, y: 20 });
  assert.deepEqual(canvas.graph.viewport, { x: 100, y: 80, zoom: 2 });
  assert.equal(canvas.canRedo(), true);
  assert.equal(canvas.redo(), true);
  assert.deepEqual(getNode(canvas.graph, 'a').position, { x: 50, y: 60 });
  assert.deepEqual(canvas.graph.viewport, { x: 100, y: 80, zoom: 2 });
});

test('transactions collapse repeated transient node movement into one undo entry', () => {
  const canvas = historyCanvasStub();
  canvas.beginTransaction('drag');
  canvas.dispatch({ type: 'node.position', nodeId: 'a', position: { x: 20, y: 20 } }, { transient: true });
  canvas.dispatch({ type: 'node.position', nodeId: 'a', position: { x: 30, y: 20 } }, { transient: true });
  canvas.dispatch({ type: 'node.position', nodeId: 'a', position: { x: 40, y: 20 } }, { transient: true });
  assert.equal(canvas.history.past.length, 0);
  assert.equal(canvas.commitTransaction(), true);
  assert.equal(canvas.history.past.length, 1);
  canvas.undo();
  assert.deepEqual(getNode(canvas.graph, 'a').position, { x: 10, y: 20 });
});

test('coalesceKey groups repeated parameter-style changes into one undo step', () => {
  const canvas = historyCanvasStub();
  canvas.dispatch({ type: 'node.data', nodeId: 'b', data: { mode: 'one' } }, { coalesceKey: 'b:mode' });
  canvas.dispatch({ type: 'node.data', nodeId: 'b', data: { mode: 'two' } }, { coalesceKey: 'b:mode' });
  canvas.dispatch({ type: 'node.data', nodeId: 'b', data: { mode: 'three' } }, { coalesceKey: 'b:mode' });
  assert.equal(canvas.history.past.length, 1);
  canvas.undo();
  assert.equal(getNode(canvas.graph, 'b').data.mode, 'pass');
});

test('copy and paste remap IDs, offset nodes, select the pasted set, and create one history entry', () => {
  const canvas = historyCanvasStub();
  canvas.setSelection(['a', 'b'], { primaryNodeId: 'b' });
  const fragment = canvas.copySelection();
  assert.equal(fragment.nodes.length, 2);
  assert.equal(fragment.edges.length, 1);
  const pasted = canvas.pasteClipboard();
  assert.equal(pasted.length, 2);
  assert.equal(canvas.graph.nodes.length, 4);
  assert.equal(canvas.graph.edges.length, 2);
  assert.deepEqual(canvas.getSelection(), [...pasted]);
  assert.equal(canvas.history.past.length, 1);
  assert.deepEqual(getNode(canvas.graph, pasted[0]).position, { x: 34, y: 44 });
});

test('duplicate uses the selected graph fragment without replacing the clipboard', () => {
  const canvas = historyCanvasStub();
  canvas.setSelection(['a'], { primaryNodeId: 'a' });
  canvas.copySelection();
  const originalClipboard = canvas.getClipboardFragment();
  canvas.setSelection(['b'], { primaryNodeId: 'b' });
  const duplicated = canvas.duplicateSelection();
  assert.equal(duplicated.length, 1);
  assert.equal(getNode(canvas.graph, duplicated[0]).type, 'transform');
  assert.equal(canvas.getClipboardFragment(), originalClipboard);
});

test('cut copies the selected fragment and deletion is undoable as one edit', () => {
  const canvas = historyCanvasStub();
  canvas.setSelection(['b'], { primaryNodeId: 'b' });
  assert.equal(canvas.cutSelection(), true);
  assert.equal(canvas.hasClipboard(), true);
  assert.equal(getNode(canvas.graph, 'b'), null);
  assert.equal(canvas.history.past.length, 1);
  canvas.undo();
  assert.ok(getNode(canvas.graph, 'b'));
});

test('dirty state ignores viewport changes and markSaved resets the baseline', () => {
  const canvas = historyCanvasStub();
  assert.equal(canvas.isDirty(), false);
  canvas.setViewport({ x: 30, y: 20, zoom: 1.2 }, { emit: false });
  assert.equal(canvas.isDirty(), false);
  canvas.dispatch({ type: 'node.disable', nodeId: 'b', disabled: true });
  assert.equal(canvas.isDirty(), true);
  canvas.markSaved();
  assert.equal(canvas.isDirty(), false);
});

test('interactive lock blocks undo, redo, paste, duplicate, and cut mutations', () => {
  const canvas = historyCanvasStub();
  canvas.setSelection(['b'], { primaryNodeId: 'b' });
  canvas.copySelection();
  canvas.dispatch({ type: 'node.disable', nodeId: 'b', disabled: true });
  canvas.interactive = false;
  const signature = graphContentSignature(canvas.graph);
  assert.equal(canvas.undo(), false);
  assert.equal(canvas.redo(), false);
  assert.deepEqual(canvas.pasteClipboard(), []);
  assert.deepEqual(canvas.duplicateSelection(), []);
  assert.equal(canvas.cutSelection(), false);
  assert.equal(graphContentSignature(canvas.graph), signature);
});

test('_portCenter uses the rendered Port center after translateY and zoom', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  const registry = demoRegistry();
  const node = createNode({ id: 'a', type: 'source', position: { x: 10, y: 20 }, data: { outputs: 1 } });
  canvas.graph = createGraph({ appId: 'demo', nodes: [node], viewport: { x: 40, y: 30, zoom: 2 } });
  canvas.registry = registry;
  canvas.portElements = new Map();
  canvas.nodeElements = new Map();
  canvas.zoomLayer = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }) };
  const button = {
    style: { top: '37px' },
    offsetLeft: 176,
    offsetTop: 37,
    offsetWidth: 18,
    offsetHeight: 18,
    getBoundingClientRect: () => ({ left: 320, top: 116, width: 36, height: 36 })
  };
  canvas.portElements.set(canvas._portMapKey('a', 'output', 'out-1'), button);
  canvas.nodeElements.set('a', { offsetWidth: 176, offsetHeight: 74 });

  // Rendered center = (338, 134). Relative to the zoom layer, then divided
  // by zoom 2, gives the exact graph-space anchor (119, 42).
  assert.deepEqual(canvas._portCenter({ nodeId: 'a', portId: 'out-1' }, 'output'), { x: 119, y: 42 });
});

test('_portCenter fallback treats style.top as the visual center of translated Ports', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  const registry = demoRegistry();
  const node = createNode({ id: 'a', type: 'source', position: { x: 10, y: 20 }, data: { outputs: 1 } });
  canvas.graph = createGraph({ appId: 'demo', nodes: [node] });
  canvas.registry = registry;
  canvas.portElements = new Map();
  canvas.nodeElements = new Map();
  canvas.zoomLayer = {};
  const button = { style: { top: '37px' }, offsetLeft: 176, offsetTop: 37, offsetWidth: 18, offsetHeight: 18 };
  canvas.portElements.set(canvas._portMapKey('a', 'output', 'out-1'), button);
  canvas.nodeElements.set('a', { offsetWidth: 176, offsetHeight: 74 });

  assert.deepEqual(canvas._portCenter({ nodeId: 'a', portId: 'out-1' }, 'output'), { x: 195, y: 57 });
});

test('v0.6 Canvas CSS provides coarse-pointer hit areas and screen-reader-only announcements', () => {
  assert.match(NODE_CANVAS_CSS, /@media \(pointer:coarse\),\(max-width:700px\)/);
  assert.match(NODE_CANVAS_CSS, /\.nec-port\{width:48px;height:48px\}/);
  assert.match(NODE_CANVAS_CSS, /\.nec-sr-only\{/);
});

function sequentialConnectionStub() {
  const graph = createGraph({
    appId: 'touch-test',
    nodes: [
      createNode({ id: 'a', type: 'source', position: { x: 0, y: 0 }, data: { outputs: 1 } }),
      createNode({ id: 'b', type: 'transform', definitionVersion: 2, position: { x: 100, y: 0 }, data: { mode: 'pass' } })
    ]
  });
  const canvas = editingCanvasStub(graph);
  canvas.registry = demoRegistry();
  canvas.pendingConnection = null;
  canvas.connectionPolicy = { allowSelfConnections: false, allowCycles: false, replaceExisting: false, isCompatible: null, validate: null, mouseMagnetRadius: 48, touchMagnetRadius: 64 };
  canvas._syncPendingConnectionHighlights = () => {};
  canvas._clearConnectionHighlights = () => {};
  canvas._announce = () => '';
  canvas.focusPort = () => null;
  canvas.validateConnection = NodeCanvas.prototype.validateConnection.bind(canvas);
  canvas.connected = null;
  canvas.connectPorts = (source, target) => {
    canvas.connected = { source, target };
    return { valid: true, edgeId: 'touch-edge', source, target, edgesToReplace: [] };
  };
  return canvas;
}

test('Tap-to-Tap / keyboard port activation starts and completes a typed connection', () => {
  const canvas = sequentialConnectionStub();
  const started = canvas.activatePort({ nodeId: 'a', direction: 'output', portId: 'out-1' }, { source: 'touch' });
  assert.equal(started.status, 'started');
  assert.deepEqual(canvas.getPendingConnection(), { nodeId: 'a', direction: 'output', portId: 'out-1' });

  const connected = canvas.activatePort({ nodeId: 'b', direction: 'input', portId: 'in' }, { source: 'touch' });
  assert.equal(connected.status, 'connected');
  assert.equal(canvas.getPendingConnection(), null);
  assert.deepEqual(canvas.connected, {
    source: { nodeId: 'a', portId: 'out-1' },
    target: { nodeId: 'b', portId: 'in' }
  });
});

test('sequential connection can restart from another same-side Port and tap again to cancel', () => {
  const registry = demoRegistry();
  const graph = createGraph({
    appId: 'touch-test',
    nodes: [
      createNode({ id: 'a', type: 'source', data: { outputs: 1 } }),
      createNode({ id: 'c', type: 'source', data: { outputs: 1 } })
    ]
  });
  const canvas = editingCanvasStub(graph);
  canvas.registry = registry;
  canvas.pendingConnection = null;
  canvas._syncPendingConnectionHighlights = () => {};
  canvas._clearConnectionHighlights = () => {};
  canvas._renderEdges = () => {};
  canvas._announce = () => '';

  canvas.activatePort({ nodeId: 'a', direction: 'output', portId: 'out-1' });
  const restarted = canvas.activatePort({ nodeId: 'c', direction: 'output', portId: 'out-1' });
  assert.equal(restarted.status, 'restarted');
  assert.equal(canvas.getPendingConnection().nodeId, 'c');
  const cancelled = canvas.activatePort({ nodeId: 'c', direction: 'output', portId: 'out-1' });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(canvas.getPendingConnection(), null);
});

test('Escape cancels a pending sequential connection before clearing selection', () => {
  const canvas = sequentialConnectionStub();
  canvas.activatePort({ nodeId: 'a', direction: 'output', portId: 'out-1' });
  canvas._renderEdges = () => {};
  const event = { key: 'Escape', target: {}, preventDefault() { this.prevented = true; }, ctrlKey: false, metaKey: false };
  canvas._handleKeyDown(event);
  assert.equal(canvas.getPendingConnection(), null);
  assert.equal(event.prevented, true);
});

test('interactive lock cancels pending connection state', () => {
  const canvas = sequentialConnectionStub();
  canvas.element.classList = { toggle: () => {} };
  canvas._syncNodeToolbar = () => {};
  canvas.activatePort({ nodeId: 'a', direction: 'output', portId: 'out-1' });
  canvas.setInteractive(false);
  assert.equal(canvas.getPendingConnection(), null);
});

test('touch Port gesture becomes a drag connection only after the configured threshold', () => {
  const canvas = sequentialConnectionStub();
  canvas.touchDragThreshold = 8;
  canvas.screenToFlowPosition = point => point;
  canvas._updateConnectionHighlights = () => {};
  canvas._nearestConnectionTarget = () => null;
  canvas._setMagnetTarget = () => {};
  canvas._renderEdges = () => {};
  canvas.cancelPendingConnection = () => false;
  canvas.gesture = { type: 'touch-port', pointerId: 9, start: { nodeId: 'a', direction: 'output', portId: 'out-1' }, startClient: { x: 10, y: 10 }, pointerType: 'touch' };
  canvas._handlePointerMove({ pointerId: 9, pointerType: 'touch', clientX: 15, clientY: 10 });
  assert.equal(canvas.gesture.type, 'touch-port');
  canvas._handlePointerMove({ pointerId: 9, pointerType: 'touch', clientX: 25, clientY: 10 });
  assert.equal(canvas.gesture.type, 'connection');
  assert.equal(canvas.gesture.moved, true);
});

test('pending connection callback reports start and cancel state', () => {
  const canvas = sequentialConnectionStub();
  const states = [];
  canvas.onPendingConnectionChange = pending => states.push(pending ? `${pending.nodeId}:${pending.portId}` : null);
  canvas.activatePort({ nodeId: 'a', direction: 'output', portId: 'out-1' }, { source: 'keyboard' });
  canvas.cancelPendingConnection({ source: 'test' });
  assert.deepEqual(states, ['a:out-1', null]);
});

test('focus helpers target Canvas, Node, and Port without changing graph content', () => {
  const canvas = editingCanvasStub();
  let canvasFocused = false, nodeFocused = false, portFocused = false;
  canvas.element.focus = () => { canvasFocused = true; };
  canvas.nodeElements.set('a', { focus: () => { nodeFocused = true; } });
  canvas.portElements.set(canvas._portMapKey('a', 'output', 'out-1'), { focus: () => { portFocused = true; } });
  canvas.focusCanvas();
  canvas.focusNode('a');
  canvas.focusPort({ nodeId: 'a', direction: 'output', portId: 'out-1' });
  assert.equal(canvasFocused, true);
  assert.equal(nodeFocused, true);
  assert.equal(portFocused, true);
  assert.ok(getNode(canvas.graph, 'a'));
});


test('v0.7 exports Canvas polish helpers', () => {
  assert.equal(typeof snapToGridValue, 'function');
  assert.equal(typeof calculateAlignmentSnap, 'function');
  assert.equal(typeof getContextualZoomLevel, 'function');
});

test('snapToGridValue rounds positions to the configured grid', () => {
  assert.equal(snapToGridValue(37, 20), 40);
  assert.equal(snapToGridValue(29, 10), 30);
  assert.equal(snapToGridValue(-7, 10), -10);
  assert.throws(() => snapToGridValue(10, 0), /greater than 0/);
});

test('calculateAlignmentSnap detects edge and center alignment independently', () => {
  const result = calculateAlignmentSnap({
    movingBounds: { x: 101, y: 39, width: 100, height: 60 },
    candidateBounds: [{ x: 0, y: 40, width: 100, height: 60 }, { x: 300, y: 200, width: 100, height: 60 }],
    threshold: 4,
    snap: true
  });
  assert.equal(result.dx, -1);
  assert.equal(result.vertical, 100);
  assert.equal(result.dy, 1);
  assert.equal(result.horizontal, 40);
});

test('calculateAlignmentSnap can show guides without changing movement', () => {
  const result = calculateAlignmentSnap({
    movingBounds: { x: 98, y: 100, width: 100, height: 60 },
    candidateBounds: [{ x: 100, y: 300, width: 100, height: 60 }],
    threshold: 4,
    snap: false
  });
  assert.equal(result.dx, 0);
  assert.equal(result.vertical, 100);
});

test('calculateAlignmentSnap ignores candidates outside the threshold', () => {
  const result = calculateAlignmentSnap({
    movingBounds: { x: 90, y: 90, width: 100, height: 60 },
    candidateBounds: [{ x: 100, y: 200, width: 100, height: 60 }],
    threshold: 5
  });
  assert.equal(result.vertical, null);
  assert.equal(result.horizontal, null);
});

test('contextual zoom reports compact, normal, and detailed levels', () => {
  const config = { compactBelow: 0.7, detailedAbove: 1.5 };
  assert.equal(getContextualZoomLevel(0.5, config), 'compact');
  assert.equal(getContextualZoomLevel(1, config), 'normal');
  assert.equal(getContextualZoomLevel(1.5, config), 'detailed');
  assert.throws(() => getContextualZoomLevel(1, { compactBelow: 1, detailedAbove: 0.8 }), /thresholds/);
});

test('v0.7 Canvas CSS contains helper lines, MiniMap, hover edge feedback, and an 18px edge hit area', () => {
  assert.match(NODE_CANVAS_CSS, /\.nec-helper-line/);
  assert.match(NODE_CANVAS_CSS, /\.nec-minimap/);
  assert.match(NODE_CANVAS_CSS, /\.nec-edge-hit\{[^}]*stroke-width:18/);
  assert.match(NODE_CANVAS_CSS, /\.nec-edge-hit:hover \+ \.nec-edge/);
});

test('_dragSnap prefers helper alignment and applies grid snap on axes without a helper', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.graph = createGraph({ appId: 'demo', nodes: [
    createNode({ id: 'moving', type: 'source', position: { x: 10, y: 10 } }),
    createNode({ id: 'fixed', type: 'source', position: { x: 200, y: 180 } })
  ], viewport: { x: 0, y: 0, zoom: 1 } });
  canvas.nodeElements = new Map([
    ['moving', { offsetWidth: 100, offsetHeight: 60 }],
    ['fixed', { offsetWidth: 100, offsetHeight: 60 }]
  ]);
  canvas.selectedNodeId = 'moving';
  canvas.helperLines = true;
  canvas.snapToHelper = true;
  canvas.helperLineThreshold = 6;
  canvas.snapToGrid = true;
  canvas.gridSize = 20;
  const result = canvas._dragSnap({ moving: { x: 10, y: 10 } }, 91, 88);
  assert.equal(result.vertical, 200);
  assert.equal(10 + result.dx, 100); // right edge aligns to fixed left at x=200
  assert.equal(10 + result.dy, 100); // Y uses 20px grid because no helper is close
});

test('MiniMap visibility is optional and can be toggled without changing graph content', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.miniMapVisible = false;
  canvas.miniMap = { hidden: true };
  canvas._renderMiniMap = () => {};
  canvas.onMiniMapChange = null;
  assert.equal(canvas.setMiniMapVisible(true), true);
  assert.equal(canvas.miniMap.hidden, false);
  assert.equal(canvas.toggleMiniMap(), false);
  assert.equal(canvas.miniMap.hidden, true);
});


test('v0.8 exports production-readiness extension APIs', () => {
  assert.deepEqual(RUNTIME_STATUSES, ['idle', 'ready', 'running', 'success', 'warning', 'error', 'disabled']);
  assert.equal(typeof RuntimeStatusStore, 'function');
  assert.equal(typeof Translator, 'function');
  assert.equal(typeof LayoutRegistry, 'function');
  assert.equal(typeof createValidationResult, 'function');
  assert.equal(typeof benchmarkGraphModel, 'function');
});

test('Theme API normalizes NEC variables and applies them without owning app layout', () => {
  const values = new Map();
  const target = { style: { setProperty: (name, value) => values.set(name, value) } };
  const theme = normalizeTheme({ accent: '#123456', '--nec-surface': '#fff', radius: 12 });
  assert.deepEqual(theme, { '--nec-accent': '#123456', '--nec-surface': '#fff', '--nec-radius': '12' });
  applyTheme(target, theme);
  assert.equal(values.get('--nec-accent'), '#123456');
  assert.equal(values.get('--nec-radius'), '12');
});

test('Translator supports locale switching, fallback, and token interpolation', () => {
  const translator = new Translator({ locale: 'ja', fallbackLocale: 'en', messages: { ja: { hello: 'こんにちは {name}' }, en: { hello: 'Hello {name}', fallback: 'Fallback' } } });
  assert.equal(translator.t('hello', { name: 'Kitty' }), 'こんにちは Kitty');
  assert.equal(translator.t('fallback'), 'Fallback');
  translator.setLocale('en');
  assert.equal(translator.t('hello', { name: 'Kitty' }), 'Hello Kitty');
  assert.equal(translator.t('missing'), 'missing');
});

test('NodeCanvas MiniMap aria-label follows Translator locale', () => {
  const attributes = new Map();
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.miniMap = { setAttribute: (name, value) => attributes.set(name, value) };
  canvas._syncNodes = () => {};
  canvas._renderEdges = () => {};

  const translator = new Translator({
    locale: 'ja',
    fallbackLocale: 'en',
    messages: {
      ja: { 'accessibility.miniMap': 'グラフのミニマップ' },
      en: { 'accessibility.miniMap': 'Graph MiniMap' }
    }
  });

  canvas.setTranslator(translator);
  assert.equal(attributes.get('aria-label'), 'グラフのミニマップ');

  translator.setLocale('en');
  canvas.setTranslator(translator);
  assert.equal(attributes.get('aria-label'), 'Graph MiniMap');
});

test('RuntimeStatusStore keeps ephemeral node status outside persistent graph state', () => {
  const store = new RuntimeStatusStore();
  const events = [];
  const unsubscribe = store.subscribe((nodeId, entry) => events.push([nodeId, entry.status]));
  store.set('node-1', 'running', { message: 'Processing' });
  assert.equal(store.get('node-1').status, 'running');
  assert.equal(store.snapshot()['node-1'].detail.message, 'Processing');
  store.clear('node-1');
  unsubscribe();
  assert.deepEqual(events, [['node-1', 'running'], ['node-1', 'idle']]);
  assert.throws(() => store.set('node-1', 'unknown'), /must be one of/);
});

test('createValidationResult groups issues by Node and Edge for error navigation', () => {
  const registry = demoRegistry();
  const graph = JSON.parse(serializeGraph(demoGraph()));
  graph.nodes[1].data.mode = '';
  graph.edges[0].target.portId = 'missing';
  const result = createValidationResult(graph, { registry });
  assert.equal(result.valid, false);
  assert.ok(result.byNode.b.some(item => item.code === 'MODE_REQUIRED'));
  assert.ok(result.byEdge.e1.some(item => item.code === 'MISSING_TARGET_PORT'));
  assert.ok(result.firstIssue);
});

test('LayoutRegistry applies consumer layout positions without bundling an algorithm into Core', async () => {
  const layouts = new LayoutRegistry();
  layouts.register('row', graph => ({ positions: Object.fromEntries(graph.nodes.map((node, index) => [node.id, { x: index * 200, y: 40 }])) }));
  const result = await layouts.run('row', demoGraph());
  assert.deepEqual(result.positions.a, { x: 0, y: 40 });
  assert.deepEqual(result.positions.b, { x: 200, y: 40 });
  assert.deepEqual(getNode(result.graph, 'b').position, { x: 200, y: 40 });
  assert.deepEqual(layouts.list(), ['row']);
});

test('normalizeLayoutResult accepts a Map and ignores nodes without supplied positions', () => {
  const graph = demoGraph();
  const result = normalizeLayoutResult(graph, new Map([['a', { x: 50, y: 60 }]]));
  assert.equal(result.changes.length, 1);
  assert.deepEqual(getNode(result.graph, 'a').position, { x: 50, y: 60 });
  assert.deepEqual(getNode(result.graph, 'b').position, getNode(graph, 'b').position);
});

test('NodeRegistry migrates persisted node data to the registered definition version during deserialize', () => {
  const registry = new NodeRegistry();
  registry.register({
    type: 'migrating', definitionVersion: 3,
    getPorts: () => [],
    migrateData: ({ fromVersion, data }) => { if (fromVersion === 1) { const { old, ...rest } = data; return { ...rest, renamed: old }; } return { ...data, final: true }; }
  });
  const graph = createGraph({ appId: 'migration-test', nodes: [createNode({ id: 'm1', type: 'migrating', definitionVersion: 1, data: { old: 'value' } })] });
  const restored = deserializeGraph(serializeGraph(graph), { registry });
  const node = getNode(restored, 'm1');
  assert.equal(node.definitionVersion, 3);
  assert.equal(node.data.renamed, 'value');
  assert.equal(node.data.final, true);
});

test('NodeRegistry rejects persisted nodes newer than the registered definition', () => {
  const registry = new NodeRegistry();
  registry.register({ type: 'old-definition', definitionVersion: 1, getPorts: () => [] });
  const graph = createGraph({ appId: 'migration-test', nodes: [createNode({ id: 'n1', type: 'old-definition', definitionVersion: 2 })] });
  assert.throws(() => deserializeGraph(serializeGraph(graph), { registry }), /newer than registered/);
});

test('benchmark helpers cover the desktop 100-node and mobile 50-node targets', () => {
  const desktop = createBenchmarkGraph({ nodeCount: 100 });
  const mobile = createBenchmarkGraph({ nodeCount: 50 });
  assert.equal(desktop.nodes.length, 100); assert.equal(desktop.edges.length, 99);
  assert.equal(mobile.nodes.length, 50); assert.equal(mobile.edges.length, 49);
  let tick = 0;
  const result = benchmarkGraphModel({ nodeCount: 100, iterations: 3, now: () => ++tick });
  assert.equal(result.nodeCount, 100); assert.equal(result.edgeCount, 99); assert.equal(result.iterations, 3); assert.equal(result.averageMs, 1);
});

test('v0.8 Canvas CSS exposes runtime and validation states without hard-coding domain types', () => {
  assert.match(NODE_CANVAS_CSS, /data-runtime-status="running"/);
  assert.match(NODE_CANVAS_CSS, /data-runtime-status="error"/);
  assert.match(NODE_CANVAS_CSS, /data-validation="error"/);
  assert.doesNotMatch(NODE_CANVAS_CSS, /ffmpeg|video|audio/i);
});

test('focusIssue selects and fits a Node issue using the public navigation helpers', () => {
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.graph = demoGraph();
  canvas.registry = demoRegistry();
  canvas.maxZoom = 2.5;
  let selected = null, fitted = null, opened = null, focused = null;
  canvas.selectNode = id => { selected = id; };
  canvas.fitNode = (id, options) => { fitted = [id, options]; };
  canvas.openInspector = id => { opened = id; };
  canvas.focusNode = id => { focused = id; return { id }; };
  const issue = { code: 'MODE_REQUIRED', path: 'nodes[1]', nodeId: 'b' };
  const result = canvas.focusIssue(issue);
  assert.equal(selected, 'b'); assert.equal(fitted[0], 'b'); assert.equal(opened, 'b'); assert.equal(focused, 'b'); assert.deepEqual(result, { id: 'b' });
});

test('v0.8.1 polish toggles expose visible Canvas state classes', () => {
  const states = new Map();
  const canvas = Object.create(NodeCanvas.prototype);
  canvas.element = { classList: { toggle: (name, value) => states.set(name, Boolean(value)) } };
  canvas.snapToGrid = false;
  canvas.helperLines = true;
  let cleared = false;
  canvas._clearHelperGuides = () => { cleared = true; };

  assert.equal(canvas.setSnapToGrid(true), true);
  assert.equal(states.get('is-grid-snap'), true);
  assert.equal(canvas.setHelperLines(false), false);
  assert.equal(states.get('is-helper-lines'), false);
  assert.equal(cleared, true);
});

test('v0.8.1 Canvas CSS makes Grid Snap and Helper Lines visually distinguishable', () => {
  assert.match(NODE_CANVAS_CSS, /\.nec-canvas\.is-grid-snap\{/);
  assert.match(NODE_CANVAS_CSS, /\.nec-helper-line\{[^}]*opacity:\.92/);
});
