# Image Pipeline Builder v0.1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver v0.1.0 where one local JPEG/PNG/WebP can run through `Images → Resize → Output` using the supplied Node Editor Core and be previewed/saved fully locally.

**Architecture:** Keep the supplied Node Editor Core source unchanged. Add a testable domain module for image-node definitions, resize/output rules, then embed that module beside Core into a Browser Kitty standalone HTML consumer. Browser-only decode/render/encode stays in the consumer layer and uses Canvas 2D.

**Tech Stack:** HTML/CSS/JavaScript, Node.js built-in test runner, Node Editor Core v1.1.0+unreleased ZIP snapshot, PowerShell standalone/self-extract builder.

**Spec:** `docs/superpowers/specs/2026-09-18-image-pipeline-builder-v0.1.0-design.md`

## Global Constraints

- Use the user-provided `htmlapps-node-editor-core.zip` snapshot as the canonical Core source.
- Do not add image-specific branches to `src/core/node-editor-core.mjs`.
- Runtime image/file data stays local and is not serialized into Graph JSON.
- `connect-src 'none'`; no runtime CDN, external fonts, analytics, or telemetry.
- Japanese and English UI are required.
- Brand primary is `#16624F`; SVG icons, no emoji UI icons.
- Build readable standalone HTML and self-extract HTML.

---

### Task 1: Image consumer model and resize rules

**Files:**
- Create: `src/image-pipeline/image-pipeline.mjs`
- Create: `tests/image-pipeline.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `NodeEditorCore.NodeRegistry`, `createGraph`, `createEdge`.
- Produces: `createImageRegistry(Core)`, `createInitialImageGraph(Core, registry)`, `calculateResizeDimensions(input, settings)`, `normalizeOutputSettings(data)`, `outputExtension(format)`, `makeOutputFilename(sourceName, format)`.

- [ ] Write failing tests for image port definitions, the valid initial graph, aspect-preserving resize, no-upscale behavior, output settings, and filename extension.
- [ ] Run `node --test tests/image-pipeline.test.mjs` and confirm failure because the consumer module does not exist.
- [ ] Implement the minimum consumer module.
- [ ] Run `npm test` and confirm Core + consumer tests pass.

### Task 2: Standalone builder embeds the consumer module

**Files:**
- Modify: `build-standalone.ps1`
- Modify: `src/index.template.html`
- Modify: `scripts/check-repository.ps1`

**Interfaces:**
- Consumes: `src/image-pipeline/image-pipeline.mjs`.
- Produces: a browser global `globalThis.ImagePipeline` before app bootstrap runs.

- [ ] Write a failing repository/build test that requires exactly one `/* IMAGE_PIPELINE_SOURCE */` placeholder and rejects unresolved placeholders in output.
- [ ] Run the check and confirm failure.
- [ ] Extend the builder to strip the consumer module's `export default` and inject it exactly once.
- [ ] Run repository and standalone verification.

### Task 3: Browser Kitty app shell and Node Canvas consumer

**Files:**
- Modify: `app.config.json`
- Modify: `src/index.template.html`
- Modify: `assets/favicon.svg`

**Interfaces:**
- Consumes: `globalThis.NodeEditorCore`, `globalThis.ImagePipeline`.
- Produces: a three-pane consumer UI with Palette, Core NodeCanvas, Preview/Inspector, JA/EN switching, Canvas toolbar, help, toast, confirm dialog.

- [ ] Add structural tests/assertions for app name, the three node types, required UI anchors, and absence of harness/demo copy.
- [ ] Confirm the structural test fails on the Core harness HTML.
- [ ] Replace the harness page with the Image Pipeline Builder shell while preserving Core integration patterns.
- [ ] Run tests and build checks.

### Task 4: Local file decode, selected-node preview, resize and output encode

**Files:**
- Modify: `src/index.template.html`

**Interfaces:**
- `loadSourceFile(file)` accepts JPEG/PNG/WebP and keeps the `File` outside graph state.
- `renderPreviewTo(nodeId)` evaluates Images/Resize/Output on the current source.
- `encodeOutput()` returns `{ blob, filename, mime }` for the Output node settings.

- [ ] Add structural tests for file-type validation copy, preview state anchors, output-format controls, and save action.
- [ ] Confirm the tests fail before implementation.
- [ ] Implement picker/drop, decode fallback, resize Canvas 2D rendering, Output encoding, object URL cleanup, and save.
- [ ] Verify the preview changes after resize settings and output format/quality settings affect encoded output.

### Task 5: v0.1.0 polish, docs and release verification

**Files:**
- Modify: `README.md`
- Modify: `README.ja.md`
- Modify: `APP_SPEC.md`
- Modify: `CHANGELOG.md`
- Modify: `VERIFY_OFFLINE.md`
- Modify: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Produces: release documentation matching actual v0.1.0 behavior and limitations.

- [ ] Run `npm test`.
- [ ] Run PowerShell syntax preflight, repository check, standalone build, standalone verification, self-extract verification.
- [ ] Inspect generated HTML for `connect-src 'none'`, unresolved placeholders, external runtime URLs, and embedded Core/consumer source.
- [ ] Package the repository as `htmlapps-image-pipeline-builder-v0.1.0.zip`.
