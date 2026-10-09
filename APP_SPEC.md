# Image Pipeline Builder — APP_SPEC

## v1.0.2 — Icon normalization

- Canonical background and matching artwork green: `#16624f`; background x/y radii exactly 25% of their respective dimensions.
- Preserve artwork, padding, app behavior, and synchronized header/favicon/download/loader representations.

## 1. Product identity

- **Name:** Image Pipeline Builder
- **Japanese:** 画像処理パイプライン
- **Version:** 1.0.2
- **Repository:** `ttomohisa/htmlapps-image-pipeline-builder`
- **Purpose:** Connect image-processing steps as a visible graph, reuse the flow, and apply it to multiple local images entirely in the browser.

## 2. Product principle

The app is a reusable image-processing workflow builder, not a Photoshop-like editor and not a generative-AI graph. Its core value is visible processing, direct branches, multiple outputs, batch execution, intermediate preview, and reusable workflows.

```text
                  ┌→ Resize → Output /large
Images → Adjust ──┤
                  └→ Resize → Output /thumb
```

A dedicated Split node is not required. Templates expand into the same editable graph rather than hiding processing behind presets.

## 3. Canonical baselines

- Node Editor Core source: the exact user-provided `htmlapps-node-editor-core.zip` snapshot supplied on 2026-09-18.
- Canonical Core SHA-256: `4a128cc388ee53df6beeaf3a8edf7c8b0db5347479884cdf669806908c619897`.
- The snapshot reports Core v1.1.0 and also contains an Unreleased MiniMap translation fix.
- Do not replace the Core merely because another source has the same version label.
- Core remains domain-neutral. Image/workflow-specific code belongs in the Consumer.

## 4. Preserved processing scope

The v1.0.0 stable release preserves the complete v0.9.0 processing, Preview, Batch, branching, Recipe, cancellation, memory-cleanup, and mobile behavior:

Preserved v0.8.x UI/behavior requirements:

- PDF Pipeline Builder-style palette drag placement: desktop users can drag a node from the left palette and drop it at the intended Canvas position; click-to-add remains supported.
- Preview presentation must preserve the processed image aspect ratio regardless of Preview panel dimensions. The Canvas element itself is fitted to the available stage; it must not be independently stretched in width/height.
- **Use this Recipe** runs the Recipe and immediately downloads its successful result: one output downloads the image directly; multiple successful outputs download as a ZIP.
- Desktop left/right panels use a fixed 640 px editor height with internal scrolling, aligned with Data Pipeline Builder; small-screen layouts remain flexible.
- **Fit All** uses an inward-fit/frame icon that is visually distinct from the floating workspace expand icon.
- In the fixed desktop editor, the Canvas viewport must be allowed to shrink while the bottom Flow status row remains non-shrinking and fully visible.


- exactly one `Images` node; reusable Geometry / Appearance / Composition / Output nodes
- direct branching from one `image` output port to multiple downstream nodes
- Resize / Crop / Rotate / Flip / Canvas
- Adjust / Grayscale / Blur / Sharpen / Border / Rounded Corners / Text Watermark
- representative-image Before / After intermediate Preview with bounded LRU cache and stale-result rejection
- Output-specific format/quality/name/folder settings
- collision-safe paths and unsafe-folder rejection
- sequential multi-image Batch with progress, cancellation, partial failure, and successful-result retention
- local ZIP generation
- Japanese / English UI and the FFmpeg Filter Builder-aligned three-panel workspace

## 5. Recipe / Pipeline reuse requirements

- Current graph/settings are recovered from browser-local storage without storing image files.
- A **Recipe** is a named reusable Pipeline stored in this browser. It contains graph/settings only, never source images or generated outputs.
- Saved Recipes appear in a quick-access section above the workspace when at least one Recipe exists.
- A quick Recipe card accepts multiple JPEG / PNG / WebP images and offers two distinct actions:
  - **Use this Recipe** runs the saved Recipe against the selected images without replacing the current Canvas.
  - **Apply to Canvas** replaces the editable graph with the Recipe and loads the selected images for further editing.
