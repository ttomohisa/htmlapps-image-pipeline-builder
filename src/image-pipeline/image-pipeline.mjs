const ImagePipeline = (() => {
  'use strict';

  const OUTPUT_FORMATS = Object.freeze(['jpeg', 'png', 'webp']);
  const ANCHORS = Object.freeze(['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']);
  const CROP_RATIOS = Object.freeze({ '1:1': [1, 1], '4:3': [4, 3], '3:2': [3, 2], '16:9': [16, 9], '9:16': [9, 16] });

  function positiveDimension(value, fallback = null) {
    if (value == null || value === '') return fallback;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return fallback;
    return Math.max(1, Math.round(number));
  }

  function createImageRegistry(Core) {
    if (!Core?.NodeRegistry) throw new TypeError('Node Editor Core is required.');
    const registry = new Core.NodeRegistry();
    registry.register({
      type: 'images',
      titleKey: 'node.images',
      category: 'input',
      definitionVersion: 1,
      createDefaultData: () => ({ label: 'Images' }),
      getPorts: () => [{ id: 'out', direction: 'output', dataType: 'image', required: true }]
    });
    registry.register({
      type: 'resize',
      titleKey: 'node.resize',
      category: 'geometry',
      definitionVersion: 2,
      createDefaultData: () => ({ width: 1600, height: null, fit: 'contain', allowUpscale: false }),
      migrateData(data, fromVersion) {
        if (fromVersion >= 2) return data;
        return { ...data, fit: data?.keepAspect === false ? 'exact' : 'contain' };
      },
      getPorts: () => [
        { id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1 },
        { id: 'out', direction: 'output', dataType: 'image', required: true }
      ]
    });
    for (const definition of [
      { type: 'crop', titleKey: 'node.crop', category: 'geometry', data: { mode: 'ratio', ratio: '1:1', width: null, height: null, customRatioWidth: 1, customRatioHeight: 1, anchor: 'center' } },
      { type: 'rotate', titleKey: 'node.rotate', category: 'geometry', data: { angle: 90 } },
      { type: 'flip', titleKey: 'node.flip', category: 'geometry', data: { direction: 'horizontal' } },
      { type: 'canvas', titleKey: 'node.canvas', category: 'geometry', data: { width: 1200, height: 1200, anchor: 'center', background: 'transparent', backgroundColor: '#ffffff' } },
      { type: 'adjust', titleKey: 'node.adjust', category: 'appearance', data: { brightness: 0, contrast: 0, saturation: 0 } },
      { type: 'grayscale', titleKey: 'node.grayscale', category: 'appearance', data: { strength: 100 } },
      { type: 'blur', titleKey: 'node.blur', category: 'appearance', data: { radius: 4 } },
      { type: 'sharpen', titleKey: 'node.sharpen', category: 'appearance', data: { amount: 0.5 } },
      { type: 'border', titleKey: 'node.border', category: 'composition', data: { width: 12, color: '#ffffff', placement: 'inside' } },
      { type: 'rounded-corners', titleKey: 'node.roundedCorners', category: 'composition', data: { mode: 'pixels', radius: 32 } },
      { type: 'text-watermark', titleKey: 'node.textWatermark', category: 'composition', data: { text: 'Watermark', fontFamily: 'sans-serif', fontSize: 36, color: '#ffffff', opacity: 0.75, position: 'bottom-right', margin: 24, rotation: 0 } }
    ]) {
      registry.register({
        type: definition.type,
        titleKey: definition.titleKey,
        category: definition.category,
        definitionVersion: 1,
        createDefaultData: () => ({ ...definition.data }),
        getPorts: () => [
          { id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1 },
          { id: 'out', direction: 'output', dataType: 'image', required: true }
        ]
      });
    }
    registry.register({
      type: 'output',
      titleKey: 'node.output',
      category: 'output',
      definitionVersion: 1,
      createDefaultData: () => ({ label: 'Output', format: 'webp', quality: 82, filename: '{name}', folder: '' }),
      getPorts: () => [{ id: 'in', direction: 'input', dataType: 'image', required: true, maxConnections: 1 }]
    });
    return registry;
  }

  function createInitialImageGraph(Core, registry = createImageRegistry(Core)) {
    const images = registry.create('images', { id: 'node-images', position: { x: 80, y: 190 } });
    const resize = registry.create('resize', { id: 'node-resize', position: { x: 390, y: 190 } });
    const output = registry.create('output', { id: 'node-output', position: { x: 700, y: 190 } });
    return Core.createGraph({
      appId: 'image-pipeline-builder',
      appSchemaVersion: 1,
      nodes: [images, resize, output],
      edges: [
        Core.createEdge({ id: 'edge-images-resize', source: { nodeId: images.id, portId: 'out' }, target: { nodeId: resize.id, portId: 'in' } }),
        Core.createEdge({ id: 'edge-resize-output', source: { nodeId: resize.id, portId: 'out' }, target: { nodeId: output.id, portId: 'in' } })
      ]
    });
  }

  function calculateResizeDimensions(input, settings = {}) {
    const sourceWidth = positiveDimension(input?.width);
    const sourceHeight = positiveDimension(input?.height);
    if (!sourceWidth || !sourceHeight) throw new TypeError('Input width and height must be positive numbers.');

    const targetWidth = positiveDimension(settings.width);
    const targetHeight = positiveDimension(settings.height);
    const fit = settings.fit === 'exact' ? 'exact' : settings.fit === 'contain' ? 'contain' : settings.keepAspect === false ? 'exact' : 'contain';
    const allowUpscale = settings.allowUpscale === true;

    if (!targetWidth && !targetHeight) return { width: sourceWidth, height: sourceHeight };

    if (fit === 'contain') {
      let scale = 1;
      if (targetWidth && targetHeight) scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
      else if (targetWidth) scale = targetWidth / sourceWidth;
      else scale = targetHeight / sourceHeight;
      if (!allowUpscale) scale = Math.min(scale, 1);
      return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale))
      };
    }

    let width = targetWidth ?? sourceWidth;
    let height = targetHeight ?? sourceHeight;
    if (!allowUpscale) {
      width = Math.min(width, sourceWidth);
      height = Math.min(height, sourceHeight);
    }
    return { width, height };
  }


  function normalizeAnchor(value) {
    return ANCHORS.includes(String(value || '')) ? String(value) : 'center';
  }

  function normalizeCropSettings(data = {}) {
    const mode = data.mode === 'size' ? 'size' : 'ratio';
    const ratio = Object.hasOwn(CROP_RATIOS, data.ratio) || data.ratio === 'custom' ? data.ratio : '1:1';
    return {
      mode,
      ratio,
      width: positiveDimension(data.width),
      height: positiveDimension(data.height),
      customRatioWidth: positiveDimension(data.customRatioWidth, 1),
      customRatioHeight: positiveDimension(data.customRatioHeight, 1),
      anchor: normalizeAnchor(data.anchor)
    };
  }

  function anchorOffset(containerWidth, containerHeight, itemWidth, itemHeight, anchor = 'center') {
    const normalized = normalizeAnchor(anchor);
    const dx = containerWidth - itemWidth;
    const dy = containerHeight - itemHeight;
    const x = normalized.includes('left') ? 0 : normalized.includes('right') ? dx : Math.round(dx / 2);
    const y = normalized.startsWith('top') ? 0 : normalized.startsWith('bottom') ? dy : Math.round(dy / 2);
    return { x, y };
  }

  function calculateCropRect(input, data = {}) {
    const sourceWidth = positiveDimension(input?.width);
    const sourceHeight = positiveDimension(input?.height);
    if (!sourceWidth || !sourceHeight) throw new TypeError('Input width and height must be positive numbers.');
    const settings = normalizeCropSettings(data);
    let width;
    let height;
    if (settings.mode === 'size') {
      width = Math.min(sourceWidth, settings.width || sourceWidth);
      height = Math.min(sourceHeight, settings.height || sourceHeight);
    } else {
      const ratioParts = settings.ratio === 'custom'
        ? [settings.customRatioWidth, settings.customRatioHeight]
        : CROP_RATIOS[settings.ratio];
      const targetRatio = ratioParts[0] / ratioParts[1];
      const sourceRatio = sourceWidth / sourceHeight;
      if (sourceRatio > targetRatio) {
        height = sourceHeight;
        width = Math.max(1, Math.round(height * targetRatio));
      } else {
        width = sourceWidth;
        height = Math.max(1, Math.round(width / targetRatio));
      }
    }
    const offset = anchorOffset(sourceWidth, sourceHeight, width, height, settings.anchor);
    return { x: offset.x, y: offset.y, width, height };
  }

  function normalizeAngle(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 90;
    return ((number % 360) + 360) % 360;
  }

  function normalizeRotateSettings(data = {}) {
    return { angle: normalizeAngle(data.angle) };
  }

  function calculateRotatedBounds(input, angle) {
    const width = positiveDimension(input?.width);
    const height = positiveDimension(input?.height);
    if (!width || !height) throw new TypeError('Input width and height must be positive numbers.');
    const normalized = normalizeAngle(angle);
    if (normalized === 0 || normalized === 180) return { width, height };
    if (normalized === 90 || normalized === 270) return { width: height, height: width };
    const radians = normalized * Math.PI / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    return {
      width: Math.max(1, Math.ceil(width * cos + height * sin)),
      height: Math.max(1, Math.ceil(width * sin + height * cos))
    };
  }

  function normalizeFlipSettings(data = {}) {
    const direction = ['horizontal', 'vertical', 'both'].includes(data.direction) ? data.direction : 'horizontal';
    return { direction };
  }

  function normalizeHexColor(value, fallback = '#ffffff') {
    const raw = String(value || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
    if (/^#[0-9a-f]{3}$/.test(raw)) return '#' + raw.slice(1).split('').map(char => char + char).join('');
    return fallback;
  }

  function normalizeCanvasSettings(data = {}) {
    return {
      width: positiveDimension(data.width, 1200),
      height: positiveDimension(data.height, 1200),
      anchor: normalizeAnchor(data.anchor),
      background: data.background === 'color' ? 'color' : 'transparent',
      backgroundColor: normalizeHexColor(data.backgroundColor, '#ffffff')
    };
  }

  function calculateCanvasPlacement(input, data = {}) {
    const inputWidth = positiveDimension(input?.width);
    const inputHeight = positiveDimension(input?.height);
    if (!inputWidth || !inputHeight) throw new TypeError('Input width and height must be positive numbers.');
    const settings = normalizeCanvasSettings(data);
    const offset = anchorOffset(settings.width, settings.height, inputWidth, inputHeight, settings.anchor);
    return { width: settings.width, height: settings.height, x: offset.x, y: offset.y };
  }


  function clampNumber(value, min, max, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeAdjustSettings(data = {}) {
    return {
      brightness: clampNumber(data.brightness, -100, 100, 0),
      contrast: clampNumber(data.contrast, -100, 100, 0),
      saturation: clampNumber(data.saturation, -100, 100, 0)
    };
  }

  function normalizeGrayscaleSettings(data = {}) {
    return { strength: clampNumber(data.strength, 0, 100, 100) };
  }

  function normalizeBlurSettings(data = {}) {
    return { radius: clampNumber(data.radius, 0, 50, 4) };
  }

  function normalizeSharpenSettings(data = {}) {
    return { amount: clampNumber(data.amount, 0, 2, 0.5) };
  }

  function normalizeBorderSettings(data = {}) {
    return {
      width: Math.round(clampNumber(data.width, 0, 500, 12)),
      color: normalizeHexColor(data.color, '#ffffff'),
      placement: data.placement === 'outside' ? 'outside' : 'inside'
    };
  }

  function calculateBorderGeometry(input, data = {}) {
    const width = positiveDimension(input?.width);
    const height = positiveDimension(input?.height);
    if (!width || !height) throw new TypeError('Input width and height must be positive numbers.');
    const settings = normalizeBorderSettings(data);
    if (settings.placement === 'outside') {
      return { width: width + settings.width * 2, height: height + settings.width * 2, imageX: settings.width, imageY: settings.width, borderWidth: settings.width, placement: settings.placement };
    }
    return { width, height, imageX: 0, imageY: 0, borderWidth: settings.width, placement: settings.placement };
  }

  function normalizeRoundedCornersSettings(data = {}) {
    const mode = data.mode === 'percent' ? 'percent' : 'pixels';
    const radius = mode === 'percent' ? clampNumber(data.radius, 0, 50, 8) : clampNumber(data.radius, 0, 5000, 32);
    return { mode, radius };
  }

  function calculateRoundedCornerRadius(input, data = {}) {
    const width = positiveDimension(input?.width);
    const height = positiveDimension(input?.height);
    if (!width || !height) throw new TypeError('Input width and height must be positive numbers.');
    const settings = normalizeRoundedCornersSettings(data);
    const maxRadius = Math.min(width, height) / 2;
    const radius = settings.mode === 'percent' ? Math.min(width, height) * settings.radius / 100 : settings.radius;
    return Math.max(0, Math.min(maxRadius, radius));
  }

  function normalizeTextWatermarkSettings(data = {}) {
    const position = ANCHORS.includes(String(data.position || '')) ? String(data.position) : 'bottom-right';
    return {
      text: String(data.text ?? 'Watermark').trim(),
      fontFamily: String(data.fontFamily || 'sans-serif').trim() || 'sans-serif',
      fontSize: Math.round(clampNumber(data.fontSize, 6, 512, 36)),
      color: normalizeHexColor(data.color, '#ffffff'),
      opacity: clampNumber(data.opacity, 0, 1, 0.75),
      position,
      margin: Math.round(clampNumber(data.margin, 0, 2000, 24)),
      rotation: normalizeAngle(data.rotation || 0)
    };
  }

  function calculateWatermarkPosition(container, overlay, data = {}) {
    const width = positiveDimension(container?.width);
    const height = positiveDimension(container?.height);
    const overlayWidth = Math.max(0, Number(overlay?.width) || 0);
    const overlayHeight = Math.max(0, Number(overlay?.height) || 0);
    if (!width || !height) throw new TypeError('Container width and height must be positive numbers.');
    const position = ANCHORS.includes(String(data.position || '')) ? String(data.position) : 'bottom-right';
    const margin = Math.max(0, Number(data.margin) || 0);
    let x;
    let y;
    if (position.includes('left')) x = margin;
    else if (position.includes('right')) x = width - margin - overlayWidth;
    else x = (width - overlayWidth) / 2;
    if (position.startsWith('top')) y = margin;
    else if (position.startsWith('bottom')) y = height - margin - overlayHeight;
    else y = (height - overlayHeight) / 2;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function sharpenRgba(input, width, height, amount = 0.5) {
    if (!(input instanceof Uint8ClampedArray)) throw new TypeError('RGBA input must be Uint8ClampedArray.');
    const w = positiveDimension(width);
    const h = positiveDimension(height);
    if (!w || !h || input.length !== w * h * 4) throw new TypeError('RGBA dimensions do not match the input length.');
    const strength = clampNumber(amount, 0, 2, 0.5);
    if (strength === 0) return new Uint8ClampedArray(input);
    const output = new Uint8ClampedArray(input);
    const at = (x, y, channel) => input[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + channel];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const offset = (y * w + x) * 4;
        for (let channel = 0; channel < 3; channel += 1) {
          const center = at(x, y, channel);
          const neighbors = at(x - 1, y, channel) + at(x + 1, y, channel) + at(x, y - 1, channel) + at(x, y + 1, channel);
          output[offset + channel] = Math.round(center * (1 + 4 * strength) - neighbors * strength);
        }
        output[offset + 3] = input[offset + 3];
      }
    }
    return output;
  }

  function normalizeOutputFolder(value = '') {
    const raw = String(value || '').trim().replaceAll('\\', '/');
    if (!raw) return '';
    if (raw.startsWith('/') || /^[A-Za-z]:\//.test(raw)) throw new TypeError('Output folder must be relative.');
    const parts = raw.split('/').filter(Boolean);
    if (parts.some(part => part === '..')) throw new TypeError('Output folder cannot use a parent directory.');
    return parts.filter(part => part !== '.').map(part => part.replace(/[<>:"|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || '_').join('/');
  }

  function normalizeOutputSettings(data = {}) {
    const format = OUTPUT_FORMATS.includes(String(data.format || '').toLowerCase()) ? String(data.format).toLowerCase() : 'webp';
    let quality = Number(data.quality);
    if (!Number.isFinite(quality)) quality = 82;
    if (quality > 1) quality /= 100;
    quality = Math.min(1, Math.max(0.01, quality));
    if (format === 'png') quality = 1;
    const filename = String(data.filename || '').trim() || '{name}';
    let folder;
    try { folder = normalizeOutputFolder(data.folder || ''); }
    catch { folder = String(data.folder || '').trim().replaceAll('\\', '/'); }
    const label = String(data.label || '').trim() || 'Output';
    return { format, quality, filename, folder, label };
  }

  function validateOutputSettings(data = {}) {
    const issues = [];
    try { normalizeOutputFolder(data.folder || ''); }
    catch (error) { issues.push(Object.freeze({ code: 'invalid-output-folder', message: error instanceof Error ? error.message : String(error) })); }
    return Object.freeze(issues);
  }

  function outputExtension(format) {
    const normalized = String(format || '').toLowerCase();
    if (normalized === 'jpeg' || normalized === 'jpg') return '.jpg';
    if (normalized === 'png') return '.png';
    if (normalized === 'webp') return '.webp';
    throw new TypeError(`Unsupported output format: ${format}`);
  }

  function sourceBaseName(sourceName) {
    const name = String(sourceName || 'image').split(/[\\/]/).pop() || 'image';
    return name.replace(/\.[^.]+$/, '') || 'image';
  }

  function makeOutputFilename(sourceName, format, template = '{name}', context = {}) {
    const base = sourceBaseName(sourceName);
    const safeTemplate = String(template || '{name}').trim() || '{name}';
    const index = Math.max(1, Math.round(Number(context.index) || 1));
    const width = positiveDimension(context.width, '');
    const height = positiveDimension(context.height, '');
    let rendered = safeTemplate
      .replaceAll('{name}', base)
      .replaceAll('{width}', String(width ?? ''))
      .replaceAll('{height}', String(height ?? ''))
      .replace(/\{index(?::(\d+))?\}/g, (_match, digits) => String(index).padStart(Math.max(1, Math.min(9, Number(digits) || 1)), '0'));
    rendered = rendered.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || base;
    return rendered + outputExtension(format);
  }

  function resolveUniqueOutputPath(path, usedPaths = new Set()) {
    if (!(usedPaths instanceof Set)) throw new TypeError('usedPaths must be a Set.');
    const normalized = String(path || '').replaceAll('\\', '/').replace(/^\/+/, '');
    const slash = normalized.lastIndexOf('/');
    const folder = slash >= 0 ? normalized.slice(0, slash + 1) : '';
    const filename = slash >= 0 ? normalized.slice(slash + 1) : normalized;
    const dot = filename.lastIndexOf('.');
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : '';
    let candidate = folder + filename;
    let suffix = 2;
    while (usedPaths.has(candidate)) candidate = `${folder}${stem}-${suffix++}${ext}`;
    usedPaths.add(candidate);
    return candidate;
  }

  function createCachedEvaluator(evaluateUncached) {
    if (typeof evaluateUncached !== 'function') throw new TypeError('Evaluator must be a function.');
    const cache = new Map();
    const evaluate = nodeId => {
      if (!cache.has(nodeId)) {
        const pending = Promise.resolve().then(() => evaluateUncached(nodeId, evaluate));
        cache.set(nodeId, pending);
        pending.catch(() => cache.delete(nodeId));
      }
      return cache.get(nodeId);
    };
    evaluate.cache = cache;
    return evaluate;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function writeU16(view, offset, value) { view.setUint16(offset, value, true); }
  function writeU32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
  function concatBytes(chunks, total) {
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
    return out;
  }

  function normalizeZipPath(path) {
    const normalized = String(path || '').trim().replaceAll('\\', '/').replace(/^\/+/, '');
    if (!normalized) throw new TypeError('ZIP path is required.');
    if (normalized.split('/').some(part => part === '..')) throw new TypeError('ZIP path cannot use a parent directory.');
    return normalized;
  }

  function buildStoredZip(entries = []) {
    const encoder = new TextEncoder();
    const localChunks = [];
    const centralChunks = [];
    let localOffset = 0;
    const dosDate = 33; // 1980-01-01

    for (const entry of entries) {
      const path = normalizeZipPath(entry.path);
      const name = encoder.encode(path);
      const bytes = entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || []);
      const crc = crc32(bytes);

      const localHeader = new Uint8Array(30 + name.length);
      const localView = new DataView(localHeader.buffer);
      writeU32(localView, 0, 0x04034b50);
      writeU16(localView, 4, 20);
      writeU16(localView, 6, 0x0800);
      writeU16(localView, 8, 0);
      writeU16(localView, 10, 0);
      writeU16(localView, 12, dosDate);
      writeU32(localView, 14, crc);
      writeU32(localView, 18, bytes.length);
      writeU32(localView, 22, bytes.length);
      writeU16(localView, 26, name.length);
      writeU16(localView, 28, 0);
      localHeader.set(name, 30);
      localChunks.push(localHeader, bytes);

      const centralHeader = new Uint8Array(46 + name.length);
      const centralView = new DataView(centralHeader.buffer);
      writeU32(centralView, 0, 0x02014b50);
      writeU16(centralView, 4, 20);
      writeU16(centralView, 6, 20);
      writeU16(centralView, 8, 0x0800);
      writeU16(centralView, 10, 0);
      writeU16(centralView, 12, 0);
      writeU16(centralView, 14, dosDate);
      writeU32(centralView, 16, crc);
      writeU32(centralView, 20, bytes.length);
      writeU32(centralView, 24, bytes.length);
      writeU16(centralView, 28, name.length);
      writeU16(centralView, 30, 0);
      writeU16(centralView, 32, 0);
      writeU16(centralView, 34, 0);
      writeU16(centralView, 36, 0);
      writeU32(centralView, 38, 0);
      writeU32(centralView, 42, localOffset);
      centralHeader.set(name, 46);
      centralChunks.push(centralHeader);
      localOffset += localHeader.length + bytes.length;
    }

    const centralSize = centralChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    writeU32(endView, 0, 0x06054b50);
    writeU16(endView, 4, 0);
    writeU16(endView, 6, 0);
    writeU16(endView, 8, entries.length);
    writeU16(endView, 10, entries.length);
    writeU32(endView, 12, centralSize);
    writeU32(endView, 16, localOffset);
    writeU16(endView, 20, 0);
    return concatBytes([...localChunks, ...centralChunks, end], localOffset + centralSize + end.length);
  }


  function previewTargetNodeId(graph, selectedNodeId, mode = 'after') {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const selected = nodes.find(node => node.id === selectedNodeId) || null;
    if (!selected) return null;
    if (mode !== 'before' || selected.type === 'images') return selected.id;
    const incoming = (Array.isArray(graph?.edges) ? graph.edges : [])
      .filter(edge => !edge.disabled && edge?.target?.nodeId === selected.id)
      .sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    return incoming[0]?.source?.nodeId || selected.id;
  }

  function previewSubgraphSignature(graph, selectedNodeId, mode = 'after') {
    const targetId = previewTargetNodeId(graph, selectedNodeId, mode);
    if (!targetId) return JSON.stringify({ targetId: null, nodes: [], edges: [] });
    const allNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const allEdges = Array.isArray(graph?.edges) ? graph.edges : [];
    const nodeById = new Map(allNodes.map(node => [node.id, node]));
    const included = new Set();
    const stack = [targetId];
    while (stack.length) {
      const nodeId = stack.pop();
      if (!nodeId || included.has(nodeId)) continue;
      included.add(nodeId);
      for (const edge of allEdges) {
        if (edge.disabled || edge?.target?.nodeId !== nodeId) continue;
        if (edge?.source?.nodeId) stack.push(edge.source.nodeId);
      }
    }
    const nodes = [...included]
      .map(id => nodeById.get(id))
      .filter(Boolean)
      .map(node => ({ id: node.id, type: node.type, disabled: Boolean(node.disabled), data: node.data || {} }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const edges = allEdges
      .filter(edge => included.has(edge?.source?.nodeId) && included.has(edge?.target?.nodeId))
      .map(edge => ({
        source: edge.source ? { nodeId: edge.source.nodeId, portId: edge.source.portId } : null,
        target: edge.target ? { nodeId: edge.target.nodeId, portId: edge.target.portId } : null,
        disabled: Boolean(edge.disabled)
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify({ targetId, mode: mode === 'before' ? 'before' : 'after', nodes, edges });
  }

  function createLruCache(limit = 12, options = {}) {
    const maxEntries = Math.max(1, Math.floor(Number(limit) || 12));
    const values = new Map();
    const onEvict = typeof options?.onEvict === 'function' ? options.onEvict : null;
    const dispose = value => {
      if (!onEvict || value === undefined) return;
      try { onEvict(value); } catch {}
    };
    return Object.freeze({
      get size() { return values.size; },
      has(key) { return values.has(key); },
      get(key) {
        if (!values.has(key)) return undefined;
        const value = values.get(key);
        values.delete(key);
        values.set(key, value);
        return value;
      },
      set(key, value) {
        if (values.has(key)) {
          const previous = values.get(key);
          values.delete(key);
          if (previous !== value) dispose(previous);
        }
        values.set(key, value);
        while (values.size > maxEntries) {
          const oldest = values.keys().next().value;
          const evicted = values.get(oldest);
          values.delete(oldest);
          dispose(evicted);
        }
        return value;
      },
      delete(key) {
        if (!values.has(key)) return false;
        const value = values.get(key);
        values.delete(key);
        dispose(value);
        return true;
      },
      clear() {
        for (const value of values.values()) dispose(value);
        values.clear();
      }
    });
  }


  function pipelineGraphSignature(graph) {
    const nodes = (Array.isArray(graph?.nodes) ? graph.nodes : []).map(node => ({
      id: node.id,
      type: node.type,
      disabled: Boolean(node.disabled),
      data: node.data || {}
    })).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const edges = (Array.isArray(graph?.edges) ? graph.edges : []).map(edge => ({
      source: edge.source ? { nodeId: edge.source.nodeId, portId: edge.source.portId } : null,
      target: edge.target ? { nodeId: edge.target.nodeId, portId: edge.target.portId } : null,
      disabled: Boolean(edge.disabled)
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify({ nodes, edges });
  }


  const WORKFLOW_FORMAT = 'image-pipeline-builder-workflow';
  const WORKFLOW_FORMAT_VERSION = 1;
  const BUILT_IN_WORKFLOW_IDS = Object.freeze(['web-images', 'main-thumbnail', 'social-square', 'watermark', 'blank']);

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createWorkflowDocument(Core, graph, options = {}) {
    if (!Core?.serializeGraph) throw new TypeError('Node Editor Core serialization is required.');
    const serialized = Core.serializeGraph(graph, { pretty: false });
    return {
      format: WORKFLOW_FORMAT,
      formatVersion: WORKFLOW_FORMAT_VERSION,
      appVersion: String(options.appVersion || ''),
      name: String(options.name || '').trim(),
      graph: JSON.parse(serialized)
    };
  }

  function migrateWorkflowDocument(input, targetVersion = WORKFLOW_FORMAT_VERSION) {
    const document = cloneJson(input);
    if (document?.format !== WORKFLOW_FORMAT) throw new TypeError('Unsupported workflow format.');
    const version = Number(document.formatVersion);
    if (!Number.isInteger(version) || version < 1) throw new TypeError('Unsupported workflow format version.');
    if (version > targetVersion) throw new TypeError('Workflow format version is newer than supported.');
    if (version < targetVersion) throw new TypeError(`Missing workflow migration from version ${version}.`);
    return document;
  }

  function parseWorkflowDocument(Core, jsonOrObject, options = {}) {
    if (!Core?.deserializeGraph) throw new TypeError('Node Editor Core deserialization is required.');
    let parsed;
    if (typeof jsonOrObject === 'string') {
      try { parsed = JSON.parse(jsonOrObject); }
      catch { throw new TypeError('Workflow JSON could not be parsed.'); }
    } else parsed = cloneJson(jsonOrObject);
    const document = migrateWorkflowDocument(parsed, WORKFLOW_FORMAT_VERSION);
    if (!document.graph || document.graph.format !== 'node-editor-core') throw new TypeError('Workflow graph format is invalid.');
    const graph = Core.deserializeGraph(document.graph, { registry: options.registry || null });
    return { document, graph };
  }

  function normalizeWorkflowName(value) {
    const name = String(value || '').trim().replace(/\s+/g, ' ');
    if (!name) throw new TypeError('Workflow name is required.');
    return name.slice(0, 80);
  }

  function createSavedWorkflowRecord({ id, name, document, updatedAt } = {}) {
    const recordId = String(id || '').trim();
    if (!recordId) throw new TypeError('Workflow id is required.');
    if (!document || document.format !== WORKFLOW_FORMAT) throw new TypeError('Workflow document is required.');
    return {
      id: recordId,
      name: normalizeWorkflowName(name),
      updatedAt: String(updatedAt || new Date().toISOString()),
      document: cloneJson(document)
    };
  }

  function upsertSavedWorkflow(records = [], record) {
    const normalized = createSavedWorkflowRecord(record);
    const next = (Array.isArray(records) ? records : []).filter(item => item?.id !== normalized.id).map(cloneJson);
    next.push(normalized);
    next.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(a.name || '').localeCompare(String(b.name || '')));
    return next;
  }

  function removeSavedWorkflow(records = [], id) {
    const target = String(id || '');
    return (Array.isArray(records) ? records : []).filter(item => item?.id !== target).map(cloneJson);
  }

  function presetEdge(Core, id, from, to) {
    return Core.createEdge({ id, source: { nodeId: from, portId: 'out' }, target: { nodeId: to, portId: 'in' } });
  }

  function createBuiltInWorkflow(id, Core, registry = createImageRegistry(Core)) {
    if (!BUILT_IN_WORKFLOW_IDS.includes(id)) throw new TypeError(`Unknown built-in workflow: ${id}`);
    const nodes = [];
    const edges = [];
    const add = (type, nodeId, x, y, data = {}) => {
      const node = registry.create(type, { id: nodeId, position: { x, y }, data });
      nodes.push(node);
      return node;
    };
    const images = add('images', 'node-images', 70, 240);
    if (id === 'blank') {
      const output = add('output', 'node-output', 430, 240, { label: 'Output', format: 'webp', quality: 82, filename: '{name}', folder: '' });
      edges.push(presetEdge(Core, 'edge-images-output', images.id, output.id));
    }
    if (id === 'web-images') {
      const resize = add('resize', 'node-resize', 350, 240, { width: 1600, height: null, fit: 'contain', allowUpscale: false });
      const output = add('output', 'node-output', 650, 240, { label: 'Web', format: 'webp', quality: 82, filename: '{name}', folder: 'web' });
      edges.push(presetEdge(Core, 'edge-images-resize', images.id, resize.id), presetEdge(Core, 'edge-resize-output', resize.id, output.id));
    }
    if (id === 'main-thumbnail') {
      const main = add('resize', 'node-resize-main', 350, 140, { width: 1600, height: null, fit: 'contain', allowUpscale: false });
      const mainOut = add('output', 'node-output-main', 660, 140, { label: 'Main', format: 'webp', quality: 82, filename: '{name}', folder: 'large' });
      const thumb = add('resize', 'node-resize-thumb', 350, 360, { width: 400, height: null, fit: 'contain', allowUpscale: false });
      const thumbOut = add('output', 'node-output-thumb', 660, 360, { label: 'Thumbnail', format: 'webp', quality: 78, filename: '{name}', folder: 'thumbnail' });
      edges.push(
        presetEdge(Core, 'edge-images-main', images.id, main.id), presetEdge(Core, 'edge-main-output', main.id, mainOut.id),
        presetEdge(Core, 'edge-images-thumb', images.id, thumb.id), presetEdge(Core, 'edge-thumb-output', thumb.id, thumbOut.id)
      );
    }
    if (id === 'social-square') {
      const crop = add('crop', 'node-crop', 300, 240, { mode: 'ratio', ratio: '1:1', anchor: 'center' });
      const resize = add('resize', 'node-resize', 530, 240, { width: 1080, height: 1080, fit: 'exact', allowUpscale: true });
      const output = add('output', 'node-output', 780, 240, { label: 'Social', format: 'jpeg', quality: 90, filename: '{name}', folder: 'social' });
      edges.push(presetEdge(Core, 'edge-images-crop', images.id, crop.id), presetEdge(Core, 'edge-crop-resize', crop.id, resize.id), presetEdge(Core, 'edge-resize-output', resize.id, output.id));
    }
    if (id === 'watermark') {
      const resize = add('resize', 'node-resize', 300, 240, { width: 1600, height: null, fit: 'contain', allowUpscale: false });
      const watermark = add('text-watermark', 'node-watermark', 540, 240, { text: 'Watermark', fontFamily: 'sans-serif', fontSize: 36, color: '#ffffff', opacity: 0.75, position: 'bottom-right', margin: 24, rotation: 0 });
      const output = add('output', 'node-output', 800, 240, { label: 'Watermarked', format: 'webp', quality: 82, filename: '{name}', folder: '' });
      edges.push(presetEdge(Core, 'edge-images-resize', images.id, resize.id), presetEdge(Core, 'edge-resize-watermark', resize.id, watermark.id), presetEdge(Core, 'edge-watermark-output', watermark.id, output.id));
    }
    return Core.createGraph({ appId: 'image-pipeline-builder', appSchemaVersion: 1, nodes, edges });
  }

  async function runBatchSequential(items, processItem, options = {}) {
    if (!Array.isArray(items)) throw new TypeError('Batch items must be an array.');
    if (typeof processItem !== 'function') throw new TypeError('Batch processor must be a function.');
    const signal = options.signal || null;
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const entries = [];
    const total = items.length;

    for (let index = 0; index < total; index += 1) {
      if (signal?.aborted) break;
      const item = items[index];
      onProgress?.({ phase: 'start', index, total, processed: entries.length, item });
      let entry;
      try {
        const value = await processItem(item, { index, total, signal });
        entry = { item, status: 'success', value };
      } catch (error) {
        if (signal?.aborted && (error?.name === 'AbortError' || signal.aborted)) break;
        entry = { item, status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
      }
      entries.push(entry);
      onProgress?.({ phase: 'complete', index, total, processed: entries.length, item, result: entry });
    }

    const succeeded = entries.filter(entry => entry.status === 'success').length;
    const failed = entries.length - succeeded;
    return {
      status: signal?.aborted && entries.length < total ? 'cancelled' : 'completed',
      total,
      processed: entries.length,
      succeeded,
      failed,
      entries
    };
  }

  return Object.freeze({
    OUTPUT_FORMATS,
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
    normalizeAdjustSettings,
    normalizeGrayscaleSettings,
    normalizeBlurSettings,
    normalizeSharpenSettings,
    normalizeBorderSettings,
    calculateBorderGeometry,
    normalizeRoundedCornersSettings,
    calculateRoundedCornerRadius,
    normalizeTextWatermarkSettings,
    calculateWatermarkPosition,
    sharpenRgba,
    normalizeOutputSettings,
    normalizeOutputFolder,
    validateOutputSettings,
    outputExtension,
    makeOutputFilename,
    resolveUniqueOutputPath,
    createCachedEvaluator,
    buildStoredZip,
    runBatchSequential,
    pipelineGraphSignature,
    previewTargetNodeId,
    previewSubgraphSignature,
    createLruCache,
    WORKFLOW_FORMAT,
    WORKFLOW_FORMAT_VERSION,
    BUILT_IN_WORKFLOW_IDS,
    createWorkflowDocument,
    migrateWorkflowDocument,
    parseWorkflowDocument,
    normalizeWorkflowName,
    createSavedWorkflowRecord,
    upsertSavedWorkflow,
    removeSavedWorkflow,
    createBuiltInWorkflow
  });
})();

globalThis.ImagePipeline = ImagePipeline;
export default ImagePipeline;
