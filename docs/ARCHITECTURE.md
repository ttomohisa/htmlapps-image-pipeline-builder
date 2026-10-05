# Architecture

## Boundary

Image Pipeline Builder is a Consumer of Node Editor Core. The canonical Core snapshot stays byte-for-byte unchanged unless the user explicitly approves a Core upgrade.

**Core owns:** graph model, registry, nodes/ports/edges, generic graph validation, cycle rejection, history, selection, connections, viewport, MiniMap, helper lines, Grid Snap, runtime-status primitives, translation primitives, and Canvas behavior.

**Consumer owns:** image files, source list, decoding/encoding, Geometry / Appearance / Composition execution, representative preview selection, image-domain validation, branch evaluation, per-source cache, sequential batch execution, output naming/folder policy, ZIP packaging, per-file errors/results, current-Pipeline recovery, Recipe persistence/quick execution, templates/Pipeline import-export, Browser Kitty UI, and downloads.

Image-specific MIME checks, Canvas 2D operations, `File`/`Blob` state, Output-folder policy, or ZIP code must never be added to Core.

## Source layout

```text
src/
├─ core/
│  └─ node-editor-core.mjs
├─ image-pipeline/
│  └─ image-pipeline.mjs
└─ index.template.html
```

`image-pipeline.mjs` exposes Consumer node definitions and pure helpers: Geometry math, Appearance / Composition setting normalization, Sharpen convolution, Border / Rounded Corners / Text Watermark calculations, Output normalization/validation, filename/path collision handling, evaluation caching, ZIP generation, and the sequential batch runner. `index.template.html` owns browser File/Canvas integration and the application shell.

## Graph model

`Images`, all Geometry / Appearance / Composition nodes, and `Output` use a Consumer-defined `image` port type. Resize/Image output ports have no single-edge limit, so branching is represented directly by multiple outgoing Edges:

```text
                  ┌→ Output A
Images → Resize ──┤
                  └→ Resize B → Output B
```

There is no Split node. Core remains unaware that the port carries an image.

## Pipeline recovery, Recipes, and templates

The Consumer keeps an application-level Pipeline envelope outside Node Editor Core:

```text
Image Pipeline workflow envelope
  ↓ app format migration
Core graph payload
  ↓ Core deserialize / node-definition migration
normalized editable graph
```

`createWorkflowDocument()` serializes only the Core graph plus application metadata (`format`, `formatVersion`, `appVersion`, `name`). `parseWorkflowDocument()` validates/migrates the envelope before handing its graph payload to Core. This keeps application versioning separate from Core graph and NodeRegistry migrations.

Two browser-local storage keys are used:

- `image-pipeline-builder.current-workflow` — debounced recovery copy of the current graph/settings
- `image-pipeline-builder.saved-workflows` — backward-compatible storage key for named Recipe records ordered by latest update

Neither key contains source `File` objects, image bytes, decoded canvases, Preview cache entries, Batch result Blobs, object URLs, or runtime status. After a page restart the graph can be restored, but the user intentionally adds image files again.

Recipe writes are transactional at the Consumer boundary: build a candidate collection, write it to localStorage, then commit the in-memory collection and redraw. Failed writes preserve prior records and staged files. Duplicate registration is rejected; explicit Update/Delete are confirmed using the adapted shared AppConfirm component. Storage keys and the formatVersion 1 envelope do not change.

Saved Recipes reuse the same graph envelope but are a user-facing browser-local reuse feature. Quick Recipe cards stage source `File` objects only in memory, then either execute the saved graph directly without mutating the editor, or apply the Recipe graph plus selected files to the Canvas.

Built-in templates are ordinary graph factories in the Consumer module. They return the same editable graph objects as manually created flows, and are immediately passed to NodeCanvas. There is no preset-only execution path.

Pipeline JSON save/open uses the same envelope as current recovery and Recipe records. Opening a Pipeline replaces only graph/settings and never attempts external file or URL resolution. Recipe and Pipeline JSON are intentionally separate user-facing concepts even though they share the internal envelope format.

## Appearance / Composition path

v0.6+ adds `Adjust`, `Grayscale`, `Blur`, `Sharpen`, `Border`, `Rounded Corners`, and `Text Watermark`. They are evaluated by the same Consumer `createFrameEvaluator()` used by Preview and Batch. Adjust / Grayscale / Blur use Canvas filters; Sharpen applies a local 3×3 pixel convolution; Border / Rounded Corners / Text Watermark use Canvas drawing and clipping. No image-processing branch is added to Node Editor Core.

