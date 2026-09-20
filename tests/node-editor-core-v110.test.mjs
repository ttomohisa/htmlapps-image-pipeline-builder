import test from 'node:test';
import assert from 'node:assert/strict';
import Core from '../src/core/node-editor-core.mjs';

function makeClassList() {
  const values = new Set();
  return {
    toggle(name, force) {
      if (force === undefined ? !values.has(name) : force) values.add(name);
      else values.delete(name);
      return values.has(name);
    },
    contains(name) { return values.has(name); },
    values
  };
}

test('v1.1 addNode accepts client coordinates, snaps, selects, and opens inspector', () => {
  const registry = new Core.NodeRegistry();
  registry.register({ type: 'demo', createDefaultData: () => ({ enabled: true }) });
  const canvas = Object.create(Core.NodeCanvas.prototype);
  canvas.registry = registry;
  canvas.snapToGrid = true;
  canvas.gridSize = 20;
  canvas.graph = Core.createGraph({ appId: 'test', viewport: { x: 5, y: 5, zoom: 2 } });
  canvas.element = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 500, height: 300 }) };
  canvas.dispatch = (change, metadata) => {
    assert.equal(change.type, 'node.add');
    assert.equal(metadata.source, 'palette-drag');
    canvas.graph = Core.applyChange(canvas.graph, change);
  };
  let selected = null;
  let inspector = null;
  canvas.selectNode = id => { selected = id; };
  canvas.openInspector = id => { inspector = id; };
  canvas.focusNode = () => null;

  const node = canvas.addNode('demo', {
    id: 'n1',
    clientPosition: { x: 125, y: 85 },
    data: { label: 'A' },
    offset: { x: -10, y: 0 },
    openInspector: true,
    metadata: { source: 'palette-drag' }
  });

  assert.equal(node.id, 'n1');
  assert.deepEqual(node.position, { x: 40, y: 40 });
  assert.deepEqual(node.data, { enabled: true, label: 'A' });
  assert.equal(selected, 'n1');
  assert.equal(inspector, 'n1');
  assert.equal(canvas.graph.nodes.length, 1);
});

test('v1.1 addNode rejects ambiguous coordinates and requires registry', () => {
  const canvas = Object.create(Core.NodeCanvas.prototype);
  canvas.registry = null;
  assert.throws(() => canvas.addNode('demo'), /requires a NodeRegistry/);

  const registry = new Core.NodeRegistry();
  registry.register({ type: 'demo' });
  canvas.registry = registry;
  assert.throws(() => canvas.addNode('demo', { position: { x: 0, y: 0 }, clientPosition: { x: 1, y: 1 } }), /either position or clientPosition/);
});

test('v1.1 MiniMap force visibility is distinct from responsive policy', () => {
  const canvas = Object.create(Core.NodeCanvas.prototype);
  canvas.miniMapVisible = false;
  canvas.miniMapResponsive = true;
  canvas.miniMapForceVisible = false;
  canvas.element = { dataset: {} };
  canvas.miniMap = { hidden: true, classList: makeClassList() };
  let renders = 0;
  canvas._renderMiniMap = () => { renders += 1; };
  let callbackState = null;
  canvas.onMiniMapChange = (_visible, _canvas, state) => { callbackState = state; };

  assert.equal(canvas.setMiniMapVisible(true, { force: true }), true);
  assert.equal(canvas.miniMap.hidden, false);
  assert.equal(canvas.miniMap.classList.contains('is-force-visible'), true);
  assert.deepEqual(canvas.getMiniMapState(), { visible: true, responsive: true, forceVisible: true });
  assert.deepEqual(callbackState, { visible: true, responsive: true, forceVisible: true });

  assert.equal(canvas.setMiniMapResponsive(false), false);
  assert.equal(canvas.element.dataset.necMinimapResponsive, 'false');
  assert.equal(renders, 2);

  canvas.setMiniMapVisible(false, { force: true });
  assert.equal(canvas.miniMap.hidden, true);
  assert.equal(canvas.miniMap.classList.contains('is-force-visible'), false);
  assert.equal(canvas.getMiniMapState().forceVisible, false);
});

