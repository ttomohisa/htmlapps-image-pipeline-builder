# Image Pipeline Builder v0.1.0 Design

## Goal

Build the first Browser Kitty consumer of Node Editor Core for local image workflows. v0.1.0 must let a user select one JPEG/PNG/WebP image, connect `Images → Resize → Output`, preview the selected-node result, and save a JPEG/PNG/WebP output without runtime network access.

## Source baselines

- Node Editor Core: the user-provided `htmlapps-node-editor-core.zip` from 2026-09-18. Treat the ZIP contents, not only the `1.1.0` version label, as canonical.
- Browser Kitty template conventions: htmlapps-template v1.3.0 behavior inherited by the Core ZIP.
- Core must remain domain-neutral. Image-specific logic lives under `src/image-pipeline/` and the consumer HTML.

## v0.1.0 scope

- App shell in Japanese and English.
- Node Editor Core embedded unchanged at build time.
- Consumer registry with `images`, `resize`, `output` nodes and `image` port type.
- Initial graph `Images → Resize → Output`.
- File picker and drag/drop for one JPEG/PNG/WebP image. Selecting another image replaces the current image in v0.1.0.
- Resize with width, height, keep-aspect behavior, and no-upscale option.
- Output as JPEG, PNG, or WebP; quality for JPEG/WebP.
- Preview of the currently selected node result using the selected source image.
- Save final encoded output.
- Canvas operations supplied by Core: select, connect, reconnect, delete, undo/redo, fit, minimap, helper lines, grid snap, view state.
- Desktop three-pane UI and responsive mobile layout sufficient for v0.1.0.
- `connect-src 'none'`, no CDN/runtime network, readable standalone HTML and self-extract HTML.

## Explicit non-goals

No batch execution, branches, multiple outputs, ZIP, workflow library, crop, rotate, appearance nodes, watermark, AI, or metadata preservation in v0.1.0.

## Boundaries

### Node Editor Core owns
Graph model, registry, typed ports, connection validation, history, viewport, canvas interaction, MiniMap, helper lines, grid snap, selection, clipboard primitives, view-state capture/restore, and translation primitives.

### Consumer owns
Image files, decode/encode, resize math, preview generation, selected-node execution, inspector controls, output file naming, Browser Kitty copy, and image-specific validation.

## Runtime

The runtime evaluates only the path from `images` to the selected preview node (or output). The first version operates on one image and Canvas 2D. It normalizes browser-decoded orientation using `createImageBitmap(file, { imageOrientation: 'from-image' })` when available, with `HTMLImageElement` fallback.

Image bytes/files are never serialized into Graph JSON.

## Testing

Node tests cover registry definitions, graph validation, topological ordering, resize math, MIME/format rules, and filename generation. Build checks cover Core and consumer placeholder embedding, standalone verification, runtime network blocking, and repository checks.