Text Watermark uses system fonts only. It does not load Google Fonts or another remote font. Rounded Corners intentionally create alpha; JPEG flattening remains an Output concern rather than a Rounded Corners concern.

## Preview path

Interactive Preview evaluates only the selected representative source image. The Consumer resolves the selected node boundary according to the current mode:

```text
Before → selected node input
After  → selected node result
```

`previewSubgraphSignature()` walks only upstream from that resolved target. The cache key combines the representative source ID with that upstream signature, so viewport/node-position changes and unrelated downstream changes do not invalidate an upstream preview.

```text
selected File
  ↓ decode once for interactive preview
representative frame
  ↓ upstream-only graph evaluation
Before/After target
  ↓ display-sized snapshot
small LRU Preview cache
  ↓
Preview Canvas
```

The cache holds display-sized snapshot canvases plus full processing dimensions and optional Output encode-size text; it does not intentionally retain every full-resolution intermediate result. Output After performs a real representative-image encode so size reflects the selected format/quality.

A monotonically increasing generation token is checked after graph evaluation and after Output encoding. Late work from an older source, node, mode, or parameter state is discarded.

## Batch and branch path

Regular Batch and quick Recipe runs share a Consumer-owned job object with a local AbortController. Only the current owner can publish progress/results, download an asynchronously prepared ZIP, or unlock controls. Pagehide aborts and invalidates the owner; stale callbacks release their own results. Recreated quick cards inherit the current busy state.

The Batch runner handles one source at a time:

```text
for each source File
  ↓ decode once
create per-source evaluator/cache
  ↓
shared upstream nodes
  ├→ Output A → encode Blob A
  └→ branch → Output B → encode Blob B
  ↓
store source result
release decoded frame
  ↓ next source
```

`createCachedEvaluator()` memoizes a Promise for each node ID. When multiple Output paths share the same upstream node, the upstream node is evaluated only once for that source image.

`runBatchSequential()` remains framework-agnostic orchestration. It processes items strictly in order, reports progress, records individual success/failure, continues after item failures, and respects cancellation. In v1.0.0 the browser runtime also checks the AbortSignal after decode, between node evaluations, and around each Output encode so cancellation can stop before the next expensive stage. A source interrupted by cancellation is not recorded as a failed source.

## Output paths

Each Output produces a relative path from an optional ZIP folder plus a filename template. `normalizeOutputFolder()` rejects absolute and parent-traversal paths. `resolveUniqueOutputPath()` tracks every path generated during the batch and appends stable numeric suffixes rather than overwriting another output.

Output-folder safety is Consumer validation. It is combined with Core graph validation in the app shell so an unsafe path makes Run unavailable and can focus the offending Output node without teaching Core about ZIP paths.

## ZIP generation

v0.3 uses a small internal ZIP32 stored-entry writer. It emits local file headers, UTF-8 entry names, central-directory records, and EOCD. Entries are stored rather than deflated; image formats are already compressed, and this avoids adding another runtime dependency or network requirement.

The ZIP is built after processing when the user chooses **Save ZIP**, and the same local writer is also used when a saved Recipe with multiple outputs auto-downloads its completed results. Failed sources are not included; their error rows remain visible.

## Cancellation, partial failure, and release

Cancelling preserves already completed outputs and does not classify the currently interrupted source as a failure. A corrupt or otherwise unprocessable source produces a failed result while unrelated images continue. Batch result Blob references are released when results are cleared or replaced. Preview-cache eviction/clear explicitly releases the backing snapshot canvases. Core `RuntimeStatusStore` displays success/warning/error state without persisting runtime data into the graph.

## Build

`build-standalone.ps1` injects both the unchanged Core source and the Image Pipeline Consumer source into `src/index.template.html`, removes their ESM-only `export default` statements for browser embedding, then applies the standard Browser Kitty standalone checks.

No third-party runtime dependency is required in v1.0.0. Workflow persistence uses browser-local storage and the existing project code only.

## Mobile workspace

The desktop three-panel workspace remains the canonical editor layout. At `max-width: 600px`, the Consumer shell presents task-oriented Flow / Images / Node / Run pages using CSS/body state and Consumer-side selection helpers. The Core does not know about these pages.

The node palette becomes a Consumer-owned bottom sheet on mobile. Graph mutations still go through Node Editor Core public APIs. Mobile navigation, safe-area padding, dialog sizing, long-filename handling, keyboard Batch shortcut, and live-region announcements belong to the Consumer shell and do not alter persisted graph content.