test('v1.1 refreshLayout remeasures ports/layers and rerenders overlays once', () => {
  const canvas = Object.create(Core.NodeCanvas.prototype);
  canvas.destroyed = false;
  canvas.element = { clientWidth: 900, clientHeight: 540 };
  canvas.activeHelperGuides = { vertical: 120, horizontal: 240 };
  const calls = [];
  canvas._positionAllPorts = () => calls.push('ports');
  canvas._syncLayerBounds = () => calls.push('bounds');
  canvas._renderEdges = () => calls.push('edges');
  canvas._renderHelperGuides = (v, h) => calls.push(`guides:${v}:${h}`);
  canvas._renderMiniMap = () => calls.push('minimap');
  let notified = null;
  canvas.onLayoutRefresh = value => { notified = value; };

  const result = canvas.refreshLayout({ source: 'expanded-workspace' });
  assert.deepEqual(calls, ['ports', 'bounds', 'edges', 'guides:120:240', 'minimap']);
  assert.deepEqual(result, { width: 900, height: 540, source: 'expanded-workspace' });
  assert.deepEqual(notified, result);
});

test('v1.1 capture/restore view state preserves viewport, selection, inspector, and MiniMap state', () => {
  const canvas = Object.create(Core.NodeCanvas.prototype);
  canvas.graph = Core.createGraph({
    appId: 'test',
    viewport: { x: 12, y: -8, zoom: 1.25 },
    nodes: [Core.createNode({ id: 'a', type: 'demo' }), Core.createNode({ id: 'b', type: 'demo' })]
  });
  canvas.selectedNodeIds = new Set(['b']);
  canvas.selectedNodeId = 'b';
  canvas.selectedEdgeId = null;
  canvas.inspectorOpen = true;
  canvas.miniMapVisible = true;
  canvas.miniMapResponsive = true;
  canvas.miniMapForceVisible = true;
  canvas.getMiniMapState = Core.NodeCanvas.prototype.getMiniMapState;

  const state = canvas.captureViewState();
  assert.deepEqual(state.viewport, { x: 12, y: -8, zoom: 1.25 });
  assert.deepEqual(state.selection, ['b']);
  assert.deepEqual(state.miniMap, { visible: true, responsive: true, forceVisible: true });

  const restored = Object.create(Core.NodeCanvas.prototype);
  restored.graph = Core.createGraph({
    appId: 'test',
    nodes: [Core.createNode({ id: 'a', type: 'demo' }), Core.createNode({ id: 'b', type: 'demo' })]
  });
  restored.selectedNodeIds = new Set();
  restored.selectedNodeId = null;
  restored.selectedEdgeId = null;
  restored.inspectorOpen = false;
  restored.miniMapVisible = false;
  restored.miniMapResponsive = false;
  restored.miniMapForceVisible = false;
  restored.getMiniMapState = Core.NodeCanvas.prototype.getMiniMapState;
  restored.setViewport = viewport => { restored.graph = { ...restored.graph, viewport: Core.createGraph({ viewport }).viewport }; return restored.graph.viewport; };
  restored.setMiniMapResponsive = value => { restored.miniMapResponsive = Boolean(value); return restored.miniMapResponsive; };
  restored.setMiniMapVisible = (value, { force = false } = {}) => { restored.miniMapVisible = Boolean(value); restored.miniMapForceVisible = Boolean(value && force); return restored.miniMapVisible; };
  restored.setSelection = (ids, { primaryNodeId }) => { restored.selectedNodeIds = new Set(ids); restored.selectedNodeId = primaryNodeId; restored.selectedEdgeId = null; };
  restored.selectEdge = id => { restored.selectedEdgeId = id; restored.selectedNodeIds.clear(); restored.selectedNodeId = null; };
  restored.clearSelection = () => { restored.selectedNodeIds.clear(); restored.selectedNodeId = null; restored.selectedEdgeId = null; };
  restored.openInspector = id => { restored.inspectorOpen = true; restored.selectedNodeId = id; };
  restored.closeInspector = () => { restored.inspectorOpen = false; };
  let refreshSource = null;
  restored.refreshLayout = ({ source }) => { refreshSource = source; };

  const after = restored.restoreViewState(state, { source: 'exit-expanded' });
  assert.deepEqual(after.viewport, state.viewport);
  assert.deepEqual(after.selection, ['b']);
  assert.equal(after.inspectorOpen, true);
  assert.deepEqual(after.miniMap, state.miniMap);
  assert.equal(refreshSource, 'exit-expanded');
});

test('v1.1 source keeps responsive MiniMap override and ResizeObserver hooks', async () => {
  const fs = await import('node:fs/promises');
  const source = await fs.readFile(new URL('../src/core/node-editor-core.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-nec-minimap-responsive="true"/);
  assert.match(source, /\.nec-minimap:not\(\.is-force-visible\)/);
  assert.match(source, /new ResizeObserverCtor/);
  assert.match(source, /this\._resizeObserver\.observe\(this\.element\)/);
  assert.match(source, /this\._resizeObserver\?\.disconnect/);
});