- The Recipe library can register the current Pipeline, use a Recipe, export it directly as Pipeline JSON, update it from the current Pipeline, and delete it.
- **Export Pipeline JSON** opens a native, keyboard-accessible dialog with an editable filename derived from the Recipe name. It exports a validated snapshot of that saved Recipe using the existing version-1 envelope. The filename strips path/control/unsafe characters, handles reserved device names, bounds UTF-8 length and normalizes one `.image-pipeline.json` suffix. Empty names use `image-pipeline.image-pipeline.json`.
- Recipe export never applies the saved graph to Canvas or changes selection/history, source images, completed results, quick-Recipe staged images, current recovery, or Recipe storage. Cancel, Escape and backdrop dismissal produce no download. Export controls obey the existing Batch busy state.
- Recipe registration rejects an existing name after trimming and case folding; users choose a different name or the explicit Update action. Update and Delete name the affected Recipe in a localized confirmation dialog with cancellation, Escape/backdrop dismissal and focus restoration.
- Recipe add/update/delete first persist the candidate collection. On storage failure, the previous collection, staged images and entered name remain unchanged; a localized error replaces any success notice. A retry uses the same storage key, record shape and formatVersion 1.
- Quick Recipe and regular Batch execution share one owned job. Duplicate starts are ignored; all launch, staging and Recipe mutation controls remain disabled through cancellation/encoding and language changes. Late progress, ZIP preparation, completion and cleanup from a discarded job cannot affect a newer job.
- Cancel retains completed outputs, releases ownership only after the current job stops, and permits retry. Cancelled/failed runs never claim that the entire Recipe completed and downloaded.
- Portable JSON is a separate **Pipeline save/open** operation. Pipeline JSON continues to use the `image-pipeline-builder-workflow` envelope (`formatVersion: 1`) internally for backward compatibility.
- Pipeline imports are owned by their current selection. A newer import, graph edit/replacement (including Undo/Redo), source add/remove/clear, Batch start or pagehide invalidates older reads. Stale success, read/parse failure, notices, recovery writes and picker cleanup cannot overwrite newer work. A current invalid import preserves graph, sources, results and history; a valid one keeps the existing replacement/history-reset behavior.
- Five built-in templates remain separate from Recipes and expand into ordinary editable graph nodes: Web images, Main + thumbnail, Social square, Watermarked images, and Minimal flow.
- Image `File` objects, decoded pixels, Preview snapshots, Batch result Blobs, ZIP bytes, runtime status, quick-Recipe staged files, and current selection are never stored as Recipe/Pipeline data.

## 6. Preserved v0.8.0 Mobile / UX / Accessibility requirements

### Mobile navigation

At `max-width: 600px`, the app uses a fixed four-tab bottom navigation instead of vertically stacking the complete desktop workspace:

```text
[Flow] [Images] [Node] [Run]
```

- **Flow** shows the graph canvas and canvas controls.
- **Images** opens the Images-node inspector and source-image list.
- **Node** opens the last selected editable node together with its intermediate Preview and settings.
- **Run** shows Batch execution, progress, results, individual save actions, and ZIP save.
- The bottom navigation respects `env(safe-area-inset-bottom)` and page content has enough bottom padding that controls/results are not hidden behind it.
- Switching tabs must not mutate graph content or discard Preview/Batch state.

### Mobile node palette

- The desktop left palette remains unchanged on larger screens.
- On mobile, the palette opens from an explicit **Add node** button as a bottom sheet with backdrop.
- The sheet has a scrollable body, safe-area padding, 44 px minimum touch targets, and closes after a node is added.
- Adding `Images` moves to the Images page; adding/editing another node moves to the Node page.
- Escape/backdrop closes the sheet without changing the graph.

### Node discovery

- The palette includes a search field that filters visible node buttons only; searching never mutates graph data.
- Search considers the current localized label and node identity, so language switching does not strand the filter state.
- A clear-search action is keyboard and touch accessible.

### Keyboard and focus

- Existing Node Editor Core keyboard navigation, focus-visible styling, port activation, Undo/Redo, and Escape handling remain available.
- `Ctrl+Enter` / `Command+Enter` runs the Batch when focus is not inside a typing control and no modal dialog is open.
- The Batch run action exposes `aria-keyshortcuts="Control+Enter Meta+Enter"`.
- Progress and mobile page changes are announced through live regions without moving focus unexpectedly.
- Modal dialogs remain keyboard reachable and Escape closes them according to native `<dialog>` behavior / app handlers.

### Small-screen robustness

- At 390 px viewport width there is no page-level horizontal overflow.
- Long filenames wrap or truncate inside their own cards and never widen the page.
- Recipe/template/help dialogs are bounded by `100dvh`, scroll internally, and keep their close/header controls reachable.
- Fixed toasts are lifted above the bottom navigation.
- Floating graph workspace remains usable above the bottom navigation and safe areas.

## 7. Privacy and storage

- Input images, decoded pixels, Preview snapshots, Batch result Blobs, ZIP bytes, and image-processing buffers stay in the browser.
- Current-Pipeline recovery and Recipe storage contain only graph/settings metadata.
- `connect-src 'none'` remains required for standalone HTML.
- No CDN, analytics, telemetry, remote fonts, cloud image API, or automatic cloud storage.
- Output is newly encoded; source EXIF/GPS metadata is not intentionally copied.

## 8. Architecture boundary

### Node Editor Core owns

Graph model, NodeRegistry, ports/edges, validation, cycle detection, history, NodeCanvas, viewport, selection, connection/reconnect, MiniMap, helper lines, Grid Snap, clipboard primitives, accessibility primitives, runtime status store, translator/theme primitives, node-data migration, and view-state helpers.

### Image Pipeline Builder owns

Files/input list, image decode/encode, image-processing node definitions, graph evaluation, Preview policy/cache, Batch/ZIP/output state, Pipeline envelope/migration, browser-local current-Pipeline recovery, Recipe records/quick execution, built-in templates, Pipeline JSON import/export, Browser Kitty shell, mobile navigation/sheets, and downloads.

Core must not contain image node branches, MIME handling, Canvas image operations, File/Blob state, ZIP logic, Recipe names, application preset IDs, browser-storage keys, or Image Pipeline Builder mobile-layout state.

## 9. Desktop and mobile UI

- The header uses EN in Japanese and JA in English, with localized language/help accessible names and tooltips. Graph Zoom out / Zoom in controls also use localized accessible names and tooltips. Preserve Fully local processing / 完全ローカル処理 and the vMAJOR.MINOR.PATCH version badge.

Desktop keeps the FFmpeg Filter Builder-aligned integrated editor:

```text
Nodes | Flow Canvas | Node settings
```

- Left/right editor panels remain independently collapsible.
- Floating expansion expands the complete editor.
- Preview and Batch stay below the editor.
- Templates remain with Flow controls; Pipeline JSON and Recipe actions remain available from the execution/result area, while saved quick Recipes appear above the workspace.

Mobile uses the four task-oriented pages described above rather than stacking the complete desktop editor.

## 10. Explicit v1.0.0 non-goals

- Conditional/Rules nodes
- Subflows / macro nodes
- Cloud sync, accounts, or server sharing
- Storing/recovering source image files in browser storage
- Image watermark overlays
- Levels / Curves / LUT / color-profile conversion
- Background removal / AI upscale / smart crop
- AVIF
- Worker/OffscreenCanvas acceleration as a release requirement
- New processing-node categories beyond the v0.7.0 scope

## 11. Release acceptance for v1.0.1

- Canonical Core source remains byte-for-byte unchanged.
- Core + Consumer automated tests pass.
- Desktop three-panel collapse/floating behavior remains functional.
- Desktop palette drag-and-drop creates a node at the dropped Canvas location and click-to-add still works.
- Desktop Nodes / Node settings columns stay fixed to the editor height and scroll internally.
- Intermediate Preview preserves aspect ratio for square, portrait, and landscape results.
- Quick Recipe direct execution automatically downloads the completed image or ZIP.
- Mobile 390 px shows the fixed Flow / Images / Node / Run navigation with no page-level horizontal overflow.
- Mobile Flow opens the node palette as a bottom sheet and closes it without layout leakage.
- Images tab selects the Images context; Node tab restores an editable node with Preview/settings; Run tab exposes Batch/results.
- Long filenames and all dialogs stay within the viewport.
- Bottom navigation, floating workspace, toast, and safe-area padding do not overlap important controls.
- Palette search filters node choices without mutating graph data and remains usable in JA/EN.
- `Ctrl+Enter` / `Command+Enter` can start a valid Batch when the user is not typing in a form field.
- Batch progress/page changes have appropriate live-region semantics.
- Recipe register/use/update/delete, quick Recipe direct execution and Canvas application, template, Pipeline JSON save/open, Preview, branch, Batch, ZIP, and processing-node regression tests remain green.
- Runtime external requests are zero during tested operations.
- `connect-src 'none'`, no runtime external dependencies, and no unresolved standalone placeholders.
- Readable standalone and gzip self-extract outputs are generated and restore byte-for-byte.
- A 100-item Batch regression remains strictly sequential with a maximum active-item count of one.
- Cancellation raised during the current item is reported as cancellation rather than a failed image, and AbortSignal checkpoints exist between decode, graph stages, and Output encode.
- A 1→3 Output branch reuses its shared upstream result rather than recomputing it per Output.
- Preview-cache eviction/clear disposes snapshot backing stores; pagehide also clears Preview cache and Batch result references.
- Large stored-ZIP regression covers at least 300 entries including UTF-8 paths.
- README, changelog, architecture, privacy/offline docs, screenshots, and version metadata describe v1.0.1.

## 12. Roadmap

- **v0.3.0:** Branches / multiple outputs / naming / ZIP
- **v0.4.0:** Geometry nodes
- **v0.5.0:** Intermediate Preview / Before-After
- **v0.6.0:** Appearance / Composition
- **v0.7.0:** Workflow persistence / templates / JSON portability
- **v0.8.0:** Mobile / UX / Accessibility finish
- **v0.8.3:** PDF/Data Pipeline Builder-aligned shell, Recipe reuse/download, palette drag placement, fixed desktop side panels, and Preview aspect-fit fixes
- **v0.9.0:** Release candidate / performance / regression
- **v1.0.0:** Stable release

- **v1.0.1:** Consistent bilingual header controls.
